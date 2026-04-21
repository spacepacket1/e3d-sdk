import { E3D } from '../dist/index.js';

const e3d = new E3D({ swap: { defaultRouterVersion: 3 } });

const tx = await e3d.swap.buildSwapTransaction(
  {
    provider: {},
    walletAddress: '0x0000000000000000000000000000000000000000',
  },
  {
    direction: 'buy',
    inputToken: 'ETH',
    outputToken: 'E3D',
    amountIn: '10000000000000000',
    slippageBps: 100,
    deadlineMinutes: 30,
  }
);

console.log(JSON.stringify(tx, null, 2));
