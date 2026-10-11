// Visual tour of Chad Square: screenshots from player viewpoints + render stats per view.
import { chromium } from 'playwright'
const out = process.env.SHOTS
const base = process.env.URL || 'http://localhost:4318/chadverse/'
const [w, h, tag, mobile] = [+(process.argv[2] || 1440), +(process.argv[3] || 900), process.argv[4] || 'dt', process.argv[5] === 'm']
const quality = process.argv[6] || (mobile ? 'medium' : 'high')
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
await p.goto(base, { waitUntil: 'networkidle' })
await p.evaluate((q) => {
  localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({
    version: 1,
    character: { name: 'Tourist', appearance: { species: 'pumpkin', skin: '#e8741c', outfit: '#141216', glow: '#ffb347', top: 'hoodie', headwear: 'cap', eyewear: 'shades', chain: true } },
    progress: { xp: 0, achievements: [], gymBest: 0, gymRuns: 0, discoveries: [] },
    settings: { quality: q, sfx: 0.7, ambience: 0.4, muted: true, reducedEffects: false, cameraSensitivity: 1, stickSensitivity: 1, uiScale: 1 },
  }))
}, quality)
await p.reload({ waitUntil: 'networkidle' })
await p.waitForSelector('[data-testid=enter-muted]', { timeout: 20000 })
const t0 = Date.now()
await p.click('[data-testid=enter-muted]')
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 30000 })
console.log(`world ready in ${Date.now() - t0} ms (headless, includes portal animation)`)
const views = (process.env.VIEWS || 'spawn,fountain,market,tavern,forge,arcade,hollow,castle,gym').split(',')
const V = {
  spawn: [0, 19.5, Math.PI],
  arch: [0, 25.2, Math.PI],
  fountain: [3, 13, Math.PI + 0.25],
  market: [-11, 3.5, -Math.PI / 2],
  tavern: [-1.5, 22, -Math.PI / 2 - 0.5],
  forge: [-10.5, -6.5, Math.PI + 0.6],
  arcade: [1.5, 15.5, Math.PI / 2 - 0.6],
  hollow: [11, -12, Math.PI - 0.9],
  castle: [0, -16, Math.PI],
  gym: [8.5, -1, Math.PI / 2 + 0.3],
  alley: [-17.5, 15, Math.PI + 0.7],
}
for (const v of views) {
  const [x, z, yaw] = V[v]
  await p.evaluate(([x, z, yaw]) => window.__chadverse.teleport(x, z, yaw), [x, z, yaw])
  await p.waitForTimeout(1300)
  const d = await p.evaluate(() => window.__chadverse.world())
  console.log(`${v.padEnd(9)} calls=${d.calls} tris=${d.triangles} npcs=${d.npcs} cam=${d.camDist} pos=(${d.x},${d.y},${d.z})`)
  await p.screenshot({ path: `${out}/tour-${tag}-${v}.jpg`, quality: 78 })
}
console.log('errors:', errs)
await b.close()
