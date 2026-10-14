// House-interior leak check: town → house → town, repeated. GPU geometry / texture counts in town must stay flat
// (each interior frees its textures, furniture and character on exit; villagers share cached geometry).
//   URL=http://localhost:4318/chadverse/ [HOUSE=witch] [Q=low] node scripts/leak-interior.mjs
import { chromium } from 'playwright'
const HOUSE = process.env.HOUSE || 'witch'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 960, height: 600 } })
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 160)))
await p.goto(process.env.URL || 'http://localhost:4318/chadverse/', { waitUntil: 'networkidle' })
await p.evaluate((q) => {
  localStorage.clear()
  localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 1, character: null, progress: { discoveries: ['intro_seen'] }, settings: { quality: q, muted: true } }))
}, process.env.Q || 'low')
await p.reload({ waitUntil: 'networkidle' })
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Leak Check')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
const inWorld = () => p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 60000 })
await inWorld()
const house = (await p.evaluate(() => window.__chadverse.houses())).find((h) => h.id === process.env.HOUSE || h.id === 'witch')
const stats = () => p.evaluate(() => window.__chadverse.stats())
const rows = []
for (let i = 0; i < 4; i++) {
  await p.evaluate(([x, z, y]) => window.__chadverse.teleport(x, z, y), [house.door.x, house.door.z, house.door.yaw + Math.PI])
  await p.waitForTimeout(1500)
  const w = await stats()
  await p.keyboard.press('e')
  await p.waitForFunction(() => window.__chadverse.phase === 'interior' && window.__chadverse.interior(), null, { timeout: 60000 })
  await p.waitForTimeout(1200)
  const h = await stats()
  await p.evaluate(([z]) => window.__chadverse.interiorTeleport(0, z, 0, 0), [house.room.d / 2 - 0.9])
  await p.waitForTimeout(700)
  await p.keyboard.press('e')
  await inWorld()
  await p.waitForTimeout(1500)
  rows.push({ town: [w.geometries, w.textures], house: [h.geometries, h.textures] })
  console.log(`cycle ${i}: town geo ${w.geometries} tex ${w.textures} | ${HOUSE} geo ${h.geometries} tex ${h.textures}`)
}
const t1 = rows[1].town
const t3 = rows[3].town
const ok = t3[0] - t1[0] <= 2 && t3[1] - t1[1] <= 1
console.log(ok ? 'FLAT (no leak)' : `LEAK: town geo ${t1[0]}→${t3[0]} tex ${t1[1]}→${t3[1]}`)
console.log('errors:', errs.length ? errs : 'none')
await b.close()
process.exit(ok && !errs.length ? 0 : 1)
