// Continuous traversal recording with a side-on tracking camera: run → sprint jump → fence vault → ledge catch → hang → shimmy both ways → pull-up → roof jump → landing.
// Saves a webm (Playwright's recorder) and a frame strip of key moments. SIMULATED browser.   OUT=dir [SPECIES=skeleton|demon] node scripts/trav-sequence.mjs
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const OUT = process.env.OUT || '.'
const TAG = process.env.TAG || 'seq'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const ctx = await b.newContext({ viewport: { width: 960, height: 540 }, recordVideo: { dir: OUT, size: { width: 960, height: 540 } } })
const p = await ctx.newPage()
const ch = process.env.SPECIES ? { species: process.env.SPECIES } : null
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen', 'visit_parkour'], xp: 800 }, settings: { quality: 'low', muted: true } })))
await p.goto(BASE)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
if (process.env.SPECIES) {
  const t = p.getByRole('tab', { name: new RegExp(process.env.SPECIES, 'i') })
  if (await t.count()) await t.first().click()
  else {
    const btn = p.getByRole('button', { name: new RegExp(process.env.SPECIES, 'i') })
    if (await btn.count()) await btn.first().click()
  }
}
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Climber')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
await p.addStyleTag({ content: '.panel, [data-testid=objective] { opacity: 0 !important }' })
const W = () => p.evaluate(() => window.__chadverse.world())
const H = () => p.evaluate(() => window.__chadverse.hang())
const PK = () => p.evaluate(() => window.__chadverse.parkour())
const wait = (ms) => p.waitForTimeout(ms)
const tp = (x, z, yaw, y = 0) => p.evaluate(([x, z, yaw, y]) => window.__chadverse.teleport(x, z, yaw, y), [x, z, yaw, y])
const until = async (fn, ms = 6000) => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    if (await fn()) return true
    await wait(40)
  }
  return false
}
const CZ = +(process.env.CZ || 1)
let running = true
let frames = 0
// side camera follows the body (looks along +x, from the south); a frame is saved every 5th tick for the strip
const tracker = (async () => {
  let k = 0
  while (running) {
    try {
      const [w, pk] = await Promise.all([W(), PK()])
      const hg = await H()
      const y = hg.hanging ? hg.y : pk.y
      await p.evaluate(([x, y, z, CZ]) => window.__chadverse.shotCam({ cam: [x - 3.0 * CZ, y + 1.5, z + 2.4 * CZ], look: [x + 0.3, y + 1.15, z], fov: 44 }), [w.x, y, w.z, CZ])
      if (++k % 4 === 0) {
        await p.screenshot({ path: `${OUT}/${TAG}-f${String(frames++).padStart(3, '0')}.jpg`, type: 'jpeg', quality: 70, timeout: 60000 })
      }
    } catch {}
    await wait(30)
  }
})()
await tp(-226, 20, Math.PI / 2)
await wait(700)
await p.keyboard.down('w')
await p.keyboard.down('Shift')
await until(async () => (await W()).x >= -222.3, 4000)
await p.keyboard.press('Space')
await until(async () => (await W()).x > -217, 3000)
await until(async () => !(await PK()).trav && (await PK()).grounded, 2000)
await until(async () => (await W()).x >= -214.3, 3000)
await p.keyboard.press('Space')
await until(async () => (await PK()).grounded && !(await PK()).trav && (await W()).x > -211.6, 2500)
await p.keyboard.up('Shift')
await until(async () => (await W()).x >= -208.4 && (await PK()).grounded && !(await PK()).trav, 5000)
await wait(150)
await p.keyboard.press('Space')
await until(async () => (await H()).hanging, 2500)
await p.keyboard.up('w')
await wait(1200)
await p.keyboard.down('a')
await until(async () => (await H()).s > 4.5, 4000)
await p.keyboard.up('a')
await wait(500)
await p.keyboard.down('d')
await wait(1800)
await p.keyboard.up('d')
await wait(500)
await p.keyboard.down('w')
await wait(150)
await p.keyboard.up('w')
await until(async () => !(await H()).hanging, 3000)
await wait(900)
const w1 = await W()
await tp(w1.x, w1.z, Math.PI / 2, 2.35)
await wait(400)
await p.keyboard.down('w')
await p.keyboard.down('Shift')
await until(async () => (await W()).x >= -197.6, 3000)
await p.keyboard.press('Space')
await wait(1800)
await p.keyboard.up('w')
await p.keyboard.up('Shift')
await wait(600)
running = false
await tracker
const vid = p.video()
await ctx.close()
console.log('video', vid ? await vid.path() : '-', 'frames', frames)
await b.close()
