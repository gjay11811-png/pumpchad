// Demon QA close-ups (belt / pauldron / bracers / boots) at several angles. Optional JSON arg sets globalThis.__demon overrides.
import { chromium } from 'playwright'
const out = process.env.SHOTS
const tag = process.argv[3] || 'dd'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1000, height: 1000 } })
await p.goto(process.env.URL || 'http://localhost:4318/chadverse/', { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'networkidle' })
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('radio', { name: 'Demon', exact: true }).first().click()
await p.waitForFunction(() => window.__chadverse.showroom()?.rig?.species === 'demon', null, { timeout: 30000 })
await p.addStyleTag({ content: '[aria-label="Character options"], [aria-label="Species"], h1, [role=radiogroup][aria-label="Preview animation"] { opacity: 0 !important }' })
const top = process.env.TOP || 'armor'
await p.evaluate(async ([o, top]) => {
  globalThis.__demon = o; globalThis.__zoom = o.zoom
  const r = window.__chadverse.showroom()
  r.autoRotate = false; r.zoom = +(globalThis.__zoom ?? 1); r.setInsets({ left: 0, right: 0, top: 0, bottom: 0 })
  await r.setAppearance({ species: 'demon', skin: '#8e1f18', outfit: '#141216', glow: '#ff6a2a', top, headwear: 'none', eyewear: 'none', chain: true })
  r.previewPose = 'idle'
}, [JSON.parse(process.argv[2] || '{}'), top])
for (const [t, yaw] of [['f', 0], ['q', -0.7], ['s', -1.5], ['b', 3.0]]) {
  await p.evaluate((y) => { window.__chadverse.showroom().yaw = y }, yaw)
  await p.waitForTimeout(t === 'f' ? 1600 : 700)
  await p.screenshot({ path: `${out}/${tag}-${t}.jpg`, quality: 88, clip: process.env.FULL ? { x: 0, y: 0, width: 1000, height: 1000 } : { x: 200, y: 250, width: 600, height: 750 } })
}
await b.close()
