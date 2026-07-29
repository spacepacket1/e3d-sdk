import assert from 'node:assert/strict';
import test from 'node:test';

import { E3D } from '../dist/index.js';

function createFetchStub(responses) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const response = responses.shift();
    if (!response) {
      throw new Error('Unexpected fetch call');
    }
    return response;
  };
  return { calls, fetchImpl };
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('webhook methods shape requests and normalize responses', async () => {
  const { calls, fetchImpl } = createFetchStub([
    jsonResponse({
      subscription: {
        id: 'sub_1',
        url: 'https://receiver.example/webhooks',
        events: ['story.created', 'thesis.corroborated'],
        filter: {
          token_addresses: ['0xabc'],
          pattern_ids: ['pattern_1'],
          thesis_ids: ['thesis_1'],
          min_corroborations: 2,
        },
        status: 'active',
        description: 'stories and theses',
        created_at: '2026-07-29T00:00:00.000Z',
        updated_at: '2026-07-29T00:00:00.000Z',
      },
      signing_secret: 'secret_1',
    }),
    jsonResponse({
      data: [
        {
          id: 'sub_1',
          url: 'https://receiver.example/webhooks',
          events: ['story.created'],
          filter: null,
          status: 'paused',
          description: null,
          created_at: '2026-07-29T00:00:00.000Z',
          updated_at: '2026-07-29T00:00:00.000Z',
        },
      ],
      next_cursor: 'cursor_2',
    }),
    jsonResponse({
      id: 'sub/2',
      url: 'https://receiver.example/webhooks',
      events: ['token.event'],
      filter: null,
      status: 'active',
      description: null,
      created_at: '2026-07-29T00:00:00.000Z',
      updated_at: '2026-07-29T00:00:00.000Z',
    }),
    jsonResponse({
      id: 'sub/2',
      url: 'https://receiver.example/new',
      events: ['token.event'],
      filter: null,
      status: 'disabled',
      description: null,
      created_at: '2026-07-29T00:00:00.000Z',
      updated_at: '2026-07-29T01:00:00.000Z',
    }),
    jsonResponse({
      subscription_id: 'sub/2',
      signing_secret: 'secret_2',
    }),
    new Response(null, { status: 204 }),
  ]);

  const e3d = new E3D({ fetchImpl });

  const created = await e3d.webhooks.create({
    url: 'https://receiver.example/webhooks',
    events: ['story.created', 'thesis.corroborated'],
    filter: {
      tokenAddresses: ['0xabc'],
      patternIds: ['pattern_1'],
      thesisIds: ['thesis_1'],
      minCorroborations: 2,
    },
    description: 'stories and theses',
  });

  assert.equal(created.signingSecret, 'secret_1');
  assert.equal('signingSecret' in created.subscription, false);
  assert.equal(created.subscription.createdAt, '2026-07-29T00:00:00.000Z');
  assert.deepEqual(created.subscription.filter, {
    tokenAddresses: ['0xabc'],
    patternIds: ['pattern_1'],
    thesisIds: ['thesis_1'],
    minCorroborations: 2,
  });

  const listed = await e3d.webhooks.list({ cursor: 'cursor_1', limit: 10, status: 'paused' });
  assert.equal(listed.nextCursor, 'cursor_2');
  assert.equal(listed.data[0].description, null);

  const fetched = await e3d.webhooks.getById('sub/2');
  assert.equal(fetched.id, 'sub/2');

  const updated = await e3d.webhooks.update('sub/2', {
    url: 'https://receiver.example/new',
    filter: null,
    description: null,
    status: 'disabled',
  });
  assert.equal(updated.status, 'disabled');

  const rotated = await e3d.webhooks.rotateSecret('sub/2');
  assert.equal(rotated.subscriptionId, 'sub/2');
  assert.equal(rotated.signingSecret, 'secret_2');

  await e3d.webhooks.delete('sub/2');

  assert.equal(calls.length, 6);
  assert.equal(calls[0].url, 'https://e3d.ai/api/webhooks/subscriptions');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    url: 'https://receiver.example/webhooks',
    events: ['story.created', 'thesis.corroborated'],
    filter: {
      token_addresses: ['0xabc'],
      pattern_ids: ['pattern_1'],
      thesis_ids: ['thesis_1'],
      min_corroborations: 2,
    },
    description: 'stories and theses',
  });
  assert.equal(calls[1].url, 'https://e3d.ai/api/webhooks/subscriptions?cursor=cursor_1&limit=10&status=paused');
  assert.equal(calls[1].init.method, 'GET');
  assert.equal(calls[2].url, 'https://e3d.ai/api/webhooks/subscriptions/sub%2F2');
  assert.equal(calls[2].init.method, 'GET');
  assert.equal(calls[3].url, 'https://e3d.ai/api/webhooks/subscriptions/sub%2F2');
  assert.equal(calls[3].init.method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[3].init.body), {
    url: 'https://receiver.example/new',
    filter: null,
    description: null,
    status: 'disabled',
  });
  assert.equal(calls[4].url, 'https://e3d.ai/api/webhooks/subscriptions/sub%2F2/rotate-secret');
  assert.equal(calls[4].init.method, 'POST');
  assert.equal(calls[5].url, 'https://e3d.ai/api/webhooks/subscriptions/sub%2F2');
  assert.equal(calls[5].init.method, 'DELETE');
  assert.equal(calls[5].init.body, undefined);
});

test('webhook validation rejects invalid inputs before request dispatch', async () => {
  let fetchCalls = 0;
  const e3d = new E3D({
    fetchImpl: async () => {
      fetchCalls += 1;
      return jsonResponse({});
    },
  });

  await assert.rejects(() => e3d.webhooks.create({ url: 'http://receiver.example', events: ['story.created'] }), {
    name: 'TypeError',
  });
  await assert.rejects(() => e3d.webhooks.create({ url: 'https://receiver.example', events: [] }), {
    name: 'TypeError',
  });
  await assert.rejects(() => e3d.webhooks.create({
    url: 'https://receiver.example',
    events: ['story.created'],
    filter: { minCorroborations: 0 },
  }), {
    name: 'RangeError',
  });
  await assert.rejects(() => e3d.webhooks.list({ limit: 0 }), {
    name: 'RangeError',
  });
  await assert.rejects(() => e3d.webhooks.update('sub_1', { filter: { minCorroborations: 0 } }), {
    name: 'RangeError',
  });
  await assert.rejects(() => e3d.webhooks.update('sub_1', { url: 'ftp://receiver.example' }), {
    name: 'TypeError',
  });

  assert.equal(fetchCalls, 0);
});
