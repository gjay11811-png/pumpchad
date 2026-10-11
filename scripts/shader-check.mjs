import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
for (const [w, h, mobile] of [[1440, 900, false], [393, 852, true]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile })
  const logs = []
  p.on('console', (m) => m.type() === 'error' && logs.push(m.text().slice(0, 1500)))
  await p.goto(process.env.URL || 'http://localhost:4318/chadverse/', { waitUntil: 'networkidle' })
  await p.evaluate(() => localStorage.clear())
  await p.reload({ waitUntil: 'networkidle' })
  await p.waitForSelector('[data-testid=enter-muted]')
  await p.waitForTimeout(1500)
  console.log(mobile ? 'mobile' : 'desktop', 'after title:', logs.length)
  await p.click('[data-testid=enter-muted]')
  await p.waitForTimeout(1500)
  for (const sp of ['Skeleton', 'Demon', 'Pumpkin']) {
    await p.getByRole('radio', { name: sp }).first().click()
    await p.waitForTimeout(1500)
    console.log(' after', sp, logs.length)
  }
  logs.slice(0, 2).forEach((l) => console.log('----\n' + l))
  await p.close()
}
await b.close()
