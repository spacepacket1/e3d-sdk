import { E3D } from '../dist/index.js';

const e3d = new E3D({
  swap: { defaultRouterVersion: 3 },
});

const quote = e3d.swap.quoteSellE3D({
  outputToken: 'ETH',
  amountIn: '1000000000000000000',
  slippageBps: 150,
  deadlineMinutes: 30,
});

console.log(JSON.stringify(quote, null, 2));
