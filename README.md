# E3D SDK

TypeScript SDK for the E3D API and wallet-side E3DToken swap helpers.

**[Full documentation → docs.e3d.ai](https://docs.e3d.ai)**

## Install

```bash
npm install e3d-sdk
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
