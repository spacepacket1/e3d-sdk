---
run_id: impl-70cc89881b18-target-1-20260824152202
---

# Negotiation Log

## Round 1

### Draft Before Round

```text
# Embedded Payments SDK

## Overview

Add a consistent embedded credit-purchase workflow to the TypeScript, Python, and Go SDKs. The workflow obtains a credit quote, delegates the on-chain transfer to caller-controlled wallet code, submits the transaction proof to the E3D API, and returns the purchased bearer credential.

## Goals

- Expose credit quoting and purchasing through each SDK.
- Implement `e3d.payments.quoteCredits` and `e3d.payments.purchaseCredits` in TypeScript.
- Provide equivalent idiomatic Python and Go APIs.
- Keep private keys and transaction signing outside the SDK.
- Document an end-to-end purchase flow that leads directly to authenticated API use.
- Provide deterministic tests for the new Python and Go clients without live API or chain access.

## Non-Goals

- Custodying private keys, seed phrases, or wallet credentials.
- Implementing a wallet, signer, RPC provider, token approval flow, or transaction broadcaster.
- Polling for blockchain confirmations beyond the server-side purchase request.
- Changing payment-service endpoints or server behavior.
- Modifying the external `docs.e3d.ai` repository.
- Adding payment UI, checkout pages, subscriptions, refunds, or stored payment methods.
- Changing existing swap behavior or authentication defaults.
- Modifying examples, lockfiles, runner configuration, TypeScript configuration, or Claude configuration.

## Existing Files

- `src/client.ts` constructs the public TypeScript `E3D` client and its modules.
- `src/http.ts` provides normalized TypeScript HTTP requests, custom headers, timeout handling, and dependency-injected `fetch`.
- `src/index.ts` defines the TypeScript package exports.
- `src/types.ts` contains shared TypeScript request and response types.
- `python/e3d/client.py` provides a standard-library Python HTTP client.
- `python/e3d/__init__.py` defines the Python package exports.
- `README.md` is the package-level installation and usage guide.
- No publishable Go client package or root-owned payment module currently exists.

## Shared Constraints

- Use `POST /payments/credits/quote` and `POST /payments/credits/purchase`; the existing default base URL already contains `/api`, so SDK code must not duplicate that prefix.
- A quote request contains `credits` as a positive integer and `walletAddress` as a non-empty string. It may include `chainId` and `paymentToken` when supplied by the caller.
- A quote response must expose `quoteId`, `credits`, `walletAddress`, `chainId`, `paymentToken`, `recipient`, `amount`, and `expiresAt`, while preserving additional server response fields where the language permits.
- The transfer callback receives the complete quote and returns a non-empty transaction hash. The SDK must never ask for or accept a private key.
- A purchase request sent after transfer contains `quoteId`, `walletAddress`, and `transactionHash`.
- A purchase result must expose the returned bearer credential as `apiKey`, along with purchased credit and transaction metadata returned by the service. It must not automatically replace credentials on the existing client.
- Reject invalid credit counts, missing wallet addresses, missing quote identifiers, and empty transaction hashes before making the corresponding network request.
- Propagate transport, callback, and API errors without attempting a purchase after a failed transfer.
- Never log quote payloads, transaction proofs, or returned credentials.
- Tests must use injected or local fake transports and must not contact the live E3D API or a blockchain.
- Preserve existing public APIs and zero-dependency behavior for Python and Go.
- Keep the complete implementation within 25 changed files and 3000 changed lines.
- Do not modify `tsconfig.json`, `examples/**`, `package-lock.json`, `.codex-spec-runner/**`, `.claude/**`, or `.git/**`.

## Phase 1 - TypeScript Payments Module

<!-- runner:model=codex:gpt-5.4 -->
<!-- pilot:touches=src/payments.ts -->
<!-- pilot:touches=src/client.ts -->
<!-- pilot:touches=src/index.ts -->
<!-- pilot:touches=src/types.ts -->
<!-- runner:read=src/http.ts -->
<!-- runner:read=src/errors.ts -->
<!-- runner:verify=npm install && npm run typecheck -->

### Requirements

- Add public TypeScript interfaces for the quote request, normalized quote, transfer result, purchase input, purchase result, and asynchronous transfer callback.
- Add a `PaymentsModule` backed by the existing `HttpClient`.
- Implement `quoteCredits(input)` using `POST /payments/credits/quote`.
- Implement `purchaseCredits(input)` as the complete quote → caller transfer callback → purchase sequence.
- Permit `purchaseCredits` to consume a caller-supplied, previously obtained quote so callers can display and approve pricing without requesting a second quote.
- When no quote is supplied, obtain one using the purchase input before invoking the transfer callback.
- Validate inputs before side effects and validate the callback result before submitting the purchase request.
- Submit only the quote identifier, wallet address, and transaction hash to `POST /payments/credits/purchase`.
- Add `readonly payments` to `E3D` and initialize it with the same `HttpClient` as the other API-backed modules.
- Export the module and all public payment types from the package entry point.
- Do not change the existing HTTP normalization, authentication, swap, or error semantics.

### Acceptance Criteria

- `new E3D().payments.quoteCredits(...)` and `new E3D().payments.purchaseCredits(...)` are public and type-safe.
- `quoteCredits` issues exactly one request to the quote endpoint with the documented body.
- `purchaseCredits` without a supplied quote performs exactly one quote request, one transfer callback, and one purchase request in that order.
- `purchaseCredits` with a supplied quote skips the quote request.
- A rejected transfer callback or empty transaction hash prevents the purchase request.
- The returned purchase result exposes the server-provided bearer credential without mutating the client’s configured API key.
- Existing TypeScript consumers continue to typecheck.
- `npm install && npm run typecheck` succeeds.

## Phase 2 - Python Payments Module

<!-- runner:model=codex:gpt-5.4 -->
<!-- pilot:touches=python/e3d/payments.py -->
<!-- pilot:touches=python/e3d/client.py -->
<!-- pilot:touches=python/e3d/__init__.py -->
<!-- pilot:touches=python/tests/test_payments.py -->
<!-- runner:read=python/e3d/client.py -->
<!-- runner:read=python/e3d/__init__.py -->
<!-- runner:verify=python3 -m unittest discover -s python/tests -p 'test_*.py' -->
<!-- runner:verify=npm install && npm run typecheck -->

### Requirements

- Add a standard-library-only `PaymentsModule` exposed as `E3DClient.payments`.
- Provide idiomatic `quote_credits` and `purchase_credits` methods matching the shared request, validation, orchestration, and response contract.
- Accept a callable transfer handler that receives the complete quote and returns either a transaction-hash string or a mapping containing `transactionHash`.
- Allow `purchase_credits` to accept an existing quote and avoid issuing another quote request.
- Reuse `E3DClient.post` for both payment endpoints rather than introducing a second HTTP implementation.
- Export the payment module and its public typed structures from `python/e3d/__init__.py`.
- Avoid circular imports and ensure each `E3DClient` instance exposes a payments module bound to that same client.
- Add `unittest` coverage using a fake client transport for request bodies, call ordering, supplied-quote reuse, validation failures, transfer failures, and successful credential return.

### Acceptance Criteria

- `E3DClient().payments.quote_credits(...)` and `E3DClient().payments.purchase_credits(...)` are available without additional dependencies.
- Python performs the same endpoint calls and side-effect ordering as TypeScript.
- Invalid input and failed transfer callbacks cannot trigger the purchase endpoint.
- Supplying an existing quote results in no quote endpoint call.
- Tests assert that the returned API key remains data in the result and does not mutate `E3DClient.api_key`.
- `python3 -m unittest discover -s python/tests -p 'test_*.py'` succeeds.
- `npm install && npm run typecheck` remains successful.

## Phase 3 - Go SDK and Payments Service

<!-- runner:model=codex:gpt-5.4 -->
<!-- pilot:touches=go/go.mod -->
<!-- pilot:touches=go/e3d/*.go -->
<!-- runner:read=python/e3d/client.py -->
<!-- runner:read=src/payments.ts -->
<!-- runner:verify=cd go && go test ./... -->
<!-- runner:verify=npm install && npm run typecheck -->

### Requirements

- Create a publishable, standard-library-only Go module under `go/`, without changing the protected example Go module.
- Add an `e3d` package with a configurable `Client`, default E3D base URL, optional API key and header, timeout, injectable `http.Client`, and JSON request/error handling sufficient for payments.
- Expose a `Payments` service from `Client`.
- Define exported request, quote, transfer-result, and purchase-result types using JSON field names compatible with the shared wire contract.
- Implement `QuoteCredits(ctx, request)` and `PurchaseCredits(ctx, input, transferFunc)`.
- Represent the caller-controlled transfer as a context-aware function receiving the complete quote and returning a transaction hash or error.
- Allow purchase input to include a previously fetched quote and skip the quote endpoint when present.
- Validate inputs before network or transfer side effects and preserve the quote → transfer → purchase ordering.
- Return non-2xx API responses as errors containing status and safely decoded service details without including credentials.
- Add `httptest` coverage for paths, methods, request bodies, call ordering, validation, transfer failure, existing-quote reuse, server errors, and successful purchase results.

### Acceptance Criteria

- A Go consumer can construct a client and call `client.Payments.QuoteCredits` and `client.Payments.PurchaseCredits`.
- The Go implementation requires no third-party modules.
- Tests make no live network or blockchain calls.
- Invalid inputs and transfer errors prevent purchase submission.
- Existing quotes are reusable without another quote request.
- Successful results expose the bearer credential without storing it on the client.
- `cd go && go test ./...` succeeds.
- `npm install && npm run typecheck` remains successful.

## Phase 4 - Payments Conversion Guide

<!-- runner:model=codex:gpt-5.4 -->
<!-- pilot:touches=README.md -->
<!-- runner:read=src/payments.ts -->
<!-- runner:read=python/e3d/payments.py -->
<!-- runner:read=go/e3d/payments.go -->
<!-- runner:verify=npm install && npm run typecheck -->

### Requirements

- Add `payments` to the README module list.
- Add a Payments section explaining the quote → wallet transfer → purchase confirmation → authenticated client cycle.
- Provide concise, copyable TypeScript, Python, and Go examples using the APIs implemented in prior phases.
- Show environment-based credential and wallet configuration; use placeholders rather than real addresses, transaction hashes, or secrets.
- Make clear that the transfer callback must send the exact quoted asset and amount to the quoted recipient on the quoted chain.
- Show how to create a newly authenticated client from the returned API key rather than implying that the original client mutates.
- Warn callers to confirm quote expiry and present the quote for user approval before initiating an irreversible on-chain transfer.
- State that retrying purchase confirmation may reuse the same confirmed transaction only when permitted by the service, and that callers must not send a second transfer blindly.
- Keep existing quick-start and swap documentation intact.

### Acceptance Criteria

- The README contains discoverable payment guidance for all three supported languages.
- Every documented symbol and call signature matches the implemented public API.
- Examples keep transaction signing under caller control and do not expose private keys.
- Documentation distinguishes API confirmation retries from on-chain transfer retries.
- No protected example or external documentation file is modified.
- `npm install && npm run typecheck` succeeds.

```

### Reviewer 1: grok-build

Status: revise

Reason: The draft invents quoteId/walletAddress/transactionHash/apiKey; lock the live product/wallet/txHash/creditKey contract and language surfaces.

Replacement Spec:

```spec
# Embedded Payments SDK

## Overview

Add a chain-library-neutral payments module to the TypeScript, Python, and Go SDKs. The module exposes the existing credit-purchase lifecycle: request a quote, execute the quoted on-chain transfer through caller-controlled wallet code, submit the transaction hash to the purchase endpoint, and return the issued product payment credit key.

The SDK default base URL is `https://e3d.ai/api`. Call exactly `POST /payments/credits/quote` and `POST /payments/credits/purchase` so the resolved URLs are `https://e3d.ai/api/payments/credits/quote` and `https://e3d.ai/api/payments/credits/purchase`. Do not send an extra `/api` prefix on the path.

There is no server quote identifier and no quote expiration field. Do not invent `quoteId`, `purchaseId`, or `expiresAt`. Quotes are advisory price calculations; purchase re-validates the on-chain transfer.

The issued credential is a product payment credit key (`creditKey`, for example `e3d_maps_pay_...`). It is not the SDK `apiKey` / `x-api-key` and must not be installed onto the client.

Public SDK surfaces:

- TypeScript: `e3d.payments.quoteCredits(request)` and `e3d.payments.purchaseCredits(request)`
- Python: `client.payments.quote_credits(request)` and `client.payments.purchase_credits(request, transfer)`
- Go: `client.Payments.QuoteCredits(ctx, request)` and `client.Payments.PurchaseCredits(ctx, request, transfer)`

## Goals

- Expose credit quoting and purchasing through each SDK using the live payments HTTP contract.
- Implement `e3d.payments.quoteCredits` and `e3d.payments.purchaseCredits` in TypeScript.
- Provide equivalent idiomatic Python and Go APIs.
- Keep private keys and transaction signing outside the SDK.
- Let `purchaseCredits` reuse a caller-supplied quote so callers can display and approve pricing without requesting a second quote.
- Document an end-to-end purchase flow that leads to using the returned product credit key.
- Provide deterministic Python and Go tests without live API or chain access.

## Non-Goals

- Custodying private keys, seed phrases, or wallet credentials.
- Implementing a wallet, signer, RPC provider, token approval flow, or transaction broadcaster.
- Adding blockchain-library dependencies (ethers usage inside payments, web3.py, or a Go chain library).
- Polling for blockchain confirmations beyond the server-side purchase request.
- Changing payment-service endpoints or server behavior.
- Adding `Authorization: Bearer` handling or mutating the configured SDK API key.
- Modifying the external `docs.e3d.ai` repository.
- Adding payment UI, checkout pages, subscriptions, refunds, stored payment methods, balance reads, spend, or product catalogs.
- Changing existing swap behavior or authentication defaults.
- Adding a TypeScript test file under `src/` (`tsconfig.json` includes `src/**/*` and is protected).
- Modifying examples, lockfiles, runner configuration, TypeScript configuration, or Claude configuration.

## Existing Files

- `src/client.ts` constructs the public TypeScript `E3D` client and its modules (`DiscoveryModule`, `AuthModule`, and similar).
- `src/http.ts` provides normalized TypeScript HTTP requests, optional `x-api-key`, timeout handling, and dependency-injected `fetch`. Default base URL is `https://e3d.ai/api`.
- `src/index.ts` defines the TypeScript package exports. TypeScript imports/exports use `.js` suffixes.
- `src/types.ts` contains shared client options and does not need payment-specific types.
- `src/errors.ts` defines `E3DError` and HTTP error mapping. Do not modify this file.
- `src/normalize.ts` camelizes snake_case response keys.
- `python/e3d/client.py` is a transport-only dataclass client with `get`/`post` and no nested modules today.
- `python/e3d/__init__.py` defines the Python package exports.
- `README.md` is the package-level installation and usage guide.
- `package.json` provides `build` and `typecheck`. There is no TypeScript test runner.
- `pyproject.toml` packages modules under `python/` and records the GitHub repository as `https://github.com/spacepacket1/e3d-sdk`.
- No publishable Go client package currently exists; Go code under `examples/` is protected and must remain unchanged.

## Shared Constraints

- Keep the complete implementation within 25 changed files and 3000 changed lines.
- Do not modify `tsconfig.json`, `examples/**`, `package-lock.json`, `.codex-spec-runner/**`, `.claude/**`, or `.git/**`.
- Use only existing runtime dependencies for TypeScript and the standard library for Python and Go.
- Preserve existing public APIs and zero-dependency behavior for Python and Go.
- The live payments HTTP API is authoritative even though `GET /openapi` currently omits these routes. Do not block implementation, and do not guess alternate URLs.
- SDK HTTP paths are relative to the configured base URL. Use exactly `POST /payments/credits/quote` and `POST /payments/credits/purchase`.
- Reuse each language’s existing base-URL, HTTP, serialization, timeout, header, and error conventions. Omit empty optional fields from JSON bodies.
- Preserve existing `x-api-key` behavior. Quote and purchase must work when no API key is configured so a caller can buy a first credential. If a key is already configured, keep sending it with the existing header. Do not add `Authorization: Bearer`.
- Do not rename request or response fields on the wire. Public language APIs use idiomatic casing and map explicitly to the camelCase server names below.
- Never log quote payloads, transaction proofs, private keys, or returned credentials. Do not interpolate `creditKey` into exception messages.

### Wire contract

Quote request JSON may contain only:

- `product` (string, required)
- `wallet` (string, required)
- `requestedIssuedCredits` (positive integer, required)
- `promotionCode` (string, optional)

`paymentMethod` is client-side selection metadata and must not be sent to the quote endpoint.

Quote responses have no quote identifier and no expiration. A normalized quote exposed to callers and to the transfer callback must include:

- `product`, `wallet`, `requestedIssuedCredits`
- selected `payment` with `id`, `chain`, `network`, `chainId`, `token`, `tokenAddress`, `treasuryAddress`, `requiredAmount` when the server provides them
- `paymentOptions` when present
- remaining server fields retained as opaque passthrough (discounts, burn, `requiredE3D` / `requiredWE3D`, and unknown keys)

If selected `payment.requiredAmount` is missing, copy `requiredWE3D` or else `requiredE3D` onto that payment’s `requiredAmount` before invoking the transfer callback. If no amount can be resolved, reject the quote before transfer or purchase.

Purchase request JSON:

- `product` (string, required)
- `wallet` (string, required)
- `txHash` (string, required)
- `promotionCode` when the caller supplied a non-empty value
- `paymentMethod` and `paymentChain` from the selected payment when available: use the selected payment’s `id` as `paymentMethod`, falling back to the caller’s selector only if the selected payment has no `id`; use the selected payment’s `chain` as `paymentChain`

Do not send a quote identifier. Do not send `walletAddress`, `transactionHash`, `credits`, or `apiKey` on the wire.

Purchase result must expose the server `creditKey` plus purchased credit and transaction metadata returned by the service (`issuedCredits`, `baseCredits`, `paymentTxHash`, `usage`, and remaining server fields where the language permits). It must not automatically replace credentials on the existing client.

### Validation

- `product` and `wallet` must be non-empty strings after trim. Leave chain-specific address format checks to the backend.
- `requestedIssuedCredits` must be a finite integer `> 0`. In Python, `True`/`False` are not valid credit counts.
- `txHash` must be a non-empty string after trim. Reject missing, non-string, and whitespace-only hashes before the purchase POST.
- Reject invalid inputs before the corresponding network or transfer side effect.
- TypeScript client-side payment failures use existing `E3DError` helpers with code `BAD_REQUEST`. Do not modify `src/errors.ts`. Python uses `ValueError` for client-side validation and the existing `RuntimeError` HTTP failures. Go returns errors containing HTTP status and safely decoded service details without credentials.

### Payment selection

Apply this after a successful quote response (including a caller-supplied quote) and before the transfer callback:

- If `paymentMethod` is supplied, select the first `paymentOptions` entry whose `id`, `chain`, or `token` exactly equals that value.
- If `paymentMethod` is supplied but no option matches, reject after the quote is available and before transfer or purchase.
- If `paymentMethod` is omitted, preserve the server-selected `payment`.
- If the server omits `payment` and supplies non-empty `paymentOptions`, select the first option.
- If neither a selected `payment` nor a non-empty `paymentOptions` value exists, reject the malformed quote before invoking the transfer callback.
- Do not fail or suppress the quote HTTP request because of client-side selection.

### Orchestration

`purchaseCredits` / `purchase_credits` / `PurchaseCredits` must:

1. Validate the purchase input and require a transfer callback.
2. If no quote is supplied, obtain one with the same validation and quote-request body as the quote method. `requestedIssuedCredits` is required in this case.
3. If a quote is supplied, skip the quote HTTP request. The supplied quote must already contain the required normalized fields; still apply payment selection. `product` and `wallet` remain required on the purchase input for the purchase POST.
4. Invoke exactly one caller-provided transfer callback with the normalized quote (including selected `payment`).
5. Reject a missing or empty transaction hash before calling purchase.
6. POST the purchase JSON above.
7. Return the service response, including `creditKey`, without mutating client authentication.

The transfer callback receives the complete normalized quote and is solely responsible for wallet access, user approval, signing, broadcasting, and chain-specific dependencies. It returns only the transaction hash string (Go: hash plus error). Do not ask for or accept a private key.

Do not retry the transfer callback automatically. Do not retry quote or purchase in a way that could duplicate an on-chain transfer. Propagate transport, callback, and API errors without attempting a purchase after a failed transfer.

### Locked public names

TypeScript (`src/payments.ts`, re-exported from `src/index.ts`):

- `QuoteCreditsInput`: `{ product: string; wallet: string; requestedIssuedCredits: number; promotionCode?: string; paymentMethod?: string }`
- `CreditPayment`: `id?`, `chain`, `network?`, `chainId`, `token`, `tokenAddress`, `treasuryAddress`, `requiredAmount?`, plus remaining server payment fields
- `CreditQuote`: required quote fields above, selected `payment: CreditPayment`, optional `paymentOptions`, plus remaining server fields
- `TransferCallback`: `(quote: CreditQuote) => Promise<string>`
- `PurchaseCreditsInput`: `{ product: string; wallet: string; requestedIssuedCredits?: number; promotionCode?: string; paymentMethod?: string; quote?: CreditQuote; transfer: TransferCallback }`
- `PurchaseCreditsResult`: `{ creditKey: string }` plus remaining server purchase fields
- `PaymentsModule` class with `quoteCredits` and `purchaseCredits`; exposed as `readonly payments` on `E3D`

Python (`python/e3d/payments.py`, re-exported from `python/e3d/__init__.py`):

- Dataclasses `QuoteCreditsInput`, `CreditPayment`, `CreditQuote`, `PurchaseCreditsInput`, `PurchaseCreditsResult`
- Public fields are snake_case: `requested_issued_credits`, `promotion_code`, `payment_method`, `payment_options`, `token_address`, `treasury_address`, `chain_id`, `required_amount`, `credit_key`, `issued_credits`, `tx_hash`, `payment_tx_hash`, `payment_chain`
- Serialize those fields to the camelCase wire names above
- `PaymentsModule.quote_credits(request)` and `PaymentsModule.purchase_credits(request, transfer)`
- `transfer` is a synchronous callable `CreditQuote -> str`

Go (`github.com/spacepacket1/e3d-sdk/go/e3d`):

- `QuoteCreditsRequest`, `CreditPayment`, `CreditQuote`, `PurchaseCreditsInput`, `PurchaseCreditsResult`
- JSON tags matching the camelCase wire names
- `TransferFunc` is `func(ctx context.Context, quote CreditQuote) (txHash string, err error)`
- `QuoteCredits(ctx, request)` and `PurchaseCredits(ctx, input, transfer)`
- Exported struct fields are PascalCase (`Product`, `Wallet`, `RequestedIssuedCredits`, `PaymentMethod`, `CreditKey`, `TxHash`, and so on)

## Phase 1 - TypeScript Payments Module

<!-- runner:model=codex:gpt-5.4 -->
<!-- pilot:touches=src/payments.ts -->
<!-- pilot:touches=src/client.ts -->
<!-- pilot:touches=src/index.ts -->
<!-- runner:read=src/http.ts -->
<!-- runner:read=src/errors.ts -->
<!-- runner:read=src/types.ts -->
<!-- runner:read=src/normalize.ts -->
<!-- runner:verify=npm install && npm run typecheck -->

### Requirements

- Add public TypeScript types in `src/payments.ts` using the locked names. Do not add payment types to `src/types.ts`.
- Add a `PaymentsModule` backed by the existing `HttpClient`.
- Implement `quoteCredits(input)` using `POST /payments/credits/quote` with the documented body and payment selection.
- Implement `purchaseCredits(input)` as the complete quote (unless supplied) → caller transfer callback → purchase sequence.
- Put the required async transfer callback on the purchase input as `transfer`.
- Permit `purchaseCredits` to consume `input.quote` and skip the quote request.
- When no quote is supplied, obtain one using the purchase input before invoking the transfer callback.
- Validate inputs before side effects and validate the callback result before submitting the purchase request.
- Submit only `product`, `wallet`, `txHash`, and the optional purchase fields listed in Shared Constraints.
- Add `readonly payments` to `E3D` and initialize it with the same `HttpClient` as the other API-backed modules.
- Export the module and all public payment types from the package entry point using `.js` suffixes.
- Do not change the existing HTTP normalization, authentication, swap, or error semantics.
- Do not add `src/payments.test.ts` or any other file under `src/` that is not production library code.

### Acceptance Criteria

- `new E3D().payments.quoteCredits(...)` and `new E3D().payments.purchaseCredits(...)` are public and type-safe.
- `quoteCredits` issues exactly one request to the quote endpoint with the documented body and never includes `paymentMethod` in that body.
- `purchaseCredits` without a supplied quote performs exactly one quote request, one transfer callback, and one purchase request in that order.
- `purchaseCredits` with a supplied quote skips the quote request.
- A rejected transfer callback or empty transaction hash prevents the purchase request.
- The returned purchase result exposes `creditKey` without mutating the client’s configured API key.
- Existing TypeScript consumers continue to typecheck.
- `npm install && npm run typecheck` succeeds without modifying `package-lock.json`.

## Phase 2 - Python Payments Module

<!-- runner:model=codex:gpt-5.4 -->
<!-- pilot:touches=python/e3d/payments.py -->
<!-- pilot:touches=python/e3d/client.py -->
<!-- pilot:touches=python/e3d/__init__.py -->
<!-- pilot:touches=python/tests/test_payments.py -->
<!-- runner:read=python/e3d/client.py -->
<!-- runner:read=python/e3d/__init__.py -->
<!-- runner:verify=python3 -m unittest discover -s python/tests -p 'test_*.py' -->
<!-- runner:verify=npm install && npm run typecheck -->

### Requirements

