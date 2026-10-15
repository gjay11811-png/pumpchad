// The three show homes: walk up to each front door (ordinary controls), enter, look round (photo cameras), walk out; the plots stay purchasable (52).
//   URL=... SHOTS=dir node scripts/showhome-test.mjs
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const SHOTS = process.env.SHOTS || ''
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
let fails = 0
const check = (ok, msg) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!ok) fails++
}
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
await p.addInitScript((q) => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'] }, settings: { quality: q, muted: true } })), process.env.Q || 'low')
await p.goto(BASE)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Visitor')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const wait = (ms) => p.waitForTimeout(ms)
const ph = () => p.evaluate(() => window.__chadverse.phase)
const HOMES = [
  ['show_cottage', 'cottage', -77, 34.4, [[0, 3.5, 2.8], [0, 1.2, -1.2]], [[-1.5, 2.2, 3.0], [-3.5, 1.0, -0.5], 70]],
  ['show_contemporary', 'contemporary', -87.5, 34.0, [[0, 3.2, 3.6], [-1, 1.2, -1]], [[3.8, 2.4, 3.4], [-2.5, 1.1, -0.5], 70]],
  ['show_premium', 'premium', -103, 35.9, [[0, 3.6, 4.2], [0, 1.4, -1]], [[4.6, 2.6, 3.9], [-2.2, 1.2, -0.5], 72]],
]
for (const [id, short, x, z, pos, up] of HOMES) {
  await p.evaluate(([x, z]) => window.__chadverse.teleport(x, z, Math.PI), [x, z])
  await wait(900)
  const prompt = (await p.evaluate(() => window.__chadverse.world())).prompt
  check(prompt === `house:${id}`, `${short}: the front door offers the interior (${prompt})`)
  await p.keyboard.press('e')
  await p.waitForFunction(() => window.__chadverse.phase === 'interior', null, { timeout: 40000 }).catch(() => {})
  check((await ph()) === 'interior', `${short}: E enters the interior`)
  if ((await ph()) !== 'interior') continue
  await wait(1500)
  if (SHOTS) {
    const [c0, l0] = pos
    await p.evaluate(([c, l]) => window.__chadverse.shotCam({ cam: c, look: l, fov: 62 }), [c0.length ? [c0[0], c0[1], c0[2]] : [0, 3, 3], [pos[1][0], pos[1][1], pos[1][2]]])
    await wait(700)
    await p.screenshot({ path: `${SHOTS}/showhome-${short}-1.jpg`, quality: 82 })
    await p.evaluate(([c, l, f]) => window.__chadverse.shotCam({ cam: c, look: l, fov: f }), up)
    await wait(700)
    await p.screenshot({ path: `${SHOTS}/showhome-${short}-2.jpg`, quality: 82 })
    await p.evaluate(() => window.__chadverse.shotCam(null))
  }
  // walk through the room with ordinary keys: forward for 2 s, then out via the door (back to it, E)
  await p.keyboard.down('w')
  await wait(1800)
  await p.keyboard.up('w')
  await p.keyboard.down('s')
  await wait(2600)
  await p.keyboard.up('s')
  await wait(300)
  await p.keyboard.press('e')
  await p.waitForFunction(() => window.__chadverse.phase === 'world', null, { timeout: 40000 }).catch(() => {})
  const w = await p.evaluate(() => window.__chadverse.world())
  check((await ph()) === 'world' && Math.hypot(w.x - x, w.z - z) < 8, `${short}: walking out returns to the street outside (${w?.x?.toFixed(1)}, ${w?.z?.toFixed(1)})`)
}
check(!errs.length, `no page errors ${JSON.stringify(errs.slice(0, 2))}`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
