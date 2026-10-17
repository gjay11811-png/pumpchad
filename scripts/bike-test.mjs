// Riding with ORDINARY KEYS in a simulated browser (headless software GL — not a real phone, not a real GPU).
// The game renders ~1-2 fps there, so game time is advanced with the QA hook __chadverse.advance(sec) (fixed 60 Hz World.update, no rendering).
// Key presses are real keyboard events; the checks read the game's state.
//   mount → accelerate → steer → brake / reverse → rear brake → held wheelie with small corrections → rear-brake touchdown →
//   loop-out + recovery → wall → dismount → remount → pause/dismount release inputs.      KIND=surron|street node scripts/bike-test.mjs
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const KIND = process.env.KIND || 'surron'
const SPECIES = process.env.SPECIES || ''
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
if (SPECIES) await p.click(`[data-testid=species-${SPECIES}]`)
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Rider')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const B = () => p.evaluate(() => window.__chadverse.bike())
const W = () => p.evaluate(() => window.__chadverse.world())
const adv = (s) => p.evaluate((s) => window.__chadverse.advance(s), s)
/** advance game time in 0.1 s slices until fn(state) is true (or maxSec passes); returns the state it ended on */
const until = async (fn, maxSec = 20, dt = 0.1) => {
  let s = await B()
  for (let t = 0; t < maxSec; t += dt) {
    if (fn(s)) return { ok: true, s }
    await adv(dt)
    s = await B()
  }
  return { ok: fn(s), s }
}
const set = (o) => p.evaluate((o) => window.__chadverse.setBike(o), o)
const down = (k) => p.keyboard.down(k)
const up = (k) => p.keyboard.up(k)
const deg = (r) => ((r * 180) / Math.PI).toFixed(0)
const parked = (await B()).parked.find((x) => x.kind === KIND)

/* 1. mount */
await p.evaluate(([x, z]) => window.__chadverse.teleport(x, z - 1.6, Math.PI), [parked.x, parked.z])
await adv(0.3)
check((await W()).prompt === `ride:${KIND}`, `walking up to the ${KIND} offers "Ride" (${(await W()).prompt})`)
await p.keyboard.press('e')
check((await until((s) => s.riding && s.phase === 'riding', 4)).ok, 'E mounts: the rider swings on and the bike is live')

/* open ground: the main avenue toward the gate, heading +z */
await set({ x: 0, z: 14, h: 0, v: 0 })
await adv(0.5)

/* 2a. Gas taps never lift the front (no gas-tap wheelies); the Wheelie key (Shift) does */
let tapPeak = 0
for (let k = 0; k < 4; k++) {
  await down('w')
  await adv(0.15)
  await up('w')
  for (let i = 0; i < 4; i++) {
    await adv(0.1)
    tapPeak = Math.max(tapPeak, (await B()).pitch)
  }
}
check(tapPeak === 0 && !(await B()).crashed, `Gas taps never lift the front (peak ${deg(tapPeak)}°)`)
await set({ x: 0, z: 14, h: 0, v: 0 })
await adv(0.4)
await p.keyboard.press('Shift')
const lifted = await until((s) => s.pitch > 0.25, 5, 0.1)
check(lifted.ok && (await B()).wheelieOn, `pressing Wheelie (Shift) once from a standstill lifts the front (${deg(lifted.s.pitch)}°)`)
await p.keyboard.press('Shift')
const lowered0 = await until((s) => s.pitch < 0.03, 8, 0.1)
check(lowered0.ok && !(await B()).wheelieOn, 'pressing Wheelie again lowers it')
await set({ x: 0, z: 14, h: 0, v: 0 })
await adv(0.4)
/* 2b. holding the gas pulls away normally (the front stays on the road after a tiny hop): camera comes round behind */
await down('w')
const a4 = await until((s) => s.v > 4, 10)
const a9 = await until((s) => s.v > 9, 15)
check(a4.ok && a9.ok, `W accelerates progressively (${a4.s.v.toFixed(1)} m/s after ${a4.ok ? '' : 'timeout'}; ${a9.s.v.toFixed(1)} m/s)`)
await adv(2.5)
const bs = await B()
const wd = await W()
const dyaw = Math.atan2(Math.sin(wd.camYaw - (bs.heading + Math.PI)), Math.cos(wd.camYaw - (bs.heading + Math.PI)))
check(Math.abs(dyaw) < 0.7, `the follow camera sits behind the bike (off by ${deg(dyaw)}°)`)
await up('w')
await adv(2)
check((await B()).v < bs.v && (await B()).v > 0, `releasing the throttle rolls off smoothly (${bs.v.toFixed(1)} → ${(await B()).v.toFixed(1)} m/s)`)