- Add a standard-library-only `PaymentsModule` exposed as `E3DClient.payments`.
- Attach it without breaking the dataclass constructor: use an `init=False` field set in `__post_init__`; do not add a new required constructor argument.
- Provide idiomatic `quote_credits` and `purchase_credits` methods matching the shared request, validation, orchestration, and response contract.
- Accept a synchronous callable transfer handler as a separate `transfer` argument that receives the complete quote and returns a transaction-hash string.
- Allow `purchase_credits` to accept `request.quote` and avoid issuing another quote request.
- Reuse `E3DClient.post` for both payment endpoints rather than introducing a second HTTP implementation.
- Export the payment module and its public dataclasses from `python/e3d/__init__.py`.
- Avoid circular imports and ensure each `E3DClient` instance exposes a payments module bound to that same client.
- Use `from __future__ import annotations` and typing compatible with Python 3.8.
- Add `unittest` coverage using a subclassed or otherwise fake client transport for request bodies, camelCase wire keys, omission of `paymentMethod` from quote payloads, call ordering, supplied-quote reuse, validation failures, transfer failures, unmatched payment selection, and successful `credit_key` return.

### Acceptance Criteria

- `E3DClient().payments.quote_credits(...)` and `E3DClient().payments.purchase_credits(...)` are available without additional dependencies.
- Python performs the same endpoint calls, wire keys, and side-effect ordering as TypeScript.
- Invalid input and failed transfer callbacks cannot trigger the purchase endpoint.
- Supplying an existing quote results in no quote endpoint call.
- Tests assert that the returned `credit_key` remains data in the result and does not mutate `E3DClient.api_key`.
- `python3 -m unittest discover -s python/tests -p 'test_*.py'` succeeds.
- `npm install && npm run typecheck` remains successful.

## Phase 3 - Go SDK and Payments Service

<!-- runner:model=codex:gpt-5.4 -->
<!-- pilot:touches=go/go.mod -->
<!-- pilot:touches=go/e3d/*.go -->
<!-- runner:read=python/e3d/client.py -->
<!-- runner:read=src/payments.ts -->
<!-- runner:read=examples/go/go.mod -->
<!-- runner:verify=cd go && go test ./... -->
<!-- runner:verify=npm install && npm run typecheck -->

### Requirements

- Create a publishable, standard-library-only Go module under `go/` without changing the protected example Go module.
- Set `go/go.mod` module path to `github.com/spacepacket1/e3d-sdk/go` so consumers import `github.com/spacepacket1/e3d-sdk/go/e3d`. Use a Go 1.22 directive matching the example module.
- Add an `e3d` package with a configurable `Client`, default E3D base URL `https://e3d.ai/api`, optional API key sent as `x-api-key`, timeout, injectable `http.Client`, and JSON request/error handling sufficient for payments.
- Do not switch payments onto `Authorization: Bearer`.
- Expose a `Payments` service from `Client`.
- Define exported request, quote, payment, and purchase-result types using JSON field names compatible with the shared wire contract.
- Implement `QuoteCredits(ctx, request)` and `PurchaseCredits(ctx, input, transferFunc)`.
- Represent the caller-controlled transfer as a context-aware function receiving the complete quote and returning a transaction hash or error.
- Allow purchase input to include a previously fetched quote and skip the quote endpoint when present.
- Validate inputs before network or transfer side effects and preserve the quote → transfer → purchase ordering.
- If `ctx` is done before a step, skip that step and return the context error.
- Omit `paymentMethod` from the quote HTTP body; include selected `paymentMethod` and `paymentChain` on purchase when available.
- Return non-2xx API responses as errors containing status and safely decoded service details without including credentials.
- Add `httptest` coverage for paths, methods, camelCase request bodies, call ordering, validation, transfer failure, existing-quote reuse, unmatched payment selection, server errors, and successful purchase results that expose `creditKey` without storing it on the client.

### Acceptance Criteria

- A Go consumer can construct a client and call `client.Payments.QuoteCredits` and `client.Payments.PurchaseCredits`.
- The Go implementation requires no third-party modules.
- Tests make no live network or blockchain calls.
- Invalid inputs and transfer errors prevent purchase submission.
- Existing quotes are reusable without another quote request.
- Successful results expose `CreditKey` without storing it on the client.
- `cd go && go test ./...` succeeds.
- `npm install && npm run typecheck` remains successful.

## Phase 4 - Payments Conversion Guide

<!-- runner:model=codex:gpt-5.4 -->
<!-- pilot:touches=README.md -->
<!-- runner:read=src/payments.ts -->
<!-- runner:read=python/e3d/payments.py -->
<!-- runner:read=go/e3d/payments.go -->
<!-- runner:verify=npm install && npm run typecheck -->

### Requirements

- Add `payments` to the README module list.
- Add a Payments section explaining the quote → wallet transfer → purchase confirmation → product credit-key cycle.
- Provide concise, copyable TypeScript, Python, and Go examples using the APIs implemented in prior phases.
- Show environment-based credential and wallet configuration; use placeholders rather than real addresses, transaction hashes, or secrets.
- Make clear that the transfer callback must send the exact quoted asset and amount to the quoted treasury on the quoted chain.
- State that returned `creditKey` values are product payment keys (`Authorization: Bearer <creditKey>` for product APIs) and are not installed as the SDK `apiKey` / `x-api-key`. Do not show `new E3D({ apiKey: result.creditKey })` or the Python/Go equivalent.
- Warn callers to present the quoted destination, asset, amount, and chain for user approval before initiating an irreversible on-chain transfer. Quotes are advisory and have no server-provided expiration or quote id; rates and discounts can change.
- State that retrying purchase confirmation may reuse the same confirmed transaction hash, and that callers must not send a second transfer blindly.
- Keep existing quick-start and swap documentation intact.

### Acceptance Criteria

- The README contains discoverable payment guidance for all three supported languages.
- Every documented symbol and call signature matches the implemented public API.
- Examples keep transaction signing under caller control and do not expose private keys.
- Documentation distinguishes API confirmation retries from on-chain transfer retries.
- No protected example or external documentation file is modified.
- `npm install && npm run typecheck` succeeds.
```

Raw Response:

```text
I'll review the draft against the negotiate-loop format and the design-skill criteria, then return the required STATUS block.The user asked me to review this draft as the only source of truth, so I’ll inspect the spec-runner format and look for implementability gaps in the draft itself.I'll check the live payments contract and e3d-agent flow so the review isn't based on an invented quote/purchase shape.---STATUS---
status: revise
reason: The draft invents quoteId/walletAddress/transactionHash/apiKey; lock the live product/wallet/txHash/creditKey contract and language surfaces.
```spec
# Embedded Payments SDK

## Overview

Add a chain-library-neutral payments module to the TypeScript, Python, and Go SDKs. The module exposes the existing credit-purchase lifecycle: request a quote, execute the quoted on-chain transfer through caller-controlled wallet code, submit the transaction hash to the purchase endpoint, and return the issued product payment credit key.

The SDK default base URL is `https://e3d.ai/api`. Call exactly `POST /payments/credits/quote` and `POST /payments/credits/purchase` so the resolved URLs are `https://e3d.ai/api/payments/credits/quote` and `https://e3d.ai/api/payments/credits/purchase`. Do not send an extra `/api` prefix on the path.

There is no server quote identifier and no quote expiration field. Do not invent `quoteId`, `purchaseId`, or `expiresAt`. Quotes are advisory price calculations; purchase re-validates the on-chain transfer.

The issued credential is a product payment credit key (`creditKey`, for example `e3d_maps_pay_...`). It is not the SDK `apiKey` / `x-api-key` and must not be installed onto the client.

Public SDK surfaces:

- TypeScript: `e3d.payments.quoteCredits(request)` and `e3d.payments.purchaseCredits(request)`
- Python: `client.payments.quote_credits(request)` and `client.payments.purchase_credits(request, transfer)`
- Go: `client.Payments.QuoteCredits(ctx, request)` and `client.Payments.PurchaseCredits(ctx, request, transfer)`

## Goals

- Expose credit quoting and purchasing through each SDK using the live payments HTTP contract.
- Implement `e3d.payments.quoteCredits` and `e3d.payments.purchaseCredits` in TypeScript.
- Provide equivalent idiomatic Python and Go APIs.
- Keep private keys and transaction signing outside the SDK.
- Let `purchaseCredits` reuse a caller-supplied quote so callers can display and approve pricing without requesting a second quote.
- Document an end-to-end purchase flow that leads to using the returned product credit key.
- Provide deterministic Python and Go tests without live API or chain access.

## Non-Goals

- Custodying private keys, seed phrases, or wallet credentials.
- Implementing a wallet, signer, RPC provider, token approval flow, or transaction broadcaster.
- Adding blockchain-library dependencies (ethers usage inside payments, web3.py, or a Go chain library).
- Polling for blockchain confirmations beyond the server-side purchase request.
- Changing payment-service endpoints or server behavior.
- Adding `Authorization: Bearer` handling or mutating the configured SDK API key.
- Modifying the external `docs.e3d.ai` repository.
- Adding payment UI, checkout pages, subscriptions, refunds, stored payment methods, balance reads, spend, or product catalogs.
- Changing existing swap behavior or authentication defaults.
- Adding a TypeScript test file under `src/` (`tsconfig.json` includes `src/**/*` and is protected).
- Modifying examples, lockfiles, runner configuration, TypeScript configuration, or Claude configuration.

## Existing Files

- `src/client.ts` constructs the public TypeScript `E3D` client and its modules (`DiscoveryModule`, `AuthModule`, and similar).
- `src/http.ts` provides normalized TypeScript HTTP requests, optional `x-api-key`, timeout handling, and dependency-injected `fetch`. Default base URL is `https://e3d.ai/api`.
- `src/index.ts` defines the TypeScript package exports. TypeScript imports/exports use `.js` suffixes.
- `src/types.ts` contains shared client options and does not need payment-specific types.
- `src/errors.ts` defines `E3DError` and HTTP error mapping. Do not modify this file.
- `src/normalize.ts` camelizes snake_case response keys.
- `python/e3d/client.py` is a transport-only dataclass client with `get`/`post` and no nested modules today.
- `python/e3d/__init__.py` defines the Python package exports.
- `README.md` is the package-level installation and usage guide.
- `package.json` provides `build` and `typecheck`. There is no TypeScript test runner.
- `pyproject.toml` packages modules under `python/` and records the GitHub repository as `https://github.com/spacepacket1/e3d-sdk`.
- No publishable Go client package currently exists; Go code under `examples/` is protected and must remain unchanged.

## Shared Constraints

- Keep the complete implementation within 25 changed files and 3000 changed lines.
- Do not modify `tsconfig.json`, `examples/**`, `package-lock.json`, `.codex-spec-runner/**`, `.claude/**`, or `.git/**`.
- Use only existing runtime dependencies for TypeScript and the standard library for Python and Go.
- Preserve existing public APIs and zero-dependency behavior for Python and Go.
- The live payments HTTP API is authoritative even though `GET /openapi` currently omits these routes. Do not block implementation, and do not guess alternate URLs.
- SDK HTTP paths are relative to the configured base URL. Use exactly `POST /payments/credits/quote` and `POST /payments/credits/purchase`.
- Reuse each language’s existing base-URL, HTTP, serialization, timeout, header, and error conventions. Omit empty optional fields from JSON bodies.
- Preserve existing `x-api-key` behavior. Quote and purchase must work when no API key is configured so a caller can buy a first credential. If a key is already configured, keep sending it with the existing header. Do not add `Authorization: Bearer`.
- Do not rename request or response fields on the wire. Public language APIs use idiomatic casing and map explicitly to the camelCase server names below.
- Never log quote payloads, transaction proofs, private keys, or returned credentials. Do not interpolate `creditKey` into exception messages.

### Wire contract

Quote request JSON may contain only:

- `product` (string, required)
- `wallet` (string, required)
- `requestedIssuedCredits` (positive integer, required)
- `promotionCode` (string, optional)

`paymentMethod` is client-side selection metadata and must not be sent to the quote endpoint.

Quote responses have no quote identifier and no expiration. A normalized quote exposed to callers and to the transfer callback must include:

- `product`, `wallet`, `requestedIssuedCredits`
- selected `payment` with `id`, `chain`, `network`, `chainId`, `token`, `tokenAddress`, `treasuryAddress`, `requiredAmount` when the server provides them
- `paymentOptions` when present
- remaining server fields retained as opaque passthrough (discounts, burn, `requiredE3D` / `requiredWE3D`, and unknown keys)

If selected `payment.requiredAmount` is missing, copy `requiredWE3D` or else `requiredE3D` onto that payment’s `requiredAmount` before invoking the transfer callback. If no amount can be resolved, reject the quote before transfer or purchase.

Purchase request JSON:

- `product` (string, required)
- `wallet` (string, required)
- `txHash` (string, required)
- `promotionCode` when the caller supplied a non-empty value
- `paymentMethod` and `paymentChain` from the selected payment when available: use the selected payment’s `id` as `paymentMethod`, falling back to the caller’s selector only if the selected payment has no `id`; use the selected payment’s `chain` as `paymentChain`

Do not send a quote identifier. Do not send `walletAddress`, `transactionHash`, `credits`, or `apiKey` on the wire.

Purchase result must expose the server `creditKey` plus purchased credit and transaction metadata returned by the service (`issuedCredits`, `baseCredits`, `paymentTxHash`, `usage`, and remaining server fields where the language permits). It must not automatically replace credentials on the existing client.

### Validation

- `product` and `wallet` must be non-empty strings after trim. Leave chain-specific address format checks to the backend.
- `requestedIssuedCredits` must be a finite integer `> 0`. In Python, `True`/`False` are not valid credit counts.
- `txHash` must be a non-empty string after trim. Reject missing, non-string, and whitespace-only hashes before the purchase POST.
- Reject invalid inputs before the corresponding network or transfer side effect.
- TypeScript client-side payment failures use existing `E3DError` helpers with code `BAD_REQUEST`. Do not modify `src/errors.ts`. Python uses `ValueError` for client-side validation and the existing `RuntimeError` HTTP failures. Go returns errors containing HTTP status and safely decoded service details without credentials.

### Payment selection

Apply this after a successful quote response (including a caller-supplied quote) and before the transfer callback:

- If `paymentMethod` is supplied, select the first `paymentOptions` entry whose `id`, `chain`, or `token` exactly equals that value.
- If `paymentMethod` is supplied but no option matches, reject after the quote is available and before transfer or purchase.
- If `paymentMethod` is omitted, preserve the server-selected `payment`.
- If the server omits `payment` and supplies non-empty `paymentOptions`, select the first option.
- If neither a selected `payment` nor a non-empty `paymentOptions` value exists, reject the malformed quote before invoking the transfer callback.
- Do not fail or suppress the quote HTTP request because of client-side selection.

### Orchestration

`purchaseCredits` / `purchase_credits` / `PurchaseCredits` must:

1. Validate the purchase input and require a transfer callback.
2. If no quote is supplied, obtain one with the same validation and quote-request body as the quote method. `requestedIssuedCredits` is required in this case.
3. If a quote is supplied, skip the quote HTTP request. The supplied quote must already contain the required normalized fields; still apply payment selection. `product` and `wallet` remain required on the purchase input for the purchase POST.
4. Invoke exactly one caller-provided transfer callback with the normalized quote (including selected `payment`).
5. Reject a missing or empty transaction hash before calling purchase.
6. POST the purchase JSON above.
7. Return the service response, including `creditKey`, without mutating client authentication.

The transfer callback receives the complete normalized quote and is solely responsible for wallet access, user approval, signing, broadcasting, and chain-specific dependencies. It returns only the transaction hash string (Go: hash plus error). Do not ask for or accept a private key.

Do not retry the transfer callback automatically. Do not retry quote or purchase in a way that could duplicate an on-chain transfer. Propagate transport, callback, and API errors without attempting a purchase after a failed transfer.

### Locked public names

TypeScript (`src/payments.ts`, re-exported from `src/index.ts`):

- `QuoteCreditsInput`: `{ product: string; wallet: string; requestedIssuedCredits: number; promotionCode?: string; paymentMethod?: string }`
- `CreditPayment`: `id?`, `chain`, `network?`, `chainId`, `token`, `tokenAddress`, `treasuryAddress`, `requiredAmount?`, plus remaining server payment fields
- `CreditQuote`: required quote fields above, selected `payment: CreditPayment`, optional `paymentOptions`, plus remaining server fields
- `TransferCallback`: `(quote: CreditQuote) => Promise<string>`
- `PurchaseCreditsInput`: `{ product: string; wallet: string; requestedIssuedCredits?: number; promotionCode?: string; paymentMethod?: string; quote?: CreditQuote; transfer: TransferCallback }`
- `PurchaseCreditsResult`: `{ creditKey: string }` plus remaining server purchase fields
- `PaymentsModule` class with `quoteCredits` and `purchaseCredits`; exposed as `readonly payments` on `E3D`

Python (`python/e3d/payments.py`, re-exported from `python/e3d/__init__.py`):

- Dataclasses `QuoteCreditsInput`, `CreditPayment`, `CreditQuote`, `PurchaseCreditsInput`, `PurchaseCreditsResult`
- Public fields are snake_case: `requested_issued_credits`, `promotion_code`, `payment_method`, `payment_options`, `token_address`, `treasury_address`, `chain_id`, `required_amount`, `credit_key`, `issued_credits`, `tx_hash`, `payment_tx_hash`, `payment_chain`
- Serialize those fields to the camelCase wire names above
- `PaymentsModule.quote_credits(request)` and `PaymentsModule.purchase_credits(request, transfer)`
- `transfer` is a synchronous callable `CreditQuote -> str`

Go (`github.com/spacepacket1/e3d-sdk/go/e3d`):

- `QuoteCreditsRequest`, `CreditPayment`, `CreditQuote`, `PurchaseCreditsInput`, `PurchaseCreditsResult`
- JSON tags matching the camelCase wire names
- `TransferFunc` is `func(ctx context.Context, quote CreditQuote) (txHash string, err error)`
- `QuoteCredits(ctx, request)` and `PurchaseCredits(ctx, input, transfer)`
- Exported struct fields are PascalCase (`Product`, `Wallet`, `RequestedIssuedCredits`, `PaymentMethod`, `CreditKey`, `TxHash`, and so on)

## Phase 1 - TypeScript Payments Module

<!-- runner:model=codex:gpt-5.4 -->
<!-- pilot:touches=src/payments.ts -->
<!-- pilot:touches=src/client.ts -->
<!-- pilot:touches=src/index.ts -->
<!-- runner:read=src/http.ts -->
<!-- runner:read=src/errors.ts -->
<!-- runner:read=src/types.ts -->
<!-- runner:read=src/normalize.ts -->
<!-- runner:verify=npm install && npm run typecheck -->

### Requirements

- Add public TypeScript types in `src/payments.ts` using the locked names. Do not add payment types to `src/types.ts`.
- Add a `PaymentsModule` backed by the existing `HttpClient`.
- Implement `quoteCredits(input)` using `POST /payments/credits/quote` with the documented body and payment selection.
- Implement `purchaseCredits(input)` as the complete quote (unless supplied) → caller transfer callback → purchase sequence.
- Put the required async transfer callback on the purchase input as `transfer`.
- Permit `purchaseCredits` to consume `input.quote` and skip the quote request.
- When no quote is supplied, obtain one using the purchase input before invoking the transfer callback.
- Validate inputs before side effects and validate the callback result before submitting the purchase request.
- Submit only `product`, `wallet`, `txHash`, and the optional purchase fields listed in Shared Constraints.
- Add `readonly payments` to `E3D` and initialize it with the same `HttpClient` as the other API-backed modules.
- Export the module and all public payment types from the package entry point using `.js` suffixes.
- Do not change the existing HTTP normalization, authentication, swap, or error semantics.
- Do not add `src/payments.test.ts` or any other file under `src/` that is not production library code.

### Acceptance Criteria

- `new E3D().payments.quoteCredits(...)` and `new E3D().payments.purchaseCredits(...)` are public and type-safe.
- `quoteCredits` issues exactly one request to the quote endpoint with the documented body and never includes `paymentMethod` in that body.
- `purchaseCredits` without a supplied quote performs exactly one quote request, one transfer callback, and one purchase request in that order.
- `purchaseCredits` with a supplied quote skips the quote request.
- A rejected transfer callback or empty transaction hash prevents the purchase request.
- The returned purchase result exposes `creditKey` without mutating the client’s configured API key.
- Existing TypeScript consumers continue to typecheck.
- `npm install && npm run typecheck` succeeds without modifying `package-lock.json`.

## Phase 2 - Python Payments Module

<!-- runner:model=codex:gpt-5.4 -->
<!-- pilot:touches=python/e3d/payments.py -->
<!-- pilot:touches=python/e3d/client.py -->
<!-- pilot:touches=python/e3d/__init__.py -->
<!-- pilot:touches=python/tests/test_payments.py -->
<!-- runner:read=python/e3d/client.py -->
<!-- runner:read=python/e3d/__init__.py -->
<!-- runner:verify=python3 -m unittest discover -s python/tests -p 'test_*.py' -->
<!-- runner:verify=npm install && npm run typecheck -->

### Requirements

- Add a standard-library-only `PaymentsModule` exposed as `E3DClient.payments`.
- Attach it without breaking the dataclass constructor: use an `init=False` field set in `__post_init__`; do not add a new required constructor argument.
- Provide idiomatic `quote_credits` and `purchase_credits` methods matching the shared request, validation, orchestration, and response contract.
- Accept a synchronous callable transfer handler as a separate `transfer` argument that receives the complete quote and returns a transaction-hash string.
- Allow `purchase_credits` to accept `request.quote` and avoid issuing another quote request.
- Reuse `E3DClient.post` for both payment endpoints rather than introducing a second HTTP implementation.
- Export the payment module and its public dataclasses from `python/e3d/__init__.py`.
- Avoid circular imports and ensure each `E3DClient` instance exposes a payments module bound to that same client.
- Use `from __future__ import annotations` and typing compatible with Python 3.8.
- Add `unittest` coverage using a subclassed or otherwise fake client transport for request bodies, camelCase wire keys, omission of `paymentMethod` from quote payloads, call ordering, supplied-quote reuse, validation failures, transfer failures, unmatched payment selection, and successful `credit_key` return.

### Acceptance Criteria

- `E3DClient().payments.quote_credits(...)` and `E3DClient().payments.purchase_credits(...)` are available without additional dependencies.
- Python performs the same endpoint calls, wire keys, and side-effect ordering as TypeScript.
- Invalid input and failed transfer callbacks cannot trigger the purchase endpoint.
- Supplying an existing quote results in no quote endpoint call.
- Tests assert that the returned `credit_key` remains data in the result and does not mutate `E3DClient.api_key`.
- `python3 -m unittest discover -s python/tests -p 'test_*.py'` succeeds.
- `npm install && npm run typecheck` remains successful.

## Phase 3 - Go SDK and Payments Service

