// Normal-movement stair check: no teleports after entering. From the door spawn the walker strafes/walks with real key presses to the
// stair foot, climbs to the upper floor, crosses the landing, and walks back down. Steering is closed-loop on the reported position.
//   ID=manor URL=http://localhost:4318/chadverse/ node scripts/stairs-test.mjs
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:4318/chadverse/'
const ID = process.env.ID || 'manor'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 900, height: 600 } })
const errs = []
let fails = 0
const check = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails++ }
p.on('pageerror', (e) => errs.push(e.message))
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: {}, settings: { quality: 'low', muted: true } })))
await p.goto(BASE)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Explorer')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 90000 })
const C = (fn, ...a) => p.evaluate(([f, a]) => window.__chadverse[f](...a), [fn, a])
const hold = async (k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); await p.waitForTimeout(120) }
const houses = await C('houses')
const h = houses.find((x) => x.id === ID)
await C('teleport', h.door.x, h.door.z, h.door.yaw + Math.PI) // outside only: the walk-up to the door is covered elsewhere
await p.waitForTimeout(900)
await p.keyboard.press('e')
await p.waitForFunction(() => window.__chadverse.phase === 'interior' && window.__chadverse.interior(), null, { timeout: 40000 })
await p.waitForTimeout(600)
const L = h.room.loft
const tx = (L.stair.x0 + L.stair.x1) / 2
let s = await C('interior')
console.log(`  spawn (${s.x}, ${s.z}) yaw ${s.yaw}; stair x ${tx}, foot z ${L.stair.zb}`)
// the stair is entered from its foot: back off toward the door wall until we are level with (or past) the foot, then line up
for (let i = 0; i < 12 && s.z < L.stair.zb + 0.15; i++) { await hold('s', 250); s = await C('interior') }
console.log(`  at the foot: (${s.x}, ${s.z})`)
// steer in x with strafe keys until over the stair lane (try both signs by watching the result)
for (let i = 0; i < 14 && Math.abs(s.x - tx) > 0.35; i++) {
  const before = s.x
  await hold(s.x < tx ? 'd' : 'a', 400)
  s = await C('interior')
  console.log(`    strafe: x ${before} -> ${s.x} (z ${s.z})`)
}
check(Math.abs(s.x - tx) <= 0.6, `lines up with the stair by walking (x ${s.x} vs ${tx})`)
// walk toward the stair top; the stair is entered from its foot, so go to the foot first if we are not already past it
let t0 = Date.now()
while (Date.now() - t0 < 30000) {
  s = await C('interior')
  if (s.level === 1 && s.y > L.y - 0.3) break
  await hold('w', 500)
}
s = await C('interior')
check(s.level === 1 && s.y > L.y - 0.3, `climbs to the upper floor by normal movement (level ${s.level}, y ${s.y})`)
await hold('w', 900)
const top = await C('interior')
check(top.level === 1, `stays on the upper floor and walks the landing (z ${top.z})`)
// come back down: turn around and walk
await hold('s', 600)
t0 = Date.now()
let prev = null
while (Date.now() - t0 < 30000) {
  s = await C('interior')
  if (s.level === 0 && s.y < 0.2) break
  await hold('s', 500)
}
s = await C('interior')
check(s.level === 0 && s.y < 0.2, `walks back down to the ground floor (level ${s.level}, y ${s.y})`)
check(!errs.length, `no page errors (${JSON.stringify(errs.slice(0, 2))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
