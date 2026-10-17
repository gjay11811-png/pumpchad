// Normal gameplay-camera frames of the riding (behind-the-bike camera, software GL, game time stepped): pull-away, cruise, turn, brake, REV-tap wheelie and its settling.
//   OUT=dir KIND=surron|street SPECIES=skeleton|demon node scripts/ride-frames.mjs
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const KIND = process.env.KIND || 'surron'
const SPECIES = process.env.SPECIES || ''
const OUT = process.env.OUT || 'tmp-viewer/ride-frames'
mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] })
const p = await b.newPage({ viewport: { width: 900, height: 520 } })
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'], xp: 800 }, settings: { quality: 'medium', muted: true } })))
await p.goto(BASE + '?sky=day')
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
if (SPECIES) await p.click(`[data-testid=species-${SPECIES}]`)
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Rider')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const B = () => p.evaluate(() => window.__chadverse.bike())
const adv = (s) => p.evaluate((s) => window.__chadverse.advance(s), s)
const set = (o) => p.evaluate((o) => window.__chadverse.setBike(o), o)
const frame = async () => { const n0 = await p.evaluate(() => window.__chadverse.renders()); await p.waitForFunction((n) => window.__chadverse.renders() >= n + 2, n0, { timeout: 60000, polling: 40 }) }
const tag = `${KIND}${SPECIES ? '-' + SPECIES : ''}`
let n = 0
const shot = async (name) => {
  await adv(0.02)
  await frame()
  const s = await B()
  await p.screenshot({ path: `${OUT}/${tag}-${String(++n).padStart(2, '0')}-${name}.jpg`, type: 'jpeg', quality: 82 })
  console.log(name.padEnd(12), JSON.stringify({ v: +s.v.toFixed(1), pitch: +(s.pitch * 57.3).toFixed(0), roll: +(s.roll * 57.3).toFixed(0), z: +s.z.toFixed(1) }))
}
const parked = (await B()).parked.find((x) => x.kind === KIND)
await p.evaluate(([x, z]) => window.__chadverse.teleport(x, z - 1.6, Math.PI), [parked.x, parked.z])
await p.waitForTimeout(2500)
await adv(0.3)
await p.evaluate((k) => window.__chadverse.mountBike(k), KIND)
await adv(1.2)
await p.evaluate(() => window.__chadverse.freeze(true))
await set({ x: 0, z: 14, h: 0, v: 0 })
await adv(1.0)
await shot('rest')
await p.keyboard.down('w')
await adv(1.2)
await adv(1)
await shot('pull-away')
await set({ x: 0, z: 14, h: 0, v: KIND === 'surron' ? 12 : 16 })
await adv(1.2)
await shot('cruise')
await set({ x: 0, z: 14, h: 0, v: KIND === 'surron' ? 10 : 14 })
await p.keyboard.down('d')
await adv(0.6)
await shot('turn')
await p.keyboard.up('d')
await p.keyboard.up('w')
await set({ x: 0, z: 14, h: 0, v: KIND === 'surron' ? 12 : 16 })
await adv(0.4)
await p.keyboard.down('s')
await adv(0.5)
await shot('brake')
await p.keyboard.up('s')
await set({ x: 0, z: 14, h: 0, v: 4 })
await adv(0.5)
// REV taps: a fresh 0.15 s press of the gas, again when the front is coming down
let peak = 0
for (let k = 0; k < 4; k++) {
  await p.keyboard.down('w')
  await adv(0.15)
  await p.keyboard.up('w')
  await adv(0.3)
  const s = await B()
  peak = Math.max(peak, s.pitch)
  if (s.pitch > 0.2 && k >= 1) break
}
await shot('rev-lift')
await adv(0.7)
await shot('settling')
await b.close()
