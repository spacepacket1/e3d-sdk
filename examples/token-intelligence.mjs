import { E3D } from '../dist/index.js';

const e3d = new E3D({ baseUrl: process.env.E3D_BASE_URL || 'https://e3d.ai/apitest' });
const token = process.env.E3D_TOKEN_ADDRESS || '0x6488861b401F427D13B6619C77C297366bCf6386';

const counterparties = await e3d.tokenIntelligence.getTokenCounterparties({ token, limit: 10 });
console.log(JSON.stringify(counterparties, null, 2));
