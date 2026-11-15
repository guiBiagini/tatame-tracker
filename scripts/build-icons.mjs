// Gera public/icon/*.png a partir dos SVGs em assets/brand/. Uso: node scripts/build-icons.mjs
// Requer @resvg/resvg-js (npx/instalação avulsa; não é dependência do projeto).
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(process.env.RESVG_FROM ?? import.meta.url);
const { Resvg } = require('@resvg/resvg-js');
const big = readFileSync(new URL('../assets/brand/icon.svg', import.meta.url), 'utf8');
const small = readFileSync(new URL('../assets/brand/icon-small.svg', import.meta.url), 'utf8');
for (const size of [16, 32, 48, 128]) {
  const svg = size <= 32 ? small : big;
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(new URL(`../public/icon/${size}.png`, import.meta.url), png);
  console.log(`icon/${size}.png`);
}
