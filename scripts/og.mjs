import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1200, height: 630 } })
await p.goto('file:///' + process.argv[2].replace(/^\/c\//, 'C:/'), { waitUntil: 'networkidle' })
await p.waitForTimeout(800)
await p.screenshot({ path: 'public/og-image.jpg', type: 'jpeg', quality: 86 })
await b.close()