/* 3. steering and grip */
await set({ x: 0, z: 14, h: 0, v: 12 })
const h0 = (await B()).heading
await down('w')
await down('d')
const tr = await until((s) => Math.abs(s.heading - h0) > 0.5, 6)
const turn = tr.s
check(Math.abs(turn.heading - h0) > 0.4 && turn.roll > 0.05, `D turns right and the bike leans in (heading ${(turn.heading - h0).toFixed(2)}, lean ${deg(turn.roll)}°)`)
check(Math.abs(turn.latAccel) <= (KIND === 'street' ? 11.3 : 9.6) && turn.crashed === null, `grip holds: ${turn.latAccel.toFixed(1)} m/s² ≤ the limit, no crash`)
await up('d')
await down('a')
const tl = await until((s) => s.heading > turn.heading + 0.3, 6)
check(tl.ok && tl.s.roll < turn.roll, 'A turns back left (the lean follows)')
await up('a')
await up('w')

/* 4. brake, then reverse; the rear brake is gentler */
await set({ x: 0, z: 14, h: 0, v: 14 })
await down(' ')
await adv(0.8)
const rvS = await B()
const rv = rvS.v
if (rv < 6) console.log('   rear-brake probe', JSON.stringify(rvS))
await up(' ')
await set({ x: 0, z: 14, h: 0, v: 14 })
await down('s')
await adv(0.8)
const fv = (await B()).v
const stopped = await until((s) => s.v < 0.4, 8)
check(rv > fv + 1 && stopped.ok, `S brakes to a stop; Space (rear brake only) is gentler (${rv.toFixed(1)} vs ${fv.toFixed(1)} m/s after 0.8 s)`)
const rev = await until((s) => s.v < -0.8, 6)
check(rev.s.v < -0.6, `holding S at a standstill reverses (${rev.s.v.toFixed(2)} m/s)`)
await up('s')

const keys = { w: false, s: false, ' ': false }
const press = async (k, on) => {
  if (keys[k] === on) return
  keys[k] = on
  await (on ? down(k) : up(k))
}
/* 5. a wheelie held for ten seconds with modest corrections (a small script on the real keys: a little Gas when it sinks, a touch of Brake when it climbs) */
await set({ x: 0, z: 10, h: 0, v: 3 })
await adv(0.3)
await p.keyboard.press('Shift')
let upTime = 0
let maxP = 0
let crashed = false
let minAfter = 9
for (let t = 0; t < 10.5; t += 0.1) {
  const s = await B()
  if (s.crashed) {
    crashed = true
    break
  }
  maxP = Math.max(maxP, s.pitch)
  if (s.pitch > 0.17) upTime += 0.1
  if (t > 1) minAfter = Math.min(minAfter, s.pitch)
  if (s.z > 66) await set({ x: 0, z: 10, v: Math.min(s.v, 6) })
  await press('w', s.pitch < 0.4 && t > 0.8 && s.v < 9)
  await press('s', s.pitch > 0.75)
  await adv(0.1)
}
await press('w', false)
await press('s', false)
check(!crashed && upTime > 9.0 && maxP < 1.0 && minAfter > 0.1, `a wheelie held for 10 s with modest corrections (${upTime.toFixed(1)} s up, peak ${deg(maxP)}°, no fall)`)

/* 5b. steering in the wheelie, both ways */
for (const [key, sign] of [['d', -1], ['a', 1]]) {
  await set({ x: 0, z: 10, h: 0, v: 4 })
  await adv(0.3)
  const hd = (await B()).heading
  await down(key)
  let pmin = 9
  for (let i = 0; i < 12; i++) {
    const s = await B()
    pmin = Math.min(pmin, s.pitch)
    if (s.z > 66) await set({ x: 0, z: 10, v: 4 })
    await press('w', s.pitch < 0.4 && s.v < 7)
    await adv(0.1)
  }
  await up(key)
  const h1 = (await B()).heading
  check(Math.sign(h1 - hd) === sign && Math.abs(h1 - hd) > 0.05 && !(await B()).crashed && pmin > 0.1, `steering ${key === 'd' ? 'right' : 'left'} in a wheelie turns that way (${(h1 - hd).toFixed(2)} rad) with the front up (min ${deg(pmin)}°)`)
}
await press('w', false)

