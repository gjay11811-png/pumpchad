// CHAD CITY review shots: the gameplay camera at key spots + fixed inspection cameras.
//   SHOTS=dir Q=high node scripts/city-shots.mjs <tag> [names,...]
import { chromium } from 'playwright'
const out = process.env.SHOTS || '.'
const tag = process.argv[2] || 'now'
const only = process.argv[3] ? process.argv[3].split(',') : null
const URL = process.env.URL || 'http://localhost:4318/chadverse/'
const PI = Math.PI
// name: play = [x, z, yaw, dragUp, dragTurn] (gameplay camera)  |  cam = [[cx,cy,cz],[lx,ly,lz],fov] (fixed)
const VIEWS = {
  'estates-arch': { cam: [[-22, 2.2, 47], [-34, 2.4, 47], 55] },
  'estates-aerial': { cam: [[-28, 30, 86], [-47, 0, 60], 50] },
  'estates-lane': { play: [-47, 50, 0, -10, 0] },
  'forest-gate': { cam: [[-80, 2.2, -8], [-80, 2.6, -22], 55] },
  'forest-path': { play: [-79, -27, PI, -10, 0] },
  'forest-clearing': { cam: [[-70, 3.2, -41], [-70, 2.4, -56], 55] },
  'forest-glade': { cam: [[-88, 2.2, -50], [-93, 1.4, -57], 55] },
  'forest-aerial': { cam: [[-50, 40, -2], [-72, 0, -45], 50] },
  'lake-arrive': { play: [72, 36.25, -PI / 2, -10, 0] },
  'lake-shore': { cam: [[78, 2.0, 40], [100, 0.5, 26], 55] },
  'lake-pier': { play: [98, 40, PI, -10, 0] },
  'lake-pavilion': { cam: [[98, 2.4, 20], [98, 2.6, 9.4], 55] },
  'lake-aerial': { cam: [[60, 42, 72], [98, 0, 30], 50] },
  spawn: { play: null },
  gateway: { cam: [[0, 2.2, 66.5], [0, 6.5, 40], 55] },
  'gateway-back': { play: [0, 44.5, 0, 0, 0] },
  avenue: { play: [0, 47.5, PI, -10, 0] },
  bridge: { cam: [[-9, 1.6, 47], [0, 0.2, 41], 55] },
  canal: { cam: [[24, 2.2, 47.5], [-4, -0.2, 40.5], 55] },
  'canal-wall': { cam: [[10, 0.9, 43.8], [10, -0.6, 38.4], 60] },
  square: { play: [0, 13, PI, 0, 0] },
  'square-wide': { cam: [[13, 7, 16], [0, 2, 0], 55] },
  castle: { play: [0, -14, PI, -20, 0] },
  'castle-door': { cam: [[0, 2, -21.5], [0, 2.6, -31], 55] },
  gym: { play: [6.5, -4, PI / 2, -10, 0] },
  courtyard: { play: [22, 12, PI, 10, 0] },
  arcade: { play: [33, 19, PI / 2, -10, 0] },
  market: { play: [-10.5, 2.5, -PI / 2, 0, 0] },
  social: { play: [-31, 2.5, -PI / 2 - 0.25, 0, 0] },
  garden: { play: [-30.5, 23, -PI / 2, -10, 0] },
  overlook: { play: [-52, 37, PI * 0.8, -10, 0] },
  rides: { play: [7.5, 60.5, 0.55, 0, 0] },
  patch: { play: [-14, 58, -PI / 2 - 0.3, -10, 0] },
  lawn: { play: [14, 50, PI / 2 + 0.6, -10, 0] },
  aerial: { cam: [[-30, 45, 95], [0, 0, 5], 50] },
  'aerial-n': { cam: [[40, 40, -60], [0, 0, 10], 50] },
  'castle-wall': { cam: [[-14, 3.2, -22.5], [-14, 5.5, -31], 60] },
  'square-gate': { cam: [[0, 1.8, 36.5], [0, 4.6, 27.5], 60] },
  'square-gate-n': { cam: [[2.5, 1.8, 20], [0, 4.4, 27.5], 60] },
  'hollow-track': { cam: [[9, 6, -8], [16, 0, -18], 60] },
  'shop-window': { cam: [[34, 1.7, 19.5], [34, 1.5, 13], 55] },
  'vil-witch': { cam: [[-20.2, 1.7, 0.6], [-21, 1.3, -2.6], 45] },
  'vil-market': { cam: [[-19, 2.0, 3.6], [-24, 1.2, -1.5], 50] },
  'vil-greeter': { cam: [[0.6, 1.7, 63.9], [-3.6, 1.0, 60.8], 40] },
  'vil-guard': { cam: [[3.2, 1.7, -14.5], [0.8, 1.0, -18], 45] },
  'vil-chat': { cam: [[-1.2, 1.7, -5.6], [-3.8, 1.0, -7.9], 45] },
  'vil-captain': { cam: [[4.4, 1.7, -21.2], [3.6, 1.3, -23.4], 45] },
  'hq-gate': { cam: [[-49, 2.4, 2.5], [-66, 3.0, 2.5], 60] },
  'hq-square': { cam: [[-70, 3.2, 7.5], [-84, 2.0, -1], 60] },
  'hq-grave': { cam: [[-85, 3.4, 23], [-97, 1.2, 15], 60] },
  'plan-hq': { cam: [[-80, 75, 3], [-80, 0, 3.1], 50] },
  'motor-row': { cam: [[30.5, 2.4, 35.2], [50, 2.6, 43], 58] },
  'pets-front': { cam: [[36.4, 1.9, 37.6], [38.4, 2.6, 44], 60] },
  'motors-front': { cam: [[50.5, 2.3, 36.8], [54.5, 3.0, 45], 62] },
  'arcade-signs': { cam: [[37.5, 2.6, 19.2], [37.5, 3.2, 12.5], 62] },
  'plan-motor': { cam: [[47, 60, 41], [47, 0, 41.1], 55] },
  'plan-n': { cam: [[0, 70, -2], [0, 0, -1.9], 55] },
  'plan-s': { cam: [[0, 70, 46], [0, 0, 46.1], 55] },
  'plan-e': { cam: [[40, 70, 14], [40, 0, 14.1], 55] },
  'plan-w': { cam: [[-40, 70, 14], [-40, 0, 14.1], 55] },
}
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const errs = []
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
p.on('pageerror', (e) => errs.push(e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)))
await p.goto(URL, { waitUntil: 'networkidle' })
await p.evaluate((q) => {
  localStorage.clear()
  localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 1, character: null, progress: {}, settings: { quality: q, muted: true } }))
}, process.env.Q || 'high')
await p.reload({ waitUntil: 'networkidle' })
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'City Shots')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 90000 })
await p.waitForTimeout(2500)
if (!process.env.UI) await p.addStyleTag({ content: '.panel, [data-testid=objective], p { opacity: 0 !important }' })
for (const [name, v] of Object.entries(VIEWS)) {
  if (only && !only.includes(name)) continue
  await p.evaluate(() => window.__chadverse.shotCam(null))
  if (v.cam) {
    await p.evaluate(([cam, look, fov]) => window.__chadverse.shotCam({ cam, look, fov }), v.cam)
  } else if (v.play) {
    const [x, z, yaw, up, turn] = v.play
    await p.evaluate(([x, z, yaw]) => window.__chadverse.teleport(x, z, yaw), [x, z, yaw])
    await p.waitForTimeout(300)
    if (up || turn) {
      await p.mouse.move(640, 400)
      await p.mouse.down()
      await p.mouse.move(640 + turn, 400 + up, { steps: 8 })
      await p.mouse.up()
    }
  }
  await p.waitForTimeout(900)
  await p.screenshot({ path: `${out}/${tag}-${name}.jpg`, quality: 82, timeout: 60000 })
  console.log('shot', name)
}
console.log('stats', JSON.stringify(await p.evaluate(() => [window.__chadverse.stats(), window.__chadverse.world()])))
console.log('errors:', JSON.stringify(errs))
await b.close()
