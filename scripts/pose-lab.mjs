// Exercise pose QA in the creator stage: each species × pose × rep phase, front + side.  node scripts/pose-lab.mjs [poses] [species]
import { chromium } from 'playwright'
const out = process.env.SHOTS
const poses = (process.argv[2] || 'curl,squat,bench,guard').split(',')
const species = (process.argv[3] || 'Pumpkin,Skeleton,Demon').split(',')
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 800, height: 900 } })
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)))
await p.goto(process.env.URL || 'http://localhost:4318/chadverse/', { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'networkidle' })
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.addStyleTag({ content: '[aria-label="Character options"], [aria-label="Species"], h1, [role=radiogroup][aria-label="Preview animation"], button { opacity: 0 !important }' })
for (const sp of species) {
  await p.getByRole('radio', { name: sp, exact: true }).first().click({ force: true })
  await p.waitForFunction((s) => window.__chadverse.showroom()?.rig?.species === s, sp.toLowerCase(), { timeout: 30000 })
  await p.waitForTimeout(3000)
  for (const pose of poses)
    for (const amt of [0, 1]) {
      await p.evaluate(([pose, amt]) => { const r = window.__chadverse.showroom(); r.autoRotate = false; r.setInsets({ left: 0, right: 0, top: 0, bottom: 0 }); r.zoom = 0; r.forcePose = pose; r.rig.pressAmount = amt }, [pose, amt])
      for (const [tag, yaw] of [['f', -0.35], ['s', -1.45]]) {
        await p.evaluate(([y, amt]) => { const r = window.__chadverse.showroom(); r.yaw = y; r.rig.pressAmount = amt }, [yaw, amt])
        await p.waitForTimeout(tag === 'f' ? 1100 : 500)
        await p.evaluate((amt) => { window.__chadverse.showroom().rig.pressAmount = amt }, amt)
        await p.screenshot({ path: `${out}/pl-${sp.toLowerCase()}-${pose}-${amt}${tag}.jpg`, quality: 80, clip: { x: 150, y: 60, width: 500, height: 800 } })
      }
    }
  await p.evaluate(() => { window.__chadverse.showroom().forcePose = null })
}
console.log('errors:', errs)
await b.close()
