---
selected: candidate-1
reason: Webhooks scores highest on Retention (5) and ties CLI on Attraction+Retention (9), wins the Revenue tiebreak (3 vs 2), and is confirmed non-duplicate against all branches, PRs, and prior run candidates.
---

# Candidates

## Dedup Context

## Current Findings

```text
---
head_sha: eaf25e1a6ac00836874244976f88f51d08ff1820
---

# Findings

## Local State

Repo head sha: eaf25e1a6ac00836874244976f88f51d08ff1820

Research topics: E3D blockchain intelligence SDK (TS+Python)

Analogy domains to consider: game progression and reward loops; social feed and notification mechanics; marketplace liquidity and two-sided matching; developer-tool CLI ergonomics; fintech trust and verification UX

## Git history
range: last 20 commits
```text
eaf25e1 Enable prompt suggestions in Claude Code settings
8cd9776 Add Claude Code auto-permissions (allow all tools)
c000b7e Add pip install to README
0e9884a Fix pyproject.toml build backend for compatibility
f69bbee Switch default API URL to production, add PyPI package structure
607f9b5 Add docs.e3d.ai link to README
f9d114a Add Python examples for E3D API
b9296bb Initial commit
```

## Branches
```text
* main                eaf25e1 Enable prompt suggestions in Claude Code settings
  remotes/origin/HEAD -> origin/main
  remotes/origin/main eaf25e1 Enable prompt suggestions in Claude Code settings
```

## GH issues and PRs
### gh issue list
- none found
### gh pr list
- none found

## Repo docs
### README.md
```text
# E3D SDK

TypeScript SDK for the E3D API and wallet-side E3DToken swap helpers.

