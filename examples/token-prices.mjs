import { E3D } from '../dist/index.js';

const e3d = new E3D({ baseUrl: process.env.E3D_BASE_URL || 'https://e3d.ai/apitest' });
const prices = await e3d.tokens.getTokenPricesWithHistoryAllRanges();

console.log(JSON.stringify(prices, null, 2));
