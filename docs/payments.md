# Payments Conversion Guide

This guide covers the E3D product-credit purchase flow implemented in this repository:

1. Request a quote from E3D.
2. Present the quoted transfer details for approval.
3. Execute the wallet transfer in caller-owned code.
4. Confirm the purchase with the resulting transaction hash.
5. Use the returned `creditKey` with the target product API.

The SDK never signs or broadcasts transactions for you. Wallet access, approval prompts, signing, and broadcasting stay entirely inside your callback or wallet integration.

## What Talks to E3D vs Your Wallet

- E3D:
  - `quoteCredits` / `quote_credits` / `QuoteCredits`
  - `purchaseCredits` / `purchase_credits` / `PurchaseCredits`
- Your wallet code:
  - Reviewing the selected destination, asset, amount, and chain with the user
  - Requesting approval for the irreversible transfer
  - Signing and broadcasting the transfer
  - Returning only the confirmed transaction hash to the SDK

Callers must send the exact quoted asset and amount to the quoted treasury on the quoted chain. Before submitting an irreversible transfer, present the destination, asset, amount, and chain to the user for approval.

## Quote Behavior

Quotes are advisory. They do not include a quote ID or server expiration, and they can become stale if rates or discounts change before the transfer is sent. If you need a fresh price, request a new quote before broadcasting.

The normalized quote returned by the SDK includes:

- `product`
- `wallet`
- `requestedIssuedCredits`
- `payment`
- optional `paymentOptions`

The selected `payment` is transfer-ready. If the service omits `payment.requiredAmount`, the SDK fills it from the top-level quoted amount when possible.

## Purchase Confirmation and Retries

Purchase confirmation is separate from the wallet transfer.

- Transfer retries are dangerous because they may create another on-chain payment.
- Purchase-confirmation retries are allowed when you already have a confirmed transaction hash.

If the transfer already succeeded on-chain but the confirmation request failed or timed out, retry purchase confirmation with the same confirmed `txHash`. Do not blindly initiate another transfer.

## Credit Key Lifecycle

The purchase response returns `creditKey`. This is a product payment key, not the SDK `apiKey` or `x-api-key` credential.

Use it as:

```http
Authorization: Bearer <creditKey>
```

Use that header only when calling the downstream product API that issued the credits. Do not replace the SDK client's configured API key with the returned `creditKey`.

## Environment Configuration

Use environment variables or your own secret-management layer for SDK credentials and wallet settings. Keep private keys, seed phrases, and signer configuration outside the SDK examples below.

- TypeScript:
  - `E3D_API_KEY`
  - your own wallet variables such as `WALLET_ADDRESS`
- Python:
  - `E3D_API_KEY`
  - `E3D_BASE_URL` and `E3D_API_KEY_HEADER` when needed
  - your own wallet variables such as `WALLET_ADDRESS`
- Go:
  - `E3D_API_KEY`
  - `E3D_BASE_URL`, `E3D_API_KEY_HEADER`, `E3D_TIMEOUT_MS` when needed
  - your own wallet variables such as `WALLET_ADDRESS`

## TypeScript

TypeScript keeps the transfer callback on the purchase input object.

```ts
import { E3D } from 'e3d-sdk';

const e3d = new E3D({
  apiKey: process.env.E3D_API_KEY,
});

const wallet = process.env.WALLET_ADDRESS ?? '<wallet-address>';

const quote = await e3d.payments.quoteCredits({
  product: 'maps',
  wallet,
  requestedIssuedCredits: 100,
});

console.log('Review before transfer:', {
  destination: quote.payment.treasuryAddress,
  asset: quote.payment.token,
  amount: quote.payment.requiredAmount,
  chain: quote.payment.chain,
});

const purchase = await e3d.payments.purchaseCredits({
  product: 'maps',
  wallet,
  requestedIssuedCredits: 100,
  quote,
  transfer: async (selectedQuote) => {
    console.log('Send the exact quoted transfer in wallet code:', {
      destination: selectedQuote.payment.treasuryAddress,
      asset: selectedQuote.payment.token,
      amount: selectedQuote.payment.requiredAmount,
      chain: selectedQuote.payment.chain,
    });

    // Sign and broadcast in your own wallet integration.
    return '<confirmed-transaction-hash>';
  },
});

console.log('creditKey:', purchase.creditKey);
```