<!-- runner:model=codex:gpt-5.4 -->
<!-- pilot:touches=go/go.mod -->
<!-- pilot:touches=go/e3d/*.go -->
<!-- runner:read=python/e3d/client.py -->
<!-- runner:read=src/payments.ts -->
<!-- runner:read=examples/go/go.mod -->
<!-- runner:verify=cd go && go test ./... -->
<!-- runner:verify=npm install && npm run typecheck -->

### Requirements

- Create a publishable, standard-library-only Go module under `go/` without changing the protected example Go module.
- Set `go/go.mod` module path to `github.com/spacepacket1/e3d-sdk/go` so consumers import `github.com/spacepacket1/e3d-sdk/go/e3d`. Use a Go 1.22 directive matching the example module.
- Add an `e3d` package with a configurable `Client`, default E3D base URL `https://e3d.ai/api`, optional API key sent as `x-api-key`, timeout, injectable `http.Client`, and JSON request/error handling sufficient for payments.
- Do not switch payments onto `Authorization: Bearer`.
- Expose a `Payments` service from `Client`.
- Define exported request, quote, payment, and purchase-result types using JSON field names compatible with the shared wire contract.
- Implement `QuoteCredits(ctx, request)` and `PurchaseCredits(ctx, input, transferFunc)`.
- Represent the caller-controlled transfer as a context-aware function receiving the complete quote and returning a transaction hash or error.
- Allow purchase input to include a previously fetched quote and skip the quote endpoint when present.
- Validate inputs before network or transfer side effects and preserve the quote → transfer → purchase ordering.
- If `ctx` is done before a step, skip that step and return the context error.
- Omit `paymentMethod` from the quote HTTP body; include selected `paymentMethod` and `paymentChain` on purchase when available.
- Return non-2xx API responses as errors containing status and safely decoded service details without including credentials.
- Add `httptest` coverage for paths, methods, camelCase request bodies, call ordering, validation, transfer failure, existing-quote reuse, unmatched payment selection, server errors, and successful purchase results that expose `creditKey` without storing it on the client.

### Acceptance Criteria

- A Go consumer can construct a client and call `client.Payments.QuoteCredits` and `client.Payments.PurchaseCredits`.
- The Go implementation requires no third-party modules.
- Tests make no live network or blockchain calls.
- Invalid inputs and transfer errors prevent purchase submission.
- Existing quotes are reusable without another quote request.
- Successful results expose `CreditKey` without storing it on the client.
- `cd go && go test ./...` succeeds.
- `npm install && npm run typecheck` remains successful.

## Phase 4 - Payments Conversion Guide

<!-- runner:model=codex:gpt-5.4 -->
<!-- pilot:touches=README.md -->
<!-- runner:read=src/payments.ts -->
<!-- runner:read=python/e3d/payments.py -->
<!-- runner:read=go/e3d/payments.go -->
<!-- runner:verify=npm install && npm run typecheck -->

### Requirements

- Add `payments` to the README module list.
- Add a Payments section explaining the quote → wallet transfer → purchase confirmation → product credit-key cycle.
- Provide concise, copyable TypeScript, Python, and Go examples using the APIs implemented in prior phases.
- Show environment-based credential and wallet configuration; use placeholders rather than real addresses, transaction hashes, or secrets.
- Make clear that the transfer callback must send the exact quoted asset and amount to the quoted treasury on the quoted chain.
- State that returned `creditKey` values are product payment keys (`Authorization: Bearer <creditKey>` for product APIs) and are not installed as the SDK `apiKey` / `x-api-key`. Do not show `new E3D({ apiKey: result.creditKey })` or the Python/Go equivalent.
- Warn callers to present the quoted destination, asset, amount, and chain for user approval before initiating an irreversible on-chain transfer. Quotes are advisory and have no server-provided expiration or quote id; rates and discounts can change.
- State that retrying purchase confirmation may reuse the same confirmed transaction hash, and that callers must not send a second transfer blindly.
- Keep existing quick-start and swap documentation intact.

### Acceptance Criteria

- The README contains discoverable payment guidance for all three supported languages.
- Every documented symbol and call signature matches the implemented public API.
- Examples keep transaction signing under caller control and do not expose private keys.
- Documentation distinguishes API confirmation retries from on-chain transfer retries.
- No protected example or external documentation file is modified.
- `npm install && npm run typecheck` succeeds.
```
```

### Reviewer 2: claude

Status: approved

Reason: Spec is internally consistent and its claims about existing files, patterns, and conventions check out against the actual repo state.

Raw Response:

```text
This confirms the pattern the Go phase should follow (base URL, API key header, timeout, injectable http.Client) matches spec claims. Everything checks out consistently against the actual repo state — file existence, module patterns, error/validation conventions, and wire-format assumptions all match what the draft asserts.

The spec is internally consistent, grounded in the actual codebase, and each phase's requirements/acceptance criteria/verify commands align with the shared constraints and wire contract.

---STATUS---
status: approved
reason: Spec is internally consistent and its claims about existing files, patterns, and conventions check out against the actual repo state.
```

### Reviewer 3: codex

Status: revise

Reason: The draft leaves unknown-field passthrough undefined for Python and Go and contradicts itself about which CreditPayment fields are optional.

Replacement Spec:

```spec
# Embedded Payments SDK

## Overview

Add a chain-library-neutral payments module to the TypeScript, Python, and Go SDKs. The module exposes the existing credit-purchase lifecycle: request a quote, execute the quoted on-chain transfer through caller-controlled wallet code, submit the transaction hash, and return the issued product payment credit key.

The default base URL is `https://e3d.ai/api`. Use exactly:

- `POST /payments/credits/quote`
- `POST /payments/credits/purchase`

Do not add another `/api` prefix.

Quotes have no server quote identifier or expiration field. Do not invent `quoteId`, `purchaseId`, or `expiresAt`. A quote is advisory; purchase re-validates the on-chain transfer.

The returned `creditKey` is a product payment credit key such as `e3d_maps_pay_...`. It is not the SDK `apiKey` or `x-api-key` credential and must not be installed on the client.

Public entry points:

- TypeScript: `e3d.payments.quoteCredits(request)` and `e3d.payments.purchaseCredits(request)`
- Python: `client.payments.quote_credits(request)` and `client.payments.purchase_credits(request, transfer)`
- Go: `client.Payments.QuoteCredits(ctx, request)` and `client.Payments.PurchaseCredits(ctx, request, transfer)`

## Goals

- Expose the live credit quote and purchase lifecycle in all three SDKs.
- Keep wallet access, approval, signing, and broadcasting outside the SDK.
- Allow purchase methods to reuse a caller-supplied normalized quote.
- Preserve useful server response metadata, including unknown fields.
- Document an end-to-end flow that ends with a product payment credit key.
- Provide deterministic Python and Go tests without live API or chain access.

## Non-Goals

- Custodying private keys, seed phrases, or wallet credentials.
- Implementing wallets, signers, RPC providers, approvals, or transaction broadcasters.
- Adding ethers, web3.py, Go chain libraries, or other blockchain dependencies.
- Polling for blockchain confirmations.
- Changing payment-service endpoints or server behavior.
- Adding `Authorization: Bearer` to SDK payment requests.
- Mutating the configured SDK API key.
- Modifying the external `docs.e3d.ai` repository.
- Adding checkout UI, subscriptions, refunds, stored payment methods, balance reads, spend operations, or product catalogs.
- Changing swap behavior or existing authentication defaults.
- Adding TypeScript tests under `src/`.
- Modifying examples, lockfiles, runner configuration, TypeScript configuration, or Claude configuration.

## Existing Files

- `src/client.ts` constructs the public TypeScript `E3D` client and its modules.
- `src/http.ts` provides normalized requests, optional `x-api-key`, timeout handling, and injected `fetch`. Its default base URL is `https://e3d.ai/api`.
- `src/index.ts` defines package exports. TypeScript imports and exports use `.js` suffixes.
- `src/types.ts` contains shared client options and must not receive payment-specific types.
- `src/errors.ts` defines `E3DError` and HTTP error mapping and must not be modified.
- `src/normalize.ts` camelizes snake_case response keys.
- `python/e3d/client.py` is a transport-only dataclass client with `get` and `post`.
- `python/e3d/__init__.py` defines Python package exports.
- `README.md` is the package installation and usage guide.
- `package.json` provides `build` and `typecheck`; there is no TypeScript test runner.
- `pyproject.toml` packages modules under `python/`.
- No publishable Go client package currently exists. Go code under `examples/` is protected.

## Shared Constraints

- Keep the implementation within 25 changed files and 3000 changed lines.
- Do not modify `tsconfig.json`, `examples/**`, `package-lock.json`, `.codex-spec-runner/**`, `.claude/**`, or `.git/**`.
- Use only existing TypeScript runtime dependencies and the standard library for Python and Go.
- Preserve existing public APIs and zero-dependency behavior for Python and Go.
- Treat the live payments HTTP API as authoritative even though `GET /openapi` omits these routes.
- Use paths relative to the configured base URL.
- Reuse each language's existing or newly specified base-URL, HTTP, JSON, timeout, header, and error conventions.
- Omit empty optional fields from request bodies.
- Preserve existing `x-api-key` behavior. Payments must work without a configured API key; if one is configured, continue sending it as `x-api-key`.
- Do not add `Authorization: Bearer` to SDK payment requests.
- Public APIs use idiomatic language casing and explicitly map to the camelCase wire names.
- Never log quote payloads, transaction proofs, private keys, or returned credentials.
- Never include a returned `creditKey` in a client-generated exception message.
- Do not retry transfer callbacks automatically.
- Do not retry quote or purchase requests in a way that could cause another on-chain transfer.
- Propagate transport, callback, and API errors and never call purchase after a failed transfer.

## Wire Contract

### Quote Request

The quote JSON body may contain only:

- `product`: required string
- `wallet`: required string
- `requestedIssuedCredits`: required positive integer
- `promotionCode`: optional non-empty string

`paymentMethod` is client-side selection metadata and must never be sent to the quote endpoint.

### Quote Normalization

Construct the normalized quote by starting with all server response fields, then ensuring these fields are populated from the validated request when the response omits them:

- `product`
- `wallet`
- `requestedIssuedCredits`

A normalized quote contains:

- required `product`, `wallet`, and `requestedIssuedCredits`
- required selected `payment`
- optional `paymentOptions`
- all other server quote fields

Each payment object can contain:

- optional `id`
- optional `chain`
- optional `network`
- optional `chainId`
- optional `token`
- optional `tokenAddress`
- optional `treasuryAddress`
- optional `requiredAmount`
- any other server payment fields

Fields other than `requiredAmount` must not be fabricated. If selected `payment.requiredAmount` is absent or empty, copy the top-level `requiredWE3D`, or otherwise `requiredE3D`, to `payment.requiredAmount`. Reject the quote before transfer or purchase if no non-empty amount can be resolved.

Unknown fields must remain available to callers as follows:

- TypeScript: retain unknown quote, payment, and purchase-result properties directly through string index signatures.
- Python: retain unknown properties in an `extra: Dict[str, Any]` field on `CreditQuote`, `CreditPayment`, and `PurchaseCreditsResult`. Known fields must not also appear in `extra`.
- Go: retain unknown properties in an exported `Extra map[string]interface{} ` field with `json:"-"` on `CreditQuote`, `CreditPayment`, and `PurchaseCreditsResult`, using custom JSON unmarshalling where necessary. Known fields must not also appear in `Extra`.

Unknown fields are response passthrough only and must not be copied into quote or purchase request bodies.

### Purchase Request

The purchase JSON body contains:

- `product`: required string
- `wallet`: required string
- `txHash`: required string
- `promotionCode`: only when the caller supplied a non-empty value
- `paymentMethod`: selected payment `id`, falling back to the caller's selector only when the selected payment has no non-empty `id`
- `paymentChain`: selected payment `chain`, when non-empty

Do not send quote identifiers. Do not send `walletAddress`, `transactionHash`, `credits`, `requestedIssuedCredits`, unknown response fields, or `apiKey`.

### Purchase Result

Expose:

- required `creditKey`
- optional returned metadata such as `issuedCredits`, `baseCredits`, `paymentTxHash`, and `usage`
- remaining server purchase fields using the language-specific unknown-field representation above

Do not install `creditKey` on the client.

## Validation

Perform validation before the corresponding network or transfer side effect:

- `product` and `wallet` must be strings that remain non-empty after trimming.
- `requestedIssuedCredits` must be a finite integer greater than zero.
- Python must reject `True` and `False` as credit counts.
- `promotionCode`, when included on the wire, must be a string that remains non-empty after trimming; omit `None`, missing, and whitespace-only values.
- `paymentMethod`, when provided, must be a string. Treat a whitespace-only selector as invalid rather than silently omitting it.
- A transfer callback is required and must be callable or non-nil as appropriate.
- The returned `txHash` must be a string that remains non-empty after trimming.
- Reject missing, non-string, or whitespace-only transaction hashes before purchase.
- Do not perform chain-specific address or hash-format validation.

For a supplied quote:

- Require non-empty `product` and `wallet`, a positive integral `requestedIssuedCredits`, and a payment that can be selected and assigned a required amount.
- Require supplied quote `product` and `wallet` to equal the validated purchase input values after trimming.
- If purchase input includes `requestedIssuedCredits`, require it to equal the supplied quote value.
- Reapply payment selection using the purchase input's `paymentMethod`.
- Reject mismatches before invoking transfer.

Error conventions:

- TypeScript validation failures use existing `E3DError` helpers with code `BAD_REQUEST`; do not modify `src/errors.ts`.
- Python validation failures use `ValueError`; existing HTTP failures remain `RuntimeError`.
- Go returns ordinary errors. Non-2xx errors must contain the HTTP status and safely decoded service details without including request headers, API keys, `creditKey`, or other credentials.

## Payment Selection

Apply selection after a quote response has been received and normalized, or after a supplied quote has been validated, but before transfer:

1. If `paymentMethod` is supplied, select the first `paymentOptions` entry whose non-empty `id`, `chain`, or `token` exactly equals the selector.
2. If a selector is supplied and no option matches, reject before transfer or purchase.
3. If no selector is supplied, preserve the server-selected `payment`.
4. If no selector is supplied, the server omitted `payment`, and `paymentOptions` is non-empty, select the first option.
5. If no payment can be selected, reject the malformed quote.
6. Resolve `requiredAmount` as described above.
7. Store the selected payment in normalized quote `payment`.

Do not fail or suppress the initial quote HTTP request merely because a selector might not match its response.

## Purchase Orchestration

Each purchase method must:

1. Validate the purchase input and transfer callback.
2. If no quote is supplied, require `requestedIssuedCredits` and obtain a quote using the same validation, request body, normalization, and selection behavior as the public quote method.
3. If a quote is supplied, skip the quote endpoint and validate, select, and normalize that quote as specified above.
4. Invoke the caller transfer callback exactly once with the complete normalized quote and selected payment.
5. Validate the returned transaction hash.
6. POST the purchase request body.
7. Return the normalized service result without mutating client authentication.

The callback is solely responsible for wallet access, approval, signing, broadcasting, and chain-specific dependencies. It returns only a transaction hash; Go additionally returns an error. Do not ask for or accept a private key.

## Locked Public APIs

### TypeScript

Create `src/payments.ts` and re-export its public types from `src/index.ts`.

```ts
export interface QuoteCreditsInput {
  product: string;
  wallet: string;
  requestedIssuedCredits: number;
  promotionCode?: string;
  paymentMethod?: string;
}

export interface CreditPayment {
  id?: string;
  chain?: string;
  network?: string;
  chainId?: string | number;
  token?: string;
  tokenAddress?: string;
  treasuryAddress?: string;
  requiredAmount?: string | number;
  [key: string]: unknown;
}

export interface CreditQuote {
  product: string;
  wallet: string;
  requestedIssuedCredits: number;
  payment: CreditPayment;
  paymentOptions?: CreditPayment[];
  [key: string]: unknown;
}

export type TransferCallback = (quote: CreditQuote) => Promise<string>;

export interface PurchaseCreditsInput {
  product: string;
  wallet: string;
  requestedIssuedCredits?: number;
  promotionCode?: string;
  paymentMethod?: string;
  quote?: CreditQuote;
  transfer: TransferCallback;
}

export interface PurchaseCreditsResult {
  creditKey: string;
  issuedCredits?: number;
  baseCredits?: number;
  paymentTxHash?: string;
  usage?: unknown;
  [key: string]: unknown;
}
```

Raw Response:

```text
---STATUS---
status: revise
reason: The draft leaves unknown-field passthrough undefined for Python and Go and contradicts itself about which CreditPayment fields are optional.
```spec
# Embedded Payments SDK

## Overview

Add a chain-library-neutral payments module to the TypeScript, Python, and Go SDKs. The module exposes the existing credit-purchase lifecycle: request a quote, execute the quoted on-chain transfer through caller-controlled wallet code, submit the transaction hash, and return the issued product payment credit key.

The default base URL is `https://e3d.ai/api`. Use exactly:

- `POST /payments/credits/quote`
- `POST /payments/credits/purchase`

Do not add another `/api` prefix.

Quotes have no server quote identifier or expiration field. Do not invent `quoteId`, `purchaseId`, or `expiresAt`. A quote is advisory; purchase re-validates the on-chain transfer.

The returned `creditKey` is a product payment credit key such as `e3d_maps_pay_...`. It is not the SDK `apiKey` or `x-api-key` credential and must not be installed on the client.

Public entry points:

- TypeScript: `e3d.payments.quoteCredits(request)` and `e3d.payments.purchaseCredits(request)`
- Python: `client.payments.quote_credits(request)` and `client.payments.purchase_credits(request, transfer)`
- Go: `client.Payments.QuoteCredits(ctx, request)` and `client.Payments.PurchaseCredits(ctx, request, transfer)`

## Goals

- Expose the live credit quote and purchase lifecycle in all three SDKs.
- Keep wallet access, approval, signing, and broadcasting outside the SDK.
- Allow purchase methods to reuse a caller-supplied normalized quote.
- Preserve useful server response metadata, including unknown fields.
- Document an end-to-end flow that ends with a product payment credit key.
- Provide deterministic Python and Go tests without live API or chain access.

## Non-Goals

- Custodying private keys, seed phrases, or wallet credentials.
- Implementing wallets, signers, RPC providers, approvals, or transaction broadcasters.
- Adding ethers, web3.py, Go chain libraries, or other blockchain dependencies.
- Polling for blockchain confirmations.
- Changing payment-service endpoints or server behavior.
- Adding `Authorization: Bearer` to SDK payment requests.
- Mutating the configured SDK API key.
- Modifying the external `docs.e3d.ai` repository.
- Adding checkout UI, subscriptions, refunds, stored payment methods, balance reads, spend operations, or product catalogs.
- Changing swap behavior or existing authentication defaults.
- Adding TypeScript tests under `src/`.
- Modifying examples, lockfiles, runner configuration, TypeScript configuration, or Claude configuration.

## Existing Files

- `src/client.ts` constructs the public TypeScript `E3D` client and its modules.
- `src/http.ts` provides normalized requests, optional `x-api-key`, timeout handling, and injected `fetch`. Its default base URL is `https://e3d.ai/api`.
- `src/index.ts` defines package exports. TypeScript imports and exports use `.js` suffixes.
- `src/types.ts` contains shared client options and must not receive payment-specific types.
- `src/errors.ts` defines `E3DError` and HTTP error mapping and must not be modified.
- `src/normalize.ts` camelizes snake_case response keys.
- `python/e3d/client.py` is a transport-only dataclass client with `get` and `post`.
- `python/e3d/__init__.py` defines Python package exports.
- `README.md` is the package installation and usage guide.
- `package.json` provides `build` and `typecheck`; there is no TypeScript test runner.
- `pyproject.toml` packages modules under `python/`.
- No publishable Go client package currently exists. Go code under `examples/` is protected.

## Shared Constraints

- Keep the implementation within 25 changed files and 3000 changed lines.
- Do not modify `tsconfig.json`, `examples/**`, `package-lock.json`, `.codex-spec-runner/**`, `.claude/**`, or `.git/**`.
- Use only existing TypeScript runtime dependencies and the standard library for Python and Go.
- Preserve existing public APIs and zero-dependency behavior for Python and Go.
- Treat the live payments HTTP API as authoritative even though `GET /openapi` omits these routes.
- Use paths relative to the configured base URL.
- Reuse each language's existing or newly specified base-URL, HTTP, JSON, timeout, header, and error conventions.
- Omit empty optional fields from request bodies.
- Preserve existing `x-api-key` behavior. Payments must work without a configured API key; if one is configured, continue sending it as `x-api-key`.
- Do not add `Authorization: Bearer` to SDK payment requests.
- Public APIs use idiomatic language casing and explicitly map to the camelCase wire names.
- Never log quote payloads, transaction proofs, private keys, or returned credentials.
- Never include a returned `creditKey` in a client-generated exception message.
- Do not retry transfer callbacks automatically.
- Do not retry quote or purchase requests in a way that could cause another on-chain transfer.
- Propagate transport, callback, and API errors and never call purchase after a failed transfer.

## Wire Contract

### Quote Request

The quote JSON body may contain only:

- `product`: required string
- `wallet`: required string
- `requestedIssuedCredits`: required positive integer
- `promotionCode`: optional non-empty string

`paymentMethod` is client-side selection metadata and must never be sent to the quote endpoint.

### Quote Normalization

Construct the normalized quote by starting with all server response fields, then ensuring these fields are populated from the validated request when the response omits them:

- `product`
- `wallet`
- `requestedIssuedCredits`

A normalized quote contains:

- required `product`, `wallet`, and `requestedIssuedCredits`
- required selected `payment`
- optional `paymentOptions`
- all other server quote fields

Each payment object can contain:

- optional `id`
- optional `chain`
- optional `network`
- optional `chainId`
- optional `token`
- optional `tokenAddress`
- optional `treasuryAddress`
- optional `requiredAmount`
- any other server payment fields

Fields other than `requiredAmount` must not be fabricated. If selected `payment.requiredAmount` is absent or empty, copy the top-level `requiredWE3D`, or otherwise `requiredE3D`, to `payment.requiredAmount`. Reject the quote before transfer or purchase if no non-empty amount can be resolved.

Unknown fields must remain available to callers as follows:

- TypeScript: retain unknown quote, payment, and purchase-result properties directly through string index signatures.
- Python: retain unknown properties in an `extra: Dict[str, Any]` field on `CreditQuote`, `CreditPayment`, and `PurchaseCreditsResult`. Known fields must not also appear in `extra`.
- Go: retain unknown properties in an exported `Extra map[string]interface{} ` field with `json:"-"` on `CreditQuote`, `CreditPayment`, and `PurchaseCreditsResult`, using custom JSON unmarshalling where necessary. Known fields must not also appear in `Extra`.

Unknown fields are response passthrough only and must not be copied into quote or purchase request bodies.

### Purchase Request

The purchase JSON body contains:

- `product`: required string
- `wallet`: required string
- `txHash`: required string
- `promotionCode`: only when the caller supplied a non-empty value
- `paymentMethod`: selected payment `id`, falling back to the caller's selector only when the selected payment has no non-empty `id`
- `paymentChain`: selected payment `chain`, when non-empty

Do not send quote identifiers. Do not send `walletAddress`, `transactionHash`, `credits`, `requestedIssuedCredits`, unknown response fields, or `apiKey`.

### Purchase Result

Expose:

- required `creditKey`
- optional returned metadata such as `issuedCredits`, `baseCredits`, `paymentTxHash`, and `usage`
- remaining server purchase fields using the language-specific unknown-field representation above

Do not install `creditKey` on the client.

## Validation

Perform validation before the corresponding network or transfer side effect:

- `product` and `wallet` must be strings that remain non-empty after trimming.
- `requestedIssuedCredits` must be a finite integer greater than zero.
- Python must reject `True` and `False` as credit counts.
- `promotionCode`, when included on the wire, must be a string that remains non-empty after trimming; omit `None`, missing, and whitespace-only values.
- `paymentMethod`, when provided, must be a string. Treat a whitespace-only selector as invalid rather than silently omitting it.
- A transfer callback is required and must be callable or non-nil as appropriate.
- The returned `txHash` must be a string that remains non-empty after trimming.
- Reject missing, non-string, or whitespace-only transaction hashes before purchase.
- Do not perform chain-specific address or hash-format validation.

For a supplied quote:

- Require non-empty `product` and `wallet`, a positive integral `requestedIssuedCredits`, and a payment that can be selected and assigned a required amount.
- Require supplied quote `product` and `wallet` to equal the validated purchase input values after trimming.
- If purchase input includes `requestedIssuedCredits`, require it to equal the supplied quote value.
- Reapply payment selection using the purchase input's `paymentMethod`.
- Reject mismatches before invoking transfer.

Error conventions:

- TypeScript validation failures use existing `E3DError` helpers with code `BAD_REQUEST`; do not modify `src/errors.ts`.
- Python validation failures use `ValueError`; existing HTTP failures remain `RuntimeError`.
- Go returns ordinary errors. Non-2xx errors must contain the HTTP status and safely decoded service details without including request headers, API keys, `creditKey`, or other credentials.

## Payment Selection

Apply selection after a quote response has been received and normalized, or after a supplied quote has been validated, but before transfer:

1. If `paymentMethod` is supplied, select the first `paymentOptions` entry whose non-empty `id`, `chain`, or `token` exactly equals the selector.
2. If a selector is supplied and no option matches, reject before transfer or purchase.
3. If no selector is supplied, preserve the server-selected `payment`.
4. If no selector is supplied, the server omitted `payment`, and `paymentOptions` is non-empty, select the first option.
5. If no payment can be selected, reject the malformed quote.
6. Resolve `requiredAmount` as described above.
7. Store the selected payment in normalized quote `payment`.

Do not fail or suppress the initial quote HTTP request merely because a selector might not match its response.

## Purchase Orchestration

Each purchase method must:

1. Validate the purchase input and transfer callback.
2. If no quote is supplied, require `requestedIssuedCredits` and obtain a quote using the same validation, request body, normalization, and selection behavior as the public quote method.
3. If a quote is supplied, skip the quote endpoint and validate, select, and normalize that quote as specified above.
4. Invoke the caller transfer callback exactly once with the complete normalized quote and selected payment.
5. Validate the returned transaction hash.
6. POST the purchase request body.
7. Return the normalized service result without mutating client authentication.

The callback is solely responsible for wallet access, approval, signing, broadcasting, and chain-specific dependencies. It returns only a transaction hash; Go additionally returns an error. Do not ask for or accept a private key.

## Locked Public APIs

### TypeScript

Create `src/payments.ts` and re-export its public types from `src/index.ts`.

```ts
export interface QuoteCreditsInput {
  product: string;
  wallet: string;
  requestedIssuedCredits: number;
  promotionCode?: string;
  paymentMethod?: string;
}

export interface CreditPayment {
  id?: string;
  chain?: string;
  network?: string;
  chainId?: string | number;
  token?: string;
  tokenAddress?: string;
  treasuryAddress?: string;
  requiredAmount?: string | number;
  [key: string]: unknown;
}

export interface CreditQuote {
  product: string;
  wallet: string;
  requestedIssuedCredits: number;
  payment: CreditPayment;
  paymentOptions?: CreditPayment[];
  [key: string]: unknown;
}

export type TransferCallback = (quote: CreditQuote) => Promise<string>;

export interface PurchaseCreditsInput {
  product: string;
  wallet: string;
  requestedIssuedCredits?: number;
  promotionCode?: string;
  paymentMethod?: string;
  quote?: CreditQuote;
  transfer: TransferCallback;
}

export interface PurchaseCreditsResult {
  creditKey: string;
  issuedCredits?: number;
  baseCredits?: number;
  paymentTxHash?: string;
  usage?: unknown;
  [key: string]: unknown;
}
```

Expose a `PaymentsModule` with:

- `quoteCredits(input: QuoteCreditsInput): Promise<CreditQuote>`
- `purchaseCredits(input: PurchaseCreditsInput): Promise<PurchaseCreditsResult>`

Expose it as `readonly payments` on `E3D`.

### Python

Create `python/e3d/payments.py` and re-export:

- `QuoteCreditsInput`
- `CreditPayment`
- `CreditQuote`
- `PurchaseCreditsInput`
- `PurchaseCreditsResult`
- `PaymentsModule`

Use dataclasses and snake_case public fields:

- `requested_issued_credits`
- `promotion_code`
- `payment_method`
- `payment_options`
- `token_address`
- `treasury_address`
- `chain_id`
- `required_amount`
- `credit_key`
- `issued_credits`
- `base_credits`
- `tx_hash`
- `payment_tx_hash`
- `payment_chain`
- `extra`

Map known fields explicitly to their camelCase wire names. Use `from __future__ import annotations` and Python 3.8-compatible typing.

Expose:

- `PaymentsModule.quote_credits(request: QuoteCreditsInput) -> CreditQuote`
- `PaymentsModule.purchase_credits(request: PurchaseCreditsInput, transfer: Callable[[CreditQuote], str]) -> PurchaseCreditsResult`

### Go

Create module `github.com/spacepacket1/e3d-sdk/go` under `go/`, with package import path `github.com/spacepacket1/e3d-sdk/go/e3d`.

Export:

- `QuoteCreditsRequest`
- `CreditPayment`
- `CreditQuote`
- `PurchaseCreditsInput`
- `PurchaseCreditsResult`
- `TransferFunc`

Use PascalCase fields and camelCase JSON tags. Optional payment fields must use types that can represent absence. Use `json.Number` or another lossless standard-library representation for response amounts whose server type may be string or number.

```go
type TransferFunc func(
    ctx context.Context,
    quote CreditQuote,
) (txHash string, err error)
```

Expose:

- `QuoteCredits(ctx context.Context, request QuoteCreditsRequest) (CreditQuote, error)`
- `PurchaseCredits(ctx context.Context, input PurchaseCreditsInput, transfer TransferFunc) (PurchaseCreditsResult, error)`

## Phase 1 — TypeScript Payments Module

<!-- runner:model=codex:gpt-5.4 -->
<!-- pilot:touches=src/payments.ts -->
<!-- pilot:touches=src/client.ts -->
<!-- pilot:touches=src/index.ts -->
<!-- runner:read=src/http.ts -->
<!-- runner:read=src/errors.ts -->
<!-- runner:read=src/types.ts -->
<!-- runner:read=src/normalize.ts -->
<!-- runner:verify=npm install && npm run typecheck -->

### Requirements

- Implement the locked TypeScript types and `PaymentsModule` in `src/payments.ts`.
- Back the module with the existing `HttpClient`.
- Implement the complete shared validation, normalization, selection, passthrough, and orchestration contract.
- Initialize `readonly payments` on `E3D` using the same `HttpClient` as other API-backed modules.
- Export the module and public payment types with `.js` suffixes.
- Do not alter HTTP normalization, authentication, swap, or error semantics.
- Do not add tests or other non-production files under `src/`.

### Acceptance Criteria

- Both payment methods are public and type-safe.
- Quote sends exactly one allowed quote request and omits `paymentMethod`.
- Purchase without a supplied quote performs quote, transfer, and purchase exactly once and in order.
- Purchase with a supplied quote skips the quote request.
- Invalid input, selection failure, transfer rejection, and invalid hash prevent purchase.
- Unknown response fields remain accessible.
- `creditKey` is returned without changing the client API key.
- Existing consumers continue to typecheck.
- `npm install && npm run typecheck` succeeds without changing `package-lock.json`.

## Phase 2 — Python Payments Module

<!-- runner:model=codex:gpt-5.4 -->
<!-- pilot:touches=python/e3d/payments.py -->
<!-- pilot:touches=python/e3d/client.py -->
<!-- pilot:touches=python/e3d/__init__.py -->
<!-- pilot:touches=python/tests/test_payments.py -->
<!-- runner:read=python/e3d/client.py -->
<!-- runner:read=python/e3d/__init__.py -->
<!-- runner:verify=python3 -m unittest discover -s python/tests -p 'test_*.py' -->
<!-- runner:verify=npm install && npm run typecheck -->

### Requirements

- Add a standard-library-only `PaymentsModule` exposed as `E3DClient.payments`.
- Preserve the dataclass constructor by using an `init=False` field initialized in `__post_init__`.
- Reuse `E3DClient.post` for both endpoints.
- Avoid circular imports and bind each module to its own client instance.
- Implement the complete shared validation, normalization, selection, passthrough, and orchestration contract.
- Export all locked payment symbols from `python/e3d/__init__.py`.
- Add `unittest` coverage using a fake or subclassed client transport.

Tests must cover:

- endpoint paths and methods
- camelCase request bodies
- omission of `paymentMethod` and unknown fields from quote requests
- optional-field omission
- quote normalization from request values
- payment selection and unmatched selection
- required-amount fallback
- unknown-field preservation in `extra`
- quote, transfer, purchase ordering
- supplied-quote reuse and mismatch rejection
- validation before side effects, including boolean credit counts
- transfer exceptions and invalid hashes
- successful `credit_key` return without mutation of `api_key`

### Acceptance Criteria

- Payment methods are available without extra dependencies.
- Python matches the shared HTTP and side-effect contract.
- Supplying a quote avoids another quote request.
- Invalid input and transfer failures cannot trigger purchase.
- Unknown response fields remain available through `extra`.
- All Python tests pass.
- TypeScript typechecking remains successful.

## Phase 3 — Go SDK and Payments Service

<!-- runner:model=codex:gpt-5.4 -->
<!-- pilot:touches=go/go.mod -->
<!-- pilot:touches=go/e3d/*.go -->
<!-- runner:read=python/e3d/client.py -->
<!-- runner:read=src/payments.ts -->
<!-- runner:read=examples/go/go.mod -->
<!-- runner:verify=cd go && go test ./... -->
<!-- runner:verify=npm install && npm run typecheck -->

### Requirements

- Create a standard-library-only Go module under `go/`.
- Set `go/go.mod` to module `github.com/spacepacket1/e3d-sdk/go` with a Go 1.22 directive.
- Do not modify the protected example module.
- Implement a configurable `Client` with:
  - default base URL `https://e3d.ai/api`
  - optional `x-api-key`
  - configurable timeout
  - injectable `http.Client`
  - JSON request and error handling sufficient for payments
- Expose a `Payments` service from `Client`.
- Implement the locked types and methods and the complete shared validation, normalization, selection, passthrough, and orchestration contract.
- Check `ctx.Err()` before quote, before transfer, and before purchase; if canceled, skip the next side effect and return the context error.
- Never use `Authorization: Bearer` for SDK payment requests.
- Safely decode non-2xx service errors without leaking credentials.
- Add deterministic `httptest` coverage.

Tests must cover:

- paths, methods, and camelCase bodies
- quote-body field allowlist
- optional-field omission
- custom base URL, API key, and injected client behavior
- call ordering
- validation before side effects
- context cancellation before each step
- selection and unmatched selection
- required-amount fallback
- unknown-field preservation in `Extra`
- transfer errors and invalid hashes
- supplied-quote reuse and mismatch rejection
- non-2xx error status and safe details
- successful `CreditKey` return without client mutation

### Acceptance Criteria

- Consumers can construct a client and call both payment methods.
- The module has no third-party dependencies.
- Tests make no live network or blockchain calls.
- Existing quotes can be reused without another quote request.
- Invalid input, canceled contexts, and transfer errors prevent later side effects.
- Unknown response fields remain available through `Extra`.
- `cd go && go test ./...` succeeds.
- TypeScript typechecking remains successful.

## Phase 4 — Payments Conversion Guide

<!-- runner:model=codex:gpt-5.4 -->
<!-- pilot:touches=README.md -->
<!-- runner:read=src/payments.ts -->
<!-- runner:read=python/e3d/payments.py -->
<!-- runner:read=go/e3d/payments.go -->
<!-- runner:verify=npm install && npm run typecheck -->

### Requirements

- Add `payments` to the README module list.
- Add a Payments section describing quote, wallet transfer, purchase confirmation, and use of the product credit key.
- Provide concise TypeScript, Python, and Go examples using the exact implemented symbols and signatures.
- Use environment-based credential and wallet configuration and placeholders rather than real secrets, addresses, or transaction hashes.
- Keep transaction signing and broadcasting entirely inside caller callbacks.
- State that callers must send the exact quoted asset and amount to the quoted treasury on the quoted chain.
- Instruct callers to present destination, asset, amount, and chain for approval before an irreversible transfer.
- Explain that quotes are advisory, have no quote ID or server expiration, and may become stale as rates or discounts change.
- Explain that `creditKey` is a product payment key used as `Authorization: Bearer <creditKey>` for product APIs, not the SDK `apiKey` or `x-api-key`.
- Do not show installing the returned key on an SDK client.
- Explain that a purchase-confirmation retry may reuse the same confirmed transaction hash and must not blindly initiate another transfer.
- Keep existing quick-start and swap documentation intact.

### Acceptance Criteria

- Payment guidance is discoverable for all three languages.
- All documented symbols and signatures match the implementation.
- Examples keep private keys and signing under caller control.
- Documentation distinguishes purchase-confirmation retries from transfer retries.
- No protected example or external documentation file is modified.
- `npm install && npm run typecheck` succeeds.
```
```

### Reviewer 4: devin

Status: revise

Reason: Python and Go locked public API sections (types, file locations, method signatures) are missing.

Replacement Spec:

```spec
# Embedded Payments SDK

## Overview

Add a chain-library-neutral payments module to the TypeScript, Python, and Go SDKs. The module exposes the existing credit-purchase lifecycle: request a quote, execute the quoted on-chain transfer through caller-controlled wallet code, submit the transaction hash, and return the issued product payment credit key.

The default base URL is `https://e3d.ai/api`. Use exactly:

- `POST /payments/credits/quote`
- `POST /payments/credits/purchase`

Do not add another `/api` prefix.

Quotes have no server quote identifier or expiration field. Do not invent `quoteId`, `purchaseId`, or `expiresAt`. A quote is advisory; purchase re-validates the on-chain transfer.

The returned `creditKey` is a product payment credit key such as `e3d_maps_pay_...`. It is not the SDK `apiKey` or `x-api-key` credential and must not be installed on the client.

Public entry points:

- TypeScript: `e3d.payments.quoteCredits(request)` and `e3d.payments.purchaseCredits(request)`
- Python: `client.payments.quote_credits(request)` and `client.payments.purchase_credits(request, transfer)`
- Go: `client.Payments.QuoteCredits(ctx, request)` and `client.Payments.PurchaseCredits(ctx, request, transfer)`

## Goals

- Expose the live credit quote and purchase lifecycle in all three SDKs.
- Keep wallet access, approval, signing, and broadcasting outside the SDK.
- Allow purchase methods to reuse a caller-supplied normalized quote.
- Preserve useful server response metadata, including unknown fields.
- Document an end-to-end flow that ends with a product payment credit key.
- Provide deterministic Python and Go tests without live API or chain access.

## Non-Goals

- Custodying private keys, seed phrases, or wallet credentials.
- Implementing wallets, signers, RPC providers, approvals, or transaction broadcasters.
- Adding ethers, web3.py, Go chain libraries, or other blockchain dependencies.
- Polling for blockchain confirmations.
- Changing payment-service endpoints or server behavior.
- Adding `Authorization: Bearer` to SDK payment requests.
- Mutating the configured SDK API key.
- Modifying the external `docs.e3d.ai` repository.
- Adding checkout UI, subscriptions, refunds, stored payment methods, balance reads, spend operations, or product catalogs.
- Changing swap behavior or existing authentication defaults.
- Adding TypeScript tests under `src/`.
- Modifying examples, lockfiles, runner configuration, TypeScript configuration, or Claude configuration.

## Existing Files

- `src/client.ts` constructs the public TypeScript `E3D` client and its modules.
- `src/http.ts` provides normalized requests, optional `x-api-key`, timeout handling, and injected `fetch`. Its default base URL is `https://e3d.ai/api`.
- `src/index.ts` defines package exports. TypeScript imports and exports use `.js` suffixes.
- `src/types.ts` contains shared client options and must not receive payment-specific types.
- `src/errors.ts` defines `E3DError` and HTTP error mapping and must not be modified.
- `src/normalize.ts` camelizes snake_case response keys.
- `python/e3d/client.py` is a transport-only dataclass client with `get` and `post`.
- `python/e3d/__init__.py` defines Python package exports.
- `README.md` is the package installation and usage guide.
- `package.json` provides `build` and `typecheck`; there is no TypeScript test runner.
- `pyproject.toml` packages modules under `python/`.
- No publishable Go client package currently exists. Go code under `examples/` is protected.

## Shared Constraints

- Keep the implementation within 25 changed files and 3000 changed lines.
- Do not modify `tsconfig.json`, `examples/**`, `package-lock.json`, `.codex-spec-runner/**`, `.claude/**`, or `.git/**`.
- Use only existing TypeScript runtime dependencies and the standard library for Python and Go.
- Preserve existing public APIs and zero-dependency behavior for Python and Go.
- Treat the live payments HTTP API as authoritative even though `GET /openapi` omits these routes.
- Use paths relative to the configured base URL.
- Reuse each language's existing or newly specified base-URL, HTTP, JSON, timeout, header, and error conventions.
- Omit empty optional fields from request bodies.
- Preserve existing `x-api-key` behavior. Payments must work without a configured API key; if one is configured, continue sending it as `x-api-key`.
- Do not add `Authorization: Bearer` to SDK payment requests.
- Public APIs use idiomatic language casing and explicitly map to the camelCase wire names.
- Never log quote payloads, transaction proofs, private keys, or returned credentials.
- Never include a returned `creditKey` in a client-generated exception message.
- Do not retry transfer callbacks automatically.
- Do not retry quote or purchase requests in a way that could cause another on-chain transfer.
- Propagate transport, callback, and API errors and never call purchase after a failed transfer.

## Wire Contract

### Quote Request

The quote JSON body may contain only:

- `product`: required string
- `wallet`: required string
- `requestedIssuedCredits`: required positive integer
- `promotionCode`: optional non-empty string

`paymentMethod` is client-side selection metadata and must never be sent to the quote endpoint.

### Quote Normalization

Construct the normalized quote by starting with all server response fields, then ensuring these fields are populated from the validated request when the response omits them:

- `product`
- `wallet`
- `requestedIssuedCredits`

A normalized quote contains:

- required `product`, `wallet`, and `requestedIssuedCredits`
- required selected `payment`
- optional `paymentOptions`
- all other server quote fields

Each payment object can contain:

- optional `id`
- optional `chain`
- optional `network`
- optional `chainId`
- optional `token`
- optional `tokenAddress`
- optional `treasuryAddress`
- optional `requiredAmount`
- any other server payment fields

Fields other than `requiredAmount` must not be fabricated. If selected `payment.requiredAmount` is absent or empty, copy the top-level `requiredWE3D`, or otherwise `requiredE3D`, to `payment.requiredAmount`. Reject the quote before transfer or purchase if no non-empty amount can be resolved.

Unknown fields must remain available to callers as follows:

- TypeScript: retain unknown quote, payment, and purchase-result properties directly through string index signatures.
- Python: retain unknown properties in an `extra: Dict[str, Any]` field on `CreditQuote`, `CreditPayment`, and `PurchaseCreditsResult`. Known fields must not also appear in `extra`.
- Go: retain unknown properties in an exported `Extra map[string]interface{}` field with `json:"-"` on `CreditQuote`, `CreditPayment`, and `PurchaseCreditsResult`, using custom JSON unmarshalling where necessary. Known fields must not also appear in `Extra`.

Unknown fields are response passthrough only and must not be copied into quote or purchase request bodies.

### Purchase Request

The purchase JSON body contains:

- `product`: required string
- `wallet`: required string
- `txHash`: required string
- `promotionCode`: only when the caller supplied a non-empty value
- `paymentMethod`: selected payment `id`, falling back to the caller's selector only when the selected payment has no non-empty `id`
- `paymentChain`: selected payment `chain`, when non-empty

Do not send quote identifiers. Do not send `walletAddress`, `transactionHash`, `credits`, `requestedIssuedCredits`, unknown response fields, or `apiKey`.

### Purchase Result

Expose:

- required `creditKey`
- optional returned metadata such as `issuedCredits`, `baseCredits`, `paymentTxHash`, and `usage`
- remaining server purchase fields using the language-specific unknown-field representation above

Do not install `creditKey` on the client.

## Validation

Perform validation before the corresponding network or transfer side effect:

- `product` and `wallet` must be strings that remain non-empty after trimming.
- `requestedIssuedCredits` must be a finite integer greater than zero.
- Python must reject `True` and `False` as credit counts.
- `promotionCode`, when included on the wire, must be a string that remains non-empty after trimming; omit `None`, missing, and whitespace-only values.
- `paymentMethod`, when provided, must be a string. Treat a whitespace-only selector as invalid rather than silently omitting it.
- A transfer callback is required and must be callable or non-nil as appropriate.
- The returned `txHash` must be a string that remains non-empty after trimming.
- Reject missing, non-string, or whitespace-only transaction hashes before purchase.
- Do not perform chain-specific address or hash-format validation.

For a supplied quote:

- Require non-empty `product` and `wallet`, a positive integral `requestedIssuedCredits`, and a payment that can be selected and assigned a required amount.
- Require supplied quote `product` and `wallet` to equal the validated purchase input values after trimming.
- If purchase input includes `requestedIssuedCredits`, require it to equal the supplied quote value.
- Reapply payment selection using the purchase input's `paymentMethod`.
- Reject mismatches before invoking transfer.

Error conventions:

- TypeScript validation failures use existing `E3DError` helpers with code `BAD_REQUEST`; do not modify `src/errors.ts`.
- Python validation failures use `ValueError`; existing HTTP failures remain `RuntimeError`.
- Go returns ordinary errors. Non-2xx errors must contain the HTTP status and safely decoded service details without including request headers, API keys, `creditKey`, or other credentials.

## Payment Selection

Apply selection after a quote response has been received and normalized, or after a supplied quote has been validated, but before transfer:

1. If `paymentMethod` is supplied, select the first `paymentOptions` entry whose non-empty `id`, `chain`, or `token` exactly equals the selector.
2. If a selector is supplied and no option matches, reject before transfer or purchase.
3. If no selector is supplied, preserve the server-selected `payment`.
4. If no selector is supplied, the server omitted `payment`, and `paymentOptions` is non-empty, select the first option.
5. If no payment can be selected, reject the malformed quote.
6. Resolve `requiredAmount` as described above.
7. Store the selected payment in normalized quote `payment`.

Do not fail or suppress the initial quote HTTP request merely because a selector might not match its response.

## Purchase Orchestration

Each purchase method must:

1. Validate the purchase input and transfer callback.
2. If no quote is supplied, require `requestedIssuedCredits` and obtain a quote using the same validation, request body, normalization, and selection behavior as the public quote method.
3. If a quote is supplied, skip the quote endpoint and validate, select, and normalize that quote as specified above.
4. Invoke the caller transfer callback exactly once with the complete normalized quote and selected payment.
5. Validate the returned transaction hash.
6. POST the purchase request body.
7. Return the normalized service result without mutating client authentication.

The callback is solely responsible for wallet access, approval, signing, broadcasting, and chain-specific dependencies. It returns only a transaction hash; Go additionally returns an error. Do not ask for or accept a private key.

## Locked Public APIs

### TypeScript

Create `src/payments.ts` and re-export its public types from `src/index.ts`.

```ts
export interface QuoteCreditsInput {
  product: string;
  wallet: string;
  requestedIssuedCredits: number;
  promotionCode?: string;
  paymentMethod?: string;
}

export interface CreditPayment {
  id?: string;
  chain?: string;
  network?: string;
  chainId?: string | number;
  token?: string;
  tokenAddress?: string;
  treasuryAddress?: string;
  requiredAmount?: string | number;
  [key: string]: unknown;
}

export interface CreditQuote {
  product: string;
  wallet: string;
  requestedIssuedCredits: number;
  payment: CreditPayment;
  paymentOptions?: CreditPayment[];
  [key: string]: unknown;
}

export type TransferCallback = (quote: CreditQuote) => Promise<string>;

export interface PurchaseCreditsInput {
  product: string;
  wallet: string;
  requestedIssuedCredits?: number;
  promotionCode?: string;
  paymentMethod?: string;
  quote?: CreditQuote;
  transfer: TransferCallback;
}

export interface PurchaseCreditsResult {
  creditKey: string;
  issuedCredits?: number;
  baseCredits?: number;
  paymentTxHash?: string;
  usage?: unknown;
  [key: string]: unknown;
}

export class PaymentsModule {
  quoteCredits(request: QuoteCreditsInput): Promise<CreditQuote>;
  purchaseCredits(request: PurchaseCreditsInput): Promise<PurchaseCreditsResult>;
}
```

Raw Response:

```text
---STATUS---
status: revise
reason: Python and Go locked public API sections (types, file locations, method signatures) are missing.
```spec
# Embedded Payments SDK

## Overview

Add a chain-library-neutral payments module to the TypeScript, Python, and Go SDKs. The module exposes the existing credit-purchase lifecycle: request a quote, execute the quoted on-chain transfer through caller-controlled wallet code, submit the transaction hash, and return the issued product payment credit key.

The default base URL is `https://e3d.ai/api`. Use exactly:

- `POST /payments/credits/quote`
- `POST /payments/credits/purchase`

Do not add another `/api` prefix.

Quotes have no server quote identifier or expiration field. Do not invent `quoteId`, `purchaseId`, or `expiresAt`. A quote is advisory; purchase re-validates the on-chain transfer.

The returned `creditKey` is a product payment credit key such as `e3d_maps_pay_...`. It is not the SDK `apiKey` or `x-api-key` credential and must not be installed on the client.

Public entry points:

- TypeScript: `e3d.payments.quoteCredits(request)` and `e3d.payments.purchaseCredits(request)`
- Python: `client.payments.quote_credits(request)` and `client.payments.purchase_credits(request, transfer)`
- Go: `client.Payments.QuoteCredits(ctx, request)` and `client.Payments.PurchaseCredits(ctx, request, transfer)`

## Goals

- Expose the live credit quote and purchase lifecycle in all three SDKs.
- Keep wallet access, approval, signing, and broadcasting outside the SDK.
- Allow purchase methods to reuse a caller-supplied normalized quote.
- Preserve useful server response metadata, including unknown fields.
- Document an end-to-end flow that ends with a product payment credit key.
- Provide deterministic Python and Go tests without live API or chain access.

## Non-Goals

- Custodying private keys, seed phrases, or wallet credentials.
- Implementing wallets, signers, RPC providers, approvals, or transaction broadcasters.
- Adding ethers, web3.py, Go chain libraries, or other blockchain dependencies.
- Polling for blockchain confirmations.
- Changing payment-service endpoints or server behavior.
- Adding `Authorization: Bearer` to SDK payment requests.
- Mutating the configured SDK API key.
- Modifying the external `docs.e3d.ai` repository.
- Adding checkout UI, subscriptions, refunds, stored payment methods, balance reads, spend operations, or product catalogs.
- Changing swap behavior or existing authentication defaults.
- Adding TypeScript tests under `src/`.
- Modifying examples, lockfiles, runner configuration, TypeScript configuration, or Claude configuration.

## Existing Files

- `src/client.ts` constructs the public TypeScript `E3D` client and its modules.
- `src/http.ts` provides normalized requests, optional `x-api-key`, timeout handling, and injected `fetch`. Its default base URL is `https://e3d.ai/api`.
- `src/index.ts` defines package exports. TypeScript imports and exports use `.js` suffixes.
- `src/types.ts` contains shared client options and must not receive payment-specific types.
- `src/errors.ts` defines `E3DError` and HTTP error mapping and must not be modified.
- `src/normalize.ts` camelizes snake_case response keys.
- `python/e3d/client.py` is a transport-only dataclass client with `get` and `post`.
- `python/e3d/__init__.py` defines Python package exports.
- `README.md` is the package installation and usage guide.
- `package.json` provides `build` and `typecheck`; there is no TypeScript test runner.
- `pyproject.toml` packages modules under `python/`.
- No publishable Go client package currently exists. Go code under `examples/` is protected.

## Shared Constraints

- Keep the implementation within 25 changed files and 3000 changed lines.
- Do not modify `tsconfig.json`, `examples/**`, `package-lock.json`, `.codex-spec-runner/**`, `.claude/**`, or `.git/**`.
- Use only existing TypeScript runtime dependencies and the standard library for Python and Go.
- Preserve existing public APIs and zero-dependency behavior for Python and Go.
- Treat the live payments HTTP API as authoritative even though `GET /openapi` omits these routes.
- Use paths relative to the configured base URL.
- Reuse each language's existing or newly specified base-URL, HTTP, JSON, timeout, header, and error conventions.
- Omit empty optional fields from request bodies.
- Preserve existing `x-api-key` behavior. Payments must work without a configured API key; if one is configured, continue sending it as `x-api-key`.
- Do not add `Authorization: Bearer` to SDK payment requests.
- Public APIs use idiomatic language casing and explicitly map to the camelCase wire names.
- Never log quote payloads, transaction proofs, private keys, or returned credentials.
- Never include a returned `creditKey` in a client-generated exception message.
- Do not retry transfer callbacks automatically.
- Do not retry quote or purchase requests in a way that could cause another on-chain transfer.
- Propagate transport, callback, and API errors and never call purchase after a failed transfer.

## Wire Contract

### Quote Request

The quote JSON body may contain only:

- `product`: required string
- `wallet`: required string
- `requestedIssuedCredits`: required positive integer
- `promotionCode`: optional non-empty string

`paymentMethod` is client-side selection metadata and must never be sent to the quote endpoint.

### Quote Normalization

Construct the normalized quote by starting with all server response fields, then ensuring these fields are populated from the validated request when the response omits them:

- `product`
- `wallet`
- `requestedIssuedCredits`

A normalized quote contains:

- required `product`, `wallet`, and `requestedIssuedCredits`
- required selected `payment`
- optional `paymentOptions`
- all other server quote fields

Each payment object can contain:

- optional `id`
- optional `chain`
- optional `network`
- optional `chainId`
- optional `token`
- optional `tokenAddress`
- optional `treasuryAddress`
- optional `requiredAmount`
- any other server payment fields

Fields other than `requiredAmount` must not be fabricated. If selected `payment.requiredAmount` is absent or empty, copy the top-level `requiredWE3D`, or otherwise `requiredE3D`, to `payment.requiredAmount`. Reject the quote before transfer or purchase if no non-empty amount can be resolved.

Unknown fields must remain available to callers as follows:

- TypeScript: retain unknown quote, payment, and purchase-result properties directly through string index signatures.
- Python: retain unknown properties in an `extra: Dict[str, Any]` field on `CreditQuote`, `CreditPayment`, and `PurchaseCreditsResult`. Known fields must not also appear in `extra`.
- Go: retain unknown properties in an exported `Extra map[string]interface{}` field with `json:"-"` on `CreditQuote`, `CreditPayment`, and `PurchaseCreditsResult`, using custom JSON unmarshalling where necessary. Known fields must not also appear in `Extra`.

Unknown fields are response passthrough only and must not be copied into quote or purchase request bodies.

### Purchase Request

The purchase JSON body contains:

- `product`: required string
- `wallet`: required string
- `txHash`: required string
- `promotionCode`: only when the caller supplied a non-empty value
- `paymentMethod`: selected payment `id`, falling back to the caller's selector only when the selected payment has no non-empty `id`
- `paymentChain`: selected payment `chain`, when non-empty

Do not send quote identifiers. Do not send `walletAddress`, `transactionHash`, `credits`, `requestedIssuedCredits`, unknown response fields, or `apiKey`.

### Purchase Result

Expose:

- required `creditKey`
- optional returned metadata such as `issuedCredits`, `baseCredits`, `paymentTxHash`, and `usage`
- remaining server purchase fields using the language-specific unknown-field representation above

Do not install `creditKey` on the client.

## Validation

Perform validation before the corresponding network or transfer side effect:

- `product` and `wallet` must be strings that remain non-empty after trimming.
- `requestedIssuedCredits` must be a finite integer greater than zero.
- Python must reject `True` and `False` as credit counts.
- `promotionCode`, when included on the wire, must be a string that remains non-empty after trimming; omit `None`, missing, and whitespace-only values.
- `paymentMethod`, when provided, must be a string. Treat a whitespace-only selector as invalid rather than silently omitting it.
- A transfer callback is required and must be callable or non-nil as appropriate.
- The returned `txHash` must be a string that remains non-empty after trimming.
- Reject missing, non-string, or whitespace-only transaction hashes before purchase.
- Do not perform chain-specific address or hash-format validation.

For a supplied quote:

- Require non-empty `product` and `wallet`, a positive integral `requestedIssuedCredits`, and a payment that can be selected and assigned a required amount.
- Require supplied quote `product` and `wallet` to equal the validated purchase input values after trimming.
- If purchase input includes `requestedIssuedCredits`, require it to equal the supplied quote value.
- Reapply payment selection using the purchase input's `paymentMethod`.
- Reject mismatches before invoking transfer.

Error conventions:

- TypeScript validation failures use existing `E3DError` helpers with code `BAD_REQUEST`; do not modify `src/errors.ts`.
- Python validation failures use `ValueError`; existing HTTP failures remain `RuntimeError`.
- Go returns ordinary errors. Non-2xx errors must contain the HTTP status and safely decoded service details without including request headers, API keys, `creditKey`, or other credentials.

## Payment Selection

Apply selection after a quote response has been received and normalized, or after a supplied quote has been validated, but before transfer:

1. If `paymentMethod` is supplied, select the first `paymentOptions` entry whose non-empty `id`, `chain`, or `token` exactly equals the selector.
2. If a selector is supplied and no option matches, reject before transfer or purchase.
3. If no selector is supplied, preserve the server-selected `payment`.
4. If no selector is supplied, the server omitted `payment`, and `paymentOptions` is non-empty, select the first option.
5. If no payment can be selected, reject the malformed quote.
6. Resolve `requiredAmount` as described above.
7. Store the selected payment in normalized quote `payment`.

Do not fail or suppress the initial quote HTTP request merely because a selector might not match its response.

## Purchase Orchestration

Each purchase method must:

1. Validate the purchase input and transfer callback.
2. If no quote is supplied, require `requestedIssuedCredits` and obtain a quote using the same validation, request body, normalization, and selection behavior as the public quote method.
3. If a quote is supplied, skip the quote endpoint and validate, select, and normalize that quote as specified above.
4. Invoke the caller transfer callback exactly once with the complete normalized quote and selected payment.
5. Validate the returned transaction hash.
6. POST the purchase request body.
7. Return the normalized service result without mutating client authentication.

The callback is solely responsible for wallet access, approval, signing, broadcasting, and chain-specific dependencies. It returns only a transaction hash; Go additionally returns an error. Do not ask for or accept a private key.

## Locked Public APIs

### TypeScript

Create `src/payments.ts` and re-export its public types from `src/index.ts`.

```ts
export interface QuoteCreditsInput {
  product: string;
  wallet: string;
  requestedIssuedCredits: number;
  promotionCode?: string;
  paymentMethod?: string;
}

export interface CreditPayment {
  id?: string;
  chain?: string;
  network?: string;
  chainId?: string | number;
  token?: string;
  tokenAddress?: string;
  treasuryAddress?: string;
  requiredAmount?: string | number;
  [key: string]: unknown;
}

export interface CreditQuote {
  product: string;
  wallet: string;
  requestedIssuedCredits: number;
  payment: CreditPayment;
  paymentOptions?: CreditPayment[];
  [key: string]: unknown;
}

export type TransferCallback = (quote: CreditQuote) => Promise<string>;

export interface PurchaseCreditsInput {
  product: string;
  wallet: string;
  requestedIssuedCredits?: number;
  promotionCode?: string;
  paymentMethod?: string;
  quote?: CreditQuote;
  transfer: TransferCallback;
}

export interface PurchaseCreditsResult {
  creditKey: string;
  issuedCredits?: number;
  baseCredits?: number;
  paymentTxHash?: string;
  usage?: unknown;
  [key: string]: unknown;
}

export class PaymentsModule {
  quoteCredits(request: QuoteCreditsInput): Promise<CreditQuote>;
  purchaseCredits(request: PurchaseCreditsInput): Promise<PurchaseCreditsResult>;
}
```

### Python

Create `python/e3d/payments.py` and export its public types from `python/e3d/__init__.py`.

```python
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Union

@dataclass
class QuoteCreditsInput:
    product: str
    wallet: str
    requested_issued_credits: int
    promotion_code: Optional[str] = None
    payment_method: Optional[str] = None

@dataclass
class CreditPayment:
    id: Optional[str] = None
    chain: Optional[str] = None
    network: Optional[str] = None
    chain_id: Optional[Union[str, int]] = None
    token: Optional[str] = None
    token_address: Optional[str] = None
    treasury_address: Optional[str] = None
    required_amount: Optional[Union[str, float]] = None
    extra: Dict[str, Any] = field(default_factory=dict)

@dataclass
class CreditQuote:
    product: str
    wallet: str
    requested_issued_credits: int
    payment: CreditPayment
    payment_options: Optional[List[CreditPayment]] = None
    extra: Dict[str, Any] = field(default_factory=dict)

# Synchronous; returns the transaction hash string.
TransferCallback = Callable[[CreditQuote], str]

@dataclass
class PurchaseCreditsInput:
    product: str
    wallet: str
    requested_issued_credits: Optional[int] = None
    promotion_code: Optional[str] = None
    payment_method: Optional[str] = None
    quote: Optional[CreditQuote] = None

@dataclass
class PurchaseCreditsResult:
    credit_key: str
    issued_credits: Optional[int] = None
    base_credits: Optional[int] = None
    payment_tx_hash: Optional[str] = None
    usage: Optional[Any] = None
    extra: Dict[str, Any] = field(default_factory=dict)

class PaymentsModule:
    def quote_credits(self, request: QuoteCreditsInput) -> CreditQuote: ...
    def purchase_credits(
        self,
        request: PurchaseCreditsInput,
        transfer: TransferCallback,
    ) -> PurchaseCreditsResult: ...
```

The Python `PaymentsModule` instance is exposed as the `payments` attribute on the existing transport client. `purchase_credits` accepts `transfer` as a positional parameter separate from `request`, matching the public entry point signature.

### Go

Create a new Go module at `go/` (with `go/go.mod`) containing package `e3d`. Place payments types and the client in `go/e3d/payments.go`. Export public types and `NewClient` from that package.

```go
package e3d

import "context"

type QuoteCreditsInput struct {
    Product                string
    Wallet                 string
    RequestedIssuedCredits int
    PromotionCode          string // omitted from wire when empty
    PaymentMethod          string // client-side only; never sent to quote endpoint
}

type CreditPayment struct {
    ID              string
    Chain           string
    Network         string
    ChainID         interface{}
    Token           string
    TokenAddress    string
    TreasuryAddress string
    RequiredAmount  interface{}
    Extra           map[string]interface{} // json:"-"; populated by custom unmarshalling
}

type CreditQuote struct {
    Product                string
    Wallet                 string
    RequestedIssuedCredits int
    Payment                CreditPayment
    PaymentOptions         []CreditPayment
    Extra                  map[string]interface{} // json:"-"; populated by custom unmarshalling
}

// TransferFunc executes the on-chain transfer and returns the transaction hash.
// It must not be nil. The returned error aborts purchase before the HTTP call.
type TransferFunc func(ctx context.Context, quote CreditQuote) (txHash string, err error)

type PurchaseCreditsInput struct {
    Product                string
    Wallet                 string
    RequestedIssuedCredits int          // required when Quote is nil
    PromotionCode          string
    PaymentMethod          string
    Quote                  *CreditQuote // optional pre-fetched quote; skips quote endpoint
}

type PurchaseCreditsResult struct {
    CreditKey     string
    IssuedCredits int
    BaseCredits   int
    PaymentTxHash string
    Usage         interface{}
    Extra         map[string]interface{} // json:"-"; populated by custom unmarshalling
}

// PaymentsClient implements QuoteCredits and PurchaseCredits.
type PaymentsClient struct{ /* unexported */ }

