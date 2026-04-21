import { E3D } from '../dist/index.js';

const e3d = new E3D({
  swap: { defaultRouterVersion: 3 },
});

const quote = e3d.swap.quoteBuyE3D({
  inputToken: 'ETH',
  amountIn: '50000000000000000',
  slippageBps: 100,
  deadlineMinutes: 30,
});

console.log(JSON.stringify(quote, null, 2));
