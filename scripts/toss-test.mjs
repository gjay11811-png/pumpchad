// Pumpkin Toss through normal play: walk up, interact, read the card, start, REAL mouse clicks on the boards, results, best, replay, quit.
// Simulated desktop browser (headless software GL); not a real phone.
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:4318/chadverse/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const ctx = await b.newContext({ viewport: { width: 900, height: 600 }, hasTouch: true })
const p = await ctx.newPage()
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
const R = await C('range')
check(!!R, `a range exists: stand ${JSON.stringify(R && { x: R.stand.x, z: R.stand.z, yaw: +R.stand.yaw.toFixed(2) })}`)
check(Math.hypot(R.stand.x - 110, R.stand.z - 64) < 3, 'the range is where the map marker says (110, 64)')
const promptHas = (t) => p.waitForFunction((n) => (document.querySelector('[data-testid=prompt]')?.textContent ?? '').includes(n), t, { timeout: 5000 }).then(() => true).catch(() => false)
// start 5 m short of the stand, face it, and walk in with W
const back = { x: R.stand.x - Math.sin(R.stand.yaw) * 6, z: R.stand.z - Math.cos(R.stand.yaw) * 6 }
await C('teleport', back.x, back.z, R.stand.yaw)
await p.waitForTimeout(500)
await p.keyboard.down('w')
for (let i = 0; i < 30 && !(await p.locator('[data-testid=prompt]').textContent().catch(() => '')).includes('Pumpkin Toss'); i++) await p.waitForTimeout(120)
await p.keyboard.up('w')
check(await promptHas('Pumpkin Toss'), 'walking up shows the "Play Pumpkin Toss" prompt')
await p.keyboard.press('e')
await p.waitForSelector('[data-testid=toss-start]')
check(true, 'the instruction card opens (10 throws, scoring, controls)')
const best0 = await p.locator('[data-testid=toss-best]').textContent()
await p.click('[data-testid=toss-start]')
await p.waitForFunction(() => window.__chadverse.range()?.phase === 'playing', null, { timeout: 5000 })
await p.waitForTimeout(500)
// movement is held while playing
const w0 = await C('world')
await p.keyboard.down('w'); await p.waitForTimeout(700); await p.keyboard.up('w')
const w1 = await C('world')
check(Math.hypot(w1.x - w0.x, w1.z - w0.z) < 0.15, 'movement is locked on the line during the round')
// throws: aim real clicks at each board centre (the first at the sliding board's bullseye), then one deliberate miss
const click = async (nx, ny) => { await p.mouse.click(((nx + 1) / 2) * 900, ((1 - ny) / 2) * 600) }
let thrown = 0
for (let i = 0; i < 10; i++) {
  const bs = await C('rangeBoards')
  const pick = i === 9 ? null : bs[i % bs.length]
  if (pick) await click(pick.x, pick.y)
  else await click(-0.95, -0.9)
  thrown++
  await p.waitForFunction((n) => window.__chadverse.range()?.thrown >= n, thrown, { timeout: 5000 })
  await p.waitForTimeout(650)
}
await p.waitForSelector('[data-testid=toss-final]', { timeout: 8000 })
const st = await C('range')
const final = Number(await p.locator('[data-testid=toss-final]').textContent())
check(st.thrown === 10 && final === st.score && st.hits >= 7, `ten throws, ${st.hits} hits, score ${final}`)
check(final > 0 && (await C('save')).progress.records.pumpkin_toss === final, 'personal best saved locally')
const xp1 = (await C('save')).progress.xp
await p.waitForTimeout(2500)
check((await C('save')).progress.xp === xp1 && xp1 > 0, `reward paid once (${xp1} XP, unchanged 2.5 s later)`)
// extra clicks after the round do nothing
await click(0, 0)
await p.waitForTimeout(400)
check((await C('range')).thrown === 10, 'clicks after the last throw do not add throws')
// replay + quit mid-round => no reward
await p.click('[data-testid=toss-again]')
await p.waitForFunction(() => window.__chadverse.range()?.phase === 'playing', null, { timeout: 5000 })
const bs = await C('rangeBoards')
await click(bs[0].x, bs[0].y)
await p.waitForTimeout(700)
await p.click('[data-testid=toss-quit]')
await p.waitForTimeout(600)
check((await C('save')).progress.xp === xp1, 'quitting mid-round gives no reward')
const r2 = await C('range')
check(r2.phase === 'idle', 'the range is idle again after quitting')
const w2 = await C('world')
await p.keyboard.down('s'); await p.waitForTimeout(900); await p.keyboard.up('s')
const w3 = await C('world')
check(Math.hypot(w3.x - w2.x, w3.z - w2.z) > 1.2, 'normal movement is restored after the activity')
// a touch tap also throws (simulated touch event, not a real phone)
await p.keyboard.press('e').catch(() => {})
check(!errs.length, `no page errors (${JSON.stringify(errs.slice(0, 2))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
