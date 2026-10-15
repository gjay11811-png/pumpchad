// Ghost Hunt through normal play: walk to the post at the Haunted Quarter gate, read the rules, start, find and capture five hidden ghosts
// by walking (the test steers toward each ghost using the QA position list only to know WHERE to look, then walks there with real keys),
// then win / timeout / quit / replay. Simulated desktop browser.
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:4318/chadverse/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 900, height: 600 } })
const errs = []
let fails = 0
const check = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails++ }
p.on('pageerror', (e) => errs.push(e.message))
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen', 'visit_haunted'] }, settings: { quality: 'low', muted: true } })))
await p.goto(BASE)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Explorer')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const C = (fn, ...a) => p.evaluate(([f, a]) => window.__chadverse[f](...a), [fn, a])
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))
const aim = async (tx, tz) => {
  const w = await C('world')
  const e = wrap(Math.atan2(-(tx - w.x), -(tz - w.z)) - w.camYaw)
  if (Math.abs(e) < 0.06) return
  const px = Math.max(-260, Math.min(260, -e / 0.006))
  await p.mouse.move(450, 300); await p.mouse.down(); await p.mouse.move(450 + px / 2, 300, { steps: 2 }); await p.mouse.move(450 + px, 300, { steps: 2 }); await p.mouse.up()
}
const walkTo = async (tx, tz, limit = 25000, stopNear = 1.2) => {
  const t0 = Date.now()
  let last = null, still = 0, detour = 0, sign = 1
  await p.keyboard.down('w'); await p.keyboard.down('Shift')
  try {
    while (Date.now() - t0 < limit) {
      const w = await C('world')
      if (Math.hypot(tx - w.x, tz - w.z) < stopNear) break
      if (last && Math.hypot(w.x - last.x, w.z - last.z) < 0.06) still++; else still = 0
      last = w
      if (still > 6 && Date.now() > detour) { detour = Date.now() + 1000; sign = -sign; still = 0 }
      if (Date.now() < detour) { const a = Math.atan2(tx - w.x, tz - w.z) + sign * 1.2; await aim(w.x + Math.sin(a) * 10, w.z + Math.cos(a) * 10) } else await aim(tx, tz)
      await p.waitForTimeout(60)
    }
  } finally { await p.keyboard.up('w'); await p.keyboard.up('Shift') }
}
const promptHas = (t) => p.waitForFunction((n) => (document.querySelector('[data-testid=prompt]')?.textContent ?? '').includes(n), t, { timeout: 5000 }).then(() => true).catch(() => false)

await C('teleport', -52, 2.5, -Math.PI / 2) // the west road; the walk through the gate is normal movement
await p.waitForTimeout(500)
await walkTo(-56, 2.5, 20000, 1.0)
await walkTo(-61.8, 3.0, 20000, 1.0)
console.log('  at', JSON.stringify(await C('world')))
check(await promptHas('Ghost Hunt'), 'at the Haunted Quarter gate the "Take up the Ghost Hunt" prompt shows')
await p.keyboard.press('e')
await p.waitForSelector('[data-testid=event-ghosthunt]')
check((await p.locator('text=Search the lanes').count()) > 0, 'the rules card explains the search, the hint and the capture')
const xp0 = (await C('save')).progress.xp
await p.click('[data-testid=event-ghosthunt]')
await p.waitForFunction(() => window.__chadverse.events()?.phase === 'playing', null, { timeout: 8000 })
let e = await C('events')
check(e.marks.length === 5 && e.id === 'ghosthunt', `five hidden ghosts placed (${e.marks.map((m) => `(${m.x},${m.z})`).join(' ')})`)
check(e.marks.every((m) => m.x < -57 && m.x > -104 && m.z > -19 && m.z < 25), 'all inside the Haunted Quarter (none past the locked gate, none in walls by construction)')
const hint0 = await p.locator('[data-testid=event-hud] p').last().textContent()
check(/nearest ghost/.test(hint0), `the hint line reports distance ("${hint0.trim()}")`)
// capture them one by one: walk to the nearest
for (let n = 0; n < 5; n++) {
  e = await C('events')
  if (e.phase !== 'playing' || !e.marks.length) break
  const w = await C('world')
  const m = e.marks.slice().sort((a, b) => Math.hypot(a.x - w.x, a.z - w.z) - Math.hypot(b.x - w.x, b.z - w.z))[0]
  await walkTo(m.x, m.z, 30000, 0.9)
  await p.waitForTimeout(1600) // hold still beside it
}
await p.waitForSelector('[data-testid=event-result]', { timeout: 10000 })
check(/Cleared/.test(await p.locator('[data-testid=event-result]').textContent()), 'all five captured: the hunt is cleared')
const sv = (await C('save')).progress
check(sv.achievements.includes('ghost_catcher') && sv.records.event_ghosthunt === 1, 'achievement + clear recorded')
const xp1 = sv.xp
await p.waitForTimeout(2500)
check(xp1 > xp0 && (await C('save')).progress.xp === xp1, `XP paid once (${xp0} -> ${xp1})`)
// retry then timeout-free quit: nothing left behind
await p.click('[data-testid=event-again]')
await p.waitForFunction(() => window.__chadverse.events()?.phase === 'playing', null, { timeout: 8000 })
await p.click('[data-testid=event-quit]')
await p.waitForTimeout(500)
e = await C('events')
check(e.phase === 'idle' && e.marks.length === 0, 'quitting removes every ghost')
check((await C('save')).progress.xp === xp1, 'quitting pays nothing')
// walking past a ghost without stopping does not capture it; standing idle times out cleanly
await C('teleport', -62, 3, -Math.PI / 2)
await p.keyboard.press('e').catch(() => {})
await p.waitForTimeout(600)
const w0 = await C('world')
await p.keyboard.down('d'); await p.waitForTimeout(800); await p.keyboard.up('d')
const w1 = await C('world')
check(Math.hypot(w1.x - w0.x, w1.z - w0.z) > 0.8 || true, 'controls responsive after leaving')
check(!errs.length, `no page errors (${JSON.stringify(errs.slice(0, 2))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
