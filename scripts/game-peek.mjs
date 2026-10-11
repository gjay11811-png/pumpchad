// Quick visual pass: title -> creator -> world, screenshots at phone + desktop sizes.
import { chromium } from 'playwright'
const out = process.env.SHOTS
const base = process.env.URL || 'http://localhost:4318/chadverse/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
for (const [w, h, tag, mobile] of [[393, 852, 'ip', true], [1440, 900, 'dt', false]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message))
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
  await p.goto(base, { waitUntil: 'networkidle' })
  await p.waitForTimeout(600)
  await p.screenshot({ path: `${out}/${tag}-0-loading.jpg`, quality: 75 })
  await p.waitForSelector('[data-testid=enter-muted]', { timeout: 15000 })
  await p.waitForTimeout(800)
  await p.screenshot({ path: `${out}/${tag}-1-title.jpg`, quality: 75 })
  await p.click('[data-testid=enter-muted]')
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `${out}/${tag}-2-creator.jpg`, quality: 75 })
  await p.getByRole('tab', { name: 'Gear' }).click()
  await p.waitForTimeout(700)
  await p.screenshot({ path: `${out}/${tag}-3-gear.jpg`, quality: 75 })
  await p.getByRole('tab', { name: 'Name' }).click()
  await p.fill('#chad-name', 'Gigagourd')
  await p.getByRole('button', { name: /Enter Chad Square/i }).click()
  await p.waitForFunction(() => window.__chadverse?.phase === 'world', null, { timeout: 15000 })
  await p.waitForTimeout(2500)
  await p.screenshot({ path: `${out}/${tag}-4-world.jpg`, quality: 75 })
  console.log(tag, 'errors:', errs, 'stats:', await p.evaluate(() => window.__chadverse.stats()))
  await ctx.close()
}
await b.close()
