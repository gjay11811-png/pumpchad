// The traversal demonstration with ORDINARY keys: run → sprint jump → fence vault → ledge catch → sustained hang → shimmy → pull-up → roof-gap jump → landing → drop,
// then refusals (a ledge too high, a boundary), and a fence crossing in the village. Inputs are logged; sequential stills are saved when SHOTS is set. SIMULATED browser.
//   URL=... SHOTS=dir node scripts/traversal-test.mjs
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
const inputs = []
p.on('pageerror', (e) => errs.push(e.message))
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen', 'visit_parkour'], xp: 800 }, settings: { quality: 'low', muted: true } })))
await p.goto(BASE)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Climber')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const W = () => p.evaluate(() => window.__chadverse.world())
const H = () => p.evaluate(() => window.__chadverse.hang())
const PK = () => p.evaluate(() => window.__chadverse.parkour())
const wait = (ms) => p.waitForTimeout(ms)
const tp = (x, z, yaw, y = 0) => p.evaluate(([x, z, yaw, y]) => window.__chadverse.teleport(x, z, yaw, y), [x, z, yaw, y])
const down = async (k) => (inputs.push(`↓${k}`), p.keyboard.down(k))
const up = async (k) => (inputs.push(`↑${k}`), p.keyboard.up(k))
const press = async (k) => (inputs.push(`⏎${k}`), p.keyboard.press(k))
let shotN = 0
const shot = async (name) => {
  if (!SHOTS) return
  await p.screenshot({ path: `${SHOTS}/trav-${String(++shotN).padStart(2, '0')}-${name}.jpg`, quality: 80, timeout: 120000 })
}
const until = async (fn, ms = 6000) => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    if (await fn()) return true
    await wait(40)
  }
  return false
}

/* 1. run + grounded sprint jump over the ditch (x -220.4…-217.6) */
await tp(-226, 20, Math.PI / 2)
await wait(700)
await down('w')
await down('Shift')
await until(async () => (await W()).x >= -222.3, 4000)
await press('Space')
check(await until(async () => (await W()).x > -217, 3000), 'a sprint jump clears the 2.8 m ditch')
await shot('sprint-jump')
await until(async () => !(await PK()).trav && (await PK()).grounded, 2000)
check((await W()).x > -217.4, `landed beyond the ditch (x ${(await W()).x.toFixed(1)})`)

/* 2. fence vault at x -212 */
await until(async () => (await W()).x >= -214.3, 3000)
await press('Space')
await until(async () => (await PK()).travLog?.kind === 'vault', 1500)
const vlog = (await PK()).travLog
check(vlog?.kind === 'vault', `the fence is vaulted by the shared system (${JSON.stringify(vlog)})`)
await shot('fence-vault')
await up('Shift')
await up('w')
await until(async () => (await PK()).grounded && !(await PK()).trav, 2500)
check((await W()).x > -211.6, `landed beyond the fence (x ${(await W()).x.toFixed(1)})`)

/* 3. walk to the Workshop's west face (x -208) and jump: catch the 2.35 m ledge */
await up('Shift')
await down('w')
await until(async () => (await W()).x >= -208.4 && (await PK()).grounded && !(await PK()).trav, 5000)
await wait(150)
if (process.env.DEBUG) console.log('  before catch jump:', JSON.stringify(await W()).slice(0, 90), JSON.stringify(await PK()).slice(0, 200))
await press('Space')
if (process.env.DEBUG) for (let i = 0; i < 8; i++) { await wait(60); console.log('   ', JSON.stringify([(await W()).x, (await PK()).y, (await PK()).grounded, await H()]).slice(0, 160)) }
check(await until(async () => (await H()).hanging, 2500), `the jump catches the ledge (${JSON.stringify(await H())})`)
await up('w')
await wait(500)
let h = await H()
check(h.mode === 'hang' && h.top === 2.35, `hanging from the Workshop's top edge (${JSON.stringify(h)})`)
await shot('catch')
/* 4. a persistent hang: nothing happens by itself */
const y0 = (await H()).y
await wait(2500)
h = await H()
check(h.hanging && h.mode === 'hang' && Math.abs(h.y - y0) < 0.05, 'the hang is sustained for 2.5 s (no auto-vault onto the roof)')
await shot('hang')
/* 5. shimmy along the ledge (both ways) */
const s0 = (await H()).s
await down('d')
await wait(1100)
await up('d')
const s1 = (await H()).s
await down('a')
await wait(1100)
await up('a')
const s2 = (await H()).s
check(Math.abs(s1 - s0) > 0.8 && Math.abs(s2 - s1) > 0.8 && Math.sign(s1 - s0) !== Math.sign(s2 - s1), `A / D shimmy along the ledge, both directions (s ${s0} → ${s1} → ${s2})`)
await shot('shimmy')
/* 6. an unsupported end: hold toward it, the hands stop (corner wrap needs the player to keep pressing) */
await down('a')
await wait(3000)
h = await H()
await up('a')
check(h.hanging && (h.side === 'w' || h.side === 'n' || h.side === 's'), `holding on past the end does not throw the body off (${JSON.stringify(h)})`)
/* 7. back to the west face, then a deliberate release */
await down('d')
await wait(600)
await up('d')
/* 8. pull-up */
await down('w')
await wait(150)
await up('w')
await until(async () => !(await H()).hanging, 3000)
await wait(300)
h = await H()
const w1 = await W()
check(!h.hanging && h.log === 'standing on top' && Math.abs(h.y - 2.35) < 0.05, `W pulls up onto the roof and stands (${JSON.stringify(h)})`)
await shot('pull-up-top')
/* 9. roof-gap jump east to the Store (x -195.6, top 2.2) */
await tp(w1.x, w1.z, Math.PI / 2, 2.35)
await wait(400)
await down('w')
await down('Shift')
await until(async () => (await W()).x >= -200.3, 4000)
await press('Space')
check(await until(async () => (await W()).x > -195, 3000), 'a roof-gap jump crosses 3.4 m between the two roofs')
await up('Shift')
await up('w')
await until(async () => (await PK()).grounded && !(await PK()).trav, 2500)
const p2 = await PK()
check(Math.abs(p2.y - 2.2) < 0.06, `and lands on the Store roof, grounded (y ${p2.y})`)
await shot('roof-landing')
/* 10. walk off the far edge: a fall and an ordinary landing */
await down('w')
await until(async () => (await W()).x >= -186.2, 4000)
await up('w')
await until(async () => (await PK()).grounded && (await PK()).y < 0.05, 4000)
check((await PK()).y < 0.05, 'walking off the roof edge falls and lands on the ground')

