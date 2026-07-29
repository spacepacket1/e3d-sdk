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

