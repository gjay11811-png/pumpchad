// Builds the offline review page + contact sheet from the captured stills: copies each image into a pack folder, verifies it opens (sharp), writes index.html
// (with relative <img> links, labelled by status) and contact-sheet.jpg.   node scripts/make-review-pack.mjs
import { createRequire } from 'node:module'
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const require = createRequire(join(process.env.TEMP, 'gtf', 'noop.js'))
const sharp = require('sharp')
const SRC = 'C:/Users/zafe5/Desktop/Chadverse-Overnight-Review'
const OUT = 'C:/Users/zafe5/Desktop/Chadverse-Review-Pack'
mkdirSync(join(OUT, 'images'), { recursive: true })
// [section, status, caption, file]
const ITEMS = [
  ['PumpChad head — before / after', 'before', 'Before — front', 'head-before-front.jpg'],
  ['PumpChad head — before / after', 'awaiting visual review', 'After (v3) — front: ribbed lobes, grooves, rind bump, ridged stem', 'head-after2-front.jpg'],
  ['PumpChad head — before / after', 'before', 'Before — three-quarter', 'head-before-threequarter.jpg'],
  ['PumpChad head — before / after', 'awaiting visual review', 'After — three-quarter', 'head-after2-threequarter.jpg'],
  ['PumpChad head — before / after', 'before', 'Before — side', 'head-before-side.jpg'],
  ['PumpChad head — before / after', 'awaiting visual review', 'After — side', 'head-after2-side.jpg'],
  ['PumpChad head — before / after', 'before', 'Before — back', 'head-before-back.jpg'],
  ['PumpChad head — before / after', 'awaiting visual review', 'After — back', 'head-after2-back.jpg'],
  ['Traversal v3 — hand-over-hand hang (ordinary keys)', 'functionally checked · visual review pending', 'Jump catches the Workshop ledge', 'trav3-catch.jpg'],
  ['Traversal v3 — hand-over-hand hang (ordinary keys)', 'functionally checked · visual review pending', 'Shimmy: one hand planted, the other reaching; the body follows', 'trav3-hang-handoverhand.jpg'],
  ['Traversal v3 — hand-over-hand hang (ordinary keys)', 'functionally checked · visual review pending', 'Pull-up, then the roof run', 'trav3-roof.jpg'],
  ['Cars — Chad Motors', 'before', 'Before: boxy extruded body (showroom front)', 'car-before-showroom.jpg'],
  ['Cars — Chad Motors', 'awaiting visual review', 'After: lofted body, bulged tyres, ten-spoke alloys — front three-quarter (original design, not a licensed model)', 'car3-front34.jpg'],
  ['Cars — Chad Motors', 'awaiting visual review', 'After — side', 'car3-side.jpg'],
  ['Cars — Chad Motors', 'awaiting visual review', 'After — rear (partly behind ivy)', 'car3-rear.jpg'],
  ['Motorbike — Chad Rides', 'awaiting visual review', 'Street bike (unchanged this pass)', 'bike-street-side.jpg'],
  ['Weapons', 'functionally checked', 'Pistol Range: Poly Haven Service Pistol (CC0) in the right hand', 'pistol3-servicepistol.jpg'],
  ['Housing — Chadville Heights', 'before', 'Before: the four original plots (A–D) and the estate lane', 'wall2-estates-aerial.jpg'],
  ['Housing — Chadville Heights', 'awaiting visual review', 'After, in daylight: the district from the south-east — four rows of plots either side of two lanes, show homes by the entrance, the parkour yard at the far end', 'day2-heights-aerial.jpg'],
  ['Housing — Chadville Heights', 'awaiting visual review', 'Show homes seen from the lane: the Premium, the Contemporary and the Cottage', 'hs2-show-homes.jpg'],
  ['Housing — Chadville Heights', 'awaiting visual review', 'Show-home cottage interior: hearth, sofa, kitchen corner, sleeping nook', 'showhome-cottage-1.jpg'],
  ['Housing — Chadville Heights', 'awaiting visual review', 'Show-home premium interior: drawing room, dining, library, loft bedrooms', 'showhome-premium-1.jpg'],
  ['Housing — Chadville Heights', 'awaiting visual review', 'Show-home contemporary interior', 'showhome-contemporary-1.jpg'],
  ['Traversal — the shared system (ordinary keys)', 'functionally checked · visual review pending', 'Sprint jump over the ditch', 'trav-01-sprint-jump.jpg'],
  ['Traversal — the shared system (ordinary keys)', 'functionally checked · visual review pending', 'Fence vault (the same rule vaults the village’s own fences)', 'trav-02-fence-vault.jpg'],
  ['Traversal — the shared system (ordinary keys)', 'functionally checked · visual review pending', 'Jump catches the Workshop ledge', 'trav-03-catch.jpg'],
  ['Traversal — the shared system (ordinary keys)', 'functionally checked · visual review pending', 'Sustained hang (2.5 s, nothing automatic) with the key hint', 'trav-04-hang.jpg'],
  ['Traversal — the shared system (ordinary keys)', 'functionally checked · visual review pending', 'Shimmy along the ledge', 'trav-05-shimmy.jpg'],
  ['Traversal — the shared system (ordinary keys)', 'functionally checked · visual review pending', 'Pull-up: standing on the roof', 'trav-06-pull-up-top.jpg'],
  ['Traversal — the shared system (ordinary keys)', 'functionally checked · visual review pending', 'Roof-gap jump landing on the Store', 'trav-07-roof-landing.jpg'],
  ['Traversal — the shared system (ordinary keys)', 'functionally checked · visual review pending', 'Crate → catch the Tower Shed ledge (3.5 m)', 'trav-08-tower-hang.jpg'],
  ['Traversal — the shared system (ordinary keys)', 'functionally checked · visual review pending', 'Vault close-up (side camera)', 'pk2-vault-1.jpg'],
  ['Traversal — the shared system (ordinary keys)', 'functionally checked · visual review pending', 'Mantle close-up (side camera)', 'pk2-mantle-2.jpg'],
  ['Parkour Yard', 'awaiting visual review', 'The yard from the air', 'pk2-overview-aerial.jpg'],
  ['Parkour Yard', 'awaiting visual review', 'Rooftop Run roofs and gaps', 'pk2-roofs-gaps.jpg'],
  ['Parkour Yard', 'emulated phone', 'Phone HUD during a run (emulated iPhone 13, portrait)', 'pk-phone-portrait.jpg'],
  ['Character selection', 'before', 'Before — desktop', 'creator-before-desktop-pumpchad.jpg'],
  ['Character selection', 'awaiting visual review', 'After — desktop', 'creator-after-desktop-pumpchad.jpg'],
  ['Character selection', 'before', 'Before — phone (emulated)', 'creator-before-phone-pumpchad.jpg'],
  ['Character selection', 'awaiting visual review', 'After — phone (emulated)', 'creator-after-phone-pumpchad.jpg'],
  ['Character selection', 'awaiting visual review', 'After — phone, Demon selected', 'creator-after-phone-demon.jpg'],
  ['Lanterns (L01 gaslight post · L02 crook · L03 pillar) — demo only', 'awaiting your approval', 'Daylight', 'lantern-afternoon-lantern-demo.jpg'],
  ['Lanterns (L01 gaslight post · L02 crook · L03 pillar) — demo only', 'awaiting your approval', 'Night', 'lantern-night-lantern-demo.jpg'],
  ['Arcade', 'awaiting visual review', 'Forecourt: the end shops stepped back, lawns either side', 'ar2-arcade-high.jpg'],
  ['Weapons', 'functionally checked', 'Sword Drill: the Antique Estoc (CC0)', 'sword-cut-side.jpg'],
  ['Haunted Quarter', 'awaiting visual review', 'Quarter square (before the Victorian detailing pass)', 'hq1-hq-square.jpg'],
]
const VIDEOS = [['trav3-sequence.webm', 'Continuous traversal, simulated browser with a tracking camera: run → sprint jump → fence vault → ledge catch → hang → shimmy both ways → pull-up → roof run → jump → landing (PumpChad, night)']]
const ok = []
const missing = []
for (const [sec, status, cap, file] of ITEMS) {
  const src = join(SRC, file)
  if (!existsSync(src)) {
    missing.push(file)
    continue
  }
  try {
    const meta = await sharp(src).metadata()
    if (!meta.width) throw new Error('no size')
    // a blank / near-uniform frame (a lost graphics context, a camera inside a wall) is not evidence: leave it out and say so
    const st = await sharp(src).stats()
    const sd = st.channels.slice(0, 3).reduce((q, c) => q + c.stdev, 0) / 3
    const mean = st.channels.slice(0, 3).reduce((q, c) => q + c.mean, 0) / 3
    if (sd < 14 || mean < 14) throw new Error(`blank or near-black frame (stdev ${sd.toFixed(0)}, mean ${mean.toFixed(0)})`)
    const dst = file.replace(/\.png$/i, '.jpg')
    await sharp(src).resize({ width: 1400, withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(join(OUT, 'images', dst))
    ok.push({ sec, status, cap, file: dst, w: meta.width, h: meta.height })
  } catch (e) {
    missing.push(`${file} (${e.message})`)
  }
}
// contact sheet: 4 columns of 440 px thumbnails
const TW = 440
const TH = 270
const cols = 4
const rows = Math.ceil(ok.length / cols)
const tiles = []
for (let i = 0; i < ok.length; i++) {
  const buf = await sharp(join(OUT, 'images', ok[i].file)).resize(TW, TH, { fit: 'cover' }).jpeg({ quality: 78 }).toBuffer()
  tiles.push({ input: buf, left: (i % cols) * (TW + 6), top: Math.floor(i / cols) * (TH + 6) })
}
await sharp({ create: { width: cols * (TW + 6), height: rows * (TH + 6), channels: 3, background: '#111' } }).composite(tiles).jpeg({ quality: 80 }).toFile(join(OUT, 'contact-sheet.jpg'))
const bySec = new Map()
for (const it of ok) bySec.set(it.sec, [...(bySec.get(it.sec) ?? []), it])
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chadverse review pack</title>
<style>body{background:#0e0b12;color:#eee;font:15px/1.5 system-ui,sans-serif;margin:0;padding:24px;max-width:1500px;margin-inline:auto}h1{font-size:28px}h2{margin-top:34px;border-bottom:1px solid #444;padding-bottom:6px;color:#ffd25a}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:18px}figure{margin:0;background:#18141f;border-radius:12px;overflow:hidden}img{width:100%;display:block}figcaption{padding:10px 12px;font-size:13px}
.s{display:inline-block;margin-right:8px;padding:1px 8px;border-radius:9px;background:#3a2a55;font-size:11px;text-transform:uppercase;letter-spacing:.06em}.before{background:#4a3a2a}</style></head><body>
<h1>Chadverse — review pack</h1><p>All stills are from a <b>simulated</b> browser (software rendering, synthetic input); none from a real phone or real mouse. Labels: <i>before</i> = how it was; <i>awaiting visual review</i> = built, checked by me, needs your eyes; <i>functionally checked</i> = scripted test passes.</p>
${VIDEOS.filter(([f]) => existsSync(join(OUT, f))).map(([f, c]) => `<h2>Video</h2><figure><video src="${f}" controls muted style="width:100%;max-width:960px"></video><figcaption>${c}</figcaption></figure>`).join('')}
<p><a href="contact-sheet.jpg">Contact sheet (all ${ok.length} images)</a></p>
${[...bySec].map(([sec, items]) => `<h2>${sec}</h2><div class="g">${items.map((i) => `<figure><a href="images/${i.file}"><img loading="lazy" src="images/${i.file}" alt=""></a><figcaption><span class="s ${i.status === 'before' ? 'before' : ''}">${i.status}</span>${i.cap}</figcaption></figure>`).join('')}</div>`).join('\n')}
${missing.length ? `<h2>Not captured</h2><ul>${missing.map((m) => `<li>${m}</li>`).join('')}</ul>` : ''}
</body></html>`
writeFileSync(join(OUT, 'index.html'), html)
console.log(`pack: ${ok.length} images verified and copied, ${missing.length} missing -> ${OUT}`)
if (missing.length) console.log('missing:', missing.join(', '))
