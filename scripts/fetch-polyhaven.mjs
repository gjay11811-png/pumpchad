// download a Poly Haven CC0 PBR set at 1K (diffuse, GL normal, roughness) and write WebP into public/chadverse/district/tex:  node scripts/fetch-polyhaven.mjs cobblestone_pavement [size]
import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'node:fs'
const id = process.argv[2]
const size = +(process.argv[3] || 1024)
const res = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json()
const info = await (await fetch(`https://api.polyhaven.com/info/${id}`)).json()
console.log(id, '—', info.name, '· authors', JSON.stringify(info.authors), '· real size', JSON.stringify(info.dimensions))
const pick = (k) => res[k]?.['1k']?.jpg?.url ?? res[k]?.['1k']?.png?.url
const maps = { diff: pick('Diffuse'), nor: pick('nor_gl'), rough: pick('Rough') }
mkdirSync('../pumpchad-assets/polyhaven-2', { recursive: true })
for (const [k, url] of Object.entries(maps)) {
  if (!url) { console.log('  missing', k); continue }
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
  writeFileSync(`../pumpchad-assets/polyhaven-2/${id}_${k}${url.endsWith('png') ? '.png' : '.jpg'}`, buf)
  const out = `public/chadverse/district/tex/${id}_${k}.webp`
  await sharp(buf).resize(size, size, { fit: 'inside' }).webp({ quality: 84 }).toFile(out)
  console.log('  ', k, url.split('/').pop(), '->', out)
}
