// The three species in the real character creator (UI visible), desktop + phone.
import { chromium } from 'playwright'
const out = process.env.SHOTS
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
for (const [w, h, mobile, tag] of [[1440, 900, false, 'dt'], [393, 852, true, 'ip']]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 })
  const errs = []
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)))
  await p.goto(process.env.URL || 'http://localhost:4318/chadverse/', { waitUntil: 'networkidle' })
  await p.evaluate(() => localStorage.clear())
  await p.reload({ waitUntil: 'networkidle' })
  await p.waitForSelector('[data-testid=enter-muted]')
  await p.click('[data-testid=enter-muted]')
  await p.waitForSelector('[role=tablist]')
  for (const sp of ['Skeleton', 'Demon', 'Pumpkin']) {
    await p.getByRole('radio', { name: sp, exact: true }).first().click()
    await p.waitForFunction((s) => window.__chadverse.showroom()?.rig?.species === s, sp.toLowerCase(), { timeout: 30000 })
    await p.evaluate(() => { const r = window.__chadverse.showroom(); r.autoRotate = false; r.yaw = -0.35 })
    await p.waitForTimeout(1400)
    await p.screenshot({ path: `${out}/cs-${tag}-${sp.toLowerCase()}.jpg`, quality: 82 })
    if (!mobile) {
      await p.getByRole('tab', { name: 'Outfit' }).click()
      await p.waitForTimeout(300)
      const tops = await p.getByRole('radiogroup', { name: 'Top' }).getByRole('radio').allTextContents()
      await p.getByRole('tab', { name: 'Gear' }).click()
      await p.waitForTimeout(300)
      const hw = await p.getByRole('radiogroup', { name: 'Headwear' }).getByRole('radio').allTextContents()
      console.log(sp, 'tops:', tops.join(' | '), '· headwear:', hw.join(' | '))
      await p.getByRole('tab', { name: 'Look' }).click()
    }
  }
  console.log(tag, 'errors:', errs)
  await p.close()
}
await b.close()
