// Pumpkin Rush mini-game end to end: prompt → instructions → countdown → live round (real movement, grabs, combos,
// golden pumpkins, respawns) → results (score, record, XP, save) → play again → quit → re-entry cleanup.
//   SHOTS=dir node scripts/rush-test.mjs      (dev server on :4318)
import { chromium } from 'playwright'
const out = process.env.SHOTS || '.'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1200, height: 800 } })
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)))
let pass = 0
let fail = 0
const check = (ok, msg) => {
  ok ? pass++ : fail++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
}
const w = (ms) => p.waitForTimeout(ms)
const R = () => p.evaluate(() => window.__chadverse.rush())
const W = () => p.evaluate(() => window.__chadverse.world())
const save = () => p.evaluate(() => window.__chadverse.save())
const visible = (id) => p.locator(`[data-testid=${id}]`).first().isVisible().catch(() => false)

console.log('\n══════ Pumpkin Rush ══════')
await p.goto(process.env.URL || 'http://localhost:4318/chadverse/', { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'networkidle' })
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Rush Test')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 40000 })
await w(1000)

// ── start point
await p.evaluate(() => window.__chadverse.teleport(10.2, 12.3, Math.PI))
await w(600)
check((await W()).prompt === 'rush', 'cart shows the "Play Pumpkin Rush" prompt')
await p.screenshot({ path: `${out}/rush-cart.jpg`, quality: 78 })
await p.keyboard.press('e')
await p.waitForSelector('[data-testid=rush-start]', { timeout: 4000 })
check(await visible('rush-start'), 'instructions card with Start')
check(/—/.test(await p.locator('[data-testid=rush-best]').textContent()), 'no best score yet')
const before = await W()
await p.keyboard.down('w')
await w(500)
await p.keyboard.up('w')
const still = await W()
check(Math.hypot(still.x - before.x, still.z - before.z) < 0.05, 'world paused while reading the instructions')
await p.keyboard.press('Escape')
await w(400)
check(!(await visible('rush-start')) && !(await p.locator('[role=dialog]').isVisible().catch(() => false)), 'Esc closes the card (and does not open the pause menu)')

