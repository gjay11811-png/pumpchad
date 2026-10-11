// GPU resource leak check: rebuild characters many times in the creator and track renderer memory + program count.
import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1280, height: 860 } })
const errs = []
p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 300)))
await p.goto(process.env.URL || 'http://localhost:4318/chadverse/', { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'networkidle' })
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
const stat = () => p.evaluate(() => window.__chadverse.stats())
const pick = async (sp) => {
  await p.getByRole('radio', { name: sp, exact: true }).first().click()
  await p.waitForFunction((s) => window.__chadverse.showroom()?.rig?.species === s, sp.toLowerCase(), { timeout: 30000 })
}
const rows = []
for (let round = 0; round < 6; round++) {
  for (const sp of ['Skeleton', 'Demon', 'Pumpkin']) {
    await pick(sp)
    const prev = await p.evaluate(() => window.__chadverse.showroom().rig.root.uuid)
    await p.getByRole('tab', { name: 'Gear' }).click()
    await p.getByRole('switch', { name: /Gold chain/ }).click()
    await p.waitForFunction((pv) => window.__chadverse.showroom().rig?.root.uuid !== pv, prev, { timeout: 8000 }).catch(() => {})
    await p.getByRole('tab', { name: 'Look' }).click()
  }
  await p.waitForTimeout(1200)
  const s = await stat()
  rows.push(s)
  console.log('round', round, 'geometries', s.geometries, 'textures', s.textures, 'programs', s.programs)
}
console.log('errors:', errs)
await b.close()
