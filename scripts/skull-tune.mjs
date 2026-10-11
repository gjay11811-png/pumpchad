import { chromium } from 'playwright'
const out = process.env.SHOTS
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 900, height: 700 } })
await p.goto('http://localhost:4318/chadverse/', { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'networkidle' })
await p.waitForSelector('[data-testid=enter-muted]')
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('radio', { name: 'Skeleton', exact: true }).first().click()
await p.waitForFunction(() => window.__chadverse.showroom()?.rig?.species === 'skeleton', null, { timeout: 30000 })
await p.addStyleTag({ content: '[aria-label="Character options"], [aria-label="Species"], h1, [role=radiogroup][aria-label="Preview animation"] { opacity: 0 !important }' })
const variants = JSON.parse(process.argv[2])
for (const [i, v] of variants.entries()) {
  await p.evaluate(async (v) => {
    globalThis.__skull = v
    const r = window.__chadverse.showroom()
    r.autoRotate = false; r.yaw = 0; r.zoom = 1; r.setInsets({ left: 0, right: 0, top: 0, bottom: 0 })
    await r.setAppearance({ species: 'skeleton', skin: '#e9e2d0', outfit: '#2a262c', glow: '#7fd6ff', top: 'armor', headwear: v.headwear ?? 'none', eyewear: 'none', chain: true })
  }, v)
  for (const [tag, yaw] of [['f', 0], ['s', -1.45], ['b', 2.6]]) {
    await p.evaluate((y) => { window.__chadverse.showroom().yaw = y }, yaw)
    await p.waitForTimeout(tag === 'f' ? 1800 : 700)
    await p.screenshot({ path: `${out}/skull-v${i}${tag}.jpg`, quality: 85 })
  }
}
await b.close()