// ── round
await p.keyboard.press('e')
await p.waitForSelector('[data-testid=rush-start]', { timeout: 4000 })
await p.click('[data-testid=rush-start]')
await w(200)
check((await R()).phase === 'countdown' && (await visible('rush-count')), 'Start → 3-2-1 countdown')
await p.waitForFunction(() => window.__chadverse.rush()?.phase === 'playing', null, { timeout: 6000 })
let r = await R()
const pl = await W()
check(r.targets.length === 3, `three pumpkins light up (${r.targets.length})`)
check(r.targets.every((t) => Math.hypot(t.x - pl.x, t.z - pl.z) >= 7 && Math.hypot(t.x, t.z) <= 29), 'spawned away from the player, inside the walls')
// real movement during the round
await p.evaluate(() => window.__chadverse.teleport(2.5, 13, 0)) // open cobbles, facing down the plaza
await w(300)
const m0 = await W()
await p.keyboard.down('Shift')
await p.keyboard.down('w')
await w(700)
await p.keyboard.up('w')
await p.keyboard.up('Shift')
const m1 = await W()
check(Math.hypot(m1.x - m0.x, m1.z - m0.z) > 1.5, `free to sprint during the round (moved ${Math.hypot(m1.x - m0.x, m1.z - m0.z).toFixed(1)} m)`)
await p.screenshot({ path: `${out}/rush-play.jpg`, quality: 78 })
// grab six in quick succession (teleporting onto them keeps the test fast; the pickup is the real proximity check)
let lastScore = 0
let sawGold = false
let combos = []
for (let i = 0; i < 6; i++) {
  r = await R()
  const t = r.targets.find((x) => x.gold) ?? r.targets[0]
  await p.evaluate(([x, z]) => window.__chadverse.teleport(x, z), [t.x, t.z])
  await w(250)
  r = await R()
  combos.push(r.combo)
  if (t.gold) sawGold = true
  check(r.score > lastScore, `grab ${i + 1}${t.gold ? ' (golden)' : ''}: score ${lastScore} → ${r.score}, combo ×${r.combo}`)
  lastScore = r.score
  await w(400) // the popped pumpkin respawns elsewhere
}
r = await R()
check(r.targets.length === 3, `a new pumpkin lights up after every grab (${r.targets.length} lit)`)
check(sawGold && r.gold >= 1, `golden pumpkins appear and count (${r.gold})`)
check(Math.max(...combos) >= 4, `quick grabs chain a combo (${combos.join(',')})`)
await p.screenshot({ path: `${out}/rush-combo.jpg`, quality: 78 })
// combo decays when you dawdle
await w(3600)
check((await R()).combo === 0, 'combo resets after the window')
// fast-forward the clock to the end
await p.evaluate(() => (window.__chadverse.rushGame().timeLeft = 0.6))
await p.waitForSelector('[data-testid=rush-final]', { timeout: 5000 })
const final = +(await p.locator('[data-testid=rush-final]').textContent())
r = await R()
check(r.phase === 'done' && r.targets.length === 0 && final === lastScore, `time up: results show ${final} and the pumpkins are cleared`)
check(/New personal best/.test(await p.locator('[data-testid=rush-record]').textContent()), 'first run is a new personal best')
const xpTxt = await p.locator('[data-testid=rush-xp]').textContent()
let s = await save()
check(s.progress.records.pumpkin_rush === final && s.progress.daily.sets.pumpkin_rush === 1, `record saved (${s.progress.records.pumpkin_rush}), daily run counted`)
check(/\+\d+ XP/.test(xpTxt) && s.progress.xp > 25, `XP awarded (${xpTxt.trim()}, total ${s.progress.xp})`)
await p.screenshot({ path: `${out}/rush-done.jpg`, quality: 78 })
const still2a = await W()
await p.keyboard.down('w')
await w(400)
await p.keyboard.up('w')
const still2b = await W()
check(Math.hypot(still2b.x - still2a.x, still2b.z - still2a.z) < 0.05, 'world paused on the results card')

// ── play again, then quit mid-run
await p.click('[data-testid=rush-again]')
await p.waitForFunction(() => window.__chadverse.rush()?.phase === 'playing', null, { timeout: 6000 })
r = await R()
check(r.score === 0 && r.targets.length === 3 && r.timeLeft > 40, 'Play again starts a fresh round')
await p.click('[data-testid=rush-quit]')
await w(400)
r = await R()
s = await save()
check(r.phase === 'idle' && r.targets.length === 0 && !(await visible('rush-hud')), 'Quit ends the round and clears the pumpkins')
check(s.progress.records.pumpkin_rush === final && s.progress.daily.sets.pumpkin_rush === 1, 'quitting gives no reward and keeps the record')

// ── leave the square and come back: no leaks, game resets
const st0 = await p.evaluate(() => window.__chadverse.stats())
await p.evaluate(() => window.__chadverse.teleport(14.4, -4))
await w(400)
await p.keyboard.press('e')
await p.waitForFunction(() => window.__chadverse?.phase === 'gym', null, { timeout: 20000 })
await w(600)
await p.evaluate(() => window.__chadverse.gymGoto('exit'))
await w(400)
await p.keyboard.press('e')
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 20000 })
await w(800)
const st1 = await p.evaluate(() => window.__chadverse.stats())
r = await R()
check(r.phase === 'idle' && r.targets.length === 0, 'fresh square after re-entry')
check(st1.geometries <= st0.geometries + 2 && st1.textures <= st0.textures, `no GPU growth across re-entry (${st0.geometries}g/${st0.textures}t → ${st1.geometries}g/${st1.textures}t)`)

check(errs.length === 0, `no console errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`)
console.log(fail ? `${fail} FAILURE(S)` : 'ALL CHECKS PASSED')
await b.close()