func (c *PaymentsClient) QuoteCredits(ctx context.Context, req QuoteCreditsInput) (CreditQuote, error)
func (c *PaymentsClient) PurchaseCredits(ctx context.Context, req PurchaseCreditsInput, transfer TransferFunc) (PurchaseCreditsResult, error)

// Client is the top-level Go SDK client. Payments is the payments sub-client,
// matching the entry point client.Payments.QuoteCredits / PurchaseCredits.
type Client struct {
    Payments *PaymentsClient
}

// NewClient creates a Client. Pass an empty apiKey to omit x-api-key.
// Pass an empty baseURL to use the default https://e3d.ai/api.
func NewClient(baseURL, apiKey string) *Client
```

Known fields on `CreditPayment`, `CreditQuote`, and `PurchaseCreditsResult` must be decoded into their typed fields; all remaining JSON keys go into `Extra`. Known fields must not also appear in `Extra`.
```
```

### Reviewer 5: local

Status: approved

Reason: (no reason provided by reviewer)

Raw Response:

```text
---STATUS---
status: approved
```

Round Result: not converged

At least one reviewer requested revision in round 1.

## Round 2

### Draft Before Round

```text
# Embedded Payments SDK

## Overview

Add a chain-library-neutral payments module to the TypeScript, Python, and Go SDKs. The module exposes the existing credit-purchase lifecycle: request a quote, execute the quoted on-chain transfer through caller-controlled wallet code, submit the transaction hash, and return the issued product payment credit key.

