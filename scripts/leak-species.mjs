// Per-species leak check: rebuild one species repeatedly (chain toggle) and report texture/geometry growth per rebuild.
import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1280, height: 860 } })
await p.goto(process.env.URL || 'http://localhost:4318/chadverse/', { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'networkidle' })
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
const stat = async () => { await p.waitForTimeout(1100); return p.evaluate(() => window.__chadverse.stats()) }
for (const sp of ['Pumpkin', 'Skeleton', 'Demon']) {
  await p.getByRole('radio', { name: sp, exact: true }).first().click()
  await p.waitForFunction((s) => window.__chadverse.showroom()?.rig?.species === s, sp.toLowerCase(), { timeout: 30000 })
  await p.getByRole('tab', { name: 'Gear' }).click()
  const a = await stat()
  for (let i = 0; i < 4; i++) {
    const prev = await p.evaluate(() => window.__chadverse.showroom().rig.root.uuid)
    await p.getByRole('switch', { name: /Gold chain/ }).click()
    await p.waitForFunction((pv) => window.__chadverse.showroom().rig?.root.uuid !== pv, prev, { timeout: 8000 })
  }
  const z = await stat()
  console.log(sp, 'per rebuild: textures', (z.textures - a.textures) / 4, 'geometries', (z.geometries - a.geometries) / 4)
  await p.getByRole('tab', { name: 'Look' }).click()
}
await b.close()
