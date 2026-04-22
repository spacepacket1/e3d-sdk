# Examples

These examples are designed to be run after `npm run build`.

## Discovery

- `quick-start.mjs` - load `/openapi` and `/rate`
- `newsletter.mjs` - fetch the latest newsletter

## Tokens

- `token-profile.mjs` - fetch the composite token page bundle
- `token-prices.mjs` - fetch all-ranges token price history

## Stories and theses

- `stories.mjs` - list stories and fetch story addresses
- `theses.mjs` - list thesis records

## Token intelligence

- `token-intelligence.mjs` - fetch counterparties for a token

## Auth

- `auth.mjs` - list API keys

## Swap helpers

- `swap-quote-buy-e3d.mjs` - build a buy-side quote for E3D
- `swap-build-transaction.mjs` - build a raw swap transaction payload
- `swap-quote-sell-e3d.mjs` - build a sell-side quote for E3D

## Python examples

- `python/quick_start.py` - load `/openapi` and `/rate`
- `python/token_profile.py` - fetch a token profile bundle
- `python/stories.py` - list stories and fetch story addresses
- `python/swap_quote_buy.py` - build a local buy-side quote helper

## Go examples

- `go/quick_start` - load `/openapi` and `/rate`
- `go/token_profile` - fetch a token profile bundle
- `go/stories` - list stories and fetch story addresses
- `go/swap_quote_buy` - build a local buy-side quote helper

## Notes

- Swap examples are intentionally quote/build oriented so they are safer to inspect.
- Live execution should only be attempted with a real wallet provider and explicit user approval.
