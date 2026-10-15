// Activity cards, HUDs and touch transitions on a landscape phone profile. SIMULATED (Chrome DevTools touch events on an
// emulated iPhone 13 landscape, 844x390) — NOT a real phone.
import { chromium, devices } from 'playwright'
const URL = process.env.URL || 'http://localhost:4318/chadverse/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const ctx = await b.newContext({ ...devices['iPhone 13 landscape'] })
const p = await ctx.newPage()
const errs = []
let fails = 0
const check = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails++ }
p.on('pageerror', (e) => errs.push(e.message))
await p.goto(URL, { waitUntil: 'networkidle' })
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen', 'visit_haunted', 'visit_lake'] }, settings: { quality: 'low', muted: true } })) })
await p.reload({ waitUntil: 'networkidle' })
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Thumb Test')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
await p.waitForTimeout(1500)
const VW = p.viewportSize().width
const VH = p.viewportSize().height
console.log(`  viewport ${VW}x${VH}`)
const cdp = await ctx.newCDPSession(p)
const active = new Map()
const send = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...active.entries()].map(([id, [x, y]]) => ({ x, y, id })) })
const down = async (id, x, y) => { active.set(id, [x, y]); await send('touchStart') }
const move = async (id, x, y) => { active.set(id, [x, y]); await send('touchMove') }
const up = async (id) => { const [x, y] = active.get(id) ?? [0, 0]; active.delete(id); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x, y, id }] }) }
const W = () => p.evaluate(() => window.__chadverse.world())
const C = (fn, ...a) => p.evaluate(([f, a]) => window.__chadverse[f](...a), [fn, a])
const wait = (ms) => p.waitForTimeout(ms)
const tapEl = async (sel, id = 9) => { const bb = await p.locator(sel).first().boundingBox(); await down(id, bb.x + bb.width / 2, bb.y + bb.height / 2); await wait(60); await up(id) }
const fits = async (sel, label) => {
  const bb = await p.locator(sel).first().boundingBox()
  const ok = bb && bb.x >= -1 && bb.y >= -1 && bb.x + bb.width <= VW + 1 && bb.y + bb.height <= VH + 16 /* the emulated layout viewport is ~14 px taller than the visible area; confirm on a real device */
  check(ok, `${label} fits the landscape screen (${bb ? `${Math.round(bb.width)}x${Math.round(bb.height)} at ${Math.round(bb.x)},${Math.round(bb.y)}` : 'missing'})`)
}
const J = [90, VH - 80]
const stopped = async (label) => {
  await wait(500)
  const a = await W(); await wait(700); const c = await W()
  check(Math.hypot(c.x - a.x, c.z - a.z) < 0.03, `${label}: character stays stopped`)
}
const prompt = (t) => p.waitForFunction((n) => (document.querySelector('[data-testid=prompt]')?.textContent ?? '').includes(n), t, { timeout: 6000 }).then(() => true).catch(() => false)
const GO = 'button:text-is("Go")' // the round touch action button
const PANEL = 'xpath=ancestor::div[contains(@class,"panel")][1]'

