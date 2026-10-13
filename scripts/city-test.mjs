// CHAD CITY: intro, routes, water + gate boundaries, new interactions, Discover Chad City, hidden pumpkins,
// photo mode (capture downloads a PNG), garden bench, gym entry from the new layout.
//   URL=http://localhost:4318/chadverse/ node scripts/city-test.mjs
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:4318/chadverse/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const ctx = await b.newContext({ viewport: { width: 1100, height: 720 }, acceptDownloads: true })
const p = await ctx.newPage()
const errs = []
let fails = 0
const check = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails++ }
p.on('pageerror', (e) => errs.push(e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)))
await p.goto(BASE + '?intro=1', { waitUntil: 'networkidle' })
await p.evaluate(() => {
  localStorage.clear()
  localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 1, character: null, progress: {}, settings: { quality: 'medium', muted: true } }))
})
await p.reload({ waitUntil: 'networkidle' })
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'City Tester')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 90000 })
const W = () => p.evaluate(() => window.__chadverse.world())
const save = () => p.evaluate(() => window.__chadverse.save().progress)
const prompt = () => p.evaluate(() => document.querySelector('[data-testid=prompt]')?.textContent ?? '')
const dialogues = () => p.locator('[data-testid=dialogue]').count()
const tp = async (x, z, yaw) => {
  await p.evaluate(([x, z, yaw]) => window.__chadverse.teleport(x, z, yaw), [x, z, yaw])
  await p.waitForTimeout(500)
}
const hold = async (key, ms) => {
  await p.keyboard.down(key)
  await p.waitForTimeout(ms)
  await p.keyboard.up(key)
  await p.waitForTimeout(250)
}

/* ── first-visit intro ── */
await p.waitForSelector('[data-testid=intro]', { timeout: 8000 }).catch(() => {})
check((await p.locator('[data-testid=intro]').count()) === 1, 'first visit: the intro flyover plays')
const a0 = await W()
await hold('w', 500)
const a1 = await W()
check(Math.hypot(a1.x - a0.x, a1.z - a0.z) < 0.05, 'movement is locked during the intro')
await p.click('[data-testid=intro-skip]')
await p.waitForTimeout(600)
check((await p.locator('[data-testid=intro]').count()) === 0, 'Skip ends the intro')
check((await save()).discoveries.includes('intro_seen'), 'the intro is remembered (won’t repeat)')
const s0 = await W()
check(Math.abs(s0.x) < 0.2 && Math.abs(s0.z - 64.5) < 0.3, `spawn on the arrival forecourt (${s0.x}, ${s0.z})`)
await hold('w', 900)
const s1 = await W()
check(s1.z < s0.z - 1, `control is back after the intro: forward walks toward the gateway (z ${s0.z} → ${s1.z})`)

/* ── routes + boundaries ── */
await tp(0, 47.5, Math.PI)
await hold('w', 6200)
check((await W()).z < 37.6, `CHAD BRIDGE: the avenue crosses the canal (z ${(await W()).z})`)
await tp(0, 41.5, Math.PI)
check(Math.abs((await W()).y - 0.42) < 0.08, `the bridge deck is walkable at its crown (y ${(await W()).y})`)
await tp(-19, 47.0, Math.PI)
await hold('w', 5600)
check((await W()).z < 37.8, `west footbridge crossing (z ${(await W()).z})`)
await tp(-10, 46.6, Math.PI)
await hold('w', 2500)
check((await W()).z > 44.4, `the canal water is solid (no falling in) (z ${(await W()).z})`)
await tp(0, 70.5, 0)
await hold('w', 2500)
check((await W()).z < 73.8, `the closed valley gate stops you (z ${(await W()).z})`)
await tp(-55, 37, 0)
await hold('w', 2500)
check((await W()).z < 42, `the overlook balustrade holds you on the terrace (z ${(await W()).z})`)
for (const [x, z, yaw, label] of [[40, 19, Math.PI / 2, 'Arcade Street'], [-40, 2.5, -Math.PI / 2, 'the road west'], [-44, 14, Math.PI, 'the garden axis'], [12, -4, Math.PI / 2, 'gym forecourt']]) {
  await tp(x, z, yaw)
  const q0 = await W()
  await hold('w', 700)
  const q1 = await W()
  check(Math.hypot(q1.x - q0.x, q1.z - q0.z) > 0.7, `walkable: ${label}`)
}

/* ── new interactions (prompt → one dialogue → Escape) ── */
const talk = async (x, z, yaw, label, id) => {
  await tp(x, z, yaw)
  const pt = await prompt()
  check(pt.includes(label), `${id}: prompt "${label}" (${pt})`)
  await p.keyboard.press('e')
  await p.waitForTimeout(600)
  const n = await dialogues()
  check(n === 1, `${id}: opens one dialogue`)
  await p.keyboard.press('Escape')
  await p.waitForTimeout(450)
  if (await p.getByRole('dialog', { name: 'Paused' }).isVisible().catch(() => false)) await p.keyboard.press('Escape')
}
await talk(-3.6 + 0.9, 60.8 + 1.0, Math.PI + 0.9, 'Goldie', 'greeter')
await talk(-6.3, 60.9, Math.PI, 'welcome board', 'citygate')
await talk(6.3, 60.9, Math.PI, 'city map', 'citymap')
await talk(10.5, 63.6, 0, 'Chad Rides', 'rides')
await talk(45.3, 19, Math.PI / 2, 'Pump Arcade', 'arcade')
await talk(-51.5, 39.0, Math.PI, 'Chad View', 'overlook')
await talk(-3.9, -20.45, Math.PI, 'citadel plaque', 'lore_citadel')
await talk(17.4, 12.9, Math.PI, 'yard board', 'yard')
await talk(-39, -1.9, Math.PI, 'Mo', 'shakes')
{
  const ch = await p.evaluate(() => window.__chadverse.world()) // champions prompt sits in front of the case
  void ch
}
const d1 = (await save()).discoveries
check(d1.includes('visit_rides') && d1.includes('visit_arcade') && d1.includes('overlook'), 'inspecting Chad Rides + the arcade + Chad View counts as discovered')

