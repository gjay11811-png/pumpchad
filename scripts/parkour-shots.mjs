// Parkour Yard review stills: overview, entrance, courses, and a side-on camera tracking the body through a vault and a mantle.
//   URL=http://localhost:5180/chadverse/ SHOTS=dir node scripts/parkour-shots.mjs
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const OUT = process.env.SHOTS || '.'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
await p.addInitScript(() =>
  localStorage.setItem(
    'pumpchad.chadverse.save',
    JSON.stringify({ version: 2, character: null, progress: { xp: 60000, discoveries: ['intro_seen', 'visit_parkour', 'visit_estates', 'visit_square'], achievements: ['welcome'] }, settings: { quality: process.env.Q || 'medium', muted: true } }),
  ),
)
await p.goto(BASE)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Runner')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
await p.addStyleTag({ content: '.panel, [data-testid=objective] { opacity: 0 !important } p { opacity: 0 !important }' })
const wait = (ms) => p.waitForTimeout(ms)
const cam = (c, l, fov = 55) => p.evaluate(([c, l, fov]) => window.__chadverse.shotCam({ cam: c, look: l, fov }), [c, l, fov])
const shot = async (name) => {
  await wait(700)
  await p.screenshot({ path: `${OUT}/${name}.jpg`, quality: 82, timeout: 150000 })
  console.log('shot', name)
}
const W = () => p.evaluate(() => window.__chadverse.world())
const PK = () => p.evaluate(() => window.__chadverse.parkour())
await p.evaluate(() => window.__chadverse.teleport(-234, 30, Math.PI))
await wait(1500)
await cam([-206, 120, 3], [-206, 0, 3.1], 55)
await shot('pk2-overview-plan')
await cam([-150, 36, 70], [-206, 2, 4], 52)
await shot('pk2-overview-aerial')
await cam([-234, 3.2, 41], [-234, 3.0, 22], 55)
await shot('pk2-entrance-arch')
await cam([-234, 2.4, 25], [-234, 1.2, 8], 58)
await shot('pk2-rookie-corridor-start')
await cam([-234, 3.0, -3], [-234, 0.8, -14], 58)
await shot('pk2-rookie-gap-and-finish')
await cam([-232, 5.2, 10], [-218, 3.5, 0], 62)
await shot('pk2-roof-crate-stair')
await cam([-208, 7.5, 12], [-196, 3.5, 0], 62)
await shot('pk2-roofs-gaps')
await cam([-205.7, 1.6, -9], [-205.7, 1.2, 0], 58)
await shot('pk2-secret-room-mouth')
await cam([-205.7, 1.5, 1.4], [-205.7, 1.0, -2], 60)
await shot('pk2-secret-room-inside')

/* tracked side camera through a vault (wall 1) and a mantle (block 1) */
await p.evaluate(() => window.__chadverse.shotCam(null))
await p.evaluate(() => window.__chadverse.teleport(-234, 20.5, Math.PI))
await wait(900)
await p.keyboard.down('w')
await p.keyboard.down('Shift')
let n = 0
let pressed = false
const marks = [0.1, 0.28, 0.44]
for (let i = 0; i < 200 && n < 3; i++) {
  const [w, pk] = await Promise.all([W(), PK()])
  if (!pressed && !pk.trav && w.z < 19.2) {
    await p.keyboard.press('Space')
    pressed = true
  }
  if (pk.trav) {
    await cam([w.x + 3.4, pk.y + 1.2, w.z], [w.x, pk.y + 0.85, w.z], 42)
    if (pk.trav.t >= marks[n]) {
      await p.screenshot({ path: `${OUT}/pk2-vault-${n + 1}.jpg`, quality: 82, timeout: 150000 })
      console.log('vault frame', n + 1, JSON.stringify(pk.trav))
      n++
    }
  }
  await wait(15)
}
await p.keyboard.up('w')
await p.keyboard.up('Shift')
await p.evaluate(() => window.__chadverse.shotCam(null))
await p.evaluate(() => window.__chadverse.teleport(-234, -4.5, Math.PI))
await wait(900)
await p.keyboard.down('w')
await p.keyboard.down('Shift')
n = 0
pressed = false
const mm = [0.1, 0.35, 0.65]
for (let i = 0; i < 200 && n < 3; i++) {
  const [w, pk] = await Promise.all([W(), PK()])
  if (!pressed && !pk.trav && w.z < -6.3) {
    await p.keyboard.press('Space')
    pressed = true
  }
  if (pk.trav) {
    await cam([w.x + 3.4, pk.y + 1.2, w.z], [w.x, pk.y + 0.85, w.z], 42)
    if (pk.trav.t >= mm[n] * 0.8) {
      await p.screenshot({ path: `${OUT}/pk2-mantle-${n + 1}.jpg`, quality: 82, timeout: 150000 })
      console.log('mantle frame', n + 1, JSON.stringify(pk.trav))
      n++
    }
  }
  await wait(15)
}
await p.keyboard.up('w')
await p.keyboard.up('Shift')
await b.close()