// 1) events board: card fits; a held stick is released cleanly when the menu opens
await C('teleport', 7.4, 11.4, Math.PI)
await wait(600)
check(await prompt('Events Board'), 'the board prompt shows')
await tapEl(GO, 2)
await p.waitForSelector('[data-testid=event-hunt]', { timeout: 5000 })
await fits(`[data-testid=event-hunt] >> ${PANEL}`, 'the Events Board card')
await tapEl('[data-testid=event-close]')
await wait(500)
// a stick held while a second finger opens the menu: the walk stops with the menu, and stays stopped after release
await C('teleport', 12, 22, Math.PI); await wait(500); await C('teleport', 7.4, 11.4, Math.PI); await wait(600) // step away and back (the prompt re-arms after you leave)
await down(1, ...J); await move(1, J[0] + 6, J[1] - 6) // a thumb resting on the stick (barely pushed)
await wait(200)
console.log('  debug', JSON.stringify(await W()), await p.locator('[data-testid=prompt]').count(), JSON.stringify(await p.locator('button').allTextContents()))
await p.waitForSelector(GO, { timeout: 10000 })
await tapEl(GO, 2)
await p.waitForSelector('[data-testid=event-hunt]', { timeout: 5000 })
await up(1)
await stopped('menu opened with a held stick, then released')
// 2) time trial: start by tap, HUD fits, steering works, quit by tap, controls return
await tapEl('[data-testid=event-race]')
await p.waitForFunction(() => window.__chadverse.events()?.phase === 'playing', null, { timeout: 8000 })
await fits('[data-testid=event-hud]', 'the Time Trial HUD')
const hud = await p.locator('[data-testid=event-hud]').boundingBox()
check(hud.y + hud.height < VH * 0.6, 'the HUD stays in the top part (the joystick and action button stay clear)')
const w0 = await W()
await down(1, ...J); await move(1, J[0], J[1] - 50); await wait(900)
const w1 = await W()
check(Math.hypot(w1.x - w0.x, w1.z - w0.z) > 0.8, 'the stick moves the runner during the round')
await up(1)
await stopped('after the stick is lifted during the round')
await tapEl('[data-testid=event-quit]')
await wait(600)
check((await C('events')).phase === 'idle', 'quit by tap ends the round')
const w2a = await W()
await down(1, ...J); await move(1, J[0], J[1] - 50); await wait(700)
const w2 = await W()
await up(1)
check(Math.hypot(w2.x - w2a.x, w2.z - w2a.z) > 0.5, 'controls are back after the activity')
// 3) ghost hunt card
await C('teleport', -61.6, 3.3, -Math.PI / 2)
await wait(600)
check(await prompt('Ghost Hunt'), 'the Ghost Hunt prompt shows')
await tapEl(GO)
await p.waitForSelector('[data-testid=event-ghosthunt]', { timeout: 5000 })
await fits(`[data-testid=event-ghosthunt] >> ${PANEL}`, 'the Ghost Hunt card')
await p.keyboard.press('Escape').catch(() => {})
await wait(500)
// 4) pumpkin toss: card fits, a tap throws
const R = await C('range')
await C('teleport', R.stand.x - Math.sin(R.stand.yaw) * 1.8, R.stand.z - Math.cos(R.stand.yaw) * 1.8, R.stand.yaw)
await wait(600)
check(await prompt('Pumpkin Toss'), 'the Pumpkin Toss prompt shows')
await tapEl(GO)
await p.waitForSelector('[data-testid=toss-start]', { timeout: 5000 })
await fits(`[data-testid=toss-start] >> ${PANEL}`, 'the Pumpkin Toss card')
await tapEl('[data-testid=toss-start]')
await p.waitForFunction(() => window.__chadverse.range()?.phase === 'playing', null, { timeout: 5000 })
await wait(700)
await fits('[data-testid=toss-hud]', 'the Pumpkin Toss HUD')
const bd = (await C('rangeBoards'))[0]
await down(3, ((bd.x + 1) / 2) * VW, ((1 - bd.y) / 2) * VH)
await wait(60)
await up(3)
await p.waitForFunction(() => window.__chadverse.range()?.thrown >= 1, null, { timeout: 4000 }).catch(() => {})
check((await C('range')).thrown >= 1, 'a finger tap on a board throws')
await tapEl('[data-testid=toss-quit]')
await wait(600)
// rotate away and back mid-activity: nothing sticks
await down(1, ...J); await move(1, J[0], J[1] - 50); await wait(300)
await p.setViewportSize({ width: VH, height: VW }); await wait(400)
await p.setViewportSize({ width: VW, height: VH }); await wait(400)
await up(1).catch(() => {})
await stopped('rotated portrait and back with the stick held')
check(!errs.length, `no page errors (${JSON.stringify(errs.slice(0, 2))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)






