import test from 'node:test';
import assert from 'node:assert/strict';

import { E3D, E3DError } from '../dist/index.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function createClient(fetchImpl) {
  return new E3D({ fetchImpl });
}

test('quoteCredits posts only quote fields and returns a transfer-ready quote', async () => {
  const calls = [];
  const client = createClient(async (url, init) => {
    calls.push({ url, init });
    return jsonResponse({
      payment_options: [
        { id: 'eth-usdc', chain: 'ethereum', token: 'USDC', treasury_address: '0xabc' },
      ],
      required_we3d: '12.5',
      quote_meta: 'kept',
    });
  });

  const quote = await client.payments.quoteCredits({
    product: 'maps',
    wallet: ' 0xwallet ',
    requestedIssuedCredits: 3,
    promotionCode: ' SAVE10 ',
    paymentMethod: 'USDC',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://e3d.ai/api/payments/credits/quote');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    product: 'maps',
    wallet: '0xwallet',
    requestedIssuedCredits: 3,
    promotionCode: 'SAVE10',
  });
  assert.equal(quote.product, 'maps');
  assert.equal(quote.wallet, '0xwallet');
  assert.equal(quote.requestedIssuedCredits, 3);
  assert.equal(quote.payment.id, 'eth-usdc');
  assert.equal(quote.payment.requiredAmount, '12.5');
  assert.equal(quote.quoteMeta, 'kept');
});

test('purchaseCredits without a supplied quote performs quote, transfer, and purchase in order', async () => {
  const events = [];
  const client = createClient(async (url, init) => {
    events.push(url);
    if (url.endsWith('/quote')) {
      return jsonResponse({
        payment_options: [
          { id: 'base-usdc', chain: 'base', token: 'USDC', required_amount: '7.25' },
        ],
      });
    }
    assert.equal(url, 'https://e3d.ai/api/payments/credits/purchase');
    assert.deepEqual(JSON.parse(init.body), {
      product: 'maps',
      wallet: '0xwallet',
      txHash: '0xhash',
      promotionCode: 'promo',
      paymentMethod: 'base-usdc',
      paymentChain: 'base',
    });
    return jsonResponse({
      credit_key: 'e3d_maps_pay_123',
      issued_credits: 5,
      extra_value: 'kept',
    });
  });

  const transferCalls = [];
  const result = await client.payments.purchaseCredits({
    product: 'maps',
    wallet: '0xwallet',
    requestedIssuedCredits: 5,
    promotionCode: 'promo',
    paymentMethod: 'base-usdc',
    transfer: async (quote) => {
      transferCalls.push(quote);
      events.push('transfer');
      return ' 0xhash ';
    },
  });

  assert.deepEqual(events, [
    'https://e3d.ai/api/payments/credits/quote',
    'transfer',
    'https://e3d.ai/api/payments/credits/purchase',
  ]);
  assert.equal(transferCalls.length, 1);
  assert.equal(transferCalls[0].payment.requiredAmount, '7.25');
  assert.equal(result.creditKey, 'e3d_maps_pay_123');
  assert.equal(result.issuedCredits, 5);
  assert.equal(result.extraValue, 'kept');
});

test('purchaseCredits with a supplied quote skips quote and falls back to the selector when payment id is absent', async () => {
  const calls = [];
  const client = createClient(async (url, init) => {
    calls.push(url);
    assert.equal(url, 'https://e3d.ai/api/payments/credits/purchase');
    assert.deepEqual(JSON.parse(init.body), {
      product: 'maps',
      wallet: '0xwallet',
      txHash: '0xhash',
      paymentMethod: 'USDC',
      paymentChain: 'base',
    });
    return jsonResponse({ credit_key: 'e3d_maps_pay_456' });
  });

  const result = await client.payments.purchaseCredits({
    product: 'maps',
    wallet: '0xwallet',
    paymentMethod: 'USDC',
    quote: {
      product: 'maps',
      wallet: '0xwallet',
      requestedIssuedCredits: 2,
      payment: { chain: 'base', token: 'USDC', requiredAmount: '2.5' },
      paymentOptions: [{ chain: 'base', token: 'USDC', requiredAmount: '2.5' }],
      passthrough: true,
    },
    transfer: async (quote) => {
      assert.equal(quote.passthrough, true);
      return '0xhash';
    },
  });

  assert.deepEqual(calls, ['https://e3d.ai/api/payments/credits/purchase']);
  assert.equal(result.creditKey, 'e3d_maps_pay_456');
});

test('purchaseCredits stops before purchase on invalid transfer hashes and transfer rejections', async () => {
  const calls = [];
  const client = createClient(async (url) => {
    calls.push(url);
    return jsonResponse({
      payment: { id: 'eth-usdc', chain: 'ethereum', required_amount: '1' },
    });
  });

  await assert.rejects(
    client.payments.purchaseCredits({
      product: 'maps',
      wallet: '0xwallet',
      requestedIssuedCredits: 1,
      transfer: async () => '   ',
    }),
    (error) => error instanceof E3DError && error.code === 'BAD_REQUEST',
  );
  assert.deepEqual(calls, ['https://e3d.ai/api/payments/credits/quote']);

  await assert.rejects(
    client.payments.purchaseCredits({
      product: 'maps',
      wallet: '0xwallet',
      requestedIssuedCredits: 1,
      transfer: async () => {
        throw new Error('wallet failed');
      },
    }),
    /wallet failed/,
  );
  assert.deepEqual(calls, [
    'https://e3d.ai/api/payments/credits/quote',
    'https://e3d.ai/api/payments/credits/quote',
  ]);
});

test('quoteCredits rejects an unmatched payment selector before returning', async () => {
  const client = createClient(async () => jsonResponse({
    payment_options: [{ id: 'eth-usdc', token: 'USDC' }],
    required_e3d: '1',
  }));

  await assert.rejects(
    client.payments.quoteCredits({
      product: 'maps',
      wallet: '0xwallet',
      requestedIssuedCredits: 1,
      paymentMethod: 'SOL',
    }),
    (error) => error instanceof E3DError && error.code === 'BAD_REQUEST',
  );
});
