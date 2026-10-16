// Continuous riding footage, captured FRAME BY FRAME so it is smooth despite the slow software renderer:
// game time is advanced by hand (QA hook) 1/FPS s at a time, one rendered frame is grabbed, and the JPEGs are piped into Playwright's bundled ffmpeg (VP8 .webm).
// The riding is driven with REAL keyboard events by a small reactive "player" script. It shows what the simulation does under plausible inputs; it says nothing about how it FEELS.
//   KIND=surron|street  SPECIES=''|skeleton|demon  CAM=chase|side  OUT=dir  FPS=15  node scripts/bike-footage.mjs
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const KIND = process.env.KIND || 'surron'
const SPECIES = process.env.SPECIES || ''
const CAM = process.env.CAM || 'chase'
const FPS = +(process.env.FPS || 15)
const OUT = process.env.OUT || '.'
mkdirSync(OUT, { recursive: true })
const SEG = +(process.env.SEG || 1) // the footage is recorded in 4 segments (a fresh browser each; the software renderer runs out of memory in one long take)
const name = `ride-${KIND}${SPECIES ? '-' + SPECIES : '-pumpchad'}-${CAM}-seg${SEG}`
let rec = SEG === 1
const FR = `${OUT}/frames-${name.replace(/-seg\d$/, '')}`
mkdirSync(FR, { recursive: true })

const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] })
const p = await b.newPage({ viewport: { width: 854, height: 480 } })
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
const adv = (s) => p.evaluate((s) => window.__chadverse.advance(s), s)
const set = (o) => p.evaluate((o) => window.__chadverse.setBike(o), o)
const parked = (await B()).parked.find((x) => x.kind === KIND)
await p.evaluate(([x, z]) => window.__chadverse.teleport(x, z - 1.6, Math.PI), [parked.x, parked.z])
await adv(0.4)
await p.evaluate(() => window.__chadverse.freeze(true))

const keys = {}
const press = async (k, on) => {
  if (!!keys[k] === on) return
  keys[k] = on
  await (on ? p.keyboard.down(k) : p.keyboard.up(k))
}
const only = async (...on) => {
  for (const k of ['w', 's', 'a', 'd', 'Shift', ' ']) await press(k, on.includes(k))
}
const log = []
let frames = 0
const grab = async (s) => {
  if (!rec) return
  if (CAM === 'side' && s.riding) {
    const f = [Math.sin(s.heading), Math.cos(s.heading)]
    const r = [Math.cos(s.heading), -Math.sin(s.heading)]
    await p.evaluate(([c, l]) => window.__chadverse.shotCam({ cam: c, look: l, fov: 34 }), [[s.x + r[0] * 3.3 - f[0] * 0.3, 1.0, s.z + r[1] * 3.3 - f[1] * 0.3], [s.x - f[0] * 0.15, 0.85, s.z - f[1] * 0.15]])
  } else if (CAM === 'side') await p.evaluate(() => window.__chadverse.shotCam(null))
  const n0 = await p.evaluate(() => window.__chadverse.renders())
  await p.waitForFunction((n) => window.__chadverse.renders() >= n + 2, n0, { timeout: 60000, polling: 40 })
  let buf
  for (let k = 0; k < 6 && !buf; k++) {
    try {
      buf = await p.screenshot({ type: 'jpeg', quality: 80, timeout: 20000 })
    } catch (e) {
      console.log(`   screenshot retry ${k} at frame ${frames}: ${String(e.message).split(String.fromCharCode(10))[0]}`)
      await p.waitForTimeout(800)
    }
  }
  if (!buf) throw new Error('screenshot failed at frame ' + frames)
  writeFileSync(`${FR}/s${SEG}-${String(frames).padStart(5, '0')}.jpg`, buf)
  frames++
}
/** advance one video frame (real key state stays held) */
const tick = async (driver) => {
  const s = await B()
  if (driver) await driver(s)
  await adv(1 / FPS)
  const s2 = await B()
  await grab(s2)
  log.push({ f: frames, t: +(frames / FPS).toFixed(2), phase: s2.phase, v: s2.v, pitch: s2.pitch, roll: s2.roll, hd: s2.heading, wt: s2.wheelieTime, crashed: s2.crashed })
  return s2
}
const run = async (sec, driver) => {
  let s
  for (let i = 0; i < Math.round(sec * FPS); i++) s = await tick(driver)
  return s
}
/** the reactive wheelie player: heave to start, throttle to hold the nose up, rear brake against going over */
const player = (steer = 0) => async (s) => {
  const pred = s.pitch + s.pitchRate * 0.25
  await press('Shift', s.pitch < s.balance * 0.45 && s.pitchRate < 0.9)
  await press('w', pred < s.balance * 0.82 && s.v < 22)
  await press(' ', pred > s.balance * 0.95)
  await press('d', steer > 0)
  await press('a', steer < 0)
}
const mark = (m) => console.log(`[${(frames / FPS).toFixed(1)}s] ${m}`)

