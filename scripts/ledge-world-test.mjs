// LEDGES in the open village, with ORDINARY KEYS (SIMULATED headless; game time is stepped, key state is real): approach → jump → catch → hang → shimmy both ways → pull up (or "no room") → stand on top.
// The yard's Workshop is the control (hand-authored); the others are ledges the world scan found (src/game/scenes/world/ledgeData.ts).   KIND=surron-free  SPECIES=''|skeleton|demon  node scripts/ledge-world-test.mjs
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const SPECIES = process.env.SPECIES || ''
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] })
const p = await b.newPage({ viewport: { width: 800, height: 450 } })
let fails = 0
const check = (ok, msg) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!ok) fails++
}
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen', 'visit_parkour'], xp: 800 }, settings: { quality: 'low', muted: true } })))
await p.goto(BASE + '?sky=day')
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
if (SPECIES) await p.click(`[data-testid=species-${SPECIES}]`)
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Climber')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
await p.evaluate(() => window.__chadverse.freeze(true))
const W = () => p.evaluate(() => window.__chadverse.world())
const H = () => p.evaluate(() => window.__chadverse.hang())
const PK = () => p.evaluate(() => window.__chadverse.parkour())
const adv = (s) => p.evaluate((s) => window.__chadverse.advance(s), s)
const tp = (x, z, yaw) => p.evaluate(([x, z, yaw]) => window.__chadverse.teleport(x, z, yaw), [x, z, yaw])
const keys = new Set()
const down = async (k) => { if (!keys.has(k)) { keys.add(k); await p.keyboard.down(k) } }
const up = async (k) => { if (keys.has(k)) { keys.delete(k); await p.keyboard.up(k) } }
const release = async () => { for (const k of [...keys]) await up(k) }
/** step game time in 1/20 s slices until fn() is true (or maxSec) */
const until = async (fn, maxSec = 4) => {
  for (let t = 0; t < maxSec; t += 0.05) {
    if (await fn()) return true
    await adv(0.05)
  }
  return !!(await fn())
}
const shot = async (name) => {
  const n0 = await p.evaluate(() => window.__chadverse.renders())
  await adv(0.02)
  await p.waitForFunction((n) => window.__chadverse.renders() >= n + 2, n0, { timeout: 60000, polling: 40 })
  await p.screenshot({ path: `${process.env.OUT || 'tmp-viewer/ledge'}-${name}.jpg`, type: 'jpeg', quality: 78 })
}

async function ledgeRun(name, o) {
  console.log(`— ${name}`)
  await release()
  await tp(o.from[0], o.from[1], o.yaw)
  await adv(0.6)
  await down('w')
  await down('Shift')
  const near = async () => { const w = await W(); return o.dist(w) <= o.jumpAt }
  check(await until(near, 6), 'sprints up to the wall')
  await down(' ')
  const caught = await until(async () => (await H()).hanging, 1.6)
  await up(' ')
  await up('w')
  await up('Shift')
  check(caught, `the jump catches the ledge (top ${o.top} m)`)
  if (!caught) return
  await until(async () => (await H()).mode === 'hang', 1)
  await adv(0.3)
  let h = await H()
  check(h.mode === 'hang', `hanging (mode ${h.mode}, hang log "${h.log}")`)
  const hand = await p.evaluate(() => window.__chadverse.fist?.() ?? null)
  void hand
  if (o.shot) await shot(`${name}-hang`)
  // shimmy along the ledge (relative to the camera: sideways keys move along the face)
  const s0 = h.s
  await down(o.shimmyKey)
  await adv(0.9)
  await up(o.shimmyKey)
  await adv(0.6) // a hand step in flight finishes
  h = await H()
  check(Math.abs(h.s - s0) > 0.3, `shimmy moves along the ledge (${s0} → ${h.s})`)
  const s1 = h.s
  await down(o.shimmyBack)
  await adv(0.9)
  await up(o.shimmyBack)
  await adv(0.6)
  h = await H()
  check(Math.abs(h.s - s1) > 0.3, `…and back (${s1} → ${h.s})`)
  // pull up
  await down(o.pull)
  const stood = await until(async () => !(await H()).hanging, 1.8)
  await up(o.pull)
  await adv(0.5)
  h = await H()
  if (o.expectPull) {
    const pk = await PK()
    check(stood && Math.abs(pk.y - o.top) < 0.12, `pulls up and stands on top (feet ${pk.y} m, top ${o.top} m)`)
    if (o.shot) await shot(`${name}-top`)
  } else {
    check(h.hanging && /no room/i.test(h.log), `a ledge too thin to stand on is refused: "${h.log}" (the hang can be dropped)`)
    await down('c')
    await adv(0.2)
    await up('c')
    await adv(0.8)
    check(!(await H()).hanging, 'C drops from the hang')
  }
}

// the control: the yard's Workshop (hand-authored, top 2.35), approached west → east along the lane (just past the fence)
await ledgeRun('workshop', { from: [-211.2, 18.4], yaw: Math.PI / 2, dist: (w) => -208 - w.x, jumpAt: 1.0, top: 2.35, shimmyKey: 'd', shimmyBack: 'a', pull: 'w', expectPull: true, shot: true })
// Heights Green: the retaining wall (2.1 m), the taller wall (2.5 m) and the shed roof (2.3 m), approached from the north
await ledgeRun('green-wall-1', { from: [-158, 34], yaw: 0, dist: (w) => 37.6 - w.z, jumpAt: 1.0, top: 2.1, shimmyKey: 'a', shimmyBack: 'd', pull: 'w', expectPull: true, shot: true })
await ledgeRun('green-wall-2', { from: [-142, 34], yaw: 0, dist: (w) => 37.6 - w.z, jumpAt: 1.0, top: 2.5, shimmyKey: 'a', shimmyBack: 'd', pull: 'w', expectPull: true })
await ledgeRun('green-shed', { from: [-128, 29], yaw: 0, dist: (w) => 33 - w.z, jumpAt: 1.0, top: 2.3, shimmyKey: 'a', shimmyBack: 'd', pull: 'w', expectPull: true, shot: true })

// Chad Rides: a crate stair (1.0 → 2.0 m) to the shelter's 3.0 m roof, climbed with plain mantles (jump at each face)
{
  console.log('— rides crate stair → roof')
  await release()
  await tp(4.6, 66.2, Math.PI / 2)
  await adv(0.6)
  const tops = [1.0, 2.0, 3.0]
  let reached = 0
  await down('w')
  for (const top of tops) {
    // walk on until the next face is right ahead, then jump (the traversal system turns a jump at a climbable face into a mantle)
    const faceX = [6.0, 7.3, 8.6][reached]
    await until(async () => faceX - (await W()).x <= 0.7, 4)
    await down(' ')
    await adv(0.12)
    await up(' ')
    const up1 = await until(async () => Math.abs((await PK()).y - top) < 0.05 && !(await PK()).trav, 2.2)
    if (!up1) break
    reached++
    await adv(0.15)
  }
  await up('w')
  check(reached === 3, `mantles up the crate stair onto the 3.0 m roof (${reached}/3 steps, feet ${(await PK()).y} m)`)
  if (reached === 3) await shot('rides-roof-top')
}
check(errs.length === 0, `no page errors (${JSON.stringify(errs.slice(0, 2))})`)
await b.close()
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
process.exit(fails ? 1 : 0)
