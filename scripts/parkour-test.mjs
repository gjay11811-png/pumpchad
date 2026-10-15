// Chad Parkour Yard with ORDINARY keyboard input (W + Shift to run, Space to jump / vault / mantle, E at the start pad).
// Runs the Rookie Run, the Rooftop Run, the hidden room, fall recovery, and checks tall walls are never climbed. SIMULATED browser.
//   URL=http://localhost:5180/chadverse/ SHOTS=dir node scripts/parkour-test.mjs
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const SHOTS = process.env.SHOTS || ''
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1000, height: 640 } })
let fails = 0
const check = (ok, msg) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!ok) fails++
}
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'] }, settings: { quality: 'low', muted: true } })))
await p.goto(BASE)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Runner')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const W = () => p.evaluate(() => window.__chadverse.world())
const PK = () => p.evaluate(() => window.__chadverse.parkour())
const wait = (ms) => p.waitForTimeout(ms)
const tp = (x, z, yaw, y = 0) => p.evaluate(([x, z, yaw, y]) => window.__chadverse.teleport(x, z, yaw, y), [x, z, yaw, y])
const shot = async (name) => {
  await p.addStyleTag({ content: '.panel, [data-testid=objective], [data-testid=parkour-chip] .panel { }' }).catch(() => {})
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}.jpg`, quality: 82, timeout: 120000 })
}
/** hold W + Shift, call `decide(world, parkour)` every ~40 ms; it returns true to press Space; stop when `done(w, pk)` */
const drive = async (decide, done, maxMs = 30000, keys = ['w', 'Shift']) => {
  for (const k of keys) await p.keyboard.down(k)
  const t0 = Date.now()
  let last = 0
  let dbgT = 0
  let stallX = 0
  let stallZ = 0
  let stallT = Date.now()
  const seen = []
  while (Date.now() - t0 < maxMs) {
    const [w, pk] = await Promise.all([W(), PK()])
    if (pk.trav && !seen.includes(pk.trav.kind)) seen.push(pk.trav.kind)
    if (pk.travLog && pk.travLog.kind !== 'none' && !seen.includes(pk.travLog.kind)) seen.push(pk.travLog.kind)
    if (process.env.DEBUG && Date.now() - dbgT > 500) {
      dbgT = Date.now()
      console.log(`    t=${((Date.now() - t0) / 1000).toFixed(1)} x=${w.x.toFixed(2)} z=${w.z.toFixed(2)} y=${pk.y} grounded=${pk.grounded} trav=${pk.trav?.kind ?? '-'} log=${pk.travLog ? pk.travLog.kind + '/' + pk.travLog.why : '-'} cp=${pk.run?.cp} falls=${pk.run?.falls}`)
    }
    if (done(w, pk)) break
    // a stall (pressed too early, hit a wall): a person would jump again
    if (Math.hypot(w.x - stallX, w.z - stallZ) > 0.15) {
      stallX = w.x
      stallZ = w.z
      stallT = Date.now()
    }
    const stalled = Date.now() - stallT > 700 && pk.grounded && !pk.trav
    if (Date.now() - last > 140 && (stalled || decide(w, pk))) {
      stallT = Date.now()
      await p.keyboard.press('Space')
      last = Date.now()
    }
    await wait(25)
  }
  for (const k of keys) await p.keyboard.up(k)
  return seen
}
const press = async (k) => {
  await p.keyboard.press(k)
  await wait(120)
}

/* ── 0. the yard exists and is reachable on foot ── */
await tp(-234, 36, Math.PI) // lane A, facing the entrance gap
await wait(500)
await p.keyboard.down('w')
await p.keyboard.down('Shift')
await wait(2200)
await p.keyboard.up('w')
await p.keyboard.up('Shift')
let w = await W()
check(w.z < 28 && w.z > 5 && Math.abs(w.x + 234) < 6, `walk in through the yard entrance from lane A (now at ${w.x.toFixed(1)}, ${w.z.toFixed(1)})`)
await shot('pk-entrance-inside')

/* ── 0b. the vault animation, frame by frame (stills of the body mid-vault; taken first so no level-up banner is over them) ── */
await p.evaluate(() => window.dispatchEvent(new CustomEvent('chad-parkour-cmd', { detail: 'exit' })))
await tp(-234, 21, Math.PI)
await wait(500)
await p.keyboard.down('w')
await p.keyboard.down('Shift')
let shotTaken = 0
for (let i = 0; i < 80 && shotTaken < 3; i++) {
  const pk = await PK()
  const w2 = await W()
  if (!pk.trav && w2.z < 19.4 && w2.z > 18.0) await p.keyboard.press('Space')
  if (pk.trav) {
    if (shotTaken === 0 && pk.trav.t > 0.12) {
      await shot('pk-vault-1')
      shotTaken = 1
    } else if (shotTaken === 1 && pk.trav.t > 0.3) {
      await shot('pk-vault-2')
      shotTaken = 2
    } else if (shotTaken === 2 && pk.trav.t > 0.45) {
      await shot('pk-vault-3')
      shotTaken = 3
    }
  }
  await wait(20)
}
await p.keyboard.up('w')
await p.keyboard.up('Shift')
check(shotTaken === 3, `vault stills captured (${shotTaken}/3)`)
await wait(500)

/* ── 1. Rookie Run ── */
await tp(-234, 22, Math.PI)
await wait(900)
check(((await W()).prompt ?? '') === 'pk:rookie', 'the start pad offers the Rookie Run')
await press('e')
let s = await PK()
check(s.run && s.run.id === 'rookie', 'pressing E on the pad starts the timed run')
const jz = [18.9, 12.9, 5.9, -3.2, -6.6, -9.5, -13.0]
let ji = 0
const seenA = await drive(
  (w, pk) => {
    if (ji < jz.length && w.z <= jz[ji] && pk.grounded && !pk.trav) {
      ji++
      return true
    }
    return false
  },
  (w, pk) => !!pk.run?.done || w.z < -19,
  26000,
)
s = await PK()
console.log('  traversals seen:', seenA.join(','), '| run:', JSON.stringify(s.run))
check(seenA.includes('vault'), 'vault animation played over the walls')
check(!!s.run?.done, `the finish is reached with ordinary input (ms ${s.run?.ms}, falls ${s.run?.falls})`)
check(s.run?.result?.coins > 0 && s.run?.result?.medal >= 0, `a result is paid (${JSON.stringify(s.run?.result)})`)
await shot('pk-rookie-finish')
const sv1 = await p.evaluate(() => JSON.parse(localStorage.getItem('pumpchad.chadverse.save') ?? '{}'))
await wait(800)
const sv = await p.evaluate(() => JSON.parse(localStorage.getItem('pumpchad.chadverse.save') ?? '{}'))
check((sv.progress?.records?.parkour_rookie ?? 0) > 0, `best time saved (${sv.progress?.records?.parkour_rookie} ms)`)
void sv1

/* ── 3. Rooftop Run ── */
await p.evaluate(() => window.dispatchEvent(new CustomEvent('chad-parkour-cmd', { detail: 'exit' })))
await wait(300)
await tp(-229.6, 0, Math.PI / 2)
await wait(900)
check(((await W()).prompt ?? '') === 'pk:roof', 'the branch pad offers the Rooftop Run')
await press('e')
await wait(300)
check((await PK()).run?.id === 'roof', 'E on the branch pad starts the ROOFTOP run (not a leftover Rookie result)')
const edges = [-212.8, -202.8, -192.8, -182.8]
let ei = 0
const seenB = await drive(
  (w, pk) => {
    if (w.x < -222 && !pk.trav && ei === 0 && w.x < -221.6) return pk.y < 3 // spam jump-mantle up the crate stair
    if (w.x >= -222.2 && ei < edges.length && w.x >= edges[ei]) {
      ei++
      return true
    }
    return false
  },
  (w, pk) => !!pk.run?.done || w.x > -170,
  40000,
)
s = await PK()
console.log('  roofs: traversals seen', seenB.join(','), '| run:', JSON.stringify(s.run))
check(seenA.includes('mantle') || seenB.includes('mantle'), 'mantle animation played (crate stair / blocks)')
check(s.run?.id === 'roof' && !!s.run?.done, `the Rooftop Run finishes with ordinary input (ms ${s.run?.ms}, falls ${s.run?.falls})`)
await shot('pk-roof-finish')
await p.evaluate(() => window.dispatchEvent(new CustomEvent('chad-parkour-cmd', { detail: 'exit' })))

/* ── 4. fall recovery: step off the beam during a run ── */
await tp(-234, 22, Math.PI)
await wait(700)
await press('e')
await tp(-234, 3, Math.PI, 0) // into the beam pit zone on the ground
await wait(900)
s = await PK()
let w3 = await W()
check(s.run && s.run.falls >= 1, `standing on the ground in a pit counts as a fall (falls ${s.run?.falls})`)
check(Math.hypot(w3.x + 234, w3.z - 22) < 2, `and puts you back at the start (at ${w3.x.toFixed(1)}, ${w3.z.toFixed(1)})`)
await p.evaluate(() => window.dispatchEvent(new CustomEvent('chad-parkour-cmd', { detail: 'exit' })))

/* ── 5. the hidden room: vault the decoy wall, take the Golden Pumpkin ── */
await tp(-206, -7.2, 0)
await wait(600)
let jumped = false
await p.keyboard.down('w')
await p.keyboard.down('Shift')
for (let i = 0; i < 60; i++) {
  const w4 = await W()
  const pk = await PK()
  if (!jumped && w4.z > -5.6) {
    await p.keyboard.press('Space')
    if ((await PK()).trav) jumped = true
  }
  if (pk.trav) await wait(0)
  if (w4.z > -2.8) break
  await wait(40)
}
await p.keyboard.up('w')
await p.keyboard.up('Shift')
await wait(900)
s = await PK()
w3 = await W()
check(s.travLog?.kind === 'vault' || w3.z > -3.6, `the decoy wall is vaulted into the hidden room (log ${JSON.stringify(s.travLog)}, z ${w3.z.toFixed(1)})`)
await tp(-205.7, -1.2, 0)
await wait(800)
check(((await W()).prompt ?? '') === 'pk_secret', 'the Golden Pumpkin can be taken')
await shot('pk-secret-room')
await press('e')
await wait(900)
s = await PK()
check(s.secretTaken, 'taking it removes the pumpkin and is remembered')

/* ── 6. things that must NEVER be climbed or vaulted ── */
await tp(-200, 24, 0) // facing the 3 m south boundary wall
await wait(500)
const logBefore = (await PK()).travLog
await p.keyboard.down('w')
await wait(500)
await p.keyboard.press('Space')
await wait(900)
await p.keyboard.up('w')
w3 = await W()
check(w3.z < 25.6, `the tall boundary wall cannot be climbed (z ${w3.z.toFixed(2)} stays inside the yard)`)
check(((await PK()).travLog?.at ?? 0) === (logBefore?.at ?? 0), 'and no traversal was even attempted')
// the closed Valley Gate: tall + locked
await tp(0, 72.4, 0)
await wait(500)
await p.keyboard.down('w')
await wait(500)
await p.keyboard.press('Space')
await wait(1000)
await p.keyboard.up('w')
w3 = await W()
check(w3.z < 74.2, `the Valley Gate stays shut (z ${w3.z.toFixed(2)})`)
check(!errs.length, `no page errors (${JSON.stringify(errs.slice(0, 2))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