/* 1. mount */
mark('mount')
if (SEG !== 1) {
  await p.keyboard.press('e')
  await adv(1.2)
  rec = true
} else {
await p.keyboard.press('e')
await run(1.2)
await set({ x: 0, z: 12, h: 0, v: 0 })
await run(0.6)
rec = true
}
if (SEG === 1) {
/* 2. pull away, gentle S-bends */
mark('pull away + S-bends')
await only('w')
await run(2.6)
await only('w', 'd')
await run(0.9)
await only('w', 'a')
await run(1.5)
await only('w', 'd')
await run(0.8)
await only('w')
await run(1.0)
/* 3. brake to a stop */
mark('brake to a stop')
await only('s')
await run(2.4)
await only()
await run(0.6)
}
if (SEG === 2) {
/* 4. imperfect attempt: too much lean back + throttle → the bike goes over (loop-out), recovers */
mark('imperfect: over-hold → loop-out')
await set({ x: 0, z: 12, h: 0, v: 5 })
await only('w', 'Shift')
let crashedAt = 0
for (let i = 0; i < 6 * FPS; i++) {
  const s = await tick()
  if (s.phase === 'crashed') {
    crashedAt = i
    break
  }
}
await only()
mark(`loop-out at ${(crashedAt / FPS).toFixed(1)}s; recovering`)
for (let i = 0; i < 6 * FPS; i++) {
  const s = await tick()
  if (s.phase === 'riding' && !s.crashed) break
}
}
if (SEG === 3) {
/* 5. a good attempt: lift, hold with corrections, gentle steer, rear-brake down */
mark('wheelie: lift, hold, steer, lower')
await set({ x: 0, z: 10, h: 0, v: 6 })
await only('w')
await run(0.5)
let up = 0
await run(5.5, async (s) => {
  if (s.z > 66) await set({ x: 0, z: 10 })
  await player(up > 3.2 && up < 4.4 ? 1 : 0)(s)
  up = s.wheelieTime
})
mark('rear brake lowers it')
await only(' ')
await run(2.2)
await only()
await run(1.2)
}
if (SEG === 4) {
/* 6. a half-hearted lift that drops back (imperfect), then ride on and get off */
mark('short lift, drops back; ride on')
await set({ x: 0, z: 12, h: 0, v: 7 })
await only('w', 'Shift')
await run(0.5)
await only('w')
await run(2.2)
await only('s')
await run(2.4)
await only()
await run(0.5)
mark('dismount')
await p.keyboard.press('e')
await run(1.4)
}

writeFileSync(`${OUT}/${name}.json`, JSON.stringify({ fps: FPS, frames, simulated: 'headless software GL, scripted key presses; not real-device feel', log }, null, 0))
console.log(`wrote frames to ${FR} (${frames} frames, ${(frames / FPS).toFixed(1)} s)`)
await b.close()
