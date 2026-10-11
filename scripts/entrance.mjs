import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
for (const [w, h, mobile] of [[1440, 900, false], [393, 852, true]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile })
  const errs = []; p.on('pageerror', (e) => errs.push(e.message))
  await p.goto('http://localhost:4317/', { waitUntil: 'networkidle' })
  if (mobile) {
    await p.click('button[aria-controls="mobile-menu"]'); await p.waitForTimeout(900)
    await p.screenshot({ path: `${process.env.SHOTS}/entrance-menu.jpg`, quality: 70 })
    await p.click('#mobile-menu a[href="/chadverse/"]')
  } else {
    await p.screenshot({ path: `${process.env.SHOTS}/entrance-header.jpg`, quality: 70, clip: { x: 0, y: 0, width: 1440, height: 90 } })
    await p.evaluate(() => document.querySelector('#chadverse').scrollIntoView()); await p.waitForTimeout(1200)
    await p.screenshot({ path: `${process.env.SHOTS}/entrance-gallery.jpg`, quality: 70 })
    await p.click('#chadverse a[href="/chadverse/"]')
  }
  await p.waitForURL('**/chadverse/', { timeout: 5000 })
  await p.waitForSelector('[data-testid=enter-muted]', { timeout: 15000 })
  console.log(mobile ? 'iphone' : 'desktop', 'entrance -> game title OK; errors:', errs)
  await p.close()
}
await b.close()