/* 6. Gas raises it into a rear-fender scrape, a short Brake press brings it back; Brake lowers it; the touchdown is soft */
await set({ x: 0, z: 10, h: 0, v: 4 })
await adv(0.5)
if (!(await B()).wheelieOn) await p.keyboard.press('Shift')
await adv(1.5)
await down('w')
let scr = false
for (let i = 0; i < 60 && !scr; i++) {
  const s = await B()
  if (s.z > 66) await set({ x: 0, z: 10, v: 5 })
  if (s.scrape && s.scrape.part === 'tail') scr = true
  await adv(0.1)
}
check(scr, 'holding Gas in a wheelie leans it back until the rear fender scrapes')
let scrapeT = 0
for (let i = 0; i < 15; i++) {
  const s = await B()
  if (s.z > 66) await set({ x: 0, z: 10, v: 5 })
  if (s.scrape && s.scrape.part === 'tail') scrapeT += 0.1
  await adv(0.1)
}
check(scrapeT > 1.0 && !(await B()).crashed, `the scrape is sustained (${scrapeT.toFixed(1)} s) without a crash`)
await up('w')
await down('s')
await adv(0.3)
await up('s')
const off = await until((s) => !(s.scrape && s.scrape.part === 'tail'), 3, 0.1)
check(off.ok && !(await B()).crashed && (await B()).wheelieOn, `a short Brake press brings it off the scrape back into the wheelie (${deg((await B()).pitch)}°)`)
await down('s')
let td = 0
const lowered = await until((s) => ((td = Math.max(td, s.touchdown)), s.pitch < 0.02), 8, 0.05)
await up('s')
check(lowered.ok && !(await B()).crashed, 'Brake lowers the wheelie to the ground')
check(td < 2.6, `smooth touchdown (impact ${td.toFixed(2)} rad/s); fork compressed ${lowered.s.forkC.toFixed(3)} m`)
await until((s) => s.v < 1.5, 12)
await set({ x: 0, z: 10, h: 0, v: 0 })
await adv(0.5)

/* 7. FULL throttle held from a standstill: plain acceleration, front on the road, no hop, no lock */
await set({ x: 0, z: 10, h: 0, v: 0 })
await down('w')
let maxHold = 0
for (let t = 0; t < 3; t += 0.1) {
  maxHold = Math.max(maxHold, (await B()).pitch)
  await adv(0.1)
}
await up('w')
check(maxHold === 0 && !(await B()).crashed, `holding full throttle is plain acceleration: the front never leaves the road (${deg(maxHold)}°)`)
await until((s) => s.v < 1.5 && s.pitch < 0.02, 12)

/* 8. a wall: a slow bump just stops you, a fast one is a crash */
await set({ x: 12, z: 52, h: 0, v: 6 })
await down('w')
const wl = await until((s) => s.z > 66 || s.v < 1.2 || s.phase === 'crashed', 8)
await up('w')
check(wl.s.z < 64.9 && Math.abs(wl.s.v) < 7, `a wall stops the bike instead of letting it through (z ${wl.s.z.toFixed(1)}, v ${wl.s.v.toFixed(1)})`)
await set({ x: 12, z: 48, h: 0, v: 16 })
await down('w')
const hit = await until((s) => s.phase === 'crashed', 8)
await up('w')
check(hit.ok, 'a fast impact is a crash (then recovered like the loop-out)')
const rc = await until((s) => s.phase === 'riding' && !s.crashed, 8)
console.log('   recovery', rc.ok, rc.s.phase, rc.s.crashed, rc.s.v)
check(rc.ok && Math.abs(rc.s.v) < 1.2, 'after a crash the bike is stood back up and the rider is on it again (recovery)')

/* 9. dismount at a standstill, remount; pause / dismount leave no held inputs */
await set({ x: 0, z: 14, h: 0, v: 0 })
await adv(0.6)
await down('w')
await adv(0.3)
await up('w')
await set({ x: 0, z: 14, h: 0, v: 0 })
await until((s) => s.pitch < 0.02, 8, 0.1) // (a tap on the gas lifts the front for a moment: you cannot get off until it is down)
await set({ x: 0, z: 14, h: 0, v: 0 })
await adv(0.3)
await p.keyboard.press('e')
check((await until((s) => !s.riding, 4)).ok, 'E at a standstill gets off')
await adv(0.4)
const w2 = await W()
check(w2.prompt === `ride:${KIND}` || Math.hypot(w2.x - 0, w2.z - 14) < 2.5, `the rider stands beside the bike (${w2.x.toFixed(1)}, ${w2.z.toFixed(1)}) and can climb back on (${w2.prompt})`)
await p.keyboard.press('e')
console.log('   before remount', JSON.stringify(await W()).slice(0, 300), JSON.stringify((await B()).parked))
check((await until((s) => s.riding, 4)).ok, 'E remounts')
await down('w')
await p.evaluate(() => window.dispatchEvent(new Event('blur')))
await adv(0.5)
const bl = await B()
if (!bl.inputs) console.log('   not riding', JSON.stringify(bl))
check(bl.inputs.thr < 0.05, `losing window focus releases the throttle (thr ${bl.inputs.thr})`)
await up('w')

check(errs.length === 0, `no page errors (${JSON.stringify(errs.slice(0, 2))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