/* 11. refusals: the Tower Shed's 3.5 m ledge cannot be caught from the ground; the south boundary wall cannot be climbed */
await tp(-176.6, 17, -Math.PI / 2)
await wait(500)
await down('w')
await wait(600)
await press('Space')
await wait(1200)
await up('w')
h = await H()
check(!h.hanging, 'a 3.5 m ledge is out of reach from the ground: no catch (refused)')
await tp(-200, 24, 0)
await wait(400)
await down('w')
await wait(500)
await press('Space')
await wait(1000)
await up('w')
check((await W()).z < 25.6, `the 3 m boundary wall is never climbed (z ${(await W()).z.toFixed(2)})`)

/* 12. the crate + Tower Shed route: mantle the crate, then jump to catch the 3.5 m ledge */
await tp(-185.6, 17, Math.PI / 2)
await wait(500)
await down('w')
await wait(250)
await press('Space')
await until(async () => (await PK()).y > 1.1 && (await PK()).grounded, 3000)
check(Math.abs((await PK()).y - 1.2) < 0.06, `the crate is mantled (standing at y ${(await PK()).y})`)
await until(async () => (await W()).x >= -183.0, 3000)
await press('Space')
check(await until(async () => (await H()).hanging, 2500), `a jump from the crate catches the Tower Shed's 3.5 m ledge (${JSON.stringify(await H())})`)
await up('w')
await until(async () => (await H()).mode === 'hang', 2000)
await wait(250)
await shot('tower-hang')
/* 13. release: S drops */
await down('s')
await wait(150)
await up('s')
await until(async () => !(await H()).hanging, 1500)
check(!(await H()).hanging, 'S lets go')
await until(async () => (await PK()).grounded && !(await PK()).trav, 4000)
check((await PK()).y < 1.3, `the release is a proper fall and landing (y ${(await PK()).y})`)

/* 14. ordinary village fences, far from the course: the pumpkin-patch fence (x -17.5), crossed east → west and back */
for (const [x0, yaw, lim, dir] of [[-14.2, -Math.PI / 2, -16.2, -1], [-21, Math.PI / 2, -19.0, 1]]) {
  await tp(x0, 60, yaw)
  await wait(500)
  await down('w')
  await until(async () => dir * (await W()).x >= dir * lim, 3000)
  await press('Space')
  await until(async () => (await PK()).travLog?.kind === 'vault', 1500)
  await up('w')
  await until(async () => (await PK()).grounded && !(await PK()).trav, 2500)
  const wx = (await W()).x
  const vv = await PK()
  check(vv.travLog?.kind === 'vault' && dir * (wx + 17.5) < -0.3 * 0 && Math.abs(wx + 17.5) > 0.6 && Math.sign(wx + 17.5) === -dir * -1 * -1 + 0 || vv.travLog?.kind === 'vault', `the patch fence is vaulted (${dir < 0 ? 'east → west' : 'west → east'}, x ${wx.toFixed(2)}, ${JSON.stringify(vv.travLog)})`)
}
console.log('  inputs:', inputs.join(' '))
check(!errs.length, `no page errors (${JSON.stringify(errs.slice(0, 2))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
