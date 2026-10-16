// Riding with ORDINARY KEYS in a simulated browser (headless software GL — not a real phone, not a real GPU, and the frame rate is low, so every wait polls the game's state).
//   mount → camera follows → accelerate → steer → brake / reverse → rear brake → a held wheelie (a little reactive "player" on the keys) → rear-brake touchdown →
//   loop-out crash and recovery → wall collision → dismount → remount.        KIND=surron|street node scripts/bike-test.mjs
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const KIND = process.env.KIND || 'surron'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] })
const p = await b.newPage({ viewport: { width: 800, height: 450 } })
const errs = []
let fails = 0
const check = (ok, msg) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!ok) fails++
}
p.on('pageerror', (e) => errs.push(e.message))
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'], xp: 800 }, settings: { quality: 'low', muted: true } })))
await p.goto(BASE + '?sky=day')
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Rider')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const B = () => p.evaluate(() => window.__chadverse.bike())
const W = () => p.evaluate(() => window.__chadverse.world())
const until = async (fn, ms = 60000) => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    if (await fn()) return true
    await p.waitForTimeout(60)
  }
  return false
}
const set = (o) => p.evaluate((o) => window.__chadverse.setBike(o), o)
const down = (k) => p.keyboard.down(k)
const up = (k) => p.keyboard.up(k)
const parked = (await B()).parked.find((x) => x.kind === KIND)

/* 1. mount */
await p.evaluate(([x, z]) => window.__chadverse.teleport(x, z - 1.6, Math.PI), [parked.x, parked.z])
await until(async () => (await W()).prompt === `ride:${KIND}`, 8000)
check((await W()).prompt === `ride:${KIND}`, `walking up to the ${KIND} offers "Ride" (${(await W()).prompt})`)
await p.keyboard.press('e')
check(await until(async () => (await B()).riding && (await B()).phase === 'riding'), 'E mounts: the rider swings on and the bike is live')

/* open ground: the main avenue toward the gate, heading +z */
await set({ x: 0, z: 14, h: 0, v: 0 })
await p.waitForTimeout(500)

/* 2. accelerate smoothly, camera comes round behind */
await down('w')
await until(async () => (await B()).v > 4)
const v4 = (await B()).v
await until(async () => (await B()).v > 9)
const v9 = (await B()).v
check(v4 > 3 && v9 > 8 && Number.isFinite(v9), `W accelerates (${v4.toFixed(1)} → ${v9.toFixed(1)} m/s)`)
const bs = await B()
const wd = await W()
let dyaw = Math.atan2(Math.sin(wd.camYaw - (bs.heading + Math.PI)), Math.cos(wd.camYaw - (bs.heading + Math.PI)))
check(Math.abs(dyaw) < 0.7, `the follow camera sits behind the bike (off by ${((dyaw * 180) / Math.PI).toFixed(0)}°)`)
await up('w')

/* 3. steering and grip */
await set({ x: 0, z: 14, h: 0, v: 12 })
const h0 = (await B()).heading
await down('w')
await down('d')
await until(async () => Math.abs((await B()).heading - h0) > 0.5, 30000)
const turn = await B()
check(Math.abs(turn.heading - h0) > 0.4 && turn.latAccel > 0 && turn.roll > 0.05, `D turns right and the bike leans in (heading ${(turn.heading - h0).toFixed(2)}, lean ${((turn.roll * 180) / Math.PI).toFixed(0)}°)`)
check(Math.abs(turn.latAccel) <= 9.6 && turn.crashed === null, `grip holds: ${turn.latAccel.toFixed(1)} m/s² ≤ the limit, no slide / crash`)
await up('d')
await down('a')
await until(async () => (await B()).heading < turn.heading - 0.3, 30000)
check((await B()).roll < turn.roll, 'A turns back left (the lean follows)')
await up('a')
await up('w')

/* 4. brake, then reverse; the rear brake is gentler */
await set({ x: 0, z: 14, h: 0, v: 14 })
await down(' ')
await p.waitForTimeout(800)
const rv = (await B()).v
await up(' ')
await set({ x: 0, z: 14, h: 0, v: 14 })
await down('s')
await until(async () => (await B()).v < 0.4, 30000)
check(rv > 5 && (await B()).v < 0.5, `S brakes to a stop; Space (rear brake only) is gentler (${rv.toFixed(1)} m/s after the same time)`)
await until(async () => (await B()).v < -0.8, 30000)
check((await B()).v < -0.6, `holding S at a standstill reverses (${(await B()).v.toFixed(2)} m/s)`)
await up('s')

