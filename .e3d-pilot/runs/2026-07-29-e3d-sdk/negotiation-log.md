---
run_id: 2026-07-29-e3d-sdk
---

# Negotiation Log

## Round 1

### Draft Before Round

```text
# Real-Time Webhook Subscriptions

## Overview

Add a first-class TypeScript webhook surface to the E3D SDK. Integrators will be able to create and manage subscriptions for story, thesis, and token-intelligence events, model delivery and retry metadata with typed payloads, and verify signed webhook requests before parsing them.

This repository contains the client SDK rather than the E3D delivery service. The implementation therefore defines and exposes the complete integrator-facing contract while calling the corresponding `/webhooks` API endpoints; it does not implement the remote dispatcher.

## Goals

- Expose typed webhook subscription creation, listing, retrieval, updating, secret rotation, and deletion through `e3d.webhooks`.
- Support filters for token addresses, detector patterns, thesis IDs, and corroboration thresholds.
- Define stable event-envelope and delivery-attempt types for stories, theses, and token events.
- Provide an HMAC-SHA256 verification helper with timestamp replay protection.
- Document subscription setup, receiver verification, retry expectations, deduplication, and secret handling.
- Preserve the SDK’s existing HTTP, normalization, error, and ESM conventions.

## Non-Goals

- Implement the server-side webhook dispatcher, persistence, scheduling, or retry queue.
- Add polling, local background workers, an HTTP receiver framework, or deployment infrastructure.
- Add Python or Go webhook bindings in this iteration.
- Change existing stories, theses, token-intelligence, authentication, or swap behavior.
- Add a new runtime or development dependency.
- Modify examples, lockfiles, TypeScript configuration, or runner configuration.

## Existing Files

- `src/client.ts` constructs the public `E3D` client and its modules.
- `src/index.ts` defines the package’s public runtime and type exports.
- `src/http.ts` provides authenticated HTTP methods, request-body serialization, error handling, and response normalization.
- `src/normalize.ts` recursively converts response keys from snake_case to camelCase.
- `src/stories.ts`, `src/theses.ts`, and `src/tokenIntelligence.ts` demonstrate current module conventions.
- `src/types.ts` contains shared client and transport types.
- `README.md` documents installation, public modules, and basic usage.
- `package.json` defines Node 18 as the minimum runtime and `npm run typecheck` as the configured static verification command.

## Shared Constraints

- Keep the complete change within 6 files, 600 changed lines, and the pipeline-wide limit of 25 files.
- Do not modify `tsconfig.json`, `examples/**`, `package-lock.json`, `.codex-spec-runner/**`, `.claude/**`, or `.git/**`.
- Use the existing `HttpClient`; do not duplicate authentication, base-URL, timeout, normalization, or error behavior.
- Follow the repository’s ESM convention by using `.js` suffixes in TypeScript imports and exports.
- Do not add dependencies or change package scripts.
- Keep all existing public APIs backward compatible.
- Treat webhook signing secrets as write-only credentials: expose them only where returned by creation or rotation, and never log or persist them.
- Use the exact raw request body for signature verification. Parsed and reserialized JSON is not an acceptable verification input.
- The SDK manages subscriptions and verifies received requests; delivery, retry scheduling, and endpoint health are server responsibilities.

## Phase 1 - Webhook Subscription and Event Contract

<!-- runner:model=codex:gpt-5.4-mini -->
<!-- pilot:touches=src/webhooks.ts -->
<!-- pilot:touches=src/client.ts -->
<!-- pilot:touches=src/index.ts -->
<!-- runner:read=src/http.ts -->
<!-- runner:read=src/normalize.ts -->
<!-- runner:read=src/stories.ts -->
<!-- runner:verify=npm run typecheck -->

### Requirements

1. Add `src/webhooks.ts` with exported types for the webhook API:
   - `WebhookEventType` covering `story.created`, `thesis.corroborated`, and `token.event`.
   - `WebhookSubscriptionStatus` covering `active`, `paused`, and `disabled`.
   - `WebhookFilter` with optional `tokenAddresses`, `patternIds`, `thesisIds`, and `minCorroborations`.
   - `CreateWebhookSubscriptionInput` with an HTTPS endpoint URL, a non-empty event list, and optional filter and description.
   - `UpdateWebhookSubscriptionInput` with optional URL, events, filter, description, and status fields.
   - `WebhookSubscription` with ID, URL, events, filter, status, description, and creation/update timestamps.
   - A creation result type containing the subscription plus the newly issued signing secret.
   - A secret-rotation result type containing the subscription ID and replacement signing secret.
   - List parameters and a paginated list result with optional cursor support.
2. Define the receiver-facing event contract in `src/webhooks.ts`:
   - A generic `WebhookEvent<TData>` envelope containing a stable event ID, event type, creation timestamp, subscription ID, delivery attempt number, and typed `data`.
   - Specific data interfaces for story creation, thesis corroboration, and token events. Known identifiers and threshold fields must be typed, while an additive `Record<string, unknown>` payload or metadata field must preserve forward compatibility with evolving API data.
   - A `WebhookDeliveryHeaders` interface for the E3D event ID, timestamp, signature, and delivery-attempt headers.
   - Exported constants for the canonical header names so receiver implementations do not hard-code strings independently.
3. Add `WebhooksModule`, following the constructor and `HttpClient` conventions used by existing modules, with these methods:
   - `create(input)` sends `POST /webhooks/subscriptions`.
   - `list(params?)` sends `GET /webhooks/subscriptions` with only defined query values.
   - `getById(subscriptionId)` sends `GET /webhooks/subscriptions/{encoded-id}`.
   - `update(subscriptionId, input)` sends `PATCH /webhooks/subscriptions/{encoded-id}` through `HttpClient.request`.
   - `rotateSecret(subscriptionId)` sends `POST /webhooks/subscriptions/{encoded-id}/rotate-secret`.
   - `delete(subscriptionId)` sends `DELETE /webhooks/subscriptions/{encoded-id}` and supports an empty response.
4. Encode subscription IDs with `encodeURIComponent` before interpolating them into paths.
5. Serialize request bodies using API-facing snake_case keys for fields whose public TypeScript names are camelCase, including filter fields. Strip `undefined` fields without discarding explicit `false`, `0`, empty arrays, or `null` when the relevant update type permits clearing a value.
6. Perform only deterministic client-side validation that prevents invalid requests:
   - Creation requires an `https:` endpoint URL.
   - Creation requires at least one event.
   - `minCorroborations`, when present, must be a positive integer.
   - Reject invalid inputs before issuing an HTTP request with a clear `TypeError` or `RangeError`.
   - Do not invent server-side authorization, quota, or filter-combination rules.
7. Instantiate `WebhooksModule` as readonly `e3d.webhooks` in `src/client.ts`.
8. Export `WebhooksModule` and all public webhook contract types from `src/index.ts`. Preserve all existing exports.

### Acceptance Criteria

- Consumers can create, list, retrieve, update, rotate the secret for, and delete webhook subscriptions through `E3D`.
- Each method uses the specified HTTP verb and `/webhooks/subscriptions` path.
- Dynamic subscription IDs are URL encoded.
- Invalid creation URLs, empty event lists, and invalid corroboration thresholds fail before `fetch` is called.
- Request bodies use the documented API field names, and API responses retain the SDK’s existing camelCase normalization behavior.
- Story, thesis, and token events can be discriminated through the exported `type` field.
- Signing secrets appear only in creation and rotation result types, not on ordinary subscription objects.
- Existing modules and public exports remain available.
- `npm run typecheck` succeeds.

## Phase 2 - HMAC Verification and Integration Documentation

<!-- runner:model=codex:gpt-5.4-mini -->
<!-- pilot:touches=src/webhookSignature.ts -->
<!-- pilot:touches=src/index.ts -->
<!-- pilot:touches=README.md -->
<!-- runner:read=src/webhooks.ts -->
<!-- runner:read=package.json -->
<!-- runner:verify=npm run typecheck -->

### Requirements

1. Add `src/webhookSignature.ts` with a dependency-free, asynchronous `verifyWebhookSignature` helper suitable for the package’s Node 18 minimum runtime and Web Crypto-compatible environments.
2. Export a `VerifyWebhookSignatureInput` type accepting:
   - `payload` as the unmodified request body, represented by `string`, `Uint8Array`, or `ArrayBuffer`.
   - The timestamp header value.
   - The signature header value.
   - The subscription signing secret.
   - Optional `toleranceSeconds`, defaulting to 300.
   - Optional `now` in Unix seconds for deterministic callers and testing.
3. Implement the signing contract as HMAC-SHA256 over the UTF-8 byte sequence `<timestamp>.<raw-payload>`.
4. Accept signature entries in `v1=<lowercase-or-uppercase-hex>` form. Permit comma-separated entries so secrets can be rotated without an atomic receiver deployment, ignore unsupported signature versions, and succeed when any valid `v1` entry matches.
5. Verify signatures without an early-exit byte comparison that leaks the first mismatching position. Web Crypto verification may be used for the constant-time cryptographic comparison.
6. Enforce replay protection:
   - Parse the timestamp as whole Unix seconds.
   - Reject malformed timestamps.
   - Reject timestamps whose absolute difference from `now` exceeds `toleranceSeconds`.
   - Reject negative or non-finite tolerance values.
7. Return `false` for malformed, stale, unsupported, or mismatched signatures. Throw only for invalid caller configuration or when the runtime lacks the required cryptographic capability; never include the signing secret in an error.
8. Export the helper and its input type from `src/index.ts` without removing or renaming existing exports.
9. Update `README.md`:
   - Add `webhooks` to the module list.
   - Add a concise TypeScript example creating a filtered subscription for story and thesis events.
   - Show receiver-side verification against the raw body before `JSON.parse`.
   - Name the canonical E3D timestamp and signature headers using the exported constants.
   - State that any 2xx receiver response acknowledges delivery; non-2xx responses and network failures are eligible for server-managed retry.
   - State that deliveries are at-least-once, may arrive out of order, and must be deduplicated using the stable event ID.
   - Explain the delivery-attempt field and advise receivers to process events idempotently.
   - Explain the default five-minute replay window and secret rotation.
   - Avoid promising a fixed retry count or backoff schedule that is not represented by the SDK contract.

### Acceptance Criteria

- A correctly signed raw payload inside the timestamp window verifies as `true`.
- Changing the payload, timestamp, signature, or secret makes verification return `false`.
- Stale, excessively future-dated, malformed, unsupported-version, and non-hex signatures return `false`.
- Comma-separated signatures verify when at least one supported `v1` signature is valid.
- String and binary payload inputs produce equivalent verification results for equivalent bytes.
- Verification occurs before JSON parsing in the documented receiver flow.
- The README explains acknowledgment, retry ownership, at-least-once delivery, ordering, deduplication, idempotency, replay protection, and rotation without claiming undocumented retry timing.
- No dependency or package-script change is introduced.
- `npm run typecheck` succeeds.

```

### Reviewer 1: devin

Status: approved

Reason: Spec is technically sound, security-conscious, scope-bounded, and self-consistent across both phases with clear acceptance criteria and no contradictions.

Raw Response:

```text
---STATUS---
status: approved
reason: Spec is technically sound, security-conscious, scope-bounded, and self-consistent across both phases with clear acceptance criteria and no contradictions.
```

### Reviewer 2: codex

Status: revise

Reason: The event payload fields, update-clearing semantics, list parameters, and signing-secret encoding are underspecified, preventing a deterministic interoperable implementation.

Replacement Spec:

```spec
# Real-Time Webhook Subscriptions

## Overview

Add a first-class TypeScript webhook surface to the E3D SDK. Integrators will be able to create and manage subscriptions for story, thesis, and token-intelligence events, model delivery and retry metadata with typed payloads, and verify signed webhook requests before parsing them.

This repository contains the client SDK rather than the E3D delivery service. The implementation therefore defines and exposes the complete integrator-facing contract while calling the corresponding `/webhooks` API endpoints; it does not implement the remote dispatcher.

## Goals

- Expose typed webhook subscription creation, listing, retrieval, updating, secret rotation, and deletion through `e3d.webhooks`.
- Support filters for token addresses, detector pattern IDs, thesis IDs, and corroboration thresholds.
- Define stable event-envelope and delivery-attempt types for stories, theses, and token events.
- Provide an HMAC-SHA256 verification helper with timestamp replay protection.
- Document subscription setup, receiver verification, retry expectations, deduplication, and secret handling.
- Preserve the SDK’s existing HTTP, normalization, error, and ESM conventions.

## Non-Goals

- Implement the server-side webhook dispatcher, persistence, scheduling, or retry queue.
- Add polling, local background workers, an HTTP receiver framework, or deployment infrastructure.
- Add Python or Go webhook bindings in this iteration.
- Change existing stories, theses, token-intelligence, authentication, or swap behavior.
- Add a new runtime or development dependency.
- Modify examples, lockfiles, TypeScript configuration, or runner configuration.

## Existing Files

- `src/client.ts` constructs the public `E3D` client and its modules.
- `src/index.ts` defines the package’s public runtime and type exports.
- `src/http.ts` provides authenticated HTTP methods, request-body serialization, error handling, and response normalization.
- `src/normalize.ts` recursively converts response keys from snake_case to camelCase.
- `src/stories.ts`, `src/theses.ts`, and `src/tokenIntelligence.ts` demonstrate current module conventions.
- `src/types.ts` contains shared client and transport types.
- `README.md` documents installation, public modules, and basic usage.
- `package.json` defines Node 18 as the minimum runtime and `npm run typecheck` as the configured static verification command.

## Shared Constraints

- Keep the complete change within 6 files, 600 changed lines, and the pipeline-wide limit of 25 files.
- Do not modify `tsconfig.json`, `examples/**`, `package-lock.json`, `.codex-spec-runner/**`, `.claude/**`, or `.git/**`.
- Use the existing `HttpClient`; do not duplicate authentication, base-URL, timeout, normalization, or error behavior.
- Follow the repository’s ESM convention by using `.js` suffixes in TypeScript imports and exports.
- Do not add dependencies or change package scripts.
- Keep all existing public APIs backward compatible.
- Treat webhook signing secrets as write-only credentials: expose them only where returned by creation or rotation, and never log or persist them.
- Use the exact raw request body for signature verification. Parsed and reserialized JSON is not an acceptable verification input.
- The SDK manages subscriptions and verifies received requests; delivery, retry scheduling, and endpoint health are server responsibilities.

## Phase 1 - Webhook Subscription and Event Contract

<!-- runner:model=codex:gpt-5.4-mini -->
<!-- pilot:touches=src/webhooks.ts -->
<!-- pilot:touches=src/client.ts -->
<!-- pilot:touches=src/index.ts -->
<!-- runner:read=src/http.ts -->
<!-- runner:read=src/normalize.ts -->
<!-- runner:read=src/stories.ts -->
<!-- runner:verify=npm run typecheck -->

### Requirements

1. Add `src/webhooks.ts` with these exported subscription API types:
   - `WebhookEventType` is the union `'story.created' | 'thesis.corroborated' | 'token.event'`.
   - `WebhookSubscriptionStatus` is the union `'active' | 'paused' | 'disabled'`.
   - `WebhookFilter` has optional `tokenAddresses: string[]`, `patternIds: string[]`, `thesisIds: string[]`, and `minCorroborations: number`.
   - `CreateWebhookSubscriptionInput` has `url: string`, `events: WebhookEventType[]`, optional `filter?: WebhookFilter`, and optional `description?: string`.
   - `UpdateWebhookSubscriptionInput` has optional `url?: string`, `events?: WebhookEventType[]`, `filter?: WebhookFilter | null`, `description?: string | null`, and `status?: WebhookSubscriptionStatus`. `null` explicitly clears `filter` or `description`; omitted properties leave existing values unchanged.
   - `WebhookSubscription` has `id: string`, `url: string`, `events: WebhookEventType[]`, optional `filter?: WebhookFilter | null`, `status: WebhookSubscriptionStatus`, optional `description?: string | null`, `createdAt: string`, and `updatedAt: string`.
   - `CreateWebhookSubscriptionResult` contains `subscription: WebhookSubscription` and `signingSecret: string`.
   - `RotateWebhookSecretResult` contains `subscriptionId: string` and `signingSecret: string`.
   - `ListWebhookSubscriptionsParams` has optional `cursor?: string`, `limit?: number`, and `status?: WebhookSubscriptionStatus`.
   - `ListWebhookSubscriptionsResult` contains `data: WebhookSubscription[]` and optional `nextCursor?: string | null`.
2. Define and export the receiver-facing event contract in `src/webhooks.ts`:
   - `WebhookEvent<TType extends WebhookEventType, TData>` contains `id: string`, `type: TType`, `createdAt: string`, `subscriptionId: string`, `deliveryAttempt: number`, and `data: TData`.
   - `StoryCreatedWebhookData` contains `storyId: string` and `payload: Record<string, unknown>`.
   - `ThesisCorroboratedWebhookData` contains `thesisId: string`, `corroborationCount: number`, and `payload: Record<string, unknown>`.
   - `TokenEventWebhookData` contains `tokenAddress: string`, `patternId: string`, and `payload: Record<string, unknown>`.
   - `StoryCreatedWebhookEvent` aliases `WebhookEvent<'story.created', StoryCreatedWebhookData>`.
   - `ThesisCorroboratedWebhookEvent` aliases `WebhookEvent<'thesis.corroborated', ThesisCorroboratedWebhookData>`.
   - `TokenWebhookEvent` aliases `WebhookEvent<'token.event', TokenEventWebhookData>`.
   - `E3DWebhookEvent` is the discriminated union of those three event aliases, so narrowing on `type` also narrows `data`.
   - `WebhookDeliveryHeaders` has `eventId: string`, `timestamp: string`, `signature: string`, and `deliveryAttempt: string`.
   - Export canonical header constants with these exact values:
     - `E3D_WEBHOOK_EVENT_ID_HEADER = 'e3d-event-id'`
     - `E3D_WEBHOOK_TIMESTAMP_HEADER = 'e3d-webhook-timestamp'`
     - `E3D_WEBHOOK_SIGNATURE_HEADER = 'e3d-webhook-signature'`
     - `E3D_WEBHOOK_DELIVERY_ATTEMPT_HEADER = 'e3d-delivery-attempt'`
3. Add `WebhooksModule`, following the constructor and `HttpClient` conventions used by existing modules, with these methods:
   - `create(input)` sends `POST /webhooks/subscriptions` and returns `Promise<CreateWebhookSubscriptionResult>`.
   - `list(params?)` sends `GET /webhooks/subscriptions` and returns `Promise<ListWebhookSubscriptionsResult>`.
   - `getById(subscriptionId)` sends `GET /webhooks/subscriptions/{encoded-id}` and returns `Promise<WebhookSubscription>`.
   - `update(subscriptionId, input)` sends `PATCH /webhooks/subscriptions/{encoded-id}` through `HttpClient.request` and returns `Promise<WebhookSubscription>`.
   - `rotateSecret(subscriptionId)` sends `POST /webhooks/subscriptions/{encoded-id}/rotate-secret` and returns `Promise<RotateWebhookSecretResult>`.
   - `delete(subscriptionId)` sends `DELETE /webhooks/subscriptions/{encoded-id}`, accepts an empty response, and returns `Promise<void>`.
4. Encode subscription IDs with `encodeURIComponent` before interpolating them into paths.
5. Serialize request and query values as follows:
   - Request bodies use `snake_case` API keys: `token_addresses`, `pattern_ids`, `thesis_ids`, and `min_corroborations`.
   - List query keys are `cursor`, `limit`, and `status`.
   - Omit only `undefined` properties.
   - Preserve `null`, `false`, `0`, and empty arrays.
   - Preserve explicit `filter: null` and `description: null` in updates.
   - Do not send a request body with list, retrieval, rotation, or deletion requests unless required by the existing `HttpClient` method signature.
6. Perform only deterministic client-side validation that prevents invalid requests:
   - On creation and whenever `url` is supplied to update, parse it with `URL` and require the protocol to be exactly `https:`.
   - Creation requires at least one event.
   - When an update supplies `events`, it must contain at least one event.
   - `minCorroborations`, when present in a non-null filter, must be a positive integer.
   - When supplied, `limit` must be a positive integer.
   - Reject invalid inputs before issuing an HTTP request with a clear `TypeError` for malformed values or a `RangeError` for invalid numeric ranges.
   - Do not invent server-side authorization, quota, or filter-combination rules.
7. Instantiate `WebhooksModule` as readonly `e3d.webhooks` in `src/client.ts`.
8. Export `WebhooksModule`, the header constants, and all public webhook contract types from `src/index.ts`. Preserve all existing exports.

### Acceptance Criteria

- Consumers can create, list, retrieve, update, rotate the secret for, and delete webhook subscriptions through `E3D`.
- Each method uses the specified HTTP verb and `/webhooks/subscriptions` path.
- Dynamic subscription IDs are URL encoded.
- Invalid URLs, empty event lists, invalid list limits, and invalid corroboration thresholds fail before `fetch` is called.
- Request bodies and queries use the documented API field names, and API responses retain the SDK’s existing camelCase normalization behavior.
- `E3DWebhookEvent` narrows its `data` type when consumers discriminate on `type`.
- Signing secrets appear only in creation and rotation result types, not on ordinary subscription objects.
- Explicit update `null` values are transmitted while omitted fields are not.
- Existing modules and public exports remain available.
- `npm run typecheck` succeeds.

## Phase 2 - HMAC Verification and Integration Documentation

<!-- runner:model=codex:gpt-5.4-mini -->
<!-- pilot:touches=src/webhookSignature.ts -->
<!-- pilot:touches=src/index.ts -->
<!-- pilot:touches=README.md -->
<!-- runner:read=src/webhooks.ts -->
<!-- runner:read=package.json -->
<!-- runner:verify=npm run typecheck -->

### Requirements

1. Add `src/webhookSignature.ts` with a dependency-free, asynchronous `verifyWebhookSignature` helper suitable for the package’s Node 18 minimum runtime and Web Crypto-compatible environments.
2. Export a `VerifyWebhookSignatureInput` type accepting:
   - `payload` as the unmodified request body, represented by `string`, `Uint8Array`, or `ArrayBuffer`.
   - `timestamp` as the timestamp header value.
   - `signature` as the signature header value.
   - `secret` as the subscription signing secret.
   - Optional `toleranceSeconds`, defaulting to `300`.
   - Optional `now` in Unix seconds for deterministic callers and testing.
3. Define the signing bytes exactly:
   - Encode `timestamp` and `.` as UTF-8.
   - For a string payload, append its UTF-8 bytes.
   - For a `Uint8Array` or `ArrayBuffer` payload, append its bytes unchanged.
   - Compute HMAC-SHA256 over the resulting concatenation.
   - Import the signing secret itself as UTF-8 bytes; it is not hex- or Base64-decoded.
4. Parse signatures as a comma-separated list:
   - Trim ASCII whitespace surrounding each entry.
   - Accept entries matching `v1=<64 hexadecimal characters>`, case-insensitively for hexadecimal digits.
   - Ignore unsupported versions and malformed entries.
   - Succeed if any valid `v1` entry verifies.
5. Verify signatures without an early-exit byte comparison that leaks the first mismatching position. Use Web Crypto HMAC verification for the cryptographic comparison.
6. Enforce replay protection:
   - Accept a timestamp only when it matches a base-10, non-negative whole Unix-seconds integer with no sign, decimal point, exponent, or surrounding whitespace.
   - Return `false` for malformed timestamps.
   - Return `false` when the absolute difference between the timestamp and `now` exceeds `toleranceSeconds`; equality with the tolerance is accepted.
   - Default `now` to `Math.floor(Date.now() / 1000)`.
   - Throw a `RangeError` when caller-supplied `toleranceSeconds` or `now` is negative, non-finite, or not an integer.
7. Return `false` for malformed, stale, unsupported, or mismatched signatures. Throw only for the invalid caller configuration described above or when the runtime lacks the required cryptographic capability. Never include the signing secret, signature, or raw payload in an error.
8. Export the helper and its input type from `src/index.ts` without removing or renaming existing exports.
9. Update `README.md`:
   - Add `webhooks` to the module list.
   - Add a concise TypeScript example creating a filtered subscription for story and thesis events.
   - Show receiver-side verification against the raw body before `JSON.parse`.
   - Use `E3D_WEBHOOK_TIMESTAMP_HEADER` and `E3D_WEBHOOK_SIGNATURE_HEADER` when reading the canonical timestamp and signature headers.
   - State that any 2xx receiver response acknowledges delivery; non-2xx responses and network failures are eligible for server-managed retry.
   - State that deliveries are at-least-once, may arrive out of order, and must be deduplicated using the stable event ID.
   - Explain `deliveryAttempt` and advise receivers to process events idempotently.
   - Explain the default five-minute replay window and secret rotation.
   - State that creation and rotation responses are the only SDK contract types exposing signing secrets and advise secure storage.
   - Avoid promising a fixed retry count or backoff schedule that is not represented by the SDK contract.

### Acceptance Criteria

- A correctly signed raw payload inside or exactly on the timestamp-window boundary verifies as `true`.
- Changing the payload, timestamp, signature, or secret makes verification return `false`.
- Stale, excessively future-dated, malformed, unsupported-version, incorrectly sized, and non-hex signatures return `false`.
- Comma-separated signatures verify when at least one supported `v1` signature is valid.
- Hexadecimal signatures are accepted with lowercase or uppercase digits.
- String and binary payload inputs produce equivalent verification results when they represent the same bytes.
- Binary payload bytes are not decoded or re-encoded during verification.
- Verification occurs before JSON parsing in the documented receiver flow.
- The README explains acknowledgment, retry ownership, at-least-once delivery, ordering, deduplication, idempotency, replay protection, secure secret storage, and rotation without claiming undocumented retry timing.
- No dependency or package-script change is introduced.
- `npm run typecheck` succeeds.
```

Raw Response:

```text
---STATUS---
status: revise
reason: The event payload fields, update-clearing semantics, list parameters, and signing-secret encoding are underspecified, preventing a deterministic interoperable implementation.
```spec
# Real-Time Webhook Subscriptions

## Overview

Add a first-class TypeScript webhook surface to the E3D SDK. Integrators will be able to create and manage subscriptions for story, thesis, and token-intelligence events, model delivery and retry metadata with typed payloads, and verify signed webhook requests before parsing them.

This repository contains the client SDK rather than the E3D delivery service. The implementation therefore defines and exposes the complete integrator-facing contract while calling the corresponding `/webhooks` API endpoints; it does not implement the remote dispatcher.

## Goals

- Expose typed webhook subscription creation, listing, retrieval, updating, secret rotation, and deletion through `e3d.webhooks`.
- Support filters for token addresses, detector pattern IDs, thesis IDs, and corroboration thresholds.
- Define stable event-envelope and delivery-attempt types for stories, theses, and token events.
- Provide an HMAC-SHA256 verification helper with timestamp replay protection.
- Document subscription setup, receiver verification, retry expectations, deduplication, and secret handling.
- Preserve the SDK’s existing HTTP, normalization, error, and ESM conventions.

## Non-Goals

- Implement the server-side webhook dispatcher, persistence, scheduling, or retry queue.
- Add polling, local background workers, an HTTP receiver framework, or deployment infrastructure.
- Add Python or Go webhook bindings in this iteration.
- Change existing stories, theses, token-intelligence, authentication, or swap behavior.
- Add a new runtime or development dependency.
- Modify examples, lockfiles, TypeScript configuration, or runner configuration.

## Existing Files

- `src/client.ts` constructs the public `E3D` client and its modules.
- `src/index.ts` defines the package’s public runtime and type exports.
- `src/http.ts` provides authenticated HTTP methods, request-body serialization, error handling, and response normalization.
- `src/normalize.ts` recursively converts response keys from snake_case to camelCase.
- `src/stories.ts`, `src/theses.ts`, and `src/tokenIntelligence.ts` demonstrate current module conventions.
- `src/types.ts` contains shared client and transport types.
- `README.md` documents installation, public modules, and basic usage.
- `package.json` defines Node 18 as the minimum runtime and `npm run typecheck` as the configured static verification command.

## Shared Constraints

- Keep the complete change within 6 files, 600 changed lines, and the pipeline-wide limit of 25 files.
- Do not modify `tsconfig.json`, `examples/**`, `package-lock.json`, `.codex-spec-runner/**`, `.claude/**`, or `.git/**`.
- Use the existing `HttpClient`; do not duplicate authentication, base-URL, timeout, normalization, or error behavior.
- Follow the repository’s ESM convention by using `.js` suffixes in TypeScript imports and exports.
- Do not add dependencies or change package scripts.
- Keep all existing public APIs backward compatible.
- Treat webhook signing secrets as write-only credentials: expose them only where returned by creation or rotation, and never log or persist them.
- Use the exact raw request body for signature verification. Parsed and reserialized JSON is not an acceptable verification input.
- The SDK manages subscriptions and verifies received requests; delivery, retry scheduling, and endpoint health are server responsibilities.

## Phase 1 - Webhook Subscription and Event Contract

<!-- runner:model=codex:gpt-5.4-mini -->
<!-- pilot:touches=src/webhooks.ts -->
<!-- pilot:touches=src/client.ts -->
<!-- pilot:touches=src/index.ts -->
<!-- runner:read=src/http.ts -->
<!-- runner:read=src/normalize.ts -->
<!-- runner:read=src/stories.ts -->
<!-- runner:verify=npm run typecheck -->

### Requirements

1. Add `src/webhooks.ts` with these exported subscription API types:
   - `WebhookEventType` is the union `'story.created' | 'thesis.corroborated' | 'token.event'`.
   - `WebhookSubscriptionStatus` is the union `'active' | 'paused' | 'disabled'`.
   - `WebhookFilter` has optional `tokenAddresses: string[]`, `patternIds: string[]`, `thesisIds: string[]`, and `minCorroborations: number`.
   - `CreateWebhookSubscriptionInput` has `url: string`, `events: WebhookEventType[]`, optional `filter?: WebhookFilter`, and optional `description?: string`.
   - `UpdateWebhookSubscriptionInput` has optional `url?: string`, `events?: WebhookEventType[]`, `filter?: WebhookFilter | null`, `description?: string | null`, and `status?: WebhookSubscriptionStatus`. `null` explicitly clears `filter` or `description`; omitted properties leave existing values unchanged.
   - `WebhookSubscription` has `id: string`, `url: string`, `events: WebhookEventType[]`, optional `filter?: WebhookFilter | null`, `status: WebhookSubscriptionStatus`, optional `description?: string | null`, `createdAt: string`, and `updatedAt: string`.
   - `CreateWebhookSubscriptionResult` contains `subscription: WebhookSubscription` and `signingSecret: string`.
   - `RotateWebhookSecretResult` contains `subscriptionId: string` and `signingSecret: string`.
   - `ListWebhookSubscriptionsParams` has optional `cursor?: string`, `limit?: number`, and `status?: WebhookSubscriptionStatus`.
   - `ListWebhookSubscriptionsResult` contains `data: WebhookSubscription[]` and optional `nextCursor?: string | null`.
2. Define and export the receiver-facing event contract in `src/webhooks.ts`:
   - `WebhookEvent<TType extends WebhookEventType, TData>` contains `id: string`, `type: TType`, `createdAt: string`, `subscriptionId: string`, `deliveryAttempt: number`, and `data: TData`.
   - `StoryCreatedWebhookData` contains `storyId: string` and `payload: Record<string, unknown>`.
   - `ThesisCorroboratedWebhookData` contains `thesisId: string`, `corroborationCount: number`, and `payload: Record<string, unknown>`.
   - `TokenEventWebhookData` contains `tokenAddress: string`, `patternId: string`, and `payload: Record<string, unknown>`.
   - `StoryCreatedWebhookEvent` aliases `WebhookEvent<'story.created', StoryCreatedWebhookData>`.
   - `ThesisCorroboratedWebhookEvent` aliases `WebhookEvent<'thesis.corroborated', ThesisCorroboratedWebhookData>`.
   - `TokenWebhookEvent` aliases `WebhookEvent<'token.event', TokenEventWebhookData>`.
   - `E3DWebhookEvent` is the discriminated union of those three event aliases, so narrowing on `type` also narrows `data`.
   - `WebhookDeliveryHeaders` has `eventId: string`, `timestamp: string`, `signature: string`, and `deliveryAttempt: string`.
   - Export canonical header constants with these exact values:
     - `E3D_WEBHOOK_EVENT_ID_HEADER = 'e3d-event-id'`
     - `E3D_WEBHOOK_TIMESTAMP_HEADER = 'e3d-webhook-timestamp'`
     - `E3D_WEBHOOK_SIGNATURE_HEADER = 'e3d-webhook-signature'`
     - `E3D_WEBHOOK_DELIVERY_ATTEMPT_HEADER = 'e3d-delivery-attempt'`
3. Add `WebhooksModule`, following the constructor and `HttpClient` conventions used by existing modules, with these methods:
   - `create(input)` sends `POST /webhooks/subscriptions` and returns `Promise<CreateWebhookSubscriptionResult>`.
   - `list(params?)` sends `GET /webhooks/subscriptions` and returns `Promise<ListWebhookSubscriptionsResult>`.
   - `getById(subscriptionId)` sends `GET /webhooks/subscriptions/{encoded-id}` and returns `Promise<WebhookSubscription>`.
   - `update(subscriptionId, input)` sends `PATCH /webhooks/subscriptions/{encoded-id}` through `HttpClient.request` and returns `Promise<WebhookSubscription>`.
   - `rotateSecret(subscriptionId)` sends `POST /webhooks/subscriptions/{encoded-id}/rotate-secret` and returns `Promise<RotateWebhookSecretResult>`.
   - `delete(subscriptionId)` sends `DELETE /webhooks/subscriptions/{encoded-id}`, accepts an empty response, and returns `Promise<void>`.
4. Encode subscription IDs with `encodeURIComponent` before interpolating them into paths.
5. Serialize request and query values as follows:
   - Request bodies use `snake_case` API keys: `token_addresses`, `pattern_ids`, `thesis_ids`, and `min_corroborations`.
   - List query keys are `cursor`, `limit`, and `status`.
   - Omit only `undefined` properties.
   - Preserve `null`, `false`, `0`, and empty arrays.
   - Preserve explicit `filter: null` and `description: null` in updates.
   - Do not send a request body with list, retrieval, rotation, or deletion requests unless required by the existing `HttpClient` method signature.
6. Perform only deterministic client-side validation that prevents invalid requests:
   - On creation and whenever `url` is supplied to update, parse it with `URL` and require the protocol to be exactly `https:`.
   - Creation requires at least one event.
   - When an update supplies `events`, it must contain at least one event.
   - `minCorroborations`, when present in a non-null filter, must be a positive integer.
   - When supplied, `limit` must be a positive integer.
   - Reject invalid inputs before issuing an HTTP request with a clear `TypeError` for malformed values or a `RangeError` for invalid numeric ranges.
   - Do not invent server-side authorization, quota, or filter-combination rules.
7. Instantiate `WebhooksModule` as readonly `e3d.webhooks` in `src/client.ts`.
8. Export `WebhooksModule`, the header constants, and all public webhook contract types from `src/index.ts`. Preserve all existing exports.

### Acceptance Criteria

- Consumers can create, list, retrieve, update, rotate the secret for, and delete webhook subscriptions through `E3D`.
- Each method uses the specified HTTP verb and `/webhooks/subscriptions` path.
- Dynamic subscription IDs are URL encoded.
- Invalid URLs, empty event lists, invalid list limits, and invalid corroboration thresholds fail before `fetch` is called.
- Request bodies and queries use the documented API field names, and API responses retain the SDK’s existing camelCase normalization behavior.
- `E3DWebhookEvent` narrows its `data` type when consumers discriminate on `type`.
- Signing secrets appear only in creation and rotation result types, not on ordinary subscription objects.
- Explicit update `null` values are transmitted while omitted fields are not.
- Existing modules and public exports remain available.
- `npm run typecheck` succeeds.

## Phase 2 - HMAC Verification and Integration Documentation

<!-- runner:model=codex:gpt-5.4-mini -->
<!-- pilot:touches=src/webhookSignature.ts -->
<!-- pilot:touches=src/index.ts -->
<!-- pilot:touches=README.md -->
<!-- runner:read=src/webhooks.ts -->
<!-- runner:read=package.json -->
<!-- runner:verify=npm run typecheck -->

### Requirements

1. Add `src/webhookSignature.ts` with a dependency-free, asynchronous `verifyWebhookSignature` helper suitable for the package’s Node 18 minimum runtime and Web Crypto-compatible environments.
2. Export a `VerifyWebhookSignatureInput` type accepting:
   - `payload` as the unmodified request body, represented by `string`, `Uint8Array`, or `ArrayBuffer`.
   - `timestamp` as the timestamp header value.
   - `signature` as the signature header value.
   - `secret` as the subscription signing secret.
   - Optional `toleranceSeconds`, defaulting to `300`.
   - Optional `now` in Unix seconds for deterministic callers and testing.
3. Define the signing bytes exactly:
   - Encode `timestamp` and `.` as UTF-8.
   - For a string payload, append its UTF-8 bytes.
   - For a `Uint8Array` or `ArrayBuffer` payload, append its bytes unchanged.
   - Compute HMAC-SHA256 over the resulting concatenation.
   - Import the signing secret itself as UTF-8 bytes; it is not hex- or Base64-decoded.
4. Parse signatures as a comma-separated list:
   - Trim ASCII whitespace surrounding each entry.
   - Accept entries matching `v1=<64 hexadecimal characters>`, case-insensitively for hexadecimal digits.
   - Ignore unsupported versions and malformed entries.
   - Succeed if any valid `v1` entry verifies.
5. Verify signatures without an early-exit byte comparison that leaks the first mismatching position. Use Web Crypto HMAC verification for the cryptographic comparison.
6. Enforce replay protection:
   - Accept a timestamp only when it matches a base-10, non-negative whole Unix-seconds integer with no sign, decimal point, exponent, or surrounding whitespace.
   - Return `false` for malformed timestamps.
   - Return `false` when the absolute difference between the timestamp and `now` exceeds `toleranceSeconds`; equality with the tolerance is accepted.
   - Default `now` to `Math.floor(Date.now() / 1000)`.
   - Throw a `RangeError` when caller-supplied `toleranceSeconds` or `now` is negative, non-finite, or not an integer.
7. Return `false` for malformed, stale, unsupported, or mismatched signatures. Throw only for the invalid caller configuration described above or when the runtime lacks the required cryptographic capability. Never include the signing secret, signature, or raw payload in an error.
8. Export the helper and its input type from `src/index.ts` without removing or renaming existing exports.
9. Update `README.md`:
   - Add `webhooks` to the module list.
   - Add a concise TypeScript example creating a filtered subscription for story and thesis events.
   - Show receiver-side verification against the raw body before `JSON.parse`.
   - Use `E3D_WEBHOOK_TIMESTAMP_HEADER` and `E3D_WEBHOOK_SIGNATURE_HEADER` when reading the canonical timestamp and signature headers.
   - State that any 2xx receiver response acknowledges delivery; non-2xx responses and network failures are eligible for server-managed retry.
   - State that deliveries are at-least-once, may arrive out of order, and must be deduplicated using the stable event ID.
   - Explain `deliveryAttempt` and advise receivers to process events idempotently.
   - Explain the default five-minute replay window and secret rotation.
   - State that creation and rotation responses are the only SDK contract types exposing signing secrets and advise secure storage.
   - Avoid promising a fixed retry count or backoff schedule that is not represented by the SDK contract.

### Acceptance Criteria

- A correctly signed raw payload inside or exactly on the timestamp-window boundary verifies as `true`.
- Changing the payload, timestamp, signature, or secret makes verification return `false`.
- Stale, excessively future-dated, malformed, unsupported-version, incorrectly sized, and non-hex signatures return `false`.
- Comma-separated signatures verify when at least one supported `v1` signature is valid.
- Hexadecimal signatures are accepted with lowercase or uppercase digits.
- String and binary payload inputs produce equivalent verification results when they represent the same bytes.
- Binary payload bytes are not decoded or re-encoded during verification.
- Verification occurs before JSON parsing in the documented receiver flow.
- The README explains acknowledgment, retry ownership, at-least-once delivery, ordering, deduplication, idempotency, replay protection, secure secret storage, and rotation without claiming undocumented retry timing.
- No dependency or package-script change is introduced.
- `npm run typecheck` succeeds.
```
```

### Reviewer 3: local

Status: approved

Reason: The draft is clear and comprehensive, aligning with the specified goals and constraints.

Raw Response:

```text
---STATUS---
status: approved
reason: The draft is clear and comprehensive, aligning with the specified goals and constraints.
```

Round Result: not converged

At least one reviewer requested revision in round 1.

## Round 2

### Draft Before Round

```text
# Real-Time Webhook Subscriptions

## Overview

Add a first-class TypeScript webhook surface to the E3D SDK. Integrators will be able to create and manage subscriptions for story, thesis, and token-intelligence events, model delivery and retry metadata with typed payloads, and verify signed webhook requests before parsing them.

This repository contains the client SDK rather than the E3D delivery service. The implementation therefore defines and exposes the complete integrator-facing contract while calling the corresponding `/webhooks` API endpoints; it does not implement the remote dispatcher.

## Goals

- Expose typed webhook subscription creation, listing, retrieval, updating, secret rotation, and deletion through `e3d.webhooks`.
- Support filters for token addresses, detector pattern IDs, thesis IDs, and corroboration thresholds.
- Define stable event-envelope and delivery-attempt types for stories, theses, and token events.
- Provide an HMAC-SHA256 verification helper with timestamp replay protection.
- Document subscription setup, receiver verification, retry expectations, deduplication, and secret handling.
- Preserve the SDK’s existing HTTP, normalization, error, and ESM conventions.

## Non-Goals

- Implement the server-side webhook dispatcher, persistence, scheduling, or retry queue.
- Add polling, local background workers, an HTTP receiver framework, or deployment infrastructure.
- Add Python or Go webhook bindings in this iteration.
- Change existing stories, theses, token-intelligence, authentication, or swap behavior.
- Add a new runtime or development dependency.
- Modify examples, lockfiles, TypeScript configuration, or runner configuration.

## Existing Files

- `src/client.ts` constructs the public `E3D` client and its modules.
- `src/index.ts` defines the package’s public runtime and type exports.
- `src/http.ts` provides authenticated HTTP methods, request-body serialization, error handling, and response normalization.
- `src/normalize.ts` recursively converts response keys from snake_case to camelCase.
- `src/stories.ts`, `src/theses.ts`, and `src/tokenIntelligence.ts` demonstrate current module conventions.
- `src/types.ts` contains shared client and transport types.
- `README.md` documents installation, public modules, and basic usage.
- `package.json` defines Node 18 as the minimum runtime and `npm run typecheck` as the configured static verification command.

## Shared Constraints

- Keep the complete change within 6 files, 600 changed lines, and the pipeline-wide limit of 25 files.
- Do not modify `tsconfig.json`, `examples/**`, `package-lock.json`, `.codex-spec-runner/**`, `.claude/**`, or `.git/**`.
- Use the existing `HttpClient`; do not duplicate authentication, base-URL, timeout, normalization, or error behavior.
- Follow the repository’s ESM convention by using `.js` suffixes in TypeScript imports and exports.
- Do not add dependencies or change package scripts.
- Keep all existing public APIs backward compatible.
- Treat webhook signing secrets as write-only credentials: expose them only where returned by creation or rotation, and never log or persist them.
- Use the exact raw request body for signature verification. Parsed and reserialized JSON is not an acceptable verification input.
- The SDK manages subscriptions and verifies received requests; delivery, retry scheduling, and endpoint health are server responsibilities.

## Phase 1 - Webhook Subscription and Event Contract

<!-- runner:model=codex:gpt-5.4-mini -->
<!-- pilot:touches=src/webhooks.ts -->
<!-- pilot:touches=src/client.ts -->
<!-- pilot:touches=src/index.ts -->
<!-- runner:read=src/http.ts -->
<!-- runner:read=src/normalize.ts -->
<!-- runner:read=src/stories.ts -->
<!-- runner:verify=npm run typecheck -->

### Requirements

1. Add `src/webhooks.ts` with these exported subscription API types:
   - `WebhookEventType` is the union `'story.created' | 'thesis.corroborated' | 'token.event'`.
   - `WebhookSubscriptionStatus` is the union `'active' | 'paused' | 'disabled'`.
   - `WebhookFilter` has optional `tokenAddresses: string[]`, `patternIds: string[]`, `thesisIds: string[]`, and `minCorroborations: number`.
   - `CreateWebhookSubscriptionInput` has `url: string`, `events: WebhookEventType[]`, optional `filter?: WebhookFilter`, and optional `description?: string`.
   - `UpdateWebhookSubscriptionInput` has optional `url?: string`, `events?: WebhookEventType[]`, `filter?: WebhookFilter | null`, `description?: string | null`, and `status?: WebhookSubscriptionStatus`. `null` explicitly clears `filter` or `description`; omitted properties leave existing values unchanged.
   - `WebhookSubscription` has `id: string`, `url: string`, `events: WebhookEventType[]`, optional `filter?: WebhookFilter | null`, `status: WebhookSubscriptionStatus`, optional `description?: string | null`, `createdAt: string`, and `updatedAt: string`.
   - `CreateWebhookSubscriptionResult` contains `subscription: WebhookSubscription` and `signingSecret: string`.
   - `RotateWebhookSecretResult` contains `subscriptionId: string` and `signingSecret: string`.
   - `ListWebhookSubscriptionsParams` has optional `cursor?: string`, `limit?: number`, and `status?: WebhookSubscriptionStatus`.
   - `ListWebhookSubscriptionsResult` contains `data: WebhookSubscription[]` and optional `nextCursor?: string | null`.
2. Define and export the receiver-facing event contract in `src/webhooks.ts`:
   - `WebhookEvent<TType extends WebhookEventType, TData>` contains `id: string`, `type: TType`, `createdAt: string`, `subscriptionId: string`, `deliveryAttempt: number`, and `data: TData`.
   - `StoryCreatedWebhookData` contains `storyId: string` and `payload: Record<string, unknown>`.
   - `ThesisCorroboratedWebhookData` contains `thesisId: string`, `corroborationCount: number`, and `payload: Record<string, unknown>`.
   - `TokenEventWebhookData` contains `tokenAddress: string`, `patternId: string`, and `payload: Record<string, unknown>`.
   - `StoryCreatedWebhookEvent` aliases `WebhookEvent<'story.created', StoryCreatedWebhookData>`.
   - `ThesisCorroboratedWebhookEvent` aliases `WebhookEvent<'thesis.corroborated', ThesisCorroboratedWebhookData>`.
   - `TokenWebhookEvent` aliases `WebhookEvent<'token.event', TokenEventWebhookData>`.
   - `E3DWebhookEvent` is the discriminated union of those three event aliases, so narrowing on `type` also narrows `data`.
   - `WebhookDeliveryHeaders` has `eventId: string`, `timestamp: string`, `signature: string`, and `deliveryAttempt: string`.
   - Export canonical header constants with these exact values:
     - `E3D_WEBHOOK_EVENT_ID_HEADER = 'e3d-event-id'`
     - `E3D_WEBHOOK_TIMESTAMP_HEADER = 'e3d-webhook-timestamp'`
     - `E3D_WEBHOOK_SIGNATURE_HEADER = 'e3d-webhook-signature'`
     - `E3D_WEBHOOK_DELIVERY_ATTEMPT_HEADER = 'e3d-delivery-attempt'`
3. Add `WebhooksModule`, following the constructor and `HttpClient` conventions used by existing modules, with these methods:
   - `create(input)` sends `POST /webhooks/subscriptions` and returns `Promise<CreateWebhookSubscriptionResult>`.
   - `list(params?)` sends `GET /webhooks/subscriptions` and returns `Promise<ListWebhookSubscriptionsResult>`.
   - `getById(subscriptionId)` sends `GET /webhooks/subscriptions/{encoded-id}` and returns `Promise<WebhookSubscription>`.
   - `update(subscriptionId, input)` sends `PATCH /webhooks/subscriptions/{encoded-id}` through `HttpClient.request` and returns `Promise<WebhookSubscription>`.
   - `rotateSecret(subscriptionId)` sends `POST /webhooks/subscriptions/{encoded-id}/rotate-secret` and returns `Promise<RotateWebhookSecretResult>`.
   - `delete(subscriptionId)` sends `DELETE /webhooks/subscriptions/{encoded-id}`, accepts an empty response, and returns `Promise<void>`.
4. Encode subscription IDs with `encodeURIComponent` before interpolating them into paths.
5. Serialize request and query values as follows:
   - Request bodies use `snake_case` API keys: `token_addresses`, `pattern_ids`, `thesis_ids`, and `min_corroborations`.
   - List query keys are `cursor`, `limit`, and `status`.
   - Omit only `undefined` properties.
   - Preserve `null`, `false`, `0`, and empty arrays.
   - Preserve explicit `filter: null` and `description: null` in updates.
   - Do not send a request body with list, retrieval, rotation, or deletion requests unless required by the existing `HttpClient` method signature.
6. Perform only deterministic client-side validation that prevents invalid requests:
   - On creation and whenever `url` is supplied to update, parse it with `URL` and require the protocol to be exactly `https:`.
   - Creation requires at least one event.
   - When an update supplies `events`, it must contain at least one event.
   - `minCorroborations`, when present in a non-null filter, must be a positive integer.
   - When supplied, `limit` must be a positive integer.
   - Reject invalid inputs before issuing an HTTP request with a clear `TypeError` for malformed values or a `RangeError` for invalid numeric ranges.
   - Do not invent server-side authorization, quota, or filter-combination rules.
7. Instantiate `WebhooksModule` as readonly `e3d.webhooks` in `src/client.ts`.
8. Export `WebhooksModule`, the header constants, and all public webhook contract types from `src/index.ts`. Preserve all existing exports.

### Acceptance Criteria

- Consumers can create, list, retrieve, update, rotate the secret for, and delete webhook subscriptions through `E3D`.
- Each method uses the specified HTTP verb and `/webhooks/subscriptions` path.
- Dynamic subscription IDs are URL encoded.
- Invalid URLs, empty event lists, invalid list limits, and invalid corroboration thresholds fail before `fetch` is called.
- Request bodies and queries use the documented API field names, and API responses retain the SDK’s existing camelCase normalization behavior.
- `E3DWebhookEvent` narrows its `data` type when consumers discriminate on `type`.
- Signing secrets appear only in creation and rotation result types, not on ordinary subscription objects.
- Explicit update `null` values are transmitted while omitted fields are not.
- Existing modules and public exports remain available.
- `npm run typecheck` succeeds.

## Phase 2 - HMAC Verification and Integration Documentation

<!-- runner:model=codex:gpt-5.4-mini -->
<!-- pilot:touches=src/webhookSignature.ts -->
<!-- pilot:touches=src/index.ts -->
<!-- pilot:touches=README.md -->
<!-- runner:read=src/webhooks.ts -->
<!-- runner:read=package.json -->
<!-- runner:verify=npm run typecheck -->

### Requirements

1. Add `src/webhookSignature.ts` with a dependency-free, asynchronous `verifyWebhookSignature` helper suitable for the package’s Node 18 minimum runtime and Web Crypto-compatible environments.
2. Export a `VerifyWebhookSignatureInput` type accepting:
   - `payload` as the unmodified request body, represented by `string`, `Uint8Array`, or `ArrayBuffer`.
   - `timestamp` as the timestamp header value.
   - `signature` as the signature header value.
   - `secret` as the subscription signing secret.
   - Optional `toleranceSeconds`, defaulting to `300`.
   - Optional `now` in Unix seconds for deterministic callers and testing.
3. Define the signing bytes exactly:
   - Encode `timestamp` and `.` as UTF-8.
   - For a string payload, append its UTF-8 bytes.
   - For a `Uint8Array` or `ArrayBuffer` payload, append its bytes unchanged.
   - Compute HMAC-SHA256 over the resulting concatenation.
   - Import the signing secret itself as UTF-8 bytes; it is not hex- or Base64-decoded.
4. Parse signatures as a comma-separated list:
   - Trim ASCII whitespace surrounding each entry.
   - Accept entries matching `v1=<64 hexadecimal characters>`, case-insensitively for hexadecimal digits.
   - Ignore unsupported versions and malformed entries.
   - Succeed if any valid `v1` entry verifies.
5. Verify signatures without an early-exit byte comparison that leaks the first mismatching position. Use Web Crypto HMAC verification for the cryptographic comparison.
6. Enforce replay protection:
   - Accept a timestamp only when it matches a base-10, non-negative whole Unix-seconds integer with no sign, decimal point, exponent, or surrounding whitespace.
   - Return `false` for malformed timestamps.
   - Return `false` when the absolute difference between the timestamp and `now` exceeds `toleranceSeconds`; equality with the tolerance is accepted.
   - Default `now` to `Math.floor(Date.now() / 1000)`.
   - Throw a `RangeError` when caller-supplied `toleranceSeconds` or `now` is negative, non-finite, or not an integer.
7. Return `false` for malformed, stale, unsupported, or mismatched signatures. Throw only for the invalid caller configuration described above or when the runtime lacks the required cryptographic capability. Never include the signing secret, signature, or raw payload in an error.
8. Export the helper and its input type from `src/index.ts` without removing or renaming existing exports.
9. Update `README.md`:
   - Add `webhooks` to the module list.
   - Add a concise TypeScript example creating a filtered subscription for story and thesis events.
   - Show receiver-side verification against the raw body before `JSON.parse`.
   - Use `E3D_WEBHOOK_TIMESTAMP_HEADER` and `E3D_WEBHOOK_SIGNATURE_HEADER` when reading the canonical timestamp and signature headers.
   - State that any 2xx receiver response acknowledges delivery; non-2xx responses and network failures are eligible for server-managed retry.
   - State that deliveries are at-least-once, may arrive out of order, and must be deduplicated using the stable event ID.
   - Explain `deliveryAttempt` and advise receivers to process events idempotently.
   - Explain the default five-minute replay window and secret rotation.
   - State that creation and rotation responses are the only SDK contract types exposing signing secrets and advise secure storage.
   - Avoid promising a fixed retry count or backoff schedule that is not represented by the SDK contract.

### Acceptance Criteria

- A correctly signed raw payload inside or exactly on the timestamp-window boundary verifies as `true`.
- Changing the payload, timestamp, signature, or secret makes verification return `false`.
- Stale, excessively future-dated, malformed, unsupported-version, incorrectly sized, and non-hex signatures return `false`.
- Comma-separated signatures verify when at least one supported `v1` signature is valid.
- Hexadecimal signatures are accepted with lowercase or uppercase digits.
- String and binary payload inputs produce equivalent verification results when they represent the same bytes.
- Binary payload bytes are not decoded or re-encoded during verification.
- Verification occurs before JSON parsing in the documented receiver flow.
- The README explains acknowledgment, retry ownership, at-least-once delivery, ordering, deduplication, idempotency, replay protection, secure secret storage, and rotation without claiming undocumented retry timing.
- No dependency or package-script change is introduced.
- `npm run typecheck` succeeds.

```

### Reviewer 1: devin

Status: approved

Reason: Spec is internally consistent, edge cases are enumerated, crypto details are unambiguous, and file/line constraints are realistic.

Raw Response:

```text
---STATUS---
status: approved
reason: Spec is internally consistent, edge cases are enumerated, crypto details are unambiguous, and file/line constraints are realistic.
```

### Reviewer 2: codex

Status: approved

Reason: The draft is internally consistent, implementation-ready, security-conscious, and provides precise contracts and acceptance criteria for both phases.

Raw Response:

```text
---STATUS---
status: approved
reason: The draft is internally consistent, implementation-ready, security-conscious, and provides precise contracts and acceptance criteria for both phases.
```

### Reviewer 3: local

Status: approved

Reason: The draft is clear and comprehensive, aligning with the specified goals and constraints.

Raw Response:

```text
---STATUS---
status: approved
reason: The draft is clear and comprehensive, aligning with the specified goals and constraints.
```

## Final Outcome

Converged in round 2.