The default base URL is `https://e3d.ai/api`. Use exactly:

- `POST /payments/credits/quote`
- `POST /payments/credits/purchase`

Do not add another `/api` prefix.

Quotes have no server quote identifier or expiration field. Do not invent `quoteId`, `purchaseId`, or `expiresAt`. A quote is advisory; purchase re-validates the on-chain transfer.

The returned `creditKey` is a product payment credit key such as `e3d_maps_pay_...`. It is not the SDK `apiKey` or `x-api-key` credential and must not be installed on the client.

Public entry points:

- TypeScript: `e3d.payments.quoteCredits(request)` and `e3d.payments.purchaseCredits(request)`
- Python: `client.payments.quote_credits(request)` and `client.payments.purchase_credits(request, transfer)`
- Go: `client.Payments.QuoteCredits(ctx, request)` and `client.Payments.PurchaseCredits(ctx, request, transfer)`

## Goals

- Expose the live credit quote and purchase lifecycle in all three SDKs.
- Keep wallet access, approval, signing, and broadcasting outside the SDK.
- Allow purchase methods to reuse a caller-supplied normalized quote.
- Preserve useful server response metadata, including unknown fields.
- Document an end-to-end flow that ends with a product payment credit key.
- Provide deterministic Python and Go tests without live API or chain access.

## Non-Goals

- Custodying private keys, seed phrases, or wallet credentials.
- Implementing wallets, signers, RPC providers, approvals, or transaction broadcasters.
- Adding ethers, web3.py, Go chain libraries, or other blockchain dependencies.
- Polling for blockchain confirmations.
- Changing payment-service endpoints or server behavior.
- Adding `Authorization: Bearer` to SDK payment requests.
- Mutating the configured SDK API key.
- Modifying the external `docs.e3d.ai` repository.
- Adding checkout UI, subscriptions, refunds, stored payment methods, balance reads, spend operations, or product catalogs.
- Changing swap behavior or existing authentication defaults.
- Adding TypeScript tests under `src/`.
- Modifying examples, lockfiles, runner configuration, TypeScript configuration, or Claude configuration.

## Existing Files

- `src/client.ts` constructs the public TypeScript `E3D` client and its modules.
- `src/http.ts` provides normalized requests, optional `x-api-key`, timeout handling, and injected `fetch`. Its default base URL is `https://e3d.ai/api`.
- `src/index.ts` defines package exports. TypeScript imports and exports use `.js` suffixes.
- `src/types.ts` contains shared client options and must not receive payment-specific types.
- `src/errors.ts` defines `E3DError` and HTTP error mapping and must not be modified.
- `src/normalize.ts` camelizes snake_case response keys.
- `python/e3d/client.py` is a transport-only dataclass client with `get` and `post`.
- `python/e3d/__init__.py` defines Python package exports.
- `README.md` is the package installation and usage guide.
- `package.json` provides `build` and `typecheck`; there is no TypeScript test runner.
- `pyproject.toml` packages modules under `python/`.
- No publishable Go client package currently exists. Go code under `examples/` is protected.

## Shared Constraints

- Keep the implementation within 25 changed files and 3000 changed lines.
- Do not modify `tsconfig.json`, `examples/**`, `package-lock.json`, `.codex-spec-runner/**`, `.claude/**`, or `.git/**`.
- Use only existing TypeScript runtime dependencies and the standard library for Python and Go.
- Preserve existing public APIs and zero-dependency behavior for Python and Go.
- Treat the live payments HTTP API as authoritative even though `GET /openapi` omits these routes.
- Use paths relative to the configured base URL.
- Reuse each language's existing or newly specified base-URL, HTTP, JSON, timeout, header, and error conventions.
- Omit empty optional fields from request bodies.
- Preserve existing `x-api-key` behavior. Payments must work without a configured API key; if one is configured, continue sending it as `x-api-key`.
- Do not add `Authorization: Bearer` to SDK payment requests.
- Public APIs use idiomatic language casing and explicitly map to the camelCase wire names.
- Never log quote payloads, transaction proofs, private keys, or returned credentials.
- Never include a returned `creditKey` in a client-generated exception message.
- Do not retry transfer callbacks automatically.
- Do not retry quote or purchase requests in a way that could cause another on-chain transfer.
- Propagate transport, callback, and API errors and never call purchase after a failed transfer.

## Wire Contract

### Quote Request

The quote JSON body may contain only:

- `product`: required string
- `wallet`: required string
- `requestedIssuedCredits`: required positive integer
- `promotionCode`: optional non-empty string

`paymentMethod` is client-side selection metadata and must never be sent to the quote endpoint.

### Quote Normalization

Construct the normalized quote by starting with all server response fields, then ensuring these fields are populated from the validated request when the response omits them:

- `product`
- `wallet`
- `requestedIssuedCredits`

A normalized quote contains:

- required `product`, `wallet`, and `requestedIssuedCredits`
- required selected `payment`
- optional `paymentOptions`
- all other server quote fields

Each payment object can contain:

- optional `id`
- optional `chain`
- optional `network`
- optional `chainId`
- optional `token`
- optional `tokenAddress`
- optional `treasuryAddress`
- optional `requiredAmount`
- any other server payment fields

Fields other than `requiredAmount` must not be fabricated. If selected `payment.requiredAmount` is absent or empty, copy the top-level `requiredWE3D`, or otherwise `requiredE3D`, to `payment.requiredAmount`. Reject the quote before transfer or purchase if no non-empty amount can be resolved.

Unknown fields must remain available to callers as follows:

- TypeScript: retain unknown quote, payment, and purchase-result properties directly through string index signatures.
- Python: retain unknown properties in an `extra: Dict[str, Any]` field on `CreditQuote`, `CreditPayment`, and `PurchaseCreditsResult`. Known fields must not also appear in `extra`.
- Go: retain unknown properties in an exported `Extra map[string]interface{}` field with `json:"-"` on `CreditQuote`, `CreditPayment`, and `PurchaseCreditsResult`, using custom JSON unmarshalling where necessary. Known fields must not also appear in `Extra`.

Unknown fields are response passthrough only and must not be copied into quote or purchase request bodies.

### Purchase Request

The purchase JSON body contains:

- `product`: required string
- `wallet`: required string
- `txHash`: required string
- `promotionCode`: only when the caller supplied a non-empty value
- `paymentMethod`: selected payment `id`, falling back to the caller's selector only when the selected payment has no non-empty `id`
- `paymentChain`: selected payment `chain`, when non-empty

Do not send quote identifiers. Do not send `walletAddress`, `transactionHash`, `credits`, `requestedIssuedCredits`, unknown response fields, or `apiKey`.

### Purchase Result

Expose:

- required `creditKey`
- optional returned metadata such as `issuedCredits`, `baseCredits`, `paymentTxHash`, and `usage`
- remaining server purchase fields using the language-specific unknown-field representation above

Do not install `creditKey` on the client.

## Validation

Perform validation before the corresponding network or transfer side effect:

- `product` and `wallet` must be strings that remain non-empty after trimming.
- `requestedIssuedCredits` must be a finite integer greater than zero.
- Python must reject `True` and `False` as credit counts.
- `promotionCode`, when included on the wire, must be a string that remains non-empty after trimming; omit `None`, missing, and whitespace-only values.
- `paymentMethod`, when provided, must be a string. Treat a whitespace-only selector as invalid rather than silently omitting it.
- A transfer callback is required and must be callable or non-nil as appropriate.
- The returned `txHash` must be a string that remains non-empty after trimming.
- Reject missing, non-string, or whitespace-only transaction hashes before purchase.
- Do not perform chain-specific address or hash-format validation.

For a supplied quote:

- Require non-empty `product` and `wallet`, a positive integral `requestedIssuedCredits`, and a payment that can be selected and assigned a required amount.
- Require supplied quote `product` and `wallet` to equal the validated purchase input values after trimming.
- If purchase input includes `requestedIssuedCredits`, require it to equal the supplied quote value.
- Reapply payment selection using the purchase input's `paymentMethod`.
- Reject mismatches before invoking transfer.

Error conventions:

- TypeScript validation failures use existing `E3DError` helpers with code `BAD_REQUEST`; do not modify `src/errors.ts`.
- Python validation failures use `ValueError`; existing HTTP failures remain `RuntimeError`.
- Go returns ordinary errors. Non-2xx errors must contain the HTTP status and safely decoded service details without including request headers, API keys, `creditKey`, or other credentials.

## Payment Selection

Apply selection after a quote response has been received and normalized, or after a supplied quote has been validated, but before transfer:

1. If `paymentMethod` is supplied, select the first `paymentOptions` entry whose non-empty `id`, `chain`, or `token` exactly equals the selector.
2. If a selector is supplied and no option matches, reject before transfer or purchase.
3. If no selector is supplied, preserve the server-selected `payment`.
4. If no selector is supplied, the server omitted `payment`, and `paymentOptions` is non-empty, select the first option.
5. If no payment can be selected, reject the malformed quote.
6. Resolve `requiredAmount` as described above.
7. Store the selected payment in normalized quote `payment`.

Do not fail or suppress the initial quote HTTP request merely because a selector might not match its response.

## Purchase Orchestration

Each purchase method must:

1. Validate the purchase input and transfer callback.
2. If no quote is supplied, require `requestedIssuedCredits` and obtain a quote using the same validation, request body, normalization, and selection behavior as the public quote method.
3. If a quote is supplied, skip the quote endpoint and validate, select, and normalize that quote as specified above.
4. Invoke the caller transfer callback exactly once with the complete normalized quote and selected payment.
5. Validate the returned transaction hash.
6. POST the purchase request body.
7. Return the normalized service result without mutating client authentication.

The callback is solely responsible for wallet access, approval, signing, broadcasting, and chain-specific dependencies. It returns only a transaction hash; Go additionally returns an error. Do not ask for or accept a private key.

## Locked Public APIs

### TypeScript

Create `src/payments.ts` and re-export its public types from `src/index.ts`.

```ts
export interface QuoteCreditsInput {
  product: string;
  wallet: string;
  requestedIssuedCredits: number;
  promotionCode?: string;
  paymentMethod?: string;
}

export interface CreditPayment {
  id?: string;
  chain?: string;
  network?: string;
  chainId?: string | number;
  token?: string;
  tokenAddress?: string;
  treasuryAddress?: string;
  requiredAmount?: string | number;
  [key: string]: unknown;
}

export interface CreditQuote {
  product: string;
  wallet: string;
  requestedIssuedCredits: number;
  payment: CreditPayment;
  paymentOptions?: CreditPayment[];
  [key: string]: unknown;
}

export type TransferCallback = (quote: CreditQuote) => Promise<string>;

export interface PurchaseCreditsInput {
  product: string;
  wallet: string;
  requestedIssuedCredits?: number;
  promotionCode?: string;
  paymentMethod?: string;
  quote?: CreditQuote;
  transfer: TransferCallback;
}

export interface PurchaseCreditsResult {
  creditKey: string;
  issuedCredits?: number;
  baseCredits?: number;
  paymentTxHash?: string;
  usage?: unknown;
  [key: string]: unknown;
}

export class PaymentsModule {
  quoteCredits(request: QuoteCreditsInput): Promise<CreditQuote>;
  purchaseCredits(request: PurchaseCreditsInput): Promise<PurchaseCreditsResult>;
}

```

### Reviewer 1: grok-build

Status: revise

Reason: Draft is truncated after the TypeScript API and lacks Python/Go surfaces, csr phases, tests, and verify commands.

Replacement Spec:

```spec
# Embedded Payments SDK

## Overview

Add a chain-library-neutral payments module to the TypeScript, Python, and Go SDKs. The module exposes the existing credit-purchase lifecycle: request a quote, execute the quoted on-chain transfer through caller-controlled wallet code, submit the transaction hash, and return the issued product payment credit key.

The default base URL is `https://e3d.ai/api`. Use exactly:

- `POST /payments/credits/quote`
- `POST /payments/credits/purchase`

Do not add another `/api` prefix. Resolved default URLs are `https://e3d.ai/api/payments/credits/quote` and `https://e3d.ai/api/payments/credits/purchase`.

Quotes have no server quote identifier or expiration field. Do not invent `quoteId`, `purchaseId`, or `expiresAt`. A quote is advisory; purchase re-validates the on-chain transfer.

The returned `creditKey` is a product payment credit key such as `e3d_maps_pay_...`. It is not the SDK `apiKey` or `x-api-key` credential and must not be installed on the client.

Because this repository does not contain the external `e3d-docs` site, add a repository-local Payments guide and link it from the root README.

Public entry points:

- TypeScript: `e3d.payments.quoteCredits(request)` and `e3d.payments.purchaseCredits(request)`
- Python: `client.payments.quote_credits(request)` and `client.payments.purchase_credits(request, transfer)`
- Go: `client.Payments.QuoteCredits(ctx, request)` and `client.Payments.PurchaseCredits(ctx, request, transfer)`

## Goals

- Expose the live credit quote and purchase lifecycle in all three SDKs.
- Keep wallet access, approval, signing, and broadcasting outside the SDK.
- Allow purchase methods to reuse a caller-supplied normalized quote.
- Preserve useful server response metadata, including unknown fields.
- Document an end-to-end flow that ends with a product payment credit key.
- Provide deterministic Python and Go tests without live API or chain access.

## Non-Goals

- Custodying private keys, seed phrases, or wallet credentials.
- Implementing wallets, signers, RPC providers, approvals, or transaction broadcasters.
- Adding ethers, web3.py, Go chain libraries, or other blockchain dependencies.
- Polling for blockchain confirmations.
- Changing payment-service endpoints or server behavior.
- Adding `Authorization: Bearer` to SDK payment requests.
- Mutating the configured SDK API key.
- Modifying the external `docs.e3d.ai` repository.
- Adding checkout UI, subscriptions, refunds, stored payment methods, balance reads, spend operations, or product catalogs.
- Changing swap behavior or existing authentication defaults.
- Adding TypeScript tests under `src/`.
- Modifying examples, lockfiles, runner configuration, TypeScript configuration, or Claude configuration.

## Existing Files

- `src/client.ts` constructs the public TypeScript `E3D` client and its modules.
- `src/http.ts` provides normalized requests, optional `x-api-key`, timeout handling, and injected `fetch`. Its default base URL is `https://e3d.ai/api`.
- `src/index.ts` defines package exports. TypeScript imports and exports use `.js` suffixes.
- `src/types.ts` contains shared client options and must not receive payment-specific types.
- `src/errors.ts` defines `E3DError` and HTTP error mapping and must not be modified.
- `src/normalize.ts` camelizes snake_case response keys.
- `python/e3d/client.py` is a transport-only dataclass client with `get` and `post`.
- `python/e3d/__init__.py` defines Python package exports.
- `README.md` is the package installation and usage guide.
- `package.json` provides `build` and `typecheck`; there is no TypeScript test runner.
- `pyproject.toml` packages modules under `python/`.
- No publishable Go client package currently exists. Go code under `examples/` is protected.

## Shared Constraints

- Keep the implementation within 25 changed files and 3000 changed lines.
- Do not modify `tsconfig.json`, `examples/**`, `package-lock.json`, `.codex-spec-runner/**`, `.claude/**`, or `.git/**`.
- Use only existing TypeScript runtime dependencies and the standard library for Python and Go.
- Preserve existing public APIs and zero-dependency behavior for Python and Go.
- Treat the live payments HTTP API as authoritative even though `GET /openapi` omits these routes.
- Use paths relative to the configured base URL.
- Reuse each language's existing or newly specified base-URL, HTTP, JSON, timeout, header, and error conventions.
- Build quote and purchase HTTP bodies explicitly. Do not JSON-serialize the public request object if that would emit client-only fields.
- Omit empty optional fields from request bodies.
- Preserve existing `x-api-key` behavior. Payments must work without a configured API key; if one is configured, continue sending it as `x-api-key`.
- Do not add `Authorization: Bearer` to SDK payment requests.
- Public APIs use idiomatic language casing and explicitly map to the camelCase wire names.
- Never log quote payloads, transaction proofs, private keys, or returned credentials.
- Never include a returned `creditKey` in a client-generated exception message.
- Do not retry transfer callbacks automatically.
- Do not retry quote or purchase requests in a way that could cause another on-chain transfer.
- Propagate transport, callback, and API errors and never call purchase after a failed transfer.

## Wire Contract

### Quote Request

The quote JSON body may contain only:

- `product`: required string
- `wallet`: required string
- `requestedIssuedCredits`: required positive integer
- `promotionCode`: optional non-empty string

`paymentMethod` is client-side selection metadata and must never be sent to the quote endpoint.

### Quote Normalization

Construct the normalized quote by starting with all server response fields, then ensuring these fields are populated from the validated request when the response omits them:

