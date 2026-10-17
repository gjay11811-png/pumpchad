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

/* 2a. the gas lifts the front even from a standstill, and the bike only creeps while it is up */
await down('w')
const lift0 = await until((s) => s.pitch > 0.3, 5, 0.05)
const creepV = (await B()).v
check(lift0.ok && creepV < 3.5 && !(await B()).crashed, `gas from a standstill lifts the front (${deg(lift0.s.pitch)}°) and the bike only creeps (${creepV.toFixed(1)} m/s)`)
await up('w')
await until((s) => s.pitch < 0.02, 8, 0.1)
await until((s) => s.v < 0.3, 12, 0.2)
/* 2b. with the rider's weight held forward (C) the front stays planted and the bike accelerates away: camera comes round behind */
await down('c')
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

/* 3. steering and grip (front planted with C held, as above) */
await down('c')
await set({ x: 0, z: 14, h: 0, v: 12 })
const h0 = (await B()).heading
await down('w')
await down('d')
const tr = await until((s) => Math.abs(s.heading - h0) > 0.5, 6)
const turn = tr.s
check(Math.abs(turn.heading - h0) > 0.4 && turn.roll > 0.05, `D turns right and the bike leans in (heading ${(turn.heading - h0).toFixed(2)}, lean ${deg(turn.roll)}°)`)
check(Math.abs(turn.latAccel) <= 9.6 && turn.crashed === null, `grip holds: ${turn.latAccel.toFixed(1)} m/s² ≤ the limit, no crash`)
await up('d')
await down('a')
const tl = await until((s) => s.heading > turn.heading + 0.3, 6)
check(tl.ok && tl.s.roll < turn.roll, 'A turns back left (the lean follows)')
await up('a')
await up('w')

await up('c')
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

/* 5. a held wheelie: a small reactive player on the keys (labelled: the "player" is a script, so this shows it is possible, not how it feels) */
await set({ x: 0, z: 10, h: 0, v: 7 })
const keys = { w: false, s: false, ' ': false }
const press = async (k, on) => {
  if (keys[k] === on) return
  keys[k] = on
  await (on ? down(k) : up(k))
}
await press('w', true)
/** a small reactive rider: GAS alone lifts the front (no lift button); ease off to hold the angle, touch Brake if it climbs too far */
const player = async (s) => {
  const predicted = s.pitch + s.pitchRate * 0.25
  await press('w', predicted < 0.38 && s.v < 22)
  await press('s', predicted > 0.5)
}
await set({ x: 0, z: 10, h: 0, v: 4 })
let held = 0
let maxP = 0
let crashed = false
for (let t = 0; t < 20; t += 0.05) {
  const s = await B()
  if (!s.riding || s.crashed) {
    crashed = !!s.crashed
    break
  }
  maxP = Math.max(maxP, s.pitch)
  if (s.pitch > 0.3) held = Math.max(held, s.wheelieTime)
  if (s.z > 70) await set({ x: 0, z: 10 })
  await player(s)
  if (held > 4) break
  await adv(0.05)
}
check(maxP > 0.3 && !crashed, `the gas alone lifts the front wheel (peak ${deg(maxP)}°) without a crash`)
check(held > 3, `the wheelie can be held with small corrections (${held.toFixed(1)} s up)`)

/* 5b. a gentle steer in the wheelie */
if ((await B()).z > 55) await set({ x: 0, z: 10 })
let hd = (await B()).heading
if ((await B()).pitch > 0.2) {
  await down('d')
  for (let i = 0; i < 12; i++) {
    const s = await B()
    if (s.z > 70) await set({ x: 0, z: 10 })
    await player(s)
    await adv(0.05)
  }
  await up('d')
  console.log('   steer', JSON.stringify(await B()).slice(0, 260))
  check(Math.abs((await B()).heading - hd) > 0.02 && !(await B()).crashed, `a gentle steer works mid-wheelie (heading ${((await B()).heading - hd).toFixed(2)} rad)`)
}
await press('w', false)
await press('s', false)
await press(' ', false)

/* 6. the rear brake lowers it; the touchdown is soft */
await set({ x: 0, z: 10, h: 0, v: 8 })
await press('w', true)
await until((s) => s.pitch > 0.3 || s.crashed, 6, 0.05)
await press('w', false)
const before = await B()
await down('s')
let td = 0
const lowered = await until((s) => ((td = Math.max(td, s.touchdown)), s.pitch < 0.02), 8, 0.05)
await up('s')
check(before.pitch > 0.2 && lowered.ok, `easing off and touching Brake brings the front wheel down (from ${deg(before.pitch)}°)`)
check(td < 2.6, `smooth touchdown (impact ${td.toFixed(2)} rad/s); fork compressed ${lowered.s.forkC.toFixed(3)} m`)

/* 7. FULL throttle held from a standstill climbs through the balance point and goes over backwards (it no longer parks at an angle); easing off before that settles it */
await set({ x: 0, z: 10, h: 0, v: 0 })
await down('w')
let over = false
let maxHold = 0
for (let t = 0; t < 7 && !over; t += 0.1) {
  const s0 = await B()
  if (s0.crashed) over = true
  maxHold = Math.max(maxHold, s0.pitch)
  await adv(0.1)
}
await up('w')
check(over && maxHold > 1.2, `holding full throttle takes the front past the balance point and over backwards (peak ${deg(maxHold)}°)`)
await until((s) => s.phase === 'riding' && !s.crashed, 8)
await set({ x: 0, z: 10, h: 0, v: 0 })
await down('w')
await until((s) => s.pitch > 0.7 || s.crashed, 6, 0.05)
await up('w')
const settled = await until((s) => s.pitch < 0.03, 8, 0.1)
check(settled.ok && !settled.s.crashed, `easing off at 40° settles the front back down (${settled.s.crashed ?? deg(settled.s.pitch) + '°'})`)
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