## Python

Python passes the transfer callback as the second `purchase_credits` argument.

```python
import os

from e3d import E3DClient, PurchaseCreditsInput, QuoteCreditsInput

client = E3DClient(api_key=os.getenv("E3D_API_KEY"))
wallet = os.getenv("WALLET_ADDRESS", "<wallet-address>")

quote = client.payments.quote_credits(
    QuoteCreditsInput(
        product="maps",
        wallet=wallet,
        requested_issued_credits=100,
    )
)

print(
    "Review before transfer:",
    {
        "destination": quote.payment.treasury_address,
        "asset": quote.payment.token,
        "amount": quote.payment.required_amount,
        "chain": quote.payment.chain,
    },
)


def transfer(selected_quote):
    print(
        "Send the exact quoted transfer in wallet code:",
        {
            "destination": selected_quote.payment.treasury_address,
            "asset": selected_quote.payment.token,
            "amount": selected_quote.payment.required_amount,
            "chain": selected_quote.payment.chain,
        },
    )
    return "<confirmed-transaction-hash>"


purchase = client.payments.purchase_credits(
    PurchaseCreditsInput(
        product="maps",
        wallet=wallet,
        requested_issued_credits=100,
        quote=quote,
    ),
    transfer,
)

print("credit_key:", purchase.credit_key)
```

## Go

Go passes the transfer callback as the third `PurchaseCredits` argument.

```go
package main

import (
	"context"
	"fmt"
	"os"

	"github.com/spacepacket1/e3d-sdk/go/e3d"
)

func main() {
	client := e3d.New()
	wallet := os.Getenv("WALLET_ADDRESS")
	if wallet == "" {
		wallet = "<wallet-address>"
	}

	quote, err := client.Payments.QuoteCredits(context.Background(), e3d.QuoteCreditsRequest{
		Product:                "maps",
		Wallet:                 wallet,
		RequestedIssuedCredits: 100,
	})
	if err != nil {
		panic(err)
	}

	fmt.Println("Review before transfer:", map[string]interface{}{
		"destination": quote.Payment.TreasuryAddress,
		"asset":       quote.Payment.Token,
		"amount":      quote.Payment.RequiredAmount,
		"chain":       quote.Payment.Chain,
	})

	purchase, err := client.Payments.PurchaseCredits(
		context.Background(),
		e3d.PurchaseCreditsInput{
			Product:                "maps",
			Wallet:                 wallet,
			RequestedIssuedCredits: 100,
			Quote:                  &quote,
		},
		func(ctx context.Context, selectedQuote e3d.CreditQuote) (string, error) {
			fmt.Println("Send the exact quoted transfer in wallet code:", map[string]interface{}{
				"destination": selectedQuote.Payment.TreasuryAddress,
				"asset":       selectedQuote.Payment.Token,
				"amount":      selectedQuote.Payment.RequiredAmount,
				"chain":       selectedQuote.Payment.Chain,
			})

			return "<confirmed-transaction-hash>", nil
		},
	)
	if err != nil {
		panic(err)
	}

	fmt.Println("creditKey:", purchase.CreditKey)
}
```

## End-to-End Checklist

- Request a fresh quote close to the time you plan to transfer.
- Show the quoted destination, asset, amount, and chain before asking the user to approve.
- Send the exact quoted asset and amount to the quoted treasury on the quoted chain.
- Return only the resulting transaction hash from your callback.
- Retry purchase confirmation with the same confirmed hash if confirmation fails after a successful transfer.
- Use the returned `creditKey` as `Authorization: Bearer <creditKey>` for the product API that issued the credits.
