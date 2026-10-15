// A forced WebGL context loss (WEBGL_lose_context, the same event a phone raises): the recovery card shows, the loss + restore are logged with GPU/heap
// facts, and the game carries on after the context comes back. SIMULATED (headless).
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--enable-precise-memory-info'] })
const p = await b.newPage({ viewport: { width: 800, height: 520 } })
let fails = 0
const check = (ok, msg) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!ok) fails++
}
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'] }, settings: { quality: 'low', muted: true } })))
await p.goto(BASE)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Lossy')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
await p.waitForTimeout(1500)
await p.evaluate(() => window.__chadverse.loseContext())
await p.waitForSelector('[data-testid=gfx-lost]', { timeout: 10000 }).then(
  () => check(true, 'the recovery card shows when the context is lost'),
  () => check(false, 'the recovery card shows when the context is lost'),
)
await p.waitForSelector('[data-testid=gfx-lost]', { state: 'detached', timeout: 15000 }).then(
  () => check(true, 'and goes away by itself when the browser restores the context'),
  () => check(false, 'and goes away by itself when the browser restores the context'),
)
const log = await p.evaluate(() => window.__chadverse.gfxLog())
console.log('  gfx log:', JSON.stringify(log).slice(0, 700))
check(log.length >= 2 && log[0].kind === 'lost' && log[log.length - 1].kind === 'restored', 'the loss and the restore were logged')
check(typeof log[0]?.geometries === 'number' && typeof log[0]?.heapMB === 'number', 'each entry records what the GPU / heap held at that moment')
const before = (await p.evaluate(() => window.__chadverse.world())).t
await p.waitForTimeout(1500)
const after = (await p.evaluate(() => window.__chadverse.world())).t
check(after > before + 0.5, 'the world keeps simulating after the restore')
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
