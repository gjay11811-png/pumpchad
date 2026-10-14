// The wilds: walk from the Haunted Quarter into the Enchanted Forest and along Motor Row to Moonlight Lake
// (each a one-time discovery), out along the pier, and check the lake water can't be walked into.
//   URL=http://localhost:4318/chadverse/ [Q=low] node scripts/wilds-test.mjs
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:4318/chadverse/'
const KEY = 'pumpchad.chadverse.save'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1100, height: 720 } })
const errs = []
let fails = 0
const check = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails++ }
p.on('pageerror', (e) => errs.push(e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)))
const C = (fn, ...a) => p.evaluate(([f, a]) => window.__chadverse[f](...a), [fn, a])
const stored = () => p.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY)
const enterWorld = async () => {
  await p.click('[data-testid=enter-muted]')
  await p.waitForSelector('[role=tablist]')
  await p.getByRole('tab', { name: 'Name' }).click()
  await p.fill('#chad-name', 'Explorer')
  await p.getByRole('button', { name: /Enter Chad Square/ }).click()
  await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 90000 })
}

const hold = async (key, ms) => {
  await p.keyboard.down(key)
  await p.waitForTimeout(ms)
  await p.keyboard.up(key)
  await p.waitForTimeout(250)
}
const LAKE = { x: 98, z: 31, rx: 19, rz: 14 }
const lr = (w) => Math.hypot((w.x - LAKE.x) / LAKE.rx, (w.z - LAKE.z) / LAKE.rz)
await p.goto(BASE, { waitUntil: 'networkidle' })
await p.evaluate(([k, q]) => {
  localStorage.clear()
  localStorage.setItem(k, JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'] }, settings: { quality: q, muted: true } }))
}, [KEY, process.env.Q || 'low'])
await p.reload({ waitUntil: 'networkidle' })
await enterWorld()

// Haunted Quarter → north through the forest gate
await C('teleport', -80, -12, Math.PI)
await p.waitForTimeout(800)
await hold('w', 6000)
const f = await C('world')
check(f.z < -20, `walks north across the Haunted Quarter seam into the Enchanted Forest (z ${f.z})`)
await p.waitForTimeout(800)
check((await C('save')).progress.discoveries.includes('visit_forest'), 'Enchanted Forest discovered')
await C('teleport', -70, -46, Math.PI)
await p.waitForTimeout(600)
await hold('w', 6000)
const oak = await C('world')
check(Math.hypot(oak.x + 70, oak.z + 58.5) > 2.2 && Math.hypot(oak.x + 70, oak.z + 58.5) < 3.5, `the Elder Oak is solid (stopped ${Math.hypot(oak.x + 70, oak.z + 58.5).toFixed(2)} m from its centre)`)

// Motor Row → east to the lake
await C('teleport', 60, 36.25, Math.PI / 2)
await p.waitForTimeout(800)
await hold('w', 6000)
const l = await C('world')
check(l.x > 70, `walks east off Motor Row toward the lake (x ${l.x})`)
await C('teleport', 80, 40, Math.PI / 2)
await p.waitForTimeout(1200)
check((await C('save')).progress.discoveries.includes('visit_lake'), 'Moonlight Lake discovered')

// the pier: walk out to the head
await C('teleport', 98, 48.5, Math.PI)
await p.waitForTimeout(800)
await hold('w', 7500)
const ph = await C('world')
check(ph.z < 36 && Math.abs(ph.x - 98) < 3 && Math.abs(ph.y) < 0.2, `walks the pier to the head (z ${ph.z}, y ${ph.y})`)
// off the side of the pier: stays on the deck
await C('teleport', 98, 40, Math.PI / 2)
await p.waitForTimeout(500)
await hold('w', 2000)
const side = await C('world')
check(side.x < 99.3 && side.x > 96.7, `can't step off the pier into the water (x ${side.x})`)
// wading in from the shore: stopped at the waterline
await C('teleport', 76, 31, Math.PI / 2)
await p.waitForTimeout(500)
await hold('w', 3500)
const sh = await C('world')
check(lr(sh) > 0.97, `the shore stops you at the water (r ${lr(sh).toFixed(3)})`)

const lost = errs.some((e) => e.includes('context lost'))
if (lost) console.log('  WARN  WebGL context lost during the run (machine memory) — shader errors after it ignored')
const real = errs.filter((e) => !(lost && (e.includes('context lost') || e.includes('WebGLProgram'))))
check(!real.length, `no page errors (${JSON.stringify(real.slice(0, 3))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
