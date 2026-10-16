// The new district (Chad City): enter it via ?district=1 and photograph it from fixed cameras, in daylight. SIMULATED browser (software GL).
//   SHOTS=dir [Q=medium] [VIEWS=a,b] [W=1280 H=720] node scripts/district-shots.mjs
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const OUT = process.env.SHOTS || '.'
const Q = process.env.Q || 'medium'
const W = +(process.env.W || 1280)
const H = +(process.env.H || 720)
const PI = Math.PI
// name: [cam, look, fov]   (district frame: avenue along z, gym on the west (−x) side, gate end at +z)
const VIEWS = {
  wide: [[2, 2.6, 66], [-6, 6, -40], 62],
  'gym-front': [[3, 1.9, -14], [-30, 4.6, -29], 62],
  'gym-high': [[8, 9, -4], [-30, 7, -29], 58],
  entrance: [[-10.5, 1.7, -22], [-32, 2.3, -29], 58],
  'gym-glass': [[-3, 2.2, -29], [-34, 6.5, -29], 60],
  road: [[0, 1.0, 46], [0, 0.4, 20], 66],
  pavement: [[-9.5, 1.5, 38], [-9.5, 0.2, 14], 62],
  trees: [[11.5, 1.6, 52], [11.5, 6.5, 20], 62],
  junction: [[0, 3.5, -36], [0, 1.0, -66], 64],
  east: [[-6, 2.2, 6], [26, 5.5, 8], 66],
  tower: [[2, 2.4, -26], [22, 12, -30], 66],
  pedestrian: [[-9.2, 1.7, 25], [-9.0, 1.9, -6], 70],
}
const only = process.env.VIEWS ? process.env.VIEWS.split(',') : Object.keys(VIEWS)
const b = await chromium.launch({
  executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe',
  args: (process.env.GLARGS ?? '--use-angle=swiftshader --enable-unsafe-swiftshader --disable-gpu-watchdog').split(' ').filter(Boolean),
})
const p = await b.newPage({ viewport: { width: W, height: H } })
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
p.on('console', (m) => {
  if (m.type() === 'error') errs.push(m.text().slice(0, 200))
})
await p.addInitScript((q) => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'], xp: 800 }, settings: { quality: q, muted: true } })), Q)
await p.goto(BASE + '?district=1&sky=day')
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Visitor')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
await p.evaluate(() => window.__chadverse.enterDistrict())
await p.waitForFunction(() => window.__chadverse.phase === 'interior', null, { timeout: 90000 })
await p.waitForTimeout(9000) // the tree models load a few seconds after the scene
await p.addStyleTag({ content: '.panel, [data-testid=objective], .hud { opacity: 0 !important }' })
for (const name of only) {
  const [c, l, fov] = VIEWS[name]
  await p.evaluate(([c, l, fov]) => window.__chadverse.shotCam({ cam: c, look: l, fov }), [c, l, fov])
  await p.waitForTimeout(1100)
  await p.screenshot({ path: `${OUT}/district-${name}.jpg`, type: 'jpeg', quality: 86, timeout: 120000 })
  console.log('shot', name)
}
console.log('errors', JSON.stringify(errs.slice(0, 5)))
await b.close()
