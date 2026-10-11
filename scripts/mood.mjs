import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true })
await p.goto('http://localhost:4317/', { waitUntil: 'networkidle' })
for (let i = 0; i < 6; i++) { await p.waitForTimeout(800); console.log(await p.locator('[aria-live=polite]').first().innerText()) }
await p.evaluate(() => scrollTo(0, 700)); await p.waitForTimeout(400)
for (let i = 0; i < 6; i++) { await p.waitForTimeout(700); if ((await p.locator('[aria-live=polite]').first().innerText()).split('\n').length > 1) { await p.screenshot({ path: process.env.SHOTS + '/mood.jpg' }); break } }
await b.close()
