# Phase 2 Summary

- Phase: 2
- Title: Python Payments Module
- Provider: codex
- Model: gpt-5.4
- Completed: 2026-08-24T09:16:22-0700
- Exit status: 0

## Implementation Handoff

- Added `python/e3d/payments.py` with stdlib-only payment dataclasses, quote normalization, payment selection, required-amount fallback, purchase orchestration, and unknown-field passthrough via `extra`.
- Exposed `E3DClient.payments` by preserving the dataclass constructor and binding `PaymentsModule` in `E3DClient.__post_init__` with an `init=False` field to avoid circular imports and keep each module tied to its own client instance.
- Reused `E3DClient.post` for both payment endpoints and kept request bodies explicit so quote requests omit `paymentMethod`, unknown response fields, and empty optional fields.
- Implemented purchase flow validation before side effects, including trimmed string checks, boolean rejection for `requested_issued_credits`, callable transfer enforcement, tx hash validation, and supplied-quote consistency checks.
- Quote normalization fills missing `product`, `wallet`, and `requestedIssuedCredits` from the validated request, reapplies payment selection from `payment_method`, and resolves `payment.required_amount` from top-level `requiredWE3D` or `requiredE3D` when needed.
- Purchase request shaping sends only the locked fields, prefers the selected payment `id` for `paymentMethod`, falls back to the selector only when the selected payment has no non-empty `id`, and includes `paymentChain` only when present.
- Exported all public Python payment symbols from `python/e3d/__init__.py`.
- Added `python/tests/test_payments.py` using a fake `E3DClient` subclass that overrides `request` rather than injecting a custom constructor transport.

Tests run:
- `PYTHONPATH=python python3 -m compileall -q python/e3d python/tests`
- `PYTHONPATH=python python3 -m unittest discover -s python/tests -p 'test_*.py'`
- `npm install`
- `npm run typecheck`

Coverage highlights:
- Quote and purchase endpoint paths and POST methods.
- CamelCase bodies, optional-field omission, quote request omission of `paymentMethod`, and quote normalization from request values.
- Payment selection, unmatched selectors, `requiredWE3D` fallback, unknown-field preservation in `extra`, and purchase ordering.
- Supplied-quote reuse and mismatch rejection.
- Validation before side effects, including boolean credit counts.
- Transfer exceptions, invalid tx hashes, and credit-key return without mutating `api_key`.

Unresolved follow-ups:
- None within Phase 2 scope.

## Verification
- passed: `PYTHONPATH=python python3 -m compileall -q python/e3d python/tests`
- passed: `PYTHONPATH=python python3 -m unittest discover -s python/tests -p 'test_*.py'`
- passed: `npm install && npm run typecheck`

## Worktree Snapshot
- ` M python/e3d/__init__.py`
- ` M python/e3d/client.py`
- ` M src/client.ts`
- ` M src/index.ts`
- `?? .codex-spec-runner/`
- `?? .e3d-pilot/`
- `?? python/e3d/payments.py`
- `?? python/tests/`
- `?? src/payments.ts`
- `?? test/`