**[Full documentation → docs.e3d.ai](https://docs.e3d.ai)**

## Install

```bash
npm install e3d-sdk      # JavaScript / TypeScript
pip install e3d-sdk      # Python
```

## Build

```bash
npm install
npm run build
```

## Quick start

```ts
import { E3D } from 'e3d-sdk';

const e3d = new E3D({ apiKey: process.env.E3D_API_KEY });

const openApi = await e3d.discovery.getOpenApi();
const rate = await e3d.discovery.getRate();
const token = await e3d.tokens.getTokenProfile('0x6488861b401F427D13B6619C77C297366bCf6386');
```

## Modules

- `discovery` - schema, rate, newsletter
- `tokens` - token discovery, metadata, price history, token page bundle
- `swap` - wallet-side E3D trading helpers
- `stories` - story feeds and story-linked discovery helpers
- `theses` - thesis feed and annotation/candidate helpers
- `tokenIntelligence` - counterparties and batch metadata
- `auth` - API key management

## Examples

- JavaScript examples live in `examples/`
- Python examples live in `examples/python/`
- Go examples live in `examples/go/`
- The Python examples use only the standard library and are safe to run without extra dependencies
- The Go examples use only the Go standard library and are safe to run without extra dependencies

## Swap example

```ts
import { E3D } from './dist/index.js';
import { ethers } from 'ethers';

const e3d = new E3D({
  swap: {
    defaultRouterVersion: 3,
  },
});

const provider = new ethers.providers.Web3Provider(window.ethereum as any);
const signer = provider.getSigner();

const tx = await e3d.swap.buyE3D(
  { provider, walletAddress: await signer.getAddress(), signer },
  { inputToken: 'ETH', amountIn: ethers.utils.parseEther('0.05').toString(), slippageBps: 100 }
);
console.log(tx.hash);
```

## Notes

- This SDK intentionally treats `/agents` as experimental and does not include it in v1.
- Swap support is wallet-side only; there is no server buy/sell endpoint.
- The package is designed to work with the live E3D deployment and its `/openapi` surface.

```

## TODO/FIXME matches
- none found

## External Context

## External Context

**Blockchain intelligence SDKs are a crowded, fast-moving category.** The most directly comparable surface area is BlockINTQL (Python + TS SDKs, REST API, MCP server, CLI) and Hive Intelligence (376+ tools across 9 data providers, normalized via a single MCP server). Both launched or significantly expanded in 2025, validating E3D's dual-language SDK strategy but raising the bar on breadth.

**MCP (Model Context Protocol) is becoming the dominant agent-integration pattern.** Projects like Hive, BlockINTQL, ChainAware, and BNB Chain's official MCP server all expose their tools as MCP servers first. E3D explicitly defers its `/agents` surface to experimental/v2 status — this is a material gap as LLM-native tooling becomes a table-stakes entry point for developer adoption.

**Narrative/conviction intelligence is a recognized product category.** Competitors including Sentysis (capital-backed conviction index), the Narrative Compiler, and Narrative Oracle are building structured conviction scoring on top of on-chain signals. E3D's stories+theses approach with LONG/SHORT/AVOID conclusions has direct parallels; differentiation will hinge on detector breadth (E3D claims 30+ pattern detectors), freshness, and structured evidence trails.

**Counterparty intelligence is consolidating around entity-level graph APIs.** Nansen's Address Counterparties endpoint, Range's counterparty analysis, and TorchLedger's GraphSAGE-based clustering all provide entity-graph traversal. E3D's `tokenIntelligence` module competes in this space; N-hop exposure and batch screening are table stakes that peers already offer.

**Multi-language SDK (TS + Python) with zero-dependency examples is now the baseline.** All leading competitors ship both; the delta is now CLI ergonomics, MCP server support, and agent-native schemas (structured JSON, Zod validation, tool manifests).

---

### Analogous Patterns

**1. Social feed and notification mechanics** *(source: consumer social apps)*
- **Mechanic borrowed:** Push-based ranked feeds, read/unread state, subscription filters, and high-signal notification triggers (e.g., only notify on "viral" items above a threshold).
- **Application:** E3D's story feed is architecturally a ranked event stream from 30+ on-chain pattern detectors; applying feed-subscription webhooks with per-token or per-thesis filter presets would let consuming apps surface actionable stories in real time rather than requiring polling — the same pattern that made Twitter Firehose and Slack channel notifications indispensable for developer integrations.

**2. Developer-tool CLI ergonomics** *(source: tools like `gh`, `stripe`, `vercel` CLIs)*
- **Mechanic borrowed:** Discoverable subcommands, interactive prompts for missing flags, and short feedback loops that make an API explorable without reading docs.
- **Application:** E3D has no CLI today while every direct competitor (BlockINTQL's `blockintql ask "..."`, Hive's `hive tools call`) ships one; a thin `e3d` CLI wrapping the SDK's modules would dramatically lower the time-to-first-insight for analysts, compress the onboarding funnel, and generate organic adoption the same way `gh` did for GitHub's API.

**3. Fintech trust and verification UX** *(source: KYC/AML and credit scoring pipelines)*
- **Mechanic borrowed:** Graduated trust tiers (CLEAR / CAUTION / BLOCK), explainable score components, and audit-trail receipts that compliance teams can attach to decisions.
- **Application:** E3D's counterparty intelligence returns interaction stats and flow data, but stops short of a verdict layer; borrowing the fintech pattern of emitting a structured trust verdict (with labeled evidence fields matching the data that drove it) would make the `tokenIntelligence` module directly embeddable in institutional due-diligence and risk-monitoring workflows — a higher-value use case than consumer research alone.


```

## Git Branches
```text
* main                eaf25e1 Enable prompt suggestions in Claude Code settings
  remotes/origin/HEAD -> origin/main
  remotes/origin/main eaf25e1 Enable prompt suggestions in Claude Code settings
```

## GH PR List (state: all)
- none found

## Prior Runs (candidates.md / spec-final.md)
### 2026-07-28-e3d-sdk-3/candidates.md
```text
---
selected: candidate-1
reason: MCP-native agent bindings scores highest on attraction+retention (9) and wins the tiebreak on revenue, directly targets the fast-growing AI-agent developer segment, and is confirmed non-duplicate against all branches/PRs/prior runs.
---

# Candidates

## Dedup Context

## Current Findings

```text
---
head_sha: eaf25e1a6ac00836874244976f88f51d08ff1820
---

# Findings

## Local State

Repo head sha: eaf25e1a6ac00836874244976f88f51d08ff1820

Research topics: E3D blockchain intelligence SDK (TS+Python)

Analogy domains to consider: game progression and reward loops; social feed and notification mechanics; marketplace liquidity and two-sided matching; developer-tool CLI ergonomics; fintech trust and verification UX

## Git history
range: last 20 commits
```text
eaf25e1 Enable prompt suggestions in Claude Code settings
8cd9776 Add Claude Code auto-permissions (allow all tools)
c000b7e Add pip install to README
0e9884a Fix pyproject.toml build backend for compatibility
f69bbee Switch default API URL to production, add PyPI package structure
607f9b5 Add docs.e3d.ai link to README
f9d114a Add Python examples for E3D API
b9296bb Initial commit
```

## Branches
```text
* main                eaf25e1 Enable prompt suggestions in Claude Code settings
  remotes/origin/HEAD -> origin/main
  remotes/origin/main eaf25e1 Enable prompt suggestions in Claude Code settings
```

## GH issues and PRs
### gh issue list
- none found
### gh pr list
- none found

## Repo docs
### README.md
```text
# E3D SDK

TypeScript SDK for the E3D API and wallet-side E3DToken swap helpers.

**[Full documentation → docs.e3d.ai](https://docs.e3d.ai)**

## Install

```bash
npm install e3d-sdk      # JavaScript / TypeScript
pip install e3d-sdk      # Python
```

## Build

```bash
npm install
npm run build
```

## Quick start

```ts
import { E3D } from 'e3d-sdk';

const e3d = new E3D({ apiKey: process.env.E3D_API_KEY });

const openApi = await e3d.discovery.getOpenApi();
const rate = await e3d.discovery.getRate();
const token = await e3d.tokens.getTokenProfile('0x6488861b401F427D13B6619C77C297366bCf6386');
```

## Modules

- `discovery` - schema, rate, newsletter
- `tokens` - token discovery, metadata, price history, token page bundle
- `swap` - wallet-side E3D trading helpers
- `stories` - story feeds and story-linked discovery helpers
- `theses` - thesis feed and annotation/candidate helpers
- `tokenIntelligence` - counterparties and batch metadata
- `auth` - API key management

## Examples

- JavaScript examples live in `examples/`
- Python examples live in `examples/python/`
- Go examples live in `examples/go/`
- The Python examples use only the standard library and are safe to run without extra dependencies
- The Go examples use only the Go standard library and are safe to run without extra dependencies

## Swap example

```ts
import { E3D } from './dist/index.js';
import { ethers } from 'ethers';

const e3d = new E3D({
  swap: {
    defaultRouterVersion: 3,
  },
});

const provider = new ethers.providers.Web3Provider(window.ethereum as any);
const signer = provider.getSigner();

const tx = await e3d.swap.buyE3D(
  { provider, walletAddress: await signer.getAddress(), signer },
  { inputToken: 'ETH', amountIn: ethers.utils.parseEther('0.05').toString(), slippageBps: 100 }
);
console.log(tx.hash);
```

## Notes

- This SDK intentionally treats `/agents` as experimental and does not include it in v1.
- Swap support is wallet-side only; there is no server buy/sell endpoint.
- The package is designed to work with the live E3D deployment and its `/openapi` surface.

```

## TODO/FIXME matches
- none found

## External Context

I don't have web search access in this session, so I'll base this on knowledge through my training cutoff (Jan 2026) rather than live sources.

## External Context

- **On-chain intelligence APIs are consolidating around "token page" bundles.** Providers like Dune, Nansen, Arkham, and DexScreener now ship single-call endpoints that merge price, holder/counterparty graphs, and narrative/news signal — mirroring this repo's `tokens` "token page bundle" and `tokenIntelligence` counterparties modules. The competitive edge has shifted from raw data access to pre-joined, low-latency composite views.
- **Wallet-side swap execution (vs. server-side custody) is the dominant pattern** for SDKs that don't want money-transmitter exposure. Uniswap's SDK, 1inch, and 0x all expose router-building helpers that the client signs locally with `ethers`/`viem` — the same shape as this repo's `swap.buyE3D` helper. `viem` has largely displaced `ethers` v5 as the default in new TS SDKs; sticking with `ethers` here is a legacy-compatibility choice worth flagging if new integrators expect `viem`.
- **Narrative/story-linked discovery is a newer differentiator.** Several 2025–2026 intel platforms (Kaito, Arkham Intel, Nansen's "Smart Money" feeds) pair on-chain metrics with LLM-summarized narrative feeds — directly analogous to this SDK's `stories` and `theses` modules (feed + annotation/candidate helpers), suggesting the SDK is tracking a real market trend rather than a one-off feature.
- **Dual TS+Python SDK distribution is now baseline expectation** for crypto data APIs (CoinGecko, Dune, The Graph all ship both), so parity between `npm install e3d-sdk` and `pip install e3d-sdk` is table stakes, not differentiation — the bar has moved to Go/Rust SDKs and MCP-native tool bindings for agent frameworks, an area this repo explicitly marks `/agents` as experimental/excluded from v1.
- **API-key auth with a dedicated `auth` module** remains standard for this class of product, but a growing share of comparable SDKs (Alchemy, Helius) now also support scoped/short-lived tokens for client-side/browser use given wallet-connected swap flows run in-browser — worth watching given this SDK's swap helpers execute wallet-side.

### Analogous Patterns

- **Marketplace liquidity and two-sided matching → counterparty/token intelligence.** Two-sided marketplaces (Airbnb, Uber, ad exchanges) solve "who should meet whom" with liquidity scores and match confidence, not just raw listings. The `tokenIntelligence` counterparties module could borrow this: surface a "liquidity/counterparty match confidence" score alongside raw counterparty lists, helping users judge whether a token's counterparty graph reflects genuine trading interest versus thin, one-sided flow.
- **Social feed and notification mechanics → stories/theses feeds.** Social platforms (Twitter/X, Reddit) rank and resurface feed items using engagement decay, "trending now" windows, and personalized notification thresholds rather than flat reverse-chronological lists. The `stories`/`theses` modules could adopt a decay-weighted "trending thesis" ranking and opt-in threshold alerts (e.g., "notify when a thesis I'm tracking gets 3 new corroborating stories"), turning a static feed into a retention loop.
- **Fintech trust and verification UX → thesis annotation/candidates.** Consumer fintech (Plaid-linked apps, robo-advisors) builds trust by showing provenance and confidence bands on every number ("estimated," "verified," "3 sources agree") rather than presenting figures as bare facts. The `theses` annotation/candidate helpers could expose a similar trust layer — a confidence/provenance tag per thesis candidate — so downstream consumers of the SDK can distinguish a well-corroborated thesis from a single-source speculative one.


```

## Git Branches
```text
* main                eaf25e1 Enable prompt suggestions in Claude Code settings
  remotes/origin/HEAD -> origin/main
  remotes/origin/main eaf25e1 Enable prompt suggestions in Claude Code settings
```

## GH PR List (state: all)
- none found

## Prior Runs (candidates.md / spec-final.md)
- none found

## Proposed Candidates

### Candidate 1: MCP-native tool bindings for AI agents
Duplicate: no
Dedup rationale: Only branch is `main` @ eaf25e1; no PRs, issues, or prior run candidates exist. The README explicitly marks `/agents` as "experimental" and excluded from v1 — this proposes graduating it, not duplicating existing work.
Category: workflow
Analogy: AI agent tooling ecosystem (MCP) -- external context notes "the bar has moved to ... MCP-native tool bindings for agent frameworks" as the new competitive line for crypto-data SDKs. Expose `tokens`, `tokenIntelligence`, `stories`, and `theses` read endpoints as an MCP server/tool schema so Claude/GPT-based agents can query E3D data natively without hand-written wrapper code, riding the same wave as this session's own MCP-driven tooling.
Attraction (1-5): 5
Retention (1-5): 4
Effort: high
Revenue (1-5|n/a): 3
Description: Ship an `@e3d-sdk/mcp` package (or a `discovery.getMcpManifest()` helper) that exposes the SDK's read-only endpoints as MCP tools, with typed schemas generated from the existing OpenAPI discovery surface. This turns every AI-agent builder into a potential E3D integrator — a fast-growing, highly visible developer segment — and each agent that adopts it becomes an always-on, repeat caller (strong retention). Effort is high because it needs schema generation, auth-scoping for agent contexts, and its own docs/examples, but it directly targets the "attract + retain developers" goal via a channel competitors haven't locked down yet.

### Candidate 2: Decay-weighted trending theses + threshold alerts
Duplicate: no
Dedup rationale: No branch, PR, issue, or prior candidate touches `stories`/`theses` beyond the initial commit (`b9296bb Initial commit`, `f9d114a Add Python examples`). Nothing pre-existing to collide with.
Category: social
Analogy: Social feed and notification mechanics -> stories/theses feeds (from Analogous Patterns) -- adopt engagement-decay trending ranks and opt-in corroboration-threshold alerts (e.g., "notify when a tracked thesis gets 3 new corroborating stories"), the same mechanic that makes Twitter/Reddit feeds sticky instead of flat reverse-chronological lists.
Attraction (1-5): 4
Retention (1-5): 5
Effort: medium
Revenue (1-5|n/a): 2
Description: Add a `theses.getTrending()` helper that ranks thesis/story items by a decay-weighted engagement score instead of raw recency, plus an opt-in `theses.subscribe(thesisId, { minNewStories })` alert primitive that integrators can wire into push/email/webhook. This converts a static feed into a recurring-engagement loop — the single highest-leverage retention lever available given the repo's existing modules — at moderate effort since it's additive ranking/subscription logic on top of feeds that already exist.

### Candidate 3: Counterparty liquidity/match-confidence score
Duplicate: no
Dedup rationale: `tokenIntelligence` counterparties module exists only as raw metadata per README; no branch/PR/prior-run work adds scoring on top of it.
Category: data
Analogy: Marketplace liquidity and two-sided matching -> counterparty/token intelligence (from Analogous Patterns) -- borrow the "match confidence" concept from Airbnb/Uber/ad-exchange liquidity scoring to flag whether a token's counterparty graph reflects genuine two-sided trading interest vs. thin, one-sided flow.
Attraction (1-5): 4
Retention (1-5): 3
Effort: medium
Revenue (1-5|n/a): 3
Description: Extend `tokenIntelligence.getCounterparties()` (or add a sibling `getLiquidityConfidence()`) to compute and return a normalized 0-100 confidence score derived from counterparty diversity, trade reciprocity, and volume concentration. This is a differentiator vs. Dune/Nansen/Arkham's raw counterparty lists (per External Context, "the competitive edge has shifted from raw data access to pre-joined, low-latency composite views") and gives integrators a single number to build UI trust indicators on top of, which is good for both new adoption and premium-tier upsell.

### Candidate 4: Confidence/provenance tags on thesis candidates
Duplicate: no
Dedup rationale: No existing branch/PR/prior candidate adds trust metadata to the `theses` annotation/candidate helpers; only the base feed exists per README and initial commit history.
Category: data
Analogy: Fintech trust and verification UX -> thesis annotation/candidates (from Analogous Patterns) -- like Plaid-linked apps and robo-advisors labeling figures "estimated / verified / N sources agree" instead of presenting bare numbers, tag each thesis candidate with a provenance/confidence band.
Attraction (1-5): 3
Retention (1-5): 4
Effort: low
Revenue (1-5|n/a): 2
Description: Add a `confidence: 'single-source' | 'corroborated' | 'verified'` (or numeric score) field to thesis candidate/annotation objects returned by the `theses` module, computed from source count and annotation agreement already available in the data model. Low effort since it's a derived field on existing responses, and it directly builds the kind of user trust that keeps analysts returning to the feed rather than cross-checking elsewhere.

### Candidate 5: First-class viem support alongside ethers
Duplicate: no
Dedup rationale: README's swap example still imports `ethers` exclusively (`c000b7e`, `f69bbee`, `0e9884a` are packaging/README fixes, not SDK-internals changes); no branch/PR proposes a `viem` adapter.
Category: workflow
Analogy: Developer-tool CLI ergonomics -- External Context flags that "`viem` has largely displaced `ethers` v5 as the default in new TS SDKs," so matching the ergonomics new integrators already expect (as Uniswap/1inch/0x SDKs have) lowers the integration-friction tax on `swap.buyE3D`.
Attraction (1-5): 3
Retention (1-5): 2
Effort: medium
Revenue (1-5|n/a): 1
Description: Add a `viem`-compatible signer/provider adapter for `swap.buyE3D`/`swap` helpers (alongside, not replacing, the current `ethers` path), so integrators building on the now-dominant `viem` stack aren't forced to add a legacy `ethers` dependency just to use E3D's wallet-side swap helpers. Medium effort to abstract the provider/signer interface without breaking the existing `ethers` example.

---IDEATE-STATUS---
selected: candidate-1
reason: MCP-native agent bindings scores highest on attraction+retention (9) and wins the tiebreak on revenue, directly targets the fast-growing AI-agent developer segment, and is confirmed non-duplicate against all branches/PRs/prior runs.


```

## Proposed Candidates

### Candidate 1: Real-time webhook subscriptions for stories, theses, and token events
Duplicate: no
Dedup rationale: Prior C2 (2026-07-28-e3d-sdk-3) included a `theses.subscribe()` SDK-method primitive as a secondary feature of a ranking proposal; this candidate is architecturally distinct — it proposes webhook delivery infrastructure (HTTP endpoints, signed payloads, per-token/per-pattern filter presets) across all modules, not a single in-SDK alert helper. No branch/PR touches any of this.
Category: workflow
Analogy: Social feed and notification mechanics -- findings explicitly describe this: "feed-subscription webhooks with per-token or per-thesis filter presets would let consuming apps surface actionable stories in real time rather than requiring polling — the same pattern that made Twitter Firehose and Slack channel notifications indispensable for developer integrations."
Attraction (1-5): 4
Retention (1-5): 5
Effort: medium
Revenue (1-5|n/a): 3
Description: Ship a `webhooks` module (or extend `stories`/`theses`) that lets integrators register an HTTP endpoint and receive signed event payloads when new stories match a token/pattern filter or a thesis crosses a corroboration threshold. Covers the full event-delivery contract: payload schema, HMAC signature verification helper, retry semantics. Turns passive polling integrations into push-driven apps — the strongest available retention lever since subscribers become always-on callers rather than one-shot users.

---

### Candidate 2: `e3d` CLI wrapping all SDK modules
Duplicate: no
Dedup rationale: No branch, PR, issue, or prior-run candidate (2026-07-28-e3d-sdk-3 C1–C5) proposes a CLI. The prior MCP candidate (C1, selected) is agent/programmatic; CLI is a separate human-facing entry point. Findings explicitly flag: "E3D has no CLI today while every direct competitor (BlockINTQL's `blockintql ask`, Hive's `hive tools call`) ships one."
Category: workflow
Analogy: Developer-tool CLI ergonomics -- findings describe the `gh`/`stripe`/`vercel` CLI pattern: "discoverable subcommands, interactive prompts for missing flags, short feedback loops that make an API explorable without reading docs." Reduces time-to-first-insight from hours (reading docs) to minutes (running `e3d tokens profile <addr>`).
Attraction (1-5): 5
Retention (1-5): 4
Effort: medium
Revenue (1-5|n/a): 2
Description: Thin `e3d` CLI binary (`npx e3d` / `pip install e3d-sdk[cli]`) with subcommands mirroring SDK modules: `e3d tokens profile <addr>`, `e3d stories feed`, `e3d theses list`, `e3d token-intel counterparties <addr>`. Interactive prompts for missing args, `--json` flag for piping, API key via env or `e3d auth login`. Generates organic adoption (blog posts, tweets, "one-liner" content) the same way `gh` expanded GitHub API reach.

---

### Candidate 3: Structured trust verdict layer for tokenIntelligence (CLEAR / CAUTION / BLOCK)
Duplicate: no
Dedup rationale: Prior C3 (2026-07-28-e3d-sdk-3) proposed a "counterparty liquidity/match-confidence score" focused on trading signal (diversity, reciprocity, volume concentration). This candidate proposes a compliance-oriented verdict layer with labeled evidence fields targeting institutional due-diligence workflows — different use case, different output schema, different buyer persona. No branch/PR covers either.
Category: data
Analogy: Fintech trust and verification UX -- findings state: "borrowing the fintech pattern of emitting a structured trust verdict (with labeled evidence fields matching the data that drove it) would make the `tokenIntelligence` module directly embeddable in institutional due-diligence and risk-monitoring workflows."
Attraction (1-5): 4
Retention (1-5): 3
Effort: medium
Revenue (1-5|n/a): 3
Description: Add `tokenIntelligence.getTrustVerdict(address)` returning `{ verdict: 'CLEAR'|'CAUTION'|'BLOCK', score: 0-100, evidence: { field, weight, value }[] }`. Derived from existing counterparty flow data plus pattern-detector outputs already in the API surface. Labeled evidence fields let compliance teams attach audit receipts to decisions. Differentiates from Nansen/Arkham raw counterparty lists and unlocks institutional/enterprise segment — a higher-value cohort than retail research.

---

### Candidate 4: Zod schema validation + typed tool manifests across all modules
Duplicate: no
Dedup rationale: No branch, PR, issue, or prior candidate (2026-07-28-e3d-sdk-3 C1–C5) adds runtime schema validation to SDK responses. Prior C1 (MCP bindings, selected) would consume Zod schemas but doesn't build them — this is the prerequisite layer.
Category: data
Analogy: none
Attraction (1-5): 3
Retention (1-5): 3
Effort: low
Revenue (1-5|n/a): 2
Description: Generate Zod schemas from the existing `discovery.getOpenApi()` surface and apply them at response parse time in the TS SDK, exposing typed error objects (`ZodError` with path + message) instead of silent `unknown`. Export schemas as `e3d-sdk/schemas` so integrators and the forthcoming MCP layer can reference the same source of truth. Findings flag "Zod validation, tool manifests" as table stakes peers already offer; this closes that gap at low effort.

---

### Candidate 5: First-class Go module (beyond example scripts)
Duplicate: no
Dedup rationale: README references `examples/go/` (Go standard-library scripts only), added in initial commit. No branch/PR proposes a proper Go module with typed client, error handling, and `go get` distribution. No prior-run candidate covers Go.
Category: workflow
Analogy: none
Attraction (1-5): 3
Retention (1-5): 2
Effort: medium
Revenue (1-5|n/a): 2
Description: Publish `github.com/e3d-network/e3d-sdk-go` as a proper Go module with a typed `E3DClient`, idiomatic error returns, and context propagation — promoting the existing example scripts to production-quality client code. Go is dominant in backend/quant infrastructure; a first-class module opens that developer segment without overlapping TS/Python users. Medium effort: struct definitions, HTTP client abstraction, CI, and a go.sum-locked release.

---

---IDEATE-STATUS---
selected: candidate-1
reason: Webhooks scores highest on Retention (5) and ties CLI on Attraction+Retention (9), wins the Revenue tiebreak (3 vs 2), and is confirmed non-duplicate against all branches, PRs, and prior run candidates.

