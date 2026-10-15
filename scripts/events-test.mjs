// Village events end to end: the board prompt, each event started, played (the test walks to the real markers), cleared or failed,
// XP + records saved, quitting leaves nothing behind.
//   URL=http://localhost:4318/chadverse/ Q=low node scripts/events-test.mjs
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:4318/chadverse/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 900, height: 600 } })
const errs = []
let fails = 0
const check = (ok, msg) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!ok) fails++
}
p.on('pageerror', (e) => errs.push(e.message))
await p.addInitScript((q) => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: {}, settings: { quality: q, muted: true } })), process.env.Q || 'low')
await p.goto(BASE)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Explorer')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 90000 })
const C = (fn, ...a) => p.evaluate(([f, a]) => window.__chadverse[f](...a), [fn, a])
const promptHas = (t) => p.waitForFunction((n) => (document.querySelector('[data-testid=prompt]')?.textContent ?? '').includes(n), t, { timeout: 5000 }).then(() => true).catch(() => false)

// the board
await C('teleport', 7.2, 8.2, 0)
check(await promptHas('Events Board'), 'the Events Board shows its prompt')
await p.keyboard.press('e')
await p.waitForSelector('[data-testid=event-hunt]', { timeout: 5000 })
check(true, 'the board opens the event menu')

// walk to whatever the director shows, one marker at a time
const play = async (id, mover) => {
  await p.click(`[data-testid=event-${id}]`)
  await p.waitForFunction(() => window.__chadverse.events()?.phase === 'playing', null, { timeout: 8000 })
  const t0 = Date.now()
  while (Date.now() - t0 < 60000) {
    const e = await C('events')
    if (!e || e.phase === 'done') break
    await mover(e)
    await p.waitForTimeout(120)
  }
  await p.waitForSelector('[data-testid=event-result]', { timeout: 8000 })
}
const goTo = async (e) => {
  const m = e.marks[0]
  if (m) await C('teleport', m.x, m.z, 0)
}
const xp0 = (await C('save')).progress.xp

await play('hunt', goTo)
check((await p.textContent('[data-testid=event-result]')).includes('Cleared'), 'Midnight Pumpkin Hunt: cleared by collecting the lit pumpkins')
check((await C('save')).progress.records.event_hunt === 1 && (await C('save')).progress.achievements.includes('hunt_won'), 'hunt: clear counted + achievement')

await p.click('[data-testid=event-menu]')
await play('festival', goTo)
check((await p.textContent('[data-testid=event-result]')).includes('Cleared'), 'Harvest Festival: all five lanterns lit')

await p.click('[data-testid=event-menu]')
await play('invasion', async (e) => {
  const q = await C('world')
  // run into the nearest ghost
  const m = e.marks.slice().sort((a, b) => Math.hypot(a.x - q.x, a.z - q.z) - Math.hypot(b.x - q.x, b.z - q.z))[0]
  if (m) await C('teleport', m.x, m.z, 0)
})
check((await p.textContent('[data-testid=event-result]')).includes('Cleared'), 'Ghost Invasion: cleared by banishing ghosts')

await p.click('[data-testid=event-menu]')
await play('storm', goTo)
check((await p.textContent('[data-testid=event-result]')).includes('Cleared') || (await p.textContent('[data-testid=event-result]')).includes('Not this time'), 'Thunderstorm: round ends with a result')

await p.click('[data-testid=event-menu]')
await play('race', goTo)
check((await p.textContent('[data-testid=event-result]')).includes('Cleared'), 'Square Time Trial: all gates cleared in order')
const sv = (await C('save')).progress
check(sv.records.race_best > 0 && sv.achievements.includes('race_won'), `time trial: best time kept (${sv.records.race_best} cs) + achievement`)

// failing: stand still through the invasion
await p.click('[data-testid=event-menu]')
await C('teleport', 25, 0, 0)
await p.click('[data-testid=event-invasion]')
await p.waitForFunction(() => window.__chadverse.events()?.phase === 'done', null, { timeout: 90000 })
await p.waitForSelector('[data-testid=event-result]')
check((await p.textContent('[data-testid=event-result]')).includes('Not this time'), 'Ghost Invasion: failing leaves you with a clear result')

check((await C('save')).progress.xp > xp0, 'events pay XP')
// quitting
await p.click('[data-testid=event-menu]')
await p.click('[data-testid=event-hunt]')
await p.waitForFunction(() => window.__chadverse.events()?.phase === 'playing', null, { timeout: 8000 })
await p.click('[data-testid=event-quit]')
await p.waitForTimeout(500)
check((await C('events')).phase === 'idle' && (await C('events')).marks.length === 0, 'quitting a round leaves no markers behind')
check(!errs.length, `no page errors (${JSON.stringify(errs.slice(0, 2))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
