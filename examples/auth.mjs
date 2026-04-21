import { E3D } from '../dist/index.js';

const e3d = new E3D({
  baseUrl: process.env.E3D_BASE_URL || 'https://e3d.ai/apitest',
  apiKey: process.env.E3D_API_KEY,
});

const keys = await e3d.auth.listApiKeys();
console.log(JSON.stringify(keys, null, 2));
