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
