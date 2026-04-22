import { E3D } from '../dist/index.js';

const e3d = new E3D({ baseUrl: process.env.E3D_BASE_URL || 'https://e3d.ai/api' });
const newsletter = await e3d.discovery.getNewsletter();

console.log(newsletter);