/* ── Discover Chad City: zones ── */
await tp(0, 8, Math.PI)
await p.waitForTimeout(500)
await tp(13.2, -4, Math.PI / 2)
await p.waitForTimeout(500)
await tp(0, -18, Math.PI)
await p.waitForTimeout(800)
const d2 = await save()
check(['visit_square', 'visit_gym', 'visit_citadel'].every((k) => d2.discoveries.includes(k)), 'walking into the square, the gym door and the citadel forecourt are discoveries')
check(d2.achievements.includes('city_explorer'), 'all five → City Explorer achievement')
const cp = await p.evaluate(() => document.querySelector('[data-testid=city-progress]')?.textContent ?? '')
check(!cp.includes('Discover Chad City'), `HUD progress line drops the finished activity (${cp})`)

/* ── hidden pumpkins ── */
const HP = [['hp_1', -10.4, 53.2], ['hp_2', 21.4, 37.0], ['hp_3', -44, 23], ['hp_4', 50.5, -4.4], ['hp_5', -5.7, -25.6], ['hp_6', -58.4, 41.0]]
for (const [id, x, z] of HP) {
  await tp(x + 0.9, z + 0.3, -Math.PI / 2)
  const pt = await prompt()
  check(pt.includes('hidden pumpkin'), `${id}: reachable, prompt shows (${pt})`)
  await p.keyboard.press('e')
  await p.waitForTimeout(500)
  check((await save()).discoveries.includes(id), `${id}: collected`)
}
check((await save()).achievements.includes('pumpkin_hunter'), 'all six → Pumpkin Hunter achievement')
await tp(-10.4 + 0.9, 53.2 + 0.3, -Math.PI / 2)
check(!(await prompt()).includes('hidden pumpkin'), 'a collected pumpkin can’t be collected again')

/* ── garden bench: sit + stand ── */
await tp(-44, 30.1 - 0.75 + 0.1, 0)
const bp = await prompt()
check(bp.includes('Sit in the garden'), `garden bench prompt (${bp})`)
await p.keyboard.press('e')
await p.waitForFunction(() => window.__chadverse.seat()?.phase === 'sit', null, { timeout: 8000 }).catch(() => {})
check((await p.evaluate(() => window.__chadverse.seat()))?.phase === 'sit', 'sits on the garden bench')
await hold('s', 300)
await p.waitForFunction(() => window.__chadverse.seat() === null, null, { timeout: 8000 }).catch(() => {})
check((await p.evaluate(() => window.__chadverse.seat())) === null, 'stands back up (not trapped)')

/* ── photo mode ── */
await tp(-52, 37.5, Math.PI * 0.8)
await p.getByRole('button', { name: 'Photo mode' }).click()
await p.waitForTimeout(500)
check((await p.locator('[data-testid=photo-bar]').count()) === 1 && (await p.locator('[data-testid=objective]').count()) === 0, 'photo mode: bar shown, HUD hidden')
const ph0 = await W()
await hold('w', 500)
const ph1 = await W()
check(Math.hypot(ph1.x - ph0.x, ph1.z - ph0.z) > 0.3, 'photo mode: you can still move to frame the shot')
const dl = p.waitForEvent('download', { timeout: 10000 }).catch(() => null)
await p.click('[data-testid=photo-capture]')
const file = await dl
check(!!file && /chad-city-.*\.png$/.test(file.suggestedFilename()), `capture downloads a PNG (${file?.suggestedFilename()})`)
if (file && process.env.SHOTS) await file.saveAs(`${process.env.SHOTS}/photo-mode-capture.png`)
await p.keyboard.press('Escape')
await p.waitForTimeout(500)
check((await p.locator('[data-testid=photo-bar]').count()) === 0 && (await p.locator('[data-testid=objective]').count()) === 1, 'Esc leaves photo mode, HUD back')

/* ── gym entry from the new city ── */
await tp(14.4, -4, Math.PI / 2)
check((await prompt()).includes('Enter Pump Gym'), 'gym door prompt (Pump Gym)')
await p.keyboard.press('e')
await p.waitForFunction(() => window.__chadverse?.phase === 'gym', null, { timeout: 60000 }).catch(() => {})
check((await p.evaluate(() => window.__chadverse.phase)) === 'gym', 'enters the gym')
await p.evaluate(() => window.__chadverse.gymGoto('exit'))
await p.waitForTimeout(500)
await p.keyboard.press('e')
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 60000 }).catch(() => {})
const back = await W()
check(back && Math.abs(back.x - 12.6) < 0.8 && Math.abs(back.z + 4) < 0.8, 'back out at the gym door')
check((await p.locator('[data-testid=intro]').count()) === 0, 'no intro when coming back from the gym')

check(errs.length === 0, `no page errors (${JSON.stringify(errs.slice(0, 3))})`)
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED')
await b.close()
process.exit(fails ? 1 : 0)
