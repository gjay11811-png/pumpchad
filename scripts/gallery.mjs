import { chromium } from 'playwright'
const out = process.env.SHOTS
const base = process.env.URL || 'http://localhost:4317/'
const exe = process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe'
const browser = await chromium.launch({ executablePath: exe })
const sizes = [
  [375, 667, 'se'],
  [393, 852, 'ip15'],
  [430, 932, 'promax'],
  [768, 1024, 'tab'],
  [1280, 800, 'lap'],
  [1440, 900, 'desk'],
]
for (const [w, h, tag] of sizes) {
  const mobile = w < 800
  const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('requestfailed', (r) => errors.push('FAIL ' + r.url()))
  page.on('response', (r) => r.status() >= 400 && errors.push(r.status() + ' ' + r.url()))
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' })
  // scroll the whole page so lazy images + reveals fire
  const total = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y < total; y += h * 0.8) {
    await page.evaluate((v) => scrollTo(0, v), y)
    await page.waitForTimeout(120)
  }
  await page.evaluate(() => document.querySelector('#chadverse').scrollIntoView())
  await page.waitForTimeout(1600)
  const report = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('#chadverse ul img, #about img')]
    return {
      scrollW: document.documentElement.scrollWidth,
      imgs: imgs.map((i) => {
        const r = i.getBoundingClientRect()
        const drift = Math.abs(r.width / r.height - i.naturalWidth / i.naturalHeight)
        return `${i.src.split('/').pop()} loaded=${i.complete && i.naturalWidth > 0} ${r.width | 0}x${r.height | 0} ratioDrift=${drift.toFixed(3)}`
      }),
    }
  })
  console.log(`\n[${tag} ${w}x${h}] scrollWidth=${report.scrollW} ${report.scrollW > w ? 'OVERFLOW!' : 'ok'}`)
  report.imgs.forEach((l) => console.log('  ' + l))
  // screenshot the whole gallery section
  const sec = page.locator('#chadverse')
  await sec.screenshot({ path: `${out}/g-${tag}.jpg`, quality: 72 })
  if (tag === 'ip15' || tag === 'desk') {
    await page.locator('#chadverse ul li').nth(2).locator('button').click()
    await page.waitForTimeout(700)
    await page.screenshot({ path: `${out}/g-${tag}-viewer.jpg`, quality: 72 })
    if (mobile) {
      // swipe left -> next
      await page.evaluate(() => {
        const d = document.querySelector('[role=dialog]')
        const t = (x) => [new Touch({ identifier: 1, target: d, clientX: x, clientY: 400 })]
        d.dispatchEvent(new TouchEvent('touchstart', { touches: t(300), changedTouches: t(300), bubbles: true }))
        d.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: t(120), bubbles: true }))
      })
      await page.waitForTimeout(600)
    } else {
      await page.keyboard.press('ArrowRight')
      await page.waitForTimeout(600)
    }
    console.log('  viewer after next:', await page.locator('[role=dialog]').getAttribute('aria-label'))
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    console.log('  viewer closed:', (await page.locator('[role=dialog]').count()) === 0)
  }
  console.log('  errors:', errors.length ? errors : 'none')
  await page.close()
}
await browser.close()
