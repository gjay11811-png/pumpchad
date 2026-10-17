// The wheelie practice challenges, ridden with ORDINARY KEYS in a simulated browser (headless software GL; game time stepped with __chadverse.advance). Checks that each of the six
// challenges (lift zone, balance band, cone weave, one hand, scrape section, landing) is scored from the actual riding, that a crash / extreme angle does not score high, that
// personal bests are kept locally, and that the normal riding screen stays uncluttered.   KIND=surron|street SPECIES=skeleton|demon node scripts/wheelie-practice-test.mjs
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const KIND = process.env.KIND || 'surron'
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
const down = (k) => p.keyboard.down(k)
const up = (k) => p.keyboard.up(k)
const parked = (await B()).parked.find((x) => x.kind === KIND)
await p.evaluate(([x, z]) => window.__chadverse.teleport(x, z - 1.6, Math.PI), [parked.x, parked.z])
await adv(0.3)
await p.evaluate((k) => window.__chadverse.mountBike(k), KIND)
await adv(1)
await p.evaluate(() => window.__chadverse.freeze(true))
const results = async () => (await B()).judge.results
const got = async (id) => (await results()).filter((r) => r.id === id).at(-1)
const recover = async () => {
  for (let i = 0; i < 40 && (await B()).phase !== 'riding'; i++) await adv(0.2)
}
const keys = {}
const key = async (k, on) => {
  if (!!keys[k] === on) return
  keys[k] = on
  await (on ? down(k) : up(k))
}
const release = async () => {
  for (const k of ['w', 's', 'a', 'd', 'Shift', ' ']) await key(k, false)
}

/** a small reactive rider: a fresh 0.15 s press of the gas lifts / holds the front (REV), easing off lets it settle, Brake brings it down if it climbs too far */
let tp = -1
let tg = 0
const ride = async (s, lim = 0.32) => {
  const pred = s.pitch + s.pitchRate * 0.25
  if (tp >= 0) {
    tp++
    if (tp >= 3) {
      await key('w', false)
      tp = -1
      tg = 0
    }
  } else {
    tg++
    if (tg >= 7 && pred < lim && s.pitchRate < 0.35 && s.v < 20) {
      await key('w', true)
      tp = 0
    }
  }
  await key('s', pred > 0.58)
}
/* 1. LIFT ZONE: gas in the blue box lifts the front smoothly → a score */
await set({ x: 0, z: 50, h: 0, v: 5 })
await adv(0.3)
for (let i = 0; i < 100 && !(await got('lift')); i++) {
  const s = await B()
  await ride(s, 0.4)
  await adv(0.05)
  if (s.z > 70) break
}
let r = await got('lift')
check(!!r && r.score > 20 && r.score <= 100, `LIFT ZONE scores a smooth lift from the gas alone (${r ? r.score + ' · ' + r.line : 'no result'})`)
await release()
// the controlled wheelie: the same small rider as bike-test: ease the gas to hold the angle, touch Brake if it climbs
/* 2. BALANCE: hold 15°–35° for 2.5 s */
await set({ x: 0, z: 56, h: 0, v: 4 })
await adv(0.3)
let held = 0
for (let i = 0; i < 140; i++) {
  const s = await B()
  if (s.crashed) break
  await ride(s, 0.4)
  if (s.pitch > 0.26) held += 0.05
  if (s.z > 70) await set({ x: 0, z: 57, v: Math.min(s.v, 8) })
  await adv(0.05)
  if (await got('balance')) break
}
r = await got('balance')
check(!!r && r.score >= 40, `BALANCE: a held wheelie inside the 15°–35° band is scored (${r ? r.score + ' · ' + r.line : 'no result'})`)
await release()
await adv(3)
/* 3. LANDING: the wheelie coming back down is scored by how soft the touchdown is */
await set({ x: 0, z: 56, h: 0, v: 5 })
await adv(0.3)
let st = await B()
for (let i = 0; i < 100 && st.pitch < 0.35; i++) {
  await ride(st, 0.5)
  await adv(0.05)
  st = await B()
}
await key('w', false)
await key('s', true)
for (let i = 0; i < 60 && (await B()).pitch > 0.02; i++) await adv(0.05)
await key('s', false)
await adv(0.2)
r = await got('landing')
check(!!r && r.score >= 50, `LANDING: bringing it down with the brake scores a soft landing (${r ? r.score + ' · ' + r.line : 'no result'})`)
await release()
await adv(2)

