import { E3D } from '../dist/index.js';

const e3d = new E3D({
  baseUrl: process.env.E3D_BASE_URL || 'https://e3d.ai/apitest',
  apiKey: process.env.E3D_API_KEY,
});

const openApi = await e3d.discovery.getOpenApi();
const rate = await e3d.discovery.getRate();

console.log('OpenAPI title:', openApi.info?.title || 'unknown');
console.log('Current rate:', rate.rate);
