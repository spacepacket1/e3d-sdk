import { E3D } from '../dist/index.js';

const tokenAddress = process.env.E3D_TOKEN_ADDRESS || '0x6488861b401F427D13B6619C77C297366bCf6386';
const e3d = new E3D({ baseUrl: process.env.E3D_BASE_URL || 'https://e3d.ai/api' });

const profile = await e3d.tokens.getTokenProfile(tokenAddress, { chain: 'ETH' });
console.log(JSON.stringify(profile, null, 2));
