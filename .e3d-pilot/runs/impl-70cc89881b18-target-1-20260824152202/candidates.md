---
selected: candidate-1
reason: approved idea implementation
focus: revenue
---

# Candidates

## Proposed Candidates

### Candidate 1: SDK Embedded Payments Module
Duplicate: no
Dedup rationale: No prior fleet candidate makes e3d-sdk itself the primary payment channel with a published API surface.
Category: other
Analogy: Stripe SDK / Twilio SDK -- the payments library ships inside the developer integration surface, not as a separate portal.
Attraction (1-5): 4
Retention (1-5): 5
Effort: medium
Revenue (1-5|n/a): 5
Description: Expose e3d-agent's existing quote → on-chain transfer → /api/payments/credits/purchase → bearer-key cycle as e3d.payments.purchaseCredits / quoteCredits in the JS/TS, Python, and Go SDKs, with an e3d-docs Payments guide as the conversion surface.
