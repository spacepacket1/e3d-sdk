import { E3D } from '../dist/index.js';

const e3d = new E3D({ baseUrl: process.env.E3D_BASE_URL || 'https://e3d.ai/api' });
const theses = await e3d.theses.list({ limit: 5 });

console.log('Thesis count:', theses.count || theses.theses.length);
console.log(JSON.stringify(theses.theses[0] || null, null, 2));
