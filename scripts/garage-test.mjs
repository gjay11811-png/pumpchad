// Chad Motors Service: walk to the reception door (ordinary keys), enter, look round (photo cameras), talk to Dex, walk out. SIMULATED browser.
//   SHOTS=dir node scripts/garage-test.mjs
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const SHOTS = process.env.SHOTS || ''
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1100, height: 650 } })
let fails = 0
const check = (ok, msg) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!ok) fails++
}
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
p.on('console', (m) => { if (process.env.CON && ['error', 'warning'].includes(m.type())) console.log('  console', m.type(), m.text().slice(0, 300)) })
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'], xp: 800 }, settings: { quality: 'low', muted: true } })))
await p.goto(BASE)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Visitor')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const wait = (ms) => p.waitForTimeout(ms)
const ph = () => p.evaluate(() => window.__chadverse.phase)
await p.evaluate(([x, z]) => window.__chadverse.teleport(x, z, Math.PI), [+(process.env.DX || 72.4), +(process.env.DZ || 43.2)])
await wait(900)
const prompt = (await p.evaluate(() => window.__chadverse.world())).prompt
check(prompt?.startsWith('house:'), `the reception door offers the interior (${prompt})`)
await p.keyboard.press('e')
await p.waitForFunction(() => window.__chadverse.phase === 'interior', null, { timeout: 40000 }).catch(() => {})
check((await ph()) === 'interior', 'E enters the garage')
if ((await ph()) === 'interior') {
  await wait(1500)
  if (SHOTS) {
    const views = [
      ['garage-1', [5.5, 3.0, 3.8], [-2.5, 1.5, -1.5], 66],
      ['garage-2', [-5.8, 2.2, 3.6], [1.5, 1.1, -2.5], 66],
      ['garage-3', [0.5, 1.6, 4.0], [-2.6, 2.0, -0.6], 60],
      ['garage-4', [1.0, 1.7, 1.0], [5.6, 1.2, 2.0], 62],
    ]
    for (const [n, c, l, f] of views) {
      await p.evaluate(([c, l, f]) => window.__chadverse.shotCam({ cam: c, look: l, fov: f }), [c, l, f])
      await wait(700)
      await p.screenshot({ path: `${SHOTS}/${n}.jpg`, quality: 82 })
    }
    await p.evaluate(() => window.__chadverse.shotCam(null))
  }
  await p.keyboard.down('w')
  await wait(1500)
  await p.keyboard.up('w')
  check((await ph()) === 'interior', 'the room can be walked through with ordinary keys')
  await p.keyboard.down('s')
  await wait(2800)
  await p.keyboard.up('s')
  await wait(300)
  await p.keyboard.press('e')
  await p.waitForFunction(() => window.__chadverse.phase === 'world', null, { timeout: 40000 }).catch(() => {})
  const w = await p.evaluate(() => window.__chadverse.world())
  check((await ph()) === 'world' && Math.hypot(w.x - 72.4, w.z - 43.2) < 8, `E at the door returns to the street outside (${w?.x?.toFixed(1)}, ${w?.z?.toFixed(1)})`)
}
check(errs.length === 0, `no page errors (${JSON.stringify(errs)})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
