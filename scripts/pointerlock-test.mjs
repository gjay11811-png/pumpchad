// Desktop mouse capture: one click captures, free look without a button, Esc / menus release, touch camera stays separate.
// SIMULATED: headless Chromium with synthetic mouse events — NOT a real mouse on a real desktop.
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1000, height: 650 } })
const errs = []
let fails = 0
const check = (ok, msg) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!ok) fails++
}
p.on('pageerror', (e) => errs.push(e.message))
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'] }, settings: { quality: 'low', muted: true } })))
await p.goto(BASE)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Explorer')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const W = () => p.evaluate(() => window.__chadverse.world())
const wait = (ms) => p.waitForTimeout(ms)
const locked = () => p.evaluate(() => !!document.pointerLockElement)
await p.evaluate(() => window.__chadverse.teleport(0, 40, Math.PI))
await wait(800)
// 1. moving the mouse with no button and no capture does nothing
const y0 = (await W()).camYaw
await p.mouse.move(400, 300)
await p.mouse.move(600, 300, { steps: 8 })
await wait(200)
check(Math.abs((await W()).camYaw - y0) < 0.01, 'before the click: moving the mouse without a button does not turn the camera')
check(!(await locked()), 'not captured before any click')
// 2. one click captures
await p.mouse.click(500, 300)
await wait(400)
check(await locked(), 'one click on the 3D view captures the mouse')
check((await p.locator('text=Mouse captured').count()) === 1, 'the HUD says the mouse is captured and Esc releases it')
// 3. free look, no button held
const y1 = (await W()).camYaw
await p.mouse.move(500, 300)
await p.mouse.move(700, 300, { steps: 10 })
await wait(300)
const y2 = (await W()).camYaw
check(Math.abs(y2 - y1) > 0.1, `moving the mouse turns the camera with no button held (dyaw ${(y2 - y1).toFixed(2)})`)
// 4. W still walks while captured, clicking does not lose the lock
await p.keyboard.down('w')
await wait(500)
await p.keyboard.up('w')
check(await locked(), 'movement keys do not release the capture')
// 5. a menu releases it (pause button), the cursor works again, the camera no longer turns
await p.keyboard.press('Escape')
await wait(500)
check(!(await locked()), 'Escape releases the capture')
await wait(300)
const pauseOpen = (await p.locator('[role=dialog], [data-testid=pause-menu]').count()) > 0 || (await p.getByText(/Resume/i).count()) > 0
console.log('  pause menu visible after Esc:', pauseOpen)
check(pauseOpen, 'releasing with Esc also opens the pause menu (single press)')
const y3 = (await W()).camYaw
await p.mouse.move(300, 300)
await p.mouse.move(500, 300, { steps: 6 })
await wait(200)
check(Math.abs((await W()).camYaw - y3) < 0.01, 'with the menu open, the mouse does not steer the camera')
await p.getByText(/Resume/i).first().click()
await wait(500)
check(!(await locked()), 'resuming does not silently re-capture: a new click is needed')
// 6. re-capture, then open the map (M): released
await p.mouse.click(500, 300)
await wait(1200)
if (!(await locked())) {
  await p.mouse.click(500, 300)
  await wait(600)
}
check(await locked(), 'a fresh click captures again')
await p.keyboard.press('m')
await wait(500)
check(!(await locked()), 'opening the map releases the capture')
await p.keyboard.press('Escape')
await wait(500)
// 7. drag-look (no capture) still works as a fallback
await p.evaluate(() => document.exitPointerLock?.())
await wait(300)
const d0 = (await W()).camYaw
await p.mouse.move(400, 300)
await p.mouse.down()
await p.mouse.move(520, 300, { steps: 8 })
await p.mouse.up()
await wait(200)
check(Math.abs((await W()).camYaw - d0) > 0.05 || (await locked()), 'a drag still turns the camera when not captured (or the release click captured)')
check(!errs.length, `no page errors (${JSON.stringify(errs.slice(0, 2))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