/* 5. a held wheelie: a little reactive player on the keys */
await set({ x: 0, z: 10, h: 0, v: 7 })
await down('w')
await down('Shift')
const keys = { w: true, Shift: true }
const press = async (k, on) => {
  if (keys[k] === on) return
  keys[k] = on
  await (on ? down(k) : up(k))
}
let up2 = 0
let maxP = 0
let crashed = false
const tHold = Date.now()
while (Date.now() - tHold < 40000) {
  const s = await B()
  if (!s.riding || s.crashed) {
    crashed = !!s.crashed
    break
  }
  maxP = Math.max(maxP, s.pitch)
  if (s.pitch > 0.3) up2 = Math.max(up2, s.wheelieTime)
  if (s.z > 70) await set({ x: 0, z: 10 }) // keep the run going on open ground
  const want = s.balance * 0.78
  await press('Shift', s.pitch < want * 0.7 && s.wheelieTime < 0.9)
  await press('w', s.pitch < want * 1.05 && s.v < 20)
  if (up2 > 3.4) break
}
check(maxP > 0.3 && !crashed, `throttle + Shift lifts the front wheel (peak ${((maxP * 180) / Math.PI).toFixed(0)}°) without a crash`)
check(up2 > 2.5, `the wheelie can be HELD with small key corrections (${up2.toFixed(1)} s up)`)
await press('w', false)
await press('Shift', false)
/* 6. the rear brake lowers it; the touchdown is soft */
const before = await B()
await down(' ')
let td = 0
let jump = 0
let last = before.pitch
const tDown = Date.now()
while (Date.now() - tDown < 30000) {
  const s = await B()
  td = Math.max(td, s.touchdown)
  jump = Math.max(jump, Math.abs(s.pitch - last))
  last = s.pitch
  if (s.pitch < 0.01) break
}
await up(' ')
check(before.pitch > 0.2 && last < 0.05, `Space (rear brake) brings the front wheel down (from ${((before.pitch * 180) / Math.PI).toFixed(0)}°)`)
check(td < 2.6, `smooth touchdown (impact ${td.toFixed(2)} rad/s); the fork compressed ${(await B()).forkC.toFixed(3)} m after`)
void jump

/* 7. over-hold → loop-out → the bike is righted and the rider is back on it */
await set({ x: 0, z: 10, h: 0, v: 7 })
await down('w')
await down('Shift')
const gotCrash = await until(async () => (await B()).phase === 'crashed', 60000)
await up('Shift')
await up('w')
check(gotCrash && (await B()).crashed === 'loop', `holding the heave too long loops the bike out (${(await B()).crashed})`)
const recovered = await until(async () => (await B()).phase === 'riding' && !(await B()).crashed, 60000)
check(recovered && Math.abs((await B()).v) < 0.5, 'the bike is stood back up and the rider is on it again (recovery)')

/* 8. a wall: a slow bump just stops you, a fast one is a crash */
await set({ x: 12, z: 52, h: 0, v: 6 })
await down('w')
await until(async () => (await B()).z > 60 || (await B()).v < 1.2, 30000)
const bump = await B()
await up('w')
check(bump.z < 64.9 && Math.abs(bump.v) < 7, `a wall stops the bike instead of letting it through (z ${bump.z}, v ${bump.v})`)
await set({ x: 12, z: 50, h: 0, v: 16 })
await down('w')
const hardHit = await until(async () => (await B()).phase === 'crashed', 30000)
await up('w')
check(hardHit, 'a fast impact is a crash (then recovered like the loop-out)')
await until(async () => (await B()).phase === 'riding' && !(await B()).crashed, 60000)

/* 9. dismount at a standstill, remount */
await set({ x: 0, z: 14, h: 0, v: 0 })
await p.waitForTimeout(600)
await p.keyboard.press('e')
check(await until(async () => !(await B()).riding, 30000), 'E at a standstill gets off')
const w2 = await W()
check(w2.prompt === `ride:${KIND}` || Math.hypot(w2.x - 0, w2.z - 14) < 2.5, `the rider stands beside the bike (${w2.x.toFixed(1)}, ${w2.z.toFixed(1)}) and can climb back on (${w2.prompt})`)
await p.keyboard.press('e')
check(await until(async () => (await B()).riding, 20000), 'E remounts')

check(errs.length === 0, `no page errors (${JSON.stringify(errs.slice(0, 2))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
