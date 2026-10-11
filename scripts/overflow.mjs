import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
await page.goto('http://localhost:4317/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
const r = await page.evaluate(() => {
  const vw = 390, out = []
  for (const el of document.querySelectorAll('body *')) {
    const b = el.getBoundingClientRect()
    if (b.right > vw + 1 || b.left < -1) {
      // only report if no ancestor clips it
      let p = el.parentElement, clipped = false
      while (p && p !== document.body) { const s = getComputedStyle(p); if (s.overflowX !== 'visible') { clipped = true; break } p = p.parentElement }
      if (!clipped) out.push(`${el.tagName}.${(el.className?.baseVal ?? el.className).slice(0, 80)} L${b.left|0} R${b.right|0}`)
    }
  }
  return [document.documentElement.scrollWidth, out.slice(0, 15)]
})
console.log(JSON.stringify(r, null, 1))
await browser.close()
