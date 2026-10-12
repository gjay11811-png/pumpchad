// Scene-transition leak check: world → gym → world, repeated, as Demon (horn fires share module-level resources).
import { chromium } from 'playwright'
const species = process.argv[2] || 'Demon'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1280, height: 860 } })
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 300)))
await p.goto(process.env.URL || 'http://localhost:4318/chadverse/', { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'networkidle' })
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('radio', { name: species, exact: true }).first().click()
await p.waitForFunction((s) => window.__chadverse.showroom()?.rig?.species === s, species.toLowerCase(), { timeout: 30000 })
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Leak Test')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
const inWorld = () => p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 30000 })
await inWorld()
const stat = async () => { await p.waitForTimeout(1200); return p.evaluate(() => window.__chadverse.stats()) }
for (let i = 0; i < 5; i++) {
  await p.evaluate(() => window.__chadverse.teleport(14.4, -4))
  await p.waitForTimeout(400)
  await p.keyboard.press('e')
  await p.waitForFunction(() => window.__chadverse?.phase === 'gym' && window.__chadverse.gymInspect(), null, { timeout: 15000 })
  const g = await stat()
  await p.evaluate(() => window.__chadverse.gymGoto('exit')) // leave through the gym door
  await p.waitForTimeout(300)
  await p.keyboard.press('e')
  await inWorld()
  const w = await stat()
  console.log(`cycle ${i}: gym geo ${g.geometries} tex ${g.textures} prog ${g.programs} | world geo ${w.geometries} tex ${w.textures} prog ${w.programs}`)
}
console.log('errors:', errs)
await b.close()
