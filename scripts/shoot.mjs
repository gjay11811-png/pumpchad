import { chromium } from 'playwright'
const [,, w, h, tag, steps = '40'] = process.argv
const out = process.env.SHOTS
const browser = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: +w < 800, isMobile: +w < 800 })
const errors = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => m.type() === 'error' && errors.push(m.text()))
await page.goto('http://localhost:4317/', { waitUntil: 'networkidle' })
await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' }); await page.waitForTimeout(2200)
const total = await page.evaluate(() => document.documentElement.scrollHeight)
const ow = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
console.log(tag, 'height', total, 'scrollWidth/innerWidth', ow)
let y = 0, i = 0
while (y < total && i < +steps) {
  await page.evaluate(v => window.scrollTo(0, v), y)
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${out}/${tag}-${String(i).padStart(2, '0')}.jpg`, quality: 70 })
  y += Math.round(+h * 0.9); i++
}
console.log('shots', i, 'errors', errors)
await browser.close()