- `product`
- `wallet`
- `requestedIssuedCredits`

A normalized quote contains:

- required `product`, `wallet`, and `requestedIssuedCredits`
- required selected `payment`
- optional `paymentOptions`
- all other server quote fields

Each payment object can contain:

- optional `id`
- optional `chain`
- optional `network`
- optional `chainId`
- optional `token`
- optional `tokenAddress`
- optional `treasuryAddress`
- optional `requiredAmount`
- any other server payment fields

Fields other than `requiredAmount` must not be fabricated. If selected `payment.requiredAmount` is absent or empty, copy the top-level `requiredWE3D`, or otherwise `requiredE3D`, to `payment.requiredAmount`. Reject the quote before transfer or purchase if no non-empty amount can be resolved.

Unknown fields must remain available to callers as follows:

- TypeScript: retain unknown quote, payment, and purchase-result properties directly through string index signatures.
- Python: retain unknown properties in an `extra: Dict[str, Any]` field on `CreditQuote`, `CreditPayment`, and `PurchaseCreditsResult`. Known fields must not also appear in `extra`.
- Go: retain unknown properties in an exported `Extra map[string]interface{}` field with `json:"-"` on `CreditQuote`, `CreditPayment`, and `PurchaseCreditsResult`, using custom JSON unmarshalling where necessary. Known fields must not also appear in `Extra`.

Unknown fields are response passthrough only and must not be copied into quote or purchase request bodies.

Public `quoteCredits` / `quote_credits` / `QuoteCredits` must apply payment selection and required-amount resolution before returning so the caller receives a transfer-ready quote.

### Purchase Request

The purchase JSON body contains:

- `product`: required string
- `wallet`: required string
- `txHash`: required string
- `promotionCode`: only when the caller supplied a non-empty value
- `paymentMethod`: selected payment `id`, falling back to the caller's selector only when the selected payment has no non-empty `id`
- `paymentChain`: selected payment `chain`, when non-empty

Do not send quote identifiers. Do not send `walletAddress`, `transactionHash`, `credits`, `requestedIssuedCredits`, unknown response fields, or `apiKey`.

### Purchase Result

Expose:

- required `creditKey`
- optional returned metadata such as `issuedCredits`, `baseCredits`, `paymentTxHash`, and `usage`
- remaining server purchase fields using the language-specific unknown-field representation above

Do not install `creditKey` on the client.

## Validation

Perform validation before the corresponding network or transfer side effect:

- `product` and `wallet` must be strings that remain non-empty after trimming.
- `requestedIssuedCredits` must be a finite integer greater than zero.
- Python must reject `True` and `False` as credit counts.
- `promotionCode`, when included on the wire, must be a string that remains non-empty after trimming; omit `None`, missing, and whitespace-only values.
- `paymentMethod`, when provided, must be a string. Treat a whitespace-only selector as invalid rather than silently omitting it.
- A transfer callback is required and must be callable or non-nil as appropriate.
- The returned `txHash` must be a string that remains non-empty after trimming.
- Reject missing, non-string, or whitespace-only transaction hashes before purchase.
- Do not perform chain-specific address or hash-format validation.

For a supplied quote:

- Require non-empty `product` and `wallet`, a positive integral `requestedIssuedCredits`, and a payment that can be selected and assigned a required amount.
- Require supplied quote `product` and `wallet` to equal the validated purchase input values after trimming.
- If purchase input includes `requestedIssuedCredits`, require it to equal the supplied quote value.
- Reapply payment selection using the purchase input's `paymentMethod`.
- Reject mismatches before invoking transfer.

Error conventions:

- TypeScript validation failures use existing `E3DError` helpers with code `BAD_REQUEST`; do not modify `src/errors.ts`.
- Python validation failures use `ValueError`; existing HTTP failures remain `RuntimeError`.
- Go returns ordinary errors. Non-2xx errors must contain the HTTP status and safely decoded service details such as `message` or `code`, without including request headers, API keys, `creditKey`, or other credentials.

## Payment Selection

Apply selection after a quote response has been received and normalized, or after a supplied quote has been validated, but before transfer:

1. If `paymentMethod` is supplied, select the first `paymentOptions` entry whose non-empty `id`, `chain`, or `token` exactly equals the selector.
2. If a selector is supplied and no option matches, reject before transfer or purchase.
3. If no selector is supplied, preserve the server-selected `payment`.
4. If no selector is supplied, the server omitted `payment`, and `paymentOptions` is non-empty, select the first option.
5. If no payment can be selected, reject the malformed quote.
6. Resolve `requiredAmount` as described above.
7. Store the selected payment in normalized quote `payment`.

Do not fail or suppress the initial quote HTTP request merely because a selector might not match its response.

## Purchase Orchestration

Each purchase method must:

1. Validate the purchase input and transfer callback.
2. If no quote is supplied, require `requestedIssuedCredits` and obtain a quote using the same validation, request body, normalization, and selection behavior as the public quote method.
3. If a quote is supplied, skip the quote endpoint and validate, select, and normalize that quote as specified above.
4. Invoke the caller transfer callback exactly once with the complete normalized quote and selected payment.
5. Validate the returned transaction hash.
6. POST the purchase request body.
7. Return the normalized service result without mutating client authentication.

The callback is solely responsible for wallet access, approval, signing, broadcasting, and chain-specific dependencies. It returns only a transaction hash; Go additionally returns an error. Do not ask for or accept a private key.

## Locked Public APIs

### TypeScript

