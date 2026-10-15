// Square Time Trial through NORMAL play: real clicks/keys only after the world loads (no teleports during a run).
// Starts from the Events Board prompt, steers with mouse-drag camera turns + held W (+ Shift), and checks the whole lifecycle.
//   MODE=sprint|jog URL=... node scripts/trial-walk.mjs
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:4318/chadverse/'
const MODE = process.env.MODE || 'sprint'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 900, height: 600 } })
const errs = []
let fails = 0
const check = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails++ }
p.on('pageerror', (e) => errs.push(e.message))
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'] }, settings: { quality: 'low', muted: true } })))
await p.goto(BASE)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Explorer')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const C = (fn, ...a) => p.evaluate(([f, a]) => window.__chadverse[f](...a), [fn, a])
let lastLog = 0
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))
const SENS = 0.006
// turn the camera toward (tx, tz) with a mouse drag; forward = (-sin cam, -cos cam)
const aim = async (tx, tz) => {
  const w = await C('world')
  const want = Math.atan2(-(tx - w.x), -(tz - w.z))
  const e = wrap(want - w.camYaw)
  if (Math.abs(e) < 0.06) return
  const px = Math.max(-260, Math.min(260, -e / SENS))
  await p.mouse.move(450, 300)
  await p.mouse.down()
  await p.mouse.move(450 + px / 2, 300, { steps: 2 })
  await p.mouse.move(450 + px, 300, { steps: 2 })
  await p.mouse.up()
}
const walkTo = async (tx, tz, until, limitMs = 60000) => {
  const t0 = Date.now()
  await p.keyboard.down('w')
  if (MODE === 'sprint') await p.keyboard.down('Shift')
  let still = 0
  let last = null
  let detourUntil = 0
  let detourSign = 1
  try {
    while (Date.now() - t0 < limitMs) {
      const w = await C('world')
      // a player who bumps into something steers round it: if we barely moved, aim 70 degrees off to one side for a moment
      if (last && Math.hypot(w.x - last.x, w.z - last.z) < 0.06) still++
      else still = 0
      last = w
      if (still > 6 && Date.now() > detourUntil) {
        detourUntil = Date.now() + 1100
        detourSign = -detourSign
        still = 0
      }
      if (Date.now() < detourUntil) {
        const a = Math.atan2(tx - w.x, tz - w.z) + detourSign * 1.2
        await aim(w.x + Math.sin(a) * 10, w.z + Math.cos(a) * 10)
        await p.waitForTimeout(60)
        continue
      }
      if (Math.hypot(tx - w.x, tz - w.z) < 1.4) break
      if (await until?.()) break
      await aim(tx, tz)
      if (process.env.TRACE && Date.now() - lastLog > 700) { lastLog = Date.now(); console.log(`    ${((Date.now() - t0) / 1000).toFixed(1)}s pos (${w.x.toFixed(1)},${w.z.toFixed(1)}) cam ${w.camYaw} -> (${tx},${tz}) d=${Math.hypot(tx - w.x, tz - w.z).toFixed(1)}`) }
      await p.waitForTimeout(60)
    }
  } finally {
    await p.keyboard.up('w')
    if (MODE === 'sprint') await p.keyboard.up('Shift')
  }
}
const promptHas = (t) => p.waitForFunction((n) => (document.querySelector('[data-testid=prompt]')?.textContent ?? '').includes(n), t, { timeout: 5000 }).then(() => true).catch(() => false)

// walk (normally) from the spawn to the Events Board: near (6.5, 9.5)
await C('teleport', 4, 22, Math.PI) // a spot in the square to begin from (the walk-up itself is ordinary movement)
await p.waitForTimeout(500)
await walkTo(7.6, 12.2, async () => (await p.locator('[data-testid=prompt]').textContent().catch(() => '')).includes('Events Board'))
check(await promptHas('Events Board'), 'approached the Events Board on foot; its prompt is showing')
await p.keyboard.press('e')
await p.waitForSelector('[data-testid=event-race]')
const xp0 = (await C('save')).progress.xp
await p.click('[data-testid=event-race]')
await p.waitForFunction(() => window.__chadverse.events()?.phase === 'playing', null, { timeout: 8000 })
const t0 = Date.now()
const gates = []
let guard = 0
while (guard++ < 400) {
  const e = await C('events')
  if (!e || e.phase !== 'playing') break
  const m = e.marks[0]
  if (!m) break
  if (!gates.length || gates[gates.length - 1].x !== m.x) gates.push(m)
  await walkTo(m.x, m.z, async () => (await C('events')).marks[0]?.x !== m.x, 12000)
}
const run = (Date.now() - t0) / 1000
const res = await p.locator('[data-testid=event-result]').textContent({ timeout: 8000 }).catch(() => '')
const info = await C('events')
console.log(`  gates ${gates.length}, wall time ${run.toFixed(1)} s (${MODE}), game timeLeft ${info?.timeLeft}`)
check(gates.length === 6, 'six gates were presented in order')
check(/Cleared/.test(res), `the run is clearable with ordinary ${MODE} movement (${res.trim()})`)
const sv = (await C('save')).progress
check(sv.records.race_best > 0, `best time saved (${sv.records.race_best} cs)`)
check(sv.achievements.includes('race_won'), 'achievement unlocked')
const xp1 = sv.xp
await p.waitForTimeout(3000)
check((await C('save')).progress.xp === xp1 && xp1 > xp0, `XP paid exactly once (${xp0} -> ${xp1}, unchanged 3 s later)`)
// replay -> timeout -> no reward
await p.click('[data-testid=event-again]')
await p.waitForFunction(() => window.__chadverse.events()?.phase === 'playing', null, { timeout: 8000 })
await p.waitForFunction(() => window.__chadverse.events()?.phase === 'done', null, { timeout: 60000 })
const to = await p.locator('[data-testid=event-result]').textContent()
check(/Not this time/.test(to), 'standing still times out cleanly')
check((await C('save')).progress.records.race_best === sv.records.race_best, 'a failed run does not overwrite the best time')
// cancel
await p.click('[data-testid=event-again]')
await p.waitForFunction(() => window.__chadverse.events()?.phase === 'playing', null, { timeout: 8000 })
await p.click('[data-testid=event-quit]')
await p.waitForTimeout(600)
const q = await C('events')
check(q.phase === 'idle' && q.marks.length === 0, 'cancelling clears every gate')
// controls back to normal after the activity
const w0 = await C('world')
await p.keyboard.down('w'); await p.waitForTimeout(1200); await p.keyboard.up('w')
const w1 = await C('world')
check(Math.hypot(w1.x - w0.x, w1.z - w0.z) > 1.5, 'normal movement works again after leaving the activity')
check(!errs.length, `no page errors (${JSON.stringify(errs.slice(0, 2))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
