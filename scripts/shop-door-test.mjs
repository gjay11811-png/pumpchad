// Arcade Street shops: every door still opens its interior after the two end shops moved (walk up, press E, arrive inside, leave). SIMULATED browser.
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 900, height: 600 } })
let fails = 0
const check = (ok, msg) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!ok) fails++
}
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'] }, settings: { quality: 'low', muted: true } })))
await p.goto(BASE)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Shopper')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const wait = (ms) => p.waitForTimeout(ms)
// [id, doorX, doorZ, face yaw, half, out]
const SHOPS = [
  ['supply', 32.9, 12.2, 0, 3.0, 0.85],
  ['snacks', 39.1, 12.0, 0, 3.1, 0.85],
  ['cuts', 32.9, 26.0, Math.PI, 3.0, 0.85],
  ['fits', 39.1, 26.0, Math.PI, 3.0, 0.85],
]
for (const [id, x, z, yaw, half, out] of SHOPS) {
  const o = half + out
  await p.evaluate(([x, z, yaw]) => window.__chadverse.teleport(x, z, yaw), [x + Math.sin(yaw) * o, z + Math.cos(yaw) * o, yaw + Math.PI])
  await wait(900)
  const prompt = (await p.evaluate(() => window.__chadverse.world())).prompt
  check(prompt === `house:${id}` || String(prompt).includes(id), `${id}: the door prompt shows at the new door (${prompt})`)
  await p.keyboard.press('e')
  await p.waitForFunction(() => window.__chadverse.phase === 'interior', null, { timeout: 30000 }).catch(() => {})
  const ph = await p.evaluate(() => window.__chadverse.phase)
  check(ph === 'interior', `${id}: pressing E enters the interior (phase ${ph})`)
  if (ph === 'interior') {
    await p.keyboard.down('s')
    await wait(1800)
    await p.keyboard.up('s')
    await wait(400)
    await p.keyboard.press('e')
    await p.waitForFunction(() => window.__chadverse.phase === 'world', null, { timeout: 30000 }).catch(() => {})
    const back = await p.evaluate(() => [window.__chadverse.phase, window.__chadverse.world()?.x, window.__chadverse.world()?.z])
    check(back[0] === 'world' && Math.hypot(back[1] - x, back[2] - z) < 10, `${id}: walking out returns to the street outside the same shop (${back.map((v) => (typeof v === 'number' ? v.toFixed(1) : v)).join(', ')})`)
  }
}
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