Create `src/payments.ts` and re-export its public types from `src/index.ts`. Keep types compatible with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`. Omit optional properties instead of assigning `undefined`.

- `QuoteCreditsInput`: required `product: string`, `wallet: string`, `requestedIssuedCredits: number`; optional `promotionCode?: string`, `paymentMethod?: string`
- `CreditPayment`: optional `id?: string`, `chain?: string`, `network?: string`, `chainId?: string | number`, `token?: string`, `tokenAddress?: string`, `treasuryAddress?: string`, `requiredAmount?: string | number`, plus `[key: string]: unknown`
- `CreditQuote`: required `product: string`, `wallet: string`, `requestedIssuedCredits: number`, `payment: CreditPayment`; optional `paymentOptions?: CreditPayment[]`; plus `[key: string]: unknown`
- `TransferCallback`: `(quote: CreditQuote) => Promise<string>`
- `PurchaseCreditsInput`: required `product: string`, `wallet: string`, `transfer: TransferCallback`; optional `requestedIssuedCredits?: number`, `promotionCode?: string`, `paymentMethod?: string`, `quote?: CreditQuote`
- `PurchaseCreditsResult`: required `creditKey: string`; optional `issuedCredits?: number`, `baseCredits?: number`, `paymentTxHash?: string`, `usage?: unknown`; plus `[key: string]: unknown`
- `PaymentsModule` constructed with the existing `HttpClient`, exposing `quoteCredits(request: QuoteCreditsInput): Promise<CreditQuote>` and `purchaseCredits(request: PurchaseCreditsInput): Promise<PurchaseCreditsResult>`
- Expose the module as `readonly payments` on `E3D`

The TypeScript transfer callback lives on the purchase input object, not as a second method argument.

### Python

Create `python/e3d/payments.py` and re-export public types from `python/e3d/__init__.py`. Use dataclasses, `from __future__ import annotations`, and Python 3.8-compatible typing (`Optional`, `Dict`, `List`, `Any`, `Callable`, `Union`). Public field names are snake_case and must map to the camelCase wire names above.

- `QuoteCreditsInput`: `product: str`, `wallet: str`, `requested_issued_credits: int`; optional `promotion_code`, `payment_method`
- `CreditPayment`: optional `id`, `chain`, `network`, `chain_id` (`str` or `int`), `token`, `token_address`, `treasury_address`, `required_amount` (`str`, `int`, or `float`); `extra: Dict[str, Any]` defaulting to a new dict
- `CreditQuote`: `product`, `wallet`, `requested_issued_credits`, `payment: CreditPayment`; optional `payment_options: Optional[List[CreditPayment]]`; `extra` dict
- `TransferCallback`: `Callable[[CreditQuote], str]` (synchronous only)
- `PurchaseCreditsInput`: `product`, `wallet`; optional `requested_issued_credits`, `promotion_code`, `payment_method`, `quote`. Do not put `transfer` on this dataclass
- `PurchaseCreditsResult`: `credit_key: str`; optional `issued_credits`, `base_credits`, `payment_tx_hash`, `usage`; `extra` dict
- `PaymentsModule.quote_credits(request: QuoteCreditsInput) -> CreditQuote`
- `PaymentsModule.purchase_credits(request: PurchaseCreditsInput, transfer: TransferCallback) -> PurchaseCreditsResult`

Snake_case to camelCase mapping:

- `requested_issued_credits` -> `requestedIssuedCredits`
- `promotion_code` -> `promotionCode`
- `payment_method` -> `paymentMethod`
- `payment_options` -> `paymentOptions`
- `token_address` -> `tokenAddress`
- `treasury_address` -> `treasuryAddress`
- `chain_id` -> `chainId`
- `required_amount` -> `requiredAmount`
- `credit_key` -> `creditKey`
- `issued_credits` -> `issuedCredits`
- `base_credits` -> `baseCredits`
- `payment_tx_hash` -> `paymentTxHash`
- `payment_chain` -> `paymentChain`

Known Python fields listed above must not also appear in `extra`. Attach `payments` on `E3DClient` without breaking the dataclass constructor: `init=False` field set in `__post_init__`; do not add a new required constructor argument. Avoid circular imports (`TYPE_CHECKING` / string annotations as needed). Bind each `PaymentsModule` to the same client instance. Reuse `E3DClient.post`. Do not introduce an async API.

### Go

Create a publishable standard-library-only module at `go/go.mod` with module path `github.com/spacepacket1/e3d-sdk/go` and package import path `github.com/spacepacket1/e3d-sdk/go/e3d`. Use a Go 1.22 directive. Do not modify or import protected `examples/**`.

- `QuoteCreditsRequest`: `Product string`, `Wallet string`, `RequestedIssuedCredits int`, `PromotionCode string`, `PaymentMethod string`
- `CreditPayment`: optional `ID`, `Chain`, `Network`, `ChainID` (`interface{}` so string or number is preserved), `Token`, `TokenAddress`, `TreasuryAddress`, `RequiredAmount` (`interface{}`); `Extra map[string]interface{}` with `json:"-"`
- `CreditQuote`: `Product`, `Wallet`, `RequestedIssuedCredits`, `Payment CreditPayment`, `PaymentOptions []CreditPayment`, `Extra map[string]interface{}` with `json:"-"`
- `TransferFunc`: `func(ctx context.Context, quote CreditQuote) (txHash string, err error)`
- `PurchaseCreditsInput`: `Product`, `Wallet`, `RequestedIssuedCredits int` (required when `Quote` is nil), `PromotionCode string`, `PaymentMethod string`, `Quote *CreditQuote`
- `PurchaseCreditsResult`: `CreditKey string`; optional `IssuedCredits`, `BaseCredits`, `PaymentTxHash`, `Usage interface{}`; `Extra map[string]interface{}` with `json:"-"`
- JSON tags must match the camelCase wire names, with `omitempty` on optional request fields
- `QuoteCredits(ctx context.Context, request QuoteCreditsRequest) (CreditQuote, error)`
- `PurchaseCredits(ctx context.Context, input PurchaseCreditsInput, transfer TransferFunc) (PurchaseCreditsResult, error)`

Construct HTTP bodies explicitly so `PaymentMethod` on public request types is never marshaled onto the quote wire body.

Client surface:

- `New()` constructs a `Client` using the same environment defaults as the example client (`E3D_BASE_URL`, `E3D_API_KEY`, `E3D_API_KEY_HEADER`, `E3D_TIMEOUT_MS`) with default base URL `https://e3d.ai/api`
- Exported configurable fields: `BaseURL`, `APIKey`, `APIKeyHeader`, `Timeout`, and an injectable `*http.Client`
- Every constructed client exposes a non-nil `Payments` service
- Send JSON with `http.NewRequestWithContext`
- If `ctx` is done before quote, transfer, or purchase, skip that step and return the context error
- Do not port unrelated example endpoints

## Phase 1 - TypeScript Payments Module

<!-- runner:model=codex:gpt-5.4 -->
<!-- pilot:touches=src/payments.ts -->
<!-- pilot:touches=src/client.ts -->
<!-- pilot:touches=src/index.ts -->
<!-- runner:read=src/http.ts -->
<!-- runner:read=src/errors.ts -->
<!-- runner:read=src/client.ts -->
<!-- runner:read=src/normalize.ts -->
<!-- runner:verify=npm install && npm run typecheck -->

### Requirements

- Implement the locked TypeScript types and `PaymentsModule` in `src/payments.ts`. Do not add payment types to `src/types.ts`.
- Back the module with the existing `HttpClient`.
- Implement `quoteCredits` and `purchaseCredits` with the shared validation, normalization, selection, passthrough, and orchestration contract.
- Put the required async transfer callback on the purchase input as `transfer`.
- Initialize `readonly payments` on `E3D` with the same `HttpClient` as other API-backed modules.
- Export the module and public payment types from `src/index.ts` using `.js` suffixes, without removing existing exports.
- Do not change HTTP normalization, authentication, swap, or error semantics.
- Do not add tests or other non-production files under `src/`.

### Acceptance Criteria

- `new E3D().payments.quoteCredits(...)` and `new E3D().payments.purchaseCredits(...)` are public and type-safe.
- Quote sends exactly one POST to `/payments/credits/quote` and never includes `paymentMethod` in that body.
- Purchase without a supplied quote performs quote, one transfer callback, and purchase exactly once and in that order.
- Purchase with a supplied quote skips the quote request.
- Invalid input, unmatched payment selection, transfer rejection, and invalid hashes prevent purchase.
- Unknown response fields remain accessible through index signatures.
- `creditKey` is returned without changing the client API key.
- Existing TypeScript consumers continue to typecheck.
- `npm install && npm run typecheck` succeeds without modifying `package-lock.json`.

## Phase 2 - Python Payments Module

<!-- runner:model=codex:gpt-5.4 -->
<!-- pilot:touches=python/e3d/payments.py -->
<!-- pilot:touches=python/e3d/client.py -->
<!-- pilot:touches=python/e3d/__init__.py -->
<!-- pilot:touches=python/tests/test_payments.py -->
<!-- runner:read=python/e3d/client.py -->
<!-- runner:read=python/e3d/__init__.py -->
<!-- runner:verify=PYTHONPATH=python python3 -m compileall -q python/e3d python/tests -->
<!-- runner:verify=PYTHONPATH=python python3 -m unittest discover -s python/tests -p 'test_*.py' -->
<!-- runner:verify=npm install && npm run typecheck -->

### Requirements

- Add a standard-library-only `PaymentsModule` exposed as `E3DClient.payments`.
- Preserve the dataclass constructor with an `init=False` field set in `__post_init__`.
- Reuse `E3DClient.post` for both endpoints.
- Avoid circular imports and bind each module to its own client instance.
- Implement the complete shared validation, normalization, selection, passthrough, and orchestration contract.
- Accept a synchronous transfer callable as a separate `transfer` argument.
- Export all locked payment symbols from `python/e3d/__init__.py`.
- Do not add `python/tests/__init__.py` (so tests are not packaged).
- Add `unittest` coverage using a subclassed or otherwise fake client transport that overrides `request` rather than adding a constructor dependency.

Tests must cover:

- endpoint paths and POST methods
- camelCase request bodies
- omission of `paymentMethod` and unknown fields from quote requests
- optional-field omission
- quote normalization from request values
- payment selection and unmatched selection
- required-amount fallback from `requiredWE3D` / `requiredE3D`
- unknown-field preservation in `extra`
- quote, transfer, purchase ordering
- supplied-quote reuse and mismatch rejection
- validation before side effects, including boolean credit counts
- transfer exceptions and invalid hashes
- successful `credit_key` return without mutation of `api_key`

### Acceptance Criteria

- `E3DClient().payments.quote_credits(...)` and `E3DClient().payments.purchase_credits(...)` are available without extra dependencies.
- Python matches the shared HTTP and side-effect contract.
- Supplying a quote avoids another quote request.
- Invalid input and transfer failures cannot trigger purchase.
- Unknown response fields remain available through `extra`.
- `PYTHONPATH=python python3 -m unittest discover -s python/tests -p 'test_*.py'` succeeds without network access.
- `PYTHONPATH=python python3 -m compileall -q python/e3d python/tests` succeeds.
- TypeScript typechecking remains successful without modifying `package-lock.json`.

## Phase 3 - Go SDK and Payments Service

<!-- runner:model=codex:gpt-5.4 -->
<!-- pilot:touches=go/go.mod -->
<!-- pilot:touches=go/e3d/client.go -->
<!-- pilot:touches=go/e3d/payments.go -->
<!-- pilot:touches=go/e3d/payments_test.go -->
<!-- runner:read=examples/go/e3dclient/client.go -->
<!-- runner:read=examples/go/go.mod -->
<!-- runner:read=src/http.ts -->
<!-- runner:verify=(cd go && go test ./... && go vet ./...) -->
<!-- runner:verify=npm install && npm run typecheck -->

### Requirements

- Create a standard-library-only Go module under `go/` with the locked module path and Go 1.22 directive.
- Do not modify the protected example module.
- Implement a configurable `Client` and non-nil `Payments` service as specified above.
- Implement the locked types and methods and the complete shared validation, normalization, selection, passthrough, and orchestration contract.
- Check `ctx.Err()` before quote, before transfer, and before purchase.
- Never use `Authorization: Bearer` for SDK payment requests.
- Safely decode non-2xx service errors without leaking credentials.
- Add deterministic `httptest` coverage.

Tests must cover:

- paths, methods, and camelCase bodies
- quote-body field allowlist
- optional-field omission
- custom base URL, API key header, and injected client behavior
- call ordering
- validation before side effects
- context cancellation before each step
- selection and unmatched selection
- required-amount fallback
- unknown-field preservation in `Extra`
- transfer errors and invalid hashes
- supplied-quote reuse and mismatch rejection
- non-2xx error status and safe details
- successful `CreditKey` return without client mutation

### Acceptance Criteria

- A consumer can import `github.com/spacepacket1/e3d-sdk/go/e3d` and call `client.Payments.QuoteCredits` and `client.Payments.PurchaseCredits`.
- The module has no third-party dependencies.
- Tests make no live network or blockchain calls.
- Existing quotes can be reused without another quote request.
- Invalid input, canceled contexts, and transfer errors prevent later side effects.
- Unknown response fields remain available through `Extra`.
- `(cd go && go test ./... && go vet ./...)` succeeds.
- TypeScript typechecking remains successful without modifying `package-lock.json`.

## Phase 4 - Payments Conversion Guide

<!-- runner:model=codex:gpt-5.4 -->
<!-- pilot:touches=README.md -->
<!-- pilot:touches=docs/payments.md -->
<!-- runner:read=src/payments.ts -->
<!-- runner:read=python/e3d/payments.py -->
<!-- runner:read=go/e3d/payments.go -->
<!-- runner:verify=npm install && npm run typecheck -->
<!-- runner:verify=PYTHONPATH=python python3 -m unittest discover -s python/tests -p 'test_*.py' -->
<!-- runner:verify=(cd go && go test ./...) -->

### Requirements

- Add `payments` to the README module list and link to `docs/payments.md`.
- Create `docs/payments.md` as the repository-local conversion guide suitable for later publication to the separate docs site.
- Explain the quote, caller-controlled wallet transfer, purchase confirmation, and product credit-key lifecycle, and which steps contact E3D versus the caller's wallet.
- Provide concise TypeScript, Python, and Go examples using the exact implemented symbols and signatures.
- TypeScript examples must pass `transfer` on the purchase input object. Python and Go examples must pass `transfer` as the separate argument.
- Use environment-based credential and wallet configuration and placeholders rather than real secrets, addresses, or transaction hashes.
- Keep transaction signing and broadcasting entirely inside caller callbacks.
- State that callers must send the exact quoted asset and amount to the quoted treasury on the quoted chain.
- Instruct callers to present destination, asset, amount, and chain for approval before an irreversible transfer.
- Explain that quotes are advisory, have no quote ID or server expiration, and may become stale as rates or discounts change.
- Explain that `creditKey` is a product payment key used as `Authorization: Bearer <creditKey>` for product APIs, not the SDK `apiKey` or `x-api-key`.
- Do not show installing the returned key on an SDK client.
- Explain that a purchase-confirmation retry may reuse the same confirmed transaction hash and must not blindly initiate another transfer.
- Keep existing quick-start and swap documentation intact.
- Do not claim subscriptions, refunds, fiat support, automatic wallet signing, balance APIs, or publication to the external documentation site.

### Acceptance Criteria

- A reader can discover payments from the root README and complete the workflow in any supported language from the guide alone.
- Every documented symbol and signature matches the implemented TypeScript, Python, and Go APIs, including `requestedIssuedCredits`, `txHash`, and `creditKey`.
- Examples keep private keys and signing under caller control.
- Documentation distinguishes purchase-confirmation retries from transfer retries.
- No protected example or external documentation file is modified.
- The cumulative change remains within 25 files and 3000 changed lines.
- `npm install && npm run typecheck`, the Python unittest command, and `(cd go && go test ./...)` succeed without modifying `package-lock.json`.
```

Raw Response:

```text
I'll review the draft against the repo and the rest of the payments contract so the negotiate-loop verdict is based on the actual SDK, not just the text.The TypeScript surface is only part of the draft; next I’ll check prior rounds, the live payments API, and the other SDK modules for missing locked APIs.The draft cuts off at the TypeScript API; I’ll pull the prior round and the live payments contract so the replacement spec, if needed, is complete.I’ll pull the live credits contract and a complete prior spec so I can judge whether this truncated draft is implementable as written.The current draft stops at the TypeScript API and is missing the Python/Go surfaces plus csr phases, so I’m restoring a complete implementable spec.---STATUS---
status: revise
reason: Draft is truncated after the TypeScript API and lacks Python/Go surfaces, csr phases, tests, and verify commands.
```spec
# Embedded Payments SDK

## Overview

Add a chain-library-neutral payments module to the TypeScript, Python, and Go SDKs. The module exposes the existing credit-purchase lifecycle: request a quote, execute the quoted on-chain transfer through caller-controlled wallet code, submit the transaction hash, and return the issued product payment credit key.

The default base URL is `https://e3d.ai/api`. Use exactly:

- `POST /payments/credits/quote`
- `POST /payments/credits/purchase`

Do not add another `/api` prefix. Resolved default URLs are `https://e3d.ai/api/payments/credits/quote` and `https://e3d.ai/api/payments/credits/purchase`.

Quotes have no server quote identifier or expiration field. Do not invent `quoteId`, `purchaseId`, or `expiresAt`. A quote is advisory; purchase re-validates the on-chain transfer.

The returned `creditKey` is a product payment credit key such as `e3d_maps_pay_...`. It is not the SDK `apiKey` or `x-api-key` credential and must not be installed on the client.

Because this repository does not contain the external `e3d-docs` site, add a repository-local Payments guide and link it from the root README.

Public entry points:

- TypeScript: `e3d.payments.quoteCredits(request)` and `e3d.payments.purchaseCredits(request)`
- Python: `client.payments.quote_credits(request)` and `client.payments.purchase_credits(request, transfer)`
- Go: `client.Payments.QuoteCredits(ctx, request)` and `client.Payments.PurchaseCredits(ctx, request, transfer)`

## Goals

- Expose the live credit quote and purchase lifecycle in all three SDKs.
- Keep wallet access, approval, signing, and broadcasting outside the SDK.
- Allow purchase methods to reuse a caller-supplied normalized quote.
- Preserve useful server response metadata, including unknown fields.
- Document an end-to-end flow that ends with a product payment credit key.
- Provide deterministic Python and Go tests without live API or chain access.

## Non-Goals

- Custodying private keys, seed phrases, or wallet credentials.
- Implementing wallets, signers, RPC providers, approvals, or transaction broadcasters.
- Adding ethers, web3.py, Go chain libraries, or other blockchain dependencies.
- Polling for blockchain confirmations.
- Changing payment-service endpoints or server behavior.
- Adding `Authorization: Bearer` to SDK payment requests.
- Mutating the configured SDK API key.
- Modifying the external `docs.e3d.ai` repository.
- Adding checkout UI, subscriptions, refunds, stored payment methods, balance reads, spend operations, or product catalogs.
- Changing swap behavior or existing authentication defaults.
- Adding TypeScript tests under `src/`.
- Modifying examples, lockfiles, runner configuration, TypeScript configuration, or Claude configuration.

## Existing Files

- `src/client.ts` constructs the public TypeScript `E3D` client and its modules.
- `src/http.ts` provides normalized requests, optional `x-api-key`, timeout handling, and injected `fetch`. Its default base URL is `https://e3d.ai/api`.
- `src/index.ts` defines package exports. TypeScript imports and exports use `.js` suffixes.
- `src/types.ts` contains shared client options and must not receive payment-specific types.
- `src/errors.ts` defines `E3DError` and HTTP error mapping and must not be modified.
- `src/normalize.ts` camelizes snake_case response keys.
- `python/e3d/client.py` is a transport-only dataclass client with `get` and `post`.
- `python/e3d/__init__.py` defines Python package exports.
- `README.md` is the package installation and usage guide.
- `package.json` provides `build` and `typecheck`; there is no TypeScript test runner.
- `pyproject.toml` packages modules under `python/`.
- No publishable Go client package currently exists. Go code under `examples/` is protected.

## Shared Constraints

- Keep the implementation within 25 changed files and 3000 changed lines.
- Do not modify `tsconfig.json`, `examples/**`, `package-lock.json`, `.codex-spec-runner/**`, `.claude/**`, or `.git/**`.
- Use only existing TypeScript runtime dependencies and the standard library for Python and Go.
- Preserve existing public APIs and zero-dependency behavior for Python and Go.
- Treat the live payments HTTP API as authoritative even though `GET /openapi` omits these routes.
- Use paths relative to the configured base URL.
- Reuse each language's existing or newly specified base-URL, HTTP, JSON, timeout, header, and error conventions.
- Build quote and purchase HTTP bodies explicitly. Do not JSON-serialize the public request object if that would emit client-only fields.
- Omit empty optional fields from request bodies.
- Preserve existing `x-api-key` behavior. Payments must work without a configured API key; if one is configured, continue sending it as `x-api-key`.
- Do not add `Authorization: Bearer` to SDK payment requests.
- Public APIs use idiomatic language casing and explicitly map to the camelCase wire names.
- Never log quote payloads, transaction proofs, private keys, or returned credentials.
- Never include a returned `creditKey` in a client-generated exception message.
- Do not retry transfer callbacks automatically.
- Do not retry quote or purchase requests in a way that could cause another on-chain transfer.
- Propagate transport, callback, and API errors and never call purchase after a failed transfer.

## Wire Contract

### Quote Request

The quote JSON body may contain only:

- `product`: required string
- `wallet`: required string
- `requestedIssuedCredits`: required positive integer
- `promotionCode`: optional non-empty string

`paymentMethod` is client-side selection metadata and must never be sent to the quote endpoint.

### Quote Normalization

Construct the normalized quote by starting with all server response fields, then ensuring these fields are populated from the validated request when the response omits them:

- `product`
- `wallet`
- `requestedIssuedCredits`

A normalized quote contains:

- required `product`, `wallet`, and `requestedIssuedCredits`
- required selected `payment`
- optional `paymentOptions`
- all other server quote fields

Each payment object can contain:

- optional `id`
- optional `chain`
- optional `network`
- optional `chainId`
- optional `token`
- optional `tokenAddress`
- optional `treasuryAddress`
- optional `requiredAmount`
- any other server payment fields

Fields other than `requiredAmount` must not be fabricated. If selected `payment.requiredAmount` is absent or empty, copy the top-level `requiredWE3D`, or otherwise `requiredE3D`, to `payment.requiredAmount`. Reject the quote before transfer or purchase if no non-empty amount can be resolved.

Unknown fields must remain available to callers as follows:

- TypeScript: retain unknown quote, payment, and purchase-result properties directly through string index signatures.
- Python: retain unknown properties in an `extra: Dict[str, Any]` field on `CreditQuote`, `CreditPayment`, and `PurchaseCreditsResult`. Known fields must not also appear in `extra`.
- Go: retain unknown properties in an exported `Extra map[string]interface{}` field with `json:"-"` on `CreditQuote`, `CreditPayment`, and `PurchaseCreditsResult`, using custom JSON unmarshalling where necessary. Known fields must not also appear in `Extra`.

Unknown fields are response passthrough only and must not be copied into quote or purchase request bodies.

Public `quoteCredits` / `quote_credits` / `QuoteCredits` must apply payment selection and required-amount resolution before returning so the caller receives a transfer-ready quote.

### Purchase Request

The purchase JSON body contains:

- `product`: required string
- `wallet`: required string
- `txHash`: required string
- `promotionCode`: only when the caller supplied a non-empty value
- `paymentMethod`: selected payment `id`, falling back to the caller's selector only when the selected payment has no non-empty `id`
- `paymentChain`: selected payment `chain`, when non-empty

Do not send quote identifiers. Do not send `walletAddress`, `transactionHash`, `credits`, `requestedIssuedCredits`, unknown response fields, or `apiKey`.

### Purchase Result

Expose:

- required `creditKey`
- optional returned metadata such as `issuedCredits`, `baseCredits`, `paymentTxHash`, and `usage`
- remaining server purchase fields using the language-specific unknown-field representation above

Do not install `creditKey` on the client.

## Validation

Perform validation before the corresponding network or transfer side effect:

- `product` and `wallet` must be strings that remain non-empty after trimming.
- `requestedIssuedCredits` must be a finite integer greater than zero.
- Python must reject `True` and `False` as credit counts.
- `promotionCode`, when included on the wire, must be a string that remains non-empty after trimming; omit `None`, missing, and whitespace-only values.
- `paymentMethod`, when provided, must be a string. Treat a whitespace-only selector as invalid rather than silently omitting it.
- A transfer callback is required and must be callable or non-nil as appropriate.
- The returned `txHash` must be a string that remains non-empty after trimming.
- Reject missing, non-string, or whitespace-only transaction hashes before purchase.
- Do not perform chain-specific address or hash-format validation.

For a supplied quote:

- Require non-empty `product` and `wallet`, a positive integral `requestedIssuedCredits`, and a payment that can be selected and assigned a required amount.
- Require supplied quote `product` and `wallet` to equal the validated purchase input values after trimming.
- If purchase input includes `requestedIssuedCredits`, require it to equal the supplied quote value.
- Reapply payment selection using the purchase input's `paymentMethod`.
- Reject mismatches before invoking transfer.

Error conventions:

- TypeScript validation failures use existing `E3DError` helpers with code `BAD_REQUEST`; do not modify `src/errors.ts`.
- Python validation failures use `ValueError`; existing HTTP failures remain `RuntimeError`.
- Go returns ordinary errors. Non-2xx errors must contain the HTTP status and safely decoded service details such as `message` or `code`, without including request headers, API keys, `creditKey`, or other credentials.

## Payment Selection

Apply selection after a quote response has been received and normalized, or after a supplied quote has been validated, but before transfer:

1. If `paymentMethod` is supplied, select the first `paymentOptions` entry whose non-empty `id`, `chain`, or `token` exactly equals the selector.
2. If a selector is supplied and no option matches, reject before transfer or purchase.
3. If no selector is supplied, preserve the server-selected `payment`.
4. If no selector is supplied, the server omitted `payment`, and `paymentOptions` is non-empty, select the first option.
5. If no payment can be selected, reject the malformed quote.
6. Resolve `requiredAmount` as described above.
7. Store the selected payment in normalized quote `payment`.

Do not fail or suppress the initial quote HTTP request merely because a selector might not match its response.

## Purchase Orchestration

Each purchase method must:

1. Validate the purchase input and transfer callback.
2. If no quote is supplied, require `requestedIssuedCredits` and obtain a quote using the same validation, request body, normalization, and selection behavior as the public quote method.
3. If a quote is supplied, skip the quote endpoint and validate, select, and normalize that quote as specified above.
4. Invoke the caller transfer callback exactly once with the complete normalized quote and selected payment.
5. Validate the returned transaction hash.
6. POST the purchase request body.
7. Return the normalized service result without mutating client authentication.

The callback is solely responsible for wallet access, approval, signing, broadcasting, and chain-specific dependencies. It returns only a transaction hash; Go additionally returns an error. Do not ask for or accept a private key.

## Locked Public APIs

### TypeScript

Create `src/payments.ts` and re-export its public types from `src/index.ts`. Keep types compatible with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`. Omit optional properties instead of assigning `undefined`.

- `QuoteCreditsInput`: required `product: string`, `wallet: string`, `requestedIssuedCredits: number`; optional `promotionCode?: string`, `paymentMethod?: string`
- `CreditPayment`: optional `id?: string`, `chain?: string`, `network?: string`, `chainId?: string | number`, `token?: string`, `tokenAddress?: string`, `treasuryAddress?: string`, `requiredAmount?: string | number`, plus `[key: string]: unknown`
- `CreditQuote`: required `product: string`, `wallet: string`, `requestedIssuedCredits: number`, `payment: CreditPayment`; optional `paymentOptions?: CreditPayment[]`; plus `[key: string]: unknown`
- `TransferCallback`: `(quote: CreditQuote) => Promise<string>`
- `PurchaseCreditsInput`: required `product: string`, `wallet: string`, `transfer: TransferCallback`; optional `requestedIssuedCredits?: number`, `promotionCode?: string`, `paymentMethod?: string`, `quote?: CreditQuote`
- `PurchaseCreditsResult`: required `creditKey: string`; optional `issuedCredits?: number`, `baseCredits?: number`, `paymentTxHash?: string`, `usage?: unknown`; plus `[key: string]: unknown`
- `PaymentsModule` constructed with the existing `HttpClient`, exposing `quoteCredits(request: QuoteCreditsInput): Promise<CreditQuote>` and `purchaseCredits(request: PurchaseCreditsInput): Promise<PurchaseCreditsResult>`
- Expose the module as `readonly payments` on `E3D`

The TypeScript transfer callback lives on the purchase input object, not as a second method argument.

### Python

Create `python/e3d/payments.py` and re-export public types from `python/e3d/__init__.py`. Use dataclasses, `from __future__ import annotations`, and Python 3.8-compatible typing (`Optional`, `Dict`, `List`, `Any`, `Callable`, `Union`). Public field names are snake_case and must map to the camelCase wire names above.

- `QuoteCreditsInput`: `product: str`, `wallet: str`, `requested_issued_credits: int`; optional `promotion_code`, `payment_method`
- `CreditPayment`: optional `id`, `chain`, `network`, `chain_id` (`str` or `int`), `token`, `token_address`, `treasury_address`, `required_amount` (`str`, `int`, or `float`); `extra: Dict[str, Any]` defaulting to a new dict
- `CreditQuote`: `product`, `wallet`, `requested_issued_credits`, `payment: CreditPayment`; optional `payment_options: Optional[List[CreditPayment]]`; `extra` dict
- `TransferCallback`: `Callable[[CreditQuote], str]` (synchronous only)
- `PurchaseCreditsInput`: `product`, `wallet`; optional `requested_issued_credits`, `promotion_code`, `payment_method`, `quote`. Do not put `transfer` on this dataclass
- `PurchaseCreditsResult`: `credit_key: str`; optional `issued_credits`, `base_credits`, `payment_tx_hash`, `usage`; `extra` dict
- `PaymentsModule.quote_credits(request: QuoteCreditsInput) -> CreditQuote`
- `PaymentsModule.purchase_credits(request: PurchaseCreditsInput, transfer: TransferCallback) -> PurchaseCreditsResult`

Snake_case to camelCase mapping:

- `requested_issued_credits` -> `requestedIssuedCredits`
- `promotion_code` -> `promotionCode`
- `payment_method` -> `paymentMethod`
- `payment_options` -> `paymentOptions`
- `token_address` -> `tokenAddress`
- `treasury_address` -> `treasuryAddress`
- `chain_id` -> `chainId`
- `required_amount` -> `requiredAmount`
- `credit_key` -> `creditKey`
- `issued_credits` -> `issuedCredits`
- `base_credits` -> `baseCredits`
- `payment_tx_hash` -> `paymentTxHash`
- `payment_chain` -> `paymentChain`

Known Python fields listed above must not also appear in `extra`. Attach `payments` on `E3DClient` without breaking the dataclass constructor: `init=False` field set in `__post_init__`; do not add a new required constructor argument. Avoid circular imports (`TYPE_CHECKING` / string annotations as needed). Bind each `PaymentsModule` to the same client instance. Reuse `E3DClient.post`. Do not introduce an async API.

### Go

Create a publishable standard-library-only module at `go/go.mod` with module path `github.com/spacepacket1/e3d-sdk/go` and package import path `github.com/spacepacket1/e3d-sdk/go/e3d`. Use a Go 1.22 directive. Do not modify or import protected `examples/**`.

- `QuoteCreditsRequest`: `Product string`, `Wallet string`, `RequestedIssuedCredits int`, `PromotionCode string`, `PaymentMethod string`
- `CreditPayment`: optional `ID`, `Chain`, `Network`, `ChainID` (`interface{}` so string or number is preserved), `Token`, `TokenAddress`, `TreasuryAddress`, `RequiredAmount` (`interface{}`); `Extra map[string]interface{}` with `json:"-"`
- `CreditQuote`: `Product`, `Wallet`, `RequestedIssuedCredits`, `Payment CreditPayment`, `PaymentOptions []CreditPayment`, `Extra map[string]interface{}` with `json:"-"`
- `TransferFunc`: `func(ctx context.Context, quote CreditQuote) (txHash string, err error)`
- `PurchaseCreditsInput`: `Product`, `Wallet`, `RequestedIssuedCredits int` (required when `Quote` is nil), `PromotionCode string`, `PaymentMethod string`, `Quote *CreditQuote`
- `PurchaseCreditsResult`: `CreditKey string`; optional `IssuedCredits`, `BaseCredits`, `PaymentTxHash`, `Usage interface{}`; `Extra map[string]interface{}` with `json:"-"`
- JSON tags must match the camelCase wire names, with `omitempty` on optional request fields
- `QuoteCredits(ctx context.Context, request QuoteCreditsRequest) (CreditQuote, error)`
- `PurchaseCredits(ctx context.Context, input PurchaseCreditsInput, transfer TransferFunc) (PurchaseCreditsResult, error)`

Construct HTTP bodies explicitly so `PaymentMethod` on public request types is never marshaled onto the quote wire body.

Client surface:

- `New()` constructs a `Client` using the same environment defaults as the example client (`E3D_BASE_URL`, `E3D_API_KEY`, `E3D_API_KEY_HEADER`, `E3D_TIMEOUT_MS`) with default base URL `https://e3d.ai/api`
- Exported configurable fields: `BaseURL`, `APIKey`, `APIKeyHeader`, `Timeout`, and an injectable `*http.Client`
- Every constructed client exposes a non-nil `Payments` service
- Send JSON with `http.NewRequestWithContext`
- If `ctx` is done before quote, transfer, or purchase, skip that step and return the context error
- Do not port unrelated example endpoints

## Phase 1 - TypeScript Payments Module

<!-- runner:model=codex:gpt-5.4 -->
<!-- pilot:touches=src/payments.ts -->
<!-- pilot:touches=src/client.ts -->
<!-- pilot:touches=src/index.ts -->
<!-- runner:read=src/http.ts -->
<!-- runner:read=src/errors.ts -->
<!-- runner:read=src/client.ts -->
<!-- runner:read=src/normalize.ts -->
<!-- runner:verify=npm install && npm run typecheck -->

### Requirements

- Implement the locked TypeScript types and `PaymentsModule` in `src/payments.ts`. Do not add payment types to `src/types.ts`.
- Back the module with the existing `HttpClient`.
- Implement `quoteCredits` and `purchaseCredits` with the shared validation, normalization, selection, passthrough, and orchestration contract.
- Put the required async transfer callback on the purchase input as `transfer`.
- Initialize `readonly payments` on `E3D` with the same `HttpClient` as other API-backed modules.
- Export the module and public payment types from `src/index.ts` using `.js` suffixes, without removing existing exports.
- Do not change HTTP normalization, authentication, swap, or error semantics.
- Do not add tests or other non-production files under `src/`.

### Acceptance Criteria

- `new E3D().payments.quoteCredits(...)` and `new E3D().payments.purchaseCredits(...)` are public and type-safe.
- Quote sends exactly one POST to `/payments/credits/quote` and never includes `paymentMethod` in that body.
- Purchase without a supplied quote performs quote, one transfer callback, and purchase exactly once and in that order.
- Purchase with a supplied quote skips the quote request.
- Invalid input, unmatched payment selection, transfer rejection, and invalid hashes prevent purchase.
- Unknown response fields remain accessible through index signatures.
- `creditKey` is returned without changing the client API key.
- Existing TypeScript consumers continue to typecheck.
- `npm install && npm run typecheck` succeeds without modifying `package-lock.json`.

## Phase 2 - Python Payments Module

<!-- runner:model=codex:gpt-5.4 -->
<!-- pilot:touches=python/e3d/payments.py -->
<!-- pilot:touches=python/e3d/client.py -->
<!-- pilot:touches=python/e3d/__init__.py -->
<!-- pilot:touches=python/tests/test_payments.py -->
<!-- runner:read=python/e3d/client.py -->
<!-- runner:read=python/e3d/__init__.py -->
<!-- runner:verify=PYTHONPATH=python python3 -m compileall -q python/e3d python/tests -->
<!-- runner:verify=PYTHONPATH=python python3 -m unittest discover -s python/tests -p 'test_*.py' -->
<!-- runner:verify=npm install && npm run typecheck -->

### Requirements

- Add a standard-library-only `PaymentsModule` exposed as `E3DClient.payments`.
- Preserve the dataclass constructor with an `init=False` field set in `__post_init__`.
- Reuse `E3DClient.post` for both endpoints.
- Avoid circular imports and bind each module to its own client instance.
- Implement the complete shared validation, normalization, selection, passthrough, and orchestration contract.
- Accept a synchronous transfer callable as a separate `transfer` argument.
- Export all locked payment symbols from `python/e3d/__init__.py`.
- Do not add `python/tests/__init__.py` (so tests are not packaged).
- Add `unittest` coverage using a subclassed or otherwise fake client transport that overrides `request` rather than adding a constructor dependency.

Tests must cover:

- endpoint paths and POST methods
- camelCase request bodies
- omission of `paymentMethod` and unknown fields from quote requests
- optional-field omission
- quote normalization from request values
- payment selection and unmatched selection
- required-amount fallback from `requiredWE3D` / `requiredE3D`
- unknown-field preservation in `extra`
- quote, transfer, purchase ordering
- supplied-quote reuse and mismatch rejection
- validation before side effects, including boolean credit counts
- transfer exceptions and invalid hashes
- successful `credit_key` return without mutation of `api_key`

### Acceptance Criteria

- `E3DClient().payments.quote_credits(...)` and `E3DClient().payments.purchase_credits(...)` are available without extra dependencies.
- Python matches the shared HTTP and side-effect contract.
- Supplying a quote avoids another quote request.
- Invalid input and transfer failures cannot trigger purchase.
- Unknown response fields remain available through `extra`.
- `PYTHONPATH=python python3 -m unittest discover -s python/tests -p 'test_*.py'` succeeds without network access.
- `PYTHONPATH=python python3 -m compileall -q python/e3d python/tests` succeeds.
- TypeScript typechecking remains successful without modifying `package-lock.json`.

## Phase 3 - Go SDK and Payments Service

<!-- runner:model=codex:gpt-5.4 -->
<!-- pilot:touches=go/go.mod -->
<!-- pilot:touches=go/e3d/client.go -->
<!-- pilot:touches=go/e3d/payments.go -->
<!-- pilot:touches=go/e3d/payments_test.go -->
<!-- runner:read=examples/go/e3dclient/client.go -->
<!-- runner:read=examples/go/go.mod -->
<!-- runner:read=src/http.ts -->
<!-- runner:verify=(cd go && go test ./... && go vet ./...) -->
<!-- runner:verify=npm install && npm run typecheck -->

### Requirements

- Create a standard-library-only Go module under `go/` with the locked module path and Go 1.22 directive.
- Do not modify the protected example module.
- Implement a configurable `Client` and non-nil `Payments` service as specified above.
- Implement the locked types and methods and the complete shared validation, normalization, selection, passthrough, and orchestration contract.
- Check `ctx.Err()` before quote, before transfer, and before purchase.
- Never use `Authorization: Bearer` for SDK payment requests.
- Safely decode non-2xx service errors without leaking credentials.
- Add deterministic `httptest` coverage.

Tests must cover:

- paths, methods, and camelCase bodies
- quote-body field allowlist
- optional-field omission
- custom base URL, API key header, and injected client behavior
- call ordering
- validation before side effects
- context cancellation before each step
- selection and unmatched selection
- required-amount fallback
- unknown-field preservation in `Extra`
- transfer errors and invalid hashes
- supplied-quote reuse and mismatch rejection
- non-2xx error status and safe details
- successful `CreditKey` return without client mutation

### Acceptance Criteria

- A consumer can import `github.com/spacepacket1/e3d-sdk/go/e3d` and call `client.Payments.QuoteCredits` and `client.Payments.PurchaseCredits`.
- The module has no third-party dependencies.
- Tests make no live network or blockchain calls.
- Existing quotes can be reused without another quote request.
- Invalid input, canceled contexts, and transfer errors prevent later side effects.
- Unknown response fields remain available through `Extra`.
- `(cd go && go test ./... && go vet ./...)` succeeds.
- TypeScript typechecking remains successful without modifying `package-lock.json`.

## Phase 4 - Payments Conversion Guide

<!-- runner:model=codex:gpt-5.4 -->
<!-- pilot:touches=README.md -->
<!-- pilot:touches=docs/payments.md -->
<!-- runner:read=src/payments.ts -->
<!-- runner:read=python/e3d/payments.py -->
<!-- runner:read=go/e3d/payments.go -->
<!-- runner:verify=npm install && npm run typecheck -->
<!-- runner:verify=PYTHONPATH=python python3 -m unittest discover -s python/tests -p 'test_*.py' -->
<!-- runner:verify=(cd go && go test ./...) -->

### Requirements

- Add `payments` to the README module list and link to `docs/payments.md`.
- Create `docs/payments.md` as the repository-local conversion guide suitable for later publication to the separate docs site.
- Explain the quote, caller-controlled wallet transfer, purchase confirmation, and product credit-key lifecycle, and which steps contact E3D versus the caller's wallet.
- Provide concise TypeScript, Python, and Go examples using the exact implemented symbols and signatures.
- TypeScript examples must pass `transfer` on the purchase input object. Python and Go examples must pass `transfer` as the separate argument.
- Use environment-based credential and wallet configuration and placeholders rather than real secrets, addresses, or transaction hashes.
- Keep transaction signing and broadcasting entirely inside caller callbacks.
- State that callers must send the exact quoted asset and amount to the quoted treasury on the quoted chain.
- Instruct callers to present destination, asset, amount, and chain for approval before an irreversible transfer.
- Explain that quotes are advisory, have no quote ID or server expiration, and may become stale as rates or discounts change.
- Explain that `creditKey` is a product payment key used as `Authorization: Bearer <creditKey>` for product APIs, not the SDK `apiKey` or `x-api-key`.
- Do not show installing the returned key on an SDK client.
- Explain that a purchase-confirmation retry may reuse the same confirmed transaction hash and must not blindly initiate another transfer.
- Keep existing quick-start and swap documentation intact.
- Do not claim subscriptions, refunds, fiat support, automatic wallet signing, balance APIs, or publication to the external documentation site.

### Acceptance Criteria

- A reader can discover payments from the root README and complete the workflow in any supported language from the guide alone.
- Every documented symbol and signature matches the implemented TypeScript, Python, and Go APIs, including `requestedIssuedCredits`, `txHash`, and `creditKey`.
- Examples keep private keys and signing under caller control.
- Documentation distinguishes purchase-confirmation retries from transfer retries.
- No protected example or external documentation file is modified.
- The cumulative change remains within 25 files and 3000 changed lines.
- `npm install && npm run typecheck`, the Python unittest command, and `(cd go && go test ./...)` succeed without modifying `package-lock.json`.
```
```

### Reviewer 2: claude

Status: approved

Reason: Spec is internally consistent, fully cross-references wire contract, validation, selection, and orchestration rules across all three languages, and each phase's touches/verifications align with the shared constraints.

Raw Response:

```text
---STATUS---
status: approved
reason: Spec is internally consistent, fully cross-references wire contract, validation, selection, and orchestration rules across all three languages, and each phase's touches/verifications align with the shared constraints.
```

### Reviewer 3: codex

Status: approved

Reason: The draft is internally consistent, implementation-ready, and provides sufficiently precise cross-language contracts, validation rules, orchestration behavior, tests, and documentation requirements.

Raw Response:

```text
---STATUS---
status: approved
reason: The draft is internally consistent, implementation-ready, and provides sufficiently precise cross-language contracts, validation rules, orchestration behavior, tests, and documentation requirements.
```

### Reviewer 4: devin

Status: approved

Reason: Spec is internally consistent across all three SDK languages, wire contract, validation, selection, orchestration, and documentation phases; no contradictions or missing requirements detected.

Raw Response:

```text
---STATUS---
status: approved
reason: Spec is internally consistent across all three SDK languages, wire contract, validation, selection, orchestration, and documentation phases; no contradictions or missing requirements detected.
```

### Reviewer 5: local

Status: approved

Reason: The draft meets all the specified requirements and guidelines.

Raw Response:

```text
---STATUS---
status: approved
reason: The draft meets all the specified requirements and guidelines.
```

Round Result: not converged

At least one reviewer requested revision in round 2.

## Round 3

### Draft Before Round

```text
# Embedded Payments SDK

## Overview

Add a chain-library-neutral payments module to the TypeScript, Python, and Go SDKs. The module exposes the existing credit-purchase lifecycle: request a quote, execute the quoted on-chain transfer through caller-controlled wallet code, submit the transaction hash, and return the issued product payment credit key.

The default base URL is `https://e3d.ai/api`. Use exactly:

- `POST /payments/credits/quote`
- `POST /payments/credits/purchase`

Do not add another `/api` prefix. Resolved default URLs are `https://e3d.ai/api/payments/credits/quote` and `https://e3d.ai/api/payments/credits/purchase`.

Quotes have no server quote identifier or expiration field. Do not invent `quoteId`, `purchaseId`, or `expiresAt`. A quote is advisory; purchase re-validates the on-chain transfer.

The returned `creditKey` is a product payment credit key such as `e3d_maps_pay_...`. It is not the SDK `apiKey` or `x-api-key` credential and must not be installed on the client.

Because this repository does not contain the external `e3d-docs` site, add a repository-local Payments guide and link it from the root README.

Public entry points:

- TypeScript: `e3d.payments.quoteCredits(request)` and `e3d.payments.purchaseCredits(request)`
- Python: `client.payments.quote_credits(request)` and `client.payments.purchase_credits(request, transfer)`
- Go: `client.Payments.QuoteCredits(ctx, request)` and `client.Payments.PurchaseCredits(ctx, request, transfer)`

## Goals

- Expose the live credit quote and purchase lifecycle in all three SDKs.
- Keep wallet access, approval, signing, and broadcasting outside the SDK.
- Allow purchase methods to reuse a caller-supplied normalized quote.
- Preserve useful server response metadata, including unknown fields.
- Document an end-to-end flow that ends with a product payment credit key.
- Provide deterministic Python and Go tests without live API or chain access.

## Non-Goals

- Custodying private keys, seed phrases, or wallet credentials.
- Implementing wallets, signers, RPC providers, approvals, or transaction broadcasters.
- Adding ethers, web3.py, Go chain libraries, or other blockchain dependencies.
- Polling for blockchain confirmations.
- Changing payment-service endpoints or server behavior.
- Adding `Authorization: Bearer` to SDK payment requests.
- Mutating the configured SDK API key.
- Modifying the external `docs.e3d.ai` repository.
- Adding checkout UI, subscriptions, refunds, stored payment methods, balance reads, spend operations, or product catalogs.
- Changing swap behavior or existing authentication defaults.
- Adding TypeScript tests under `src/`.
- Modifying examples, lockfiles, runner configuration, TypeScript configuration, or Claude configuration.

## Existing Files

- `src/client.ts` constructs the public TypeScript `E3D` client and its modules.
- `src/http.ts` provides normalized requests, optional `x-api-key`, timeout handling, and injected `fetch`. Its default base URL is `https://e3d.ai/api`.
- `src/index.ts` defines package exports. TypeScript imports and exports use `.js` suffixes.
- `src/types.ts` contains shared client options and must not receive payment-specific types.
- `src/errors.ts` defines `E3DError` and HTTP error mapping and must not be modified.
- `src/normalize.ts` camelizes snake_case response keys.
- `python/e3d/client.py` is a transport-only dataclass client with `get` and `post`.
- `python/e3d/__init__.py` defines Python package exports.
- `README.md` is the package installation and usage guide.
- `package.json` provides `build` and `typecheck`; there is no TypeScript test runner.
- `pyproject.toml` packages modules under `python/`.
- No publishable Go client package currently exists. Go code under `examples/` is protected.

## Shared Constraints

- Keep the implementation within 25 changed files and 3000 changed lines.
- Do not modify `tsconfig.json`, `examples/**`, `package-lock.json`, `.codex-spec-runner/**`, `.claude/**`, or `.git/**`.
- Use only existing TypeScript runtime dependencies and the standard library for Python and Go.
- Preserve existing public APIs and zero-dependency behavior for Python and Go.
- Treat the live payments HTTP API as authoritative even though `GET /openapi` omits these routes.
- Use paths relative to the configured base URL.
- Reuse each language's existing or newly specified base-URL, HTTP, JSON, timeout, header, and error conventions.
- Build quote and purchase HTTP bodies explicitly. Do not JSON-serialize the public request object if that would emit client-only fields.
- Omit empty optional fields from request bodies.
- Preserve existing `x-api-key` behavior. Payments must work without a configured API key; if one is configured, continue sending it as `x-api-key`.
- Do not add `Authorization: Bearer` to SDK payment requests.
- Public APIs use idiomatic language casing and explicitly map to the camelCase wire names.
- Never log quote payloads, transaction proofs, private keys, or returned credentials.
- Never include a returned `creditKey` in a client-generated exception message.
- Do not retry transfer callbacks automatically.
- Do not retry quote or purchase requests in a way that could cause another on-chain transfer.
- Propagate transport, callback, and API errors and never call purchase after a failed transfer.

## Wire Contract

### Quote Request

The quote JSON body may contain only:

- `product`: required string
- `wallet`: required string
- `requestedIssuedCredits`: required positive integer
- `promotionCode`: optional non-empty string

`paymentMethod` is client-side selection metadata and must never be sent to the quote endpoint.

### Quote Normalization

Construct the normalized quote by starting with all server response fields, then ensuring these fields are populated from the validated request when the response omits them:

- `product`
- `wallet`
- `requestedIssuedCredits`

A normalized quote contains:

- required `product`, `wallet`, and `requestedIssuedCredits`
- required selected `payment`
- optional `paymentOptions`
- all other server quote fields

Each payment object can contain:

- optional `id`
- optional `chain`
- optional `network`
- optional `chainId`
- optional `token`
- optional `tokenAddress`
- optional `treasuryAddress`
- optional `requiredAmount`
- any other server payment fields

Fields other than `requiredAmount` must not be fabricated. If selected `payment.requiredAmount` is absent or empty, copy the top-level `requiredWE3D`, or otherwise `requiredE3D`, to `payment.requiredAmount`. Reject the quote before transfer or purchase if no non-empty amount can be resolved.

Unknown fields must remain available to callers as follows:

- TypeScript: retain unknown quote, payment, and purchase-result properties directly through string index signatures.
- Python: retain unknown properties in an `extra: Dict[str, Any]` field on `CreditQuote`, `CreditPayment`, and `PurchaseCreditsResult`. Known fields must not also appear in `extra`.
- Go: retain unknown properties in an exported `Extra map[string]interface{}` field with `json:"-"` on `CreditQuote`, `CreditPayment`, and `PurchaseCreditsResult`, using custom JSON unmarshalling where necessary. Known fields must not also appear in `Extra`.

Unknown fields are response passthrough only and must not be copied into quote or purchase request bodies.

Public `quoteCredits` / `quote_credits` / `QuoteCredits` must apply payment selection and required-amount resolution before returning so the caller receives a transfer-ready quote.

### Purchase Request

The purchase JSON body contains:

- `product`: required string
- `wallet`: required string
- `txHash`: required string
- `promotionCode`: only when the caller supplied a non-empty value
- `paymentMethod`: selected payment `id`, falling back to the caller's selector only when the selected payment has no non-empty `id`
- `paymentChain`: selected payment `chain`, when non-empty

Do not send quote identifiers. Do not send `walletAddress`, `transactionHash`, `credits`, `requestedIssuedCredits`, unknown response fields, or `apiKey`.

### Purchase Result

Expose:

- required `creditKey`
- optional returned metadata such as `issuedCredits`, `baseCredits`, `paymentTxHash`, and `usage`
- remaining server purchase fields using the language-specific unknown-field representation above

Do not install `creditKey` on the client.

## Validation

Perform validation before the corresponding network or transfer side effect:

- `product` and `wallet` must be strings that remain non-empty after trimming.
- `requestedIssuedCredits` must be a finite integer greater than zero.
- Python must reject `True` and `False` as credit counts.
- `promotionCode`, when included on the wire, must be a string that remains non-empty after trimming; omit `None`, missing, and whitespace-only values.
- `paymentMethod`, when provided, must be a string. Treat a whitespace-only selector as invalid rather than silently omitting it.
- A transfer callback is required and must be callable or non-nil as appropriate.
- The returned `txHash` must be a string that remains non-empty after trimming.
- Reject missing, non-string, or whitespace-only transaction hashes before purchase.
- Do not perform chain-specific address or hash-format validation.

For a supplied quote:

- Require non-empty `product` and `wallet`, a positive integral `requestedIssuedCredits`, and a payment that can be selected and assigned a required amount.
- Require supplied quote `product` and `wallet` to equal the validated purchase input values after trimming.
- If purchase input includes `requestedIssuedCredits`, require it to equal the supplied quote value.
- Reapply payment selection using the purchase input's `paymentMethod`.
- Reject mismatches before invoking transfer.

Error conventions:

- TypeScript validation failures use existing `E3DError` helpers with code `BAD_REQUEST`; do not modify `src/errors.ts`.
- Python validation failures use `ValueError`; existing HTTP failures remain `RuntimeError`.
- Go returns ordinary errors. Non-2xx errors must contain the HTTP status and safely decoded service details such as `message` or `code`, without including request headers, API keys, `creditKey`, or other credentials.

## Payment Selection

Apply selection after a quote response has been received and normalized, or after a supplied quote has been validated, but before transfer:

1. If `paymentMethod` is supplied, select the first `paymentOptions` entry whose non-empty `id`, `chain`, or `token` exactly equals the selector.
2. If a selector is supplied and no option matches, reject before transfer or purchase.
3. If no selector is supplied, preserve the server-selected `payment`.
4. If no selector is supplied, the server omitted `payment`, and `paymentOptions` is non-empty, select the first option.
5. If no payment can be selected, reject the malformed quote.
6. Resolve `requiredAmount` as described above.
7. Store the selected payment in normalized quote `payment`.

Do not fail or suppress the initial quote HTTP request merely because a selector might not match its response.

## Purchase Orchestration

Each purchase method must:

1. Validate the purchase input and transfer callback.
2. If no quote is supplied, require `requestedIssuedCredits` and obtain a quote using the same validation, request body, normalization, and selection behavior as the public quote method.
3. If a quote is supplied, skip the quote endpoint and validate, select, and normalize that quote as specified above.
4. Invoke the caller transfer callback exactly once with the complete normalized quote and selected payment.
5. Validate the returned transaction hash.
6. POST the purchase request body.
7. Return the normalized service result without mutating client authentication.

The callback is solely responsible for wallet access, approval, signing, broadcasting, and chain-specific dependencies. It returns only a transaction hash; Go additionally returns an error. Do not ask for or accept a private key.

## Locked Public APIs

### TypeScript

Create `src/payments.ts` and re-export its public types from `src/index.ts`. Keep types compatible with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`. Omit optional properties instead of assigning `undefined`.

- `QuoteCreditsInput`: required `product: string`, `wallet: string`, `requestedIssuedCredits: number`; optional `promotionCode?: string`, `paymentMethod?: string`
- `CreditPayment`: optional `id?: string`, `chain?: string`, `network?: string`, `chainId?: string | number`, `token?: string`, `tokenAddress?: string`, `treasuryAddress?: string`, `requiredAmount?: string | number`, plus `[key: string]: unknown`
- `CreditQuote`: required `product: string`, `wallet: string`, `requestedIssuedCredits: number`, `payment: CreditPayment`; optional `paymentOptions?: CreditPayment[]`; plus `[key: string]: unknown`
- `TransferCallback`: `(quote: CreditQuote) => Promise<string>`
- `PurchaseCreditsInput`: required `product: string`, `wallet: string`, `transfer: TransferCallback`; optional `requestedIssuedCredits?: number`, `promotionCode?: string`, `paymentMethod?: string`, `quote?: CreditQuote`
- `PurchaseCreditsResult`: required `creditKey: string`; optional `issuedCredits?: number`, `baseCredits?: number`, `paymentTxHash?: string`, `usage?: unknown`; plus `[key: string]: unknown`
- `PaymentsModule` constructed with the existing `HttpClient`, exposing `quoteCredits(request: QuoteCreditsInput): Promise<CreditQuote>` and `purchaseCredits(request: PurchaseCreditsInput): Promise<PurchaseCreditsResult>`
- Expose the module as `readonly payments` on `E3D`

The TypeScript transfer callback lives on the purchase input object, not as a second method argument.

### Python

Create `python/e3d/payments.py` and re-export public types from `python/e3d/__init__.py`. Use dataclasses, `from __future__ import annotations`, and Python 3.8-compatible typing (`Optional`, `Dict`, `List`, `Any`, `Callable`, `Union`). Public field names are snake_case and must map to the camelCase wire names above.

- `QuoteCreditsInput`: `product: str`, `wallet: str`, `requested_issued_credits: int`; optional `promotion_code`, `payment_method`
- `CreditPayment`: optional `id`, `chain`, `network`, `chain_id` (`str` or `int`), `token`, `token_address`, `treasury_address`, `required_amount` (`str`, `int`, or `float`); `extra: Dict[str, Any]` defaulting to a new dict
- `CreditQuote`: `product`, `wallet`, `requested_issued_credits`, `payment: CreditPayment`; optional `payment_options: Optional[List[CreditPayment]]`; `extra` dict
- `TransferCallback`: `Callable[[CreditQuote], str]` (synchronous only)
- `PurchaseCreditsInput`: `product`, `wallet`; optional `requested_issued_credits`, `promotion_code`, `payment_method`, `quote`. Do not put `transfer` on this dataclass
- `PurchaseCreditsResult`: `credit_key: str`; optional `issued_credits`, `base_credits`, `payment_tx_hash`, `usage`; `extra` dict
- `PaymentsModule.quote_credits(request: QuoteCreditsInput) -> CreditQuote`
- `PaymentsModule.purchase_credits(request: PurchaseCreditsInput, transfer: TransferCallback) -> PurchaseCreditsResult`

Snake_case to camelCase mapping:

- `requested_issued_credits` -> `requestedIssuedCredits`
- `promotion_code` -> `promotionCode`
- `payment_method` -> `paymentMethod`
- `payment_options` -> `paymentOptions`
- `token_address` -> `tokenAddress`
- `treasury_address` -> `treasuryAddress`
- `chain_id` -> `chainId`
- `required_amount` -> `requiredAmount`
- `credit_key` -> `creditKey`
- `issued_credits` -> `issuedCredits`
- `base_credits` -> `baseCredits`
- `payment_tx_hash` -> `paymentTxHash`
- `payment_chain` -> `paymentChain`

Known Python fields listed above must not also appear in `extra`. Attach `payments` on `E3DClient` without breaking the dataclass constructor: `init=False` field set in `__post_init__`; do not add a new required constructor argument. Avoid circular imports (`TYPE_CHECKING` / string annotations as needed). Bind each `PaymentsModule` to the same client instance. Reuse `E3DClient.post`. Do not introduce an async API.

### Go

Create a publishable standard-library-only module at `go/go.mod` with module path `github.com/spacepacket1/e3d-sdk/go` and package import path `github.com/spacepacket1/e3d-sdk/go/e3d`. Use a Go 1.22 directive. Do not modify or import protected `examples/**`.

- `QuoteCreditsRequest`: `Product string`, `Wallet string`, `RequestedIssuedCredits int`, `PromotionCode string`, `PaymentMethod string`
- `CreditPayment`: optional `ID`, `Chain`, `Network`, `ChainID` (`interface{}` so string or number is preserved), `Token`, `TokenAddress`, `TreasuryAddress`, `RequiredAmount` (`interface{}`); `Extra map[string]interface{}` with `json:"-"`
- `CreditQuote`: `Product`, `Wallet`, `RequestedIssuedCredits`, `Payment CreditPayment`, `PaymentOptions []CreditPayment`, `Extra map[string]interface{}` with `json:"-"`
- `TransferFunc`: `func(ctx context.Context, quote CreditQuote) (txHash string, err error)`
- `PurchaseCreditsInput`: `Product`, `Wallet`, `RequestedIssuedCredits int` (required when `Quote` is nil), `PromotionCode string`, `PaymentMethod string`, `Quote *CreditQuote`
- `PurchaseCreditsResult`: `CreditKey string`; optional `IssuedCredits`, `BaseCredits`, `PaymentTxHash`, `Usage interface{}`; `Extra map[string]interface{}` with `json:"-"`
- JSON tags must match the camelCase wire names, with `omitempty` on optional request fields
- `QuoteCredits(ctx context.Context, request QuoteCreditsRequest) (CreditQuote, error)`
- `PurchaseCredits(ctx context.Context, input PurchaseCreditsInput, transfer TransferFunc) (PurchaseCreditsResult, error)`

Construct HTTP bodies explicitly so `PaymentMethod` on public request types is never marshaled onto the quote wire body.

Client surface:

- `New()` constructs a `Client` using the same environment defaults as the example client (`E3D_BASE_URL`, `E3D_API_KEY`, `E3D_API_KEY_HEADER`, `E3D_TIMEOUT_MS`) with default base URL `https://e3d.ai/api`
- Exported configurable fields: `BaseURL`, `APIKey`, `APIKeyHeader`, `Timeout`, and an injectable `*http.Client`
- Every constructed client exposes a non-nil `Payments` service
- Send JSON with `http.NewRequestWithContext`
- If `ctx` is done before quote, transfer, or purchase, skip that step and return the context error
- Do not port unrelated example endpoints

## Phase 1 - TypeScript Payments Module

<!-- runner:model=codex:gpt-5.4 -->
<!-- pilot:touches=src/payments.ts -->
<!-- pilot:touches=src/client.ts -->
<!-- pilot:touches=src/index.ts -->
<!-- runner:read=src/http.ts -->
<!-- runner:read=src/errors.ts -->
<!-- runner:read=src/client.ts -->
<!-- runner:read=src/normalize.ts -->
<!-- runner:verify=npm install && npm run typecheck -->

### Requirements

- Implement the locked TypeScript types and `PaymentsModule` in `src/payments.ts`. Do not add payment types to `src/types.ts`.
- Back the module with the existing `HttpClient`.
- Implement `quoteCredits` and `purchaseCredits` with the shared validation, normalization, selection, passthrough, and orchestration contract.
- Put the required async transfer callback on the purchase input as `transfer`.
- Initialize `readonly payments` on `E3D` with the same `HttpClient` as other API-backed modules.
- Export the module and public payment types from `src/index.ts` using `.js` suffixes, without removing existing exports.
- Do not change HTTP normalization, authentication, swap, or error semantics.
- Do not add tests or other non-production files under `src/`.

### Acceptance Criteria

- `new E3D().payments.quoteCredits(...)` and `new E3D().payments.purchaseCredits(...)` are public and type-safe.
- Quote sends exactly one POST to `/payments/credits/quote` and never includes `paymentMethod` in that body.
- Purchase without a supplied quote performs quote, one transfer callback, and purchase exactly once and in that order.
- Purchase with a supplied quote skips the quote request.
- Invalid input, unmatched payment selection, transfer rejection, and invalid hashes prevent purchase.
- Unknown response fields remain accessible through index signatures.
- `creditKey` is returned without changing the client API key.
- Existing TypeScript consumers continue to typecheck.
- `npm install && npm run typecheck` succeeds without modifying `package-lock.json`.

## Phase 2 - Python Payments Module

<!-- runner:model=codex:gpt-5.4 -->
<!-- pilot:touches=python/e3d/payments.py -->
<!-- pilot:touches=python/e3d/client.py -->
<!-- pilot:touches=python/e3d/__init__.py -->
<!-- pilot:touches=python/tests/test_payments.py -->
<!-- runner:read=python/e3d/client.py -->
<!-- runner:read=python/e3d/__init__.py -->
<!-- runner:verify=PYTHONPATH=python python3 -m compileall -q python/e3d python/tests -->
<!-- runner:verify=PYTHONPATH=python python3 -m unittest discover -s python/tests -p 'test_*.py' -->
<!-- runner:verify=npm install && npm run typecheck -->

### Requirements

- Add a standard-library-only `PaymentsModule` exposed as `E3DClient.payments`.
- Preserve the dataclass constructor with an `init=False` field set in `__post_init__`.
- Reuse `E3DClient.post` for both endpoints.
- Avoid circular imports and bind each module to its own client instance.
- Implement the complete shared validation, normalization, selection, passthrough, and orchestration contract.
- Accept a synchronous transfer callable as a separate `transfer` argument.
- Export all locked payment symbols from `python/e3d/__init__.py`.
- Do not add `python/tests/__init__.py` (so tests are not packaged).
- Add `unittest` coverage using a subclassed or otherwise fake client transport that overrides `request` rather than adding a constructor dependency.

Tests must cover:

- endpoint paths and POST methods
- camelCase request bodies
- omission of `paymentMethod` and unknown fields from quote requests
- optional-field omission
- quote normalization from request values
- payment selection and unmatched selection
- required-amount fallback from `requiredWE3D` / `requiredE3D`
- unknown-field preservation in `extra`
- quote, transfer, purchase ordering
- supplied-quote reuse and mismatch rejection
- validation before side effects, including boolean credit counts
- transfer exceptions and invalid hashes
- successful `credit_key` return without mutation of `api_key`

### Acceptance Criteria

- `E3DClient().payments.quote_credits(...)` and `E3DClient().payments.purchase_credits(...)` are available without extra dependencies.
- Python matches the shared HTTP and side-effect contract.
- Supplying a quote avoids another quote request.
- Invalid input and transfer failures cannot trigger purchase.
- Unknown response fields remain available through `extra`.
- `PYTHONPATH=python python3 -m unittest discover -s python/tests -p 'test_*.py'` succeeds without network access.
- `PYTHONPATH=python python3 -m compileall -q python/e3d python/tests` succeeds.
- TypeScript typechecking remains successful without modifying `package-lock.json`.

## Phase 3 - Go SDK and Payments Service

<!-- runner:model=codex:gpt-5.4 -->
<!-- pilot:touches=go/go.mod -->
<!-- pilot:touches=go/e3d/client.go -->
<!-- pilot:touches=go/e3d/payments.go -->
<!-- pilot:touches=go/e3d/payments_test.go -->
<!-- runner:read=examples/go/e3dclient/client.go -->
<!-- runner:read=examples/go/go.mod -->
<!-- runner:read=src/http.ts -->
<!-- runner:verify=(cd go && go test ./... && go vet ./...) -->
<!-- runner:verify=npm install && npm run typecheck -->

### Requirements

- Create a standard-library-only Go module under `go/` with the locked module path and Go 1.22 directive.
- Do not modify the protected example module.
- Implement a configurable `Client` and non-nil `Payments` service as specified above.
- Implement the locked types and methods and the complete shared validation, normalization, selection, passthrough, and orchestration contract.
- Check `ctx.Err()` before quote, before transfer, and before purchase.
- Never use `Authorization: Bearer` for SDK payment requests.
- Safely decode non-2xx service errors without leaking credentials.
- Add deterministic `httptest` coverage.

Tests must cover:

- paths, methods, and camelCase bodies
- quote-body field allowlist
- optional-field omission
- custom base URL, API key header, and injected client behavior
- call ordering
- validation before side effects
- context cancellation before each step
- selection and unmatched selection
- required-amount fallback
- unknown-field preservation in `Extra`
- transfer errors and invalid hashes
- supplied-quote reuse and mismatch rejection
- non-2xx error status and safe details
- successful `CreditKey` return without client mutation

### Acceptance Criteria

- A consumer can import `github.com/spacepacket1/e3d-sdk/go/e3d` and call `client.Payments.QuoteCredits` and `client.Payments.PurchaseCredits`.
- The module has no third-party dependencies.
- Tests make no live network or blockchain calls.
- Existing quotes can be reused without another quote request.
- Invalid input, canceled contexts, and transfer errors prevent later side effects.
- Unknown response fields remain available through `Extra`.
- `(cd go && go test ./... && go vet ./...)` succeeds.
- TypeScript typechecking remains successful without modifying `package-lock.json`.

## Phase 4 - Payments Conversion Guide

<!-- runner:model=codex:gpt-5.4 -->
<!-- pilot:touches=README.md -->
<!-- pilot:touches=docs/payments.md -->
<!-- runner:read=src/payments.ts -->
<!-- runner:read=python/e3d/payments.py -->
<!-- runner:read=go/e3d/payments.go -->
<!-- runner:verify=npm install && npm run typecheck -->
<!-- runner:verify=PYTHONPATH=python python3 -m unittest discover -s python/tests -p 'test_*.py' -->
<!-- runner:verify=(cd go && go test ./...) -->

### Requirements

- Add `payments` to the README module list and link to `docs/payments.md`.
- Create `docs/payments.md` as the repository-local conversion guide suitable for later publication to the separate docs site.
- Explain the quote, caller-controlled wallet transfer, purchase confirmation, and product credit-key lifecycle, and which steps contact E3D versus the caller's wallet.
- Provide concise TypeScript, Python, and Go examples using the exact implemented symbols and signatures.
- TypeScript examples must pass `transfer` on the purchase input object. Python and Go examples must pass `transfer` as the separate argument.
- Use environment-based credential and wallet configuration and placeholders rather than real secrets, addresses, or transaction hashes.
- Keep transaction signing and broadcasting entirely inside caller callbacks.
- State that callers must send the exact quoted asset and amount to the quoted treasury on the quoted chain.
- Instruct callers to present destination, asset, amount, and chain for approval before an irreversible transfer.
- Explain that quotes are advisory, have no quote ID or server expiration, and may become stale as rates or discounts change.
- Explain that `creditKey` is a product payment key used as `Authorization: Bearer <creditKey>` for product APIs, not the SDK `apiKey` or `x-api-key`.
- Do not show installing the returned key on an SDK client.
- Explain that a purchase-confirmation retry may reuse the same confirmed transaction hash and must not blindly initiate another transfer.
- Keep existing quick-start and swap documentation intact.
- Do not claim subscriptions, refunds, fiat support, automatic wallet signing, balance APIs, or publication to the external documentation site.

### Acceptance Criteria

- A reader can discover payments from the root README and complete the workflow in any supported language from the guide alone.
- Every documented symbol and signature matches the implemented TypeScript, Python, and Go APIs, including `requestedIssuedCredits`, `txHash`, and `creditKey`.
- Examples keep private keys and signing under caller control.
- Documentation distinguishes purchase-confirmation retries from transfer retries.
- No protected example or external documentation file is modified.
- The cumulative change remains within 25 files and 3000 changed lines.
- `npm install && npm run typecheck`, the Python unittest command, and `(cd go && go test ./...)` succeed without modifying `package-lock.json`.

```

### Reviewer 1: grok-build

Status: approved

Reason: Spec is implementable as written: live product/wallet/txHash/creditKey contract, locked TS/Python/Go surfaces, selection and orchestration, tests, and docs all fit this repo.

Raw Response:

```text
I'll read the full draft and review it against the negotiate-loop rules.I'll inspect the repo and any prior negotiate notes so the review is grounded in the actual SDK.I'll check whether the locked TypeScript types actually typecheck under this repo's compiler flags.---STATUS---
status: approved
reason: Spec is implementable as written: live product/wallet/txHash/creditKey contract, locked TS/Python/Go surfaces, selection and orchestration, tests, and docs all fit this repo.
```

### Reviewer 2: claude

Status: approved

Reason: Wire contract, validation, selection, orchestration, and per-language type specs are complete, mutually consistent, and each phase's touches/verify steps align with the shared constraints.

Raw Response:

```text
---STATUS---
status: approved
reason: Wire contract, validation, selection, orchestration, and per-language type specs are complete, mutually consistent, and each phase's touches/verify steps align with the shared constraints.
```

### Reviewer 3: codex

Status: approved

Reason: The draft is internally consistent, implementation-ready, and defines precise cross-language APIs, validation, wire behavior, orchestration, testing, and documentation requirements.

Raw Response:

```text
---STATUS---
status: approved
reason: The draft is internally consistent, implementation-ready, and defines precise cross-language APIs, validation, wire behavior, orchestration, testing, and documentation requirements.
```

### Reviewer 4: devin

Status: approved

Reason: Spec is internally consistent across wire contract, validation, selection, orchestration, unknown-field handling, and all three language locked APIs with no contradictions or gaps.

Raw Response:

```text
---STATUS---
status: approved
reason: Spec is internally consistent across wire contract, validation, selection, orchestration, unknown-field handling, and all three language locked APIs with no contradictions or gaps.
```

### Reviewer 5: local

Status: approved

Reason: The draft meets all the specified requirements and guidelines.

Raw Response:

```text
---STATUS---
status: approved
reason: The draft meets all the specified requirements and guidelines.
```

## Final Outcome

Converged in round 3.