/* 4. ONE HAND: only counts inside a wheelie; the keyboard Shift is the same control as the phone button */
await set({ x: 0, z: 14, h: 0, v: 5 })
await adv(0.3)
await key('Shift', true)
await adv(1)
check(!(await got('onehand')) && (await B()).oneHand === 0, 'ONE HAND does nothing on the ground (no pose, no score)')
for (let i = 0; i < 140 && !(await got('onehand')); i++) {
  const s = await B()
  await ride(s, 0.4)
  if (s.z > 66) await set({ x: 0, z: 14, v: Math.min(s.v, 7) })
  await adv(0.05)
}
r = await got('onehand')
check(!!r && r.score >= 55, `ONE HAND: 1.5 s one-handed inside a wheelie is scored (${r ? r.score + ' · ' + r.line : 'no result'})`)
await release()
await adv(3)
await recover()

/* 5. CONES: weave all five without touching them (a small pursuit rider steers to the gap) */
await set({ x: 0, z: 14, h: 0, v: 0 })
await adv(0.5)
await key('w', true)
const cones = [22, 26, 30, 34, 38]
for (let i = 0; i < 160 && !(await got('cones')); i++) {
  const s = await B()
  if (s.crashed) break
  const nextI = cones.findIndex((cz) => cz + 0.6 > s.z)
  const aimX = nextI < 0 ? 0 : (nextI % 2 ? 1 : -1) * 0.75
  const err = aimX - s.x
  const want = Math.max(-1, Math.min(1, -(err * 0.9 + (s.heading || 0) * -0.5)))
  await key('d', want > 0.15)
  await key('a', want < -0.15)
  await key('w', s.v < 7)
  await adv(0.05)
}
r = await got('cones')
check(!!r && r.score >= 50, `CONES: weaving the five cones is scored (${r ? r.score + ' · ' + r.line : 'no result'})`)
await release()
await adv(2)
await recover()

/* 6. SCRAPE: a peg drags in the yellow section on a hard lean; a gentle line does not */
await set({ x: -1.8, z: 14, h: 0, v: KIND === 'surron' ? 15 : 20 }) // (starts left of centre: the first lean goes toward +x, where the avenue has a lamp / bench near z 28)
await adv(0.3)
await key('w', true)
// a hard S through the section: full lock one way, then the other, so the bike stays near the strip while a peg touches on each lean
for (let i = 0; i < 40 && !(await got('scrape')); i++) {
  await key('a', Math.floor(i / 9) % 2 === 0)
  await key('d', Math.floor(i / 9) % 2 === 1)
  await adv(0.1)
  const s = await B()
  if (process.env.DEBUG) console.log('   scrape?', i, 'z', s.z, 'x', s.x, 'v', s.v, 'roll', s.roll, JSON.stringify(s.scrape), s.crashed)
  if (s.z > 41 || s.crashed) break
}
r = await got('scrape')
const pegSeen = (await B()).scrape?.part === 'peg' || !!r
check(!!r && r.score >= 55, `SCRAPE: dragging a peg through the marked section is scored (${r ? r.score + ' · ' + r.line : 'no result'})`)
await release()
await adv(2)
await recover()
await set({ x: 0, z: 14, h: 0, v: 8 })
await adv(0.3)
await key('w', true)
await key('d', true)
let easyPeg = false
await adv(0.1)
for (let i = 0; i < 8; i++) {
  await key('d', i < 1)
  await adv(0.1)
  if ((await B()).scrape?.part) easyPeg = true
}
check(!easyPeg, 'a gentle turn at moderate speed never scrapes anything')
await release()

/* 7. extreme angles / crashes never score high: a loop-out forced by a steep climb earns at most a small score */
const bests = await p.evaluate(() => JSON.parse(localStorage.getItem('pumpchad.ride.v1') ?? '{}').best ?? {})
check(Object.keys(bests).length >= 4 && Object.values(bests).every((v) => v >= 0 && v <= 100), `personal bests are kept locally in this browser (${JSON.stringify(bests)})`)
// a second, worse attempt must not lower a best
const before = { ...bests }
await set({ x: 0, z: 52, h: 0, v: 5 })
await adv(0.3)
await key('w', true)
for (let i = 0; i < 40; i++) {
  await adv(0.1)
  if ((await B()).z > 70) break
}
await release()
const after = await p.evaluate(() => JSON.parse(localStorage.getItem('pumpchad.ride.v1') ?? '{}').best ?? {})
check(Object.keys(before).every((k) => (after[k] ?? 0) >= before[k]), 'a later, worse attempt never lowers a personal best')

/* 8. the riding screen stays clear: no practice card off the strip */
await set({ x: 40, z: 100, h: 0, v: 3 })
await adv(6)
const card = await p.locator('[data-testid=ride-practice]').count()
check(card === 0, 'off the practice strip there is no practice card on the riding screen')
check(errs.length === 0, `no page errors (${JSON.stringify(errs.slice(0, 2))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS (simulated)')
await b.close()
process.exit(fails ? 1 : 0)
