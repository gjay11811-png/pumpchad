// stills of the rideable bikes: parked, mounted, riding side / front / three-quarter, mid-wheelie.   SHOTS=dir KIND=surron|street node scripts/bike-look.mjs
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const OUT = process.env.SHOTS || '.'
const KIND = process.env.KIND || 'surron'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] })
const p = await b.newPage({ viewport: { width: 1100, height: 650 } })
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'], xp: 800 }, settings: { quality: 'medium', muted: true } })))
await p.goto(BASE + '?sky=day')
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Rider')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const B = () => p.evaluate(() => window.__chadverse.bike())
const st = await B()
const bk = st.parked.find((x) => x.kind === KIND)
const cam = (c, l, fov = 40) => p.evaluate(([c, l, fov]) => window.__chadverse.shotCam({ cam: c, look: l, fov }), [c, l, fov])
const shot = async (n) => {
  await p.waitForTimeout(900)
  await p.screenshot({ path: `${OUT}/bike-${KIND}-${n}.jpg`, type: 'jpeg', quality: 86 })
  console.log('shot', n)
}
// parked
await p.evaluate(([x, z]) => window.__chadverse.teleport(x, z - 3, Math.PI), [bk.x, bk.z])
await cam([bk.x + 2.6, 1.0, bk.z + 0.4], [bk.x, 0.55, bk.z], 38)
await shot('parked-side')
await p.evaluate(() => window.__chadverse.shotCam(null))
await p.evaluate(([x, z]) => window.__chadverse.teleport(x, z - 1.6, Math.PI), [bk.x, bk.z])
await p.waitForTimeout(1000)
await p.keyboard.press('e')
await p.waitForFunction(() => window.__chadverse.bike().riding && window.__chadverse.bike().phase === 'riding', null, { timeout: 90000 })
// to an open stretch of ground
await p.evaluate(() => window.__chadverse.setBike({ x: 0, z: 14, h: 0, v: 0 }))
await p.waitForTimeout(1200)
const s0 = await B()
for (const [n, c, l] of [
  ['side', [s0.x + 3.2, 1.1, s0.z], [s0.x, 0.8, s0.z]],
  ['front', [s0.x, 1.2, s0.z + 3.6], [s0.x, 0.8, s0.z]],
  ['rear34', [s0.x + 2.2, 1.5, s0.z - 2.8], [s0.x, 0.8, s0.z]],
  ['hands', [s0.x + 0.9, 1.5, s0.z + 1.2], [s0.x, 1.1, s0.z + 0.2]],
]) {
  await cam(c, l, n === 'hands' ? 55 : 38)
  await shot(n)
}
// wheelie: gas + heave until the front is up, then a side shot
await p.evaluate(() => window.__chadverse.setBike({ x: 0, z: 16, h: 0, v: 7 }))
await p.keyboard.down('w')
await p.keyboard.down('Shift')
await p.waitForFunction(() => window.__chadverse.bike().pitch > 0.4, null, { timeout: 60000 })
await p.keyboard.up('Shift')
const w = await B()
console.log('wheelie', JSON.stringify(w))
await cam([w.x + 3.4, 1.1, w.z], [w.x, 0.9, w.z], 40)
await shot('wheelie-side')
await p.keyboard.up('w')
await b.close()
