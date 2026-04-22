import { E3D } from '../dist/index.js';

const e3d = new E3D({ baseUrl: process.env.E3D_BASE_URL || 'https://e3d.ai/api' });
const stories = await e3d.stories.list({ limit: 5 });
const addresses = await e3d.stories.getAddresses();

console.log('Stories:', stories.length);
console.log('Addresses sample:', addresses.slice(0, 3));
