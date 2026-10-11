// Side-by-side QA captures: all three species with identical framing + lighting (creator: front / three-quarter / side / close-up; in-game: same spot).
import { chromium } from 'playwright'
const out = process.env.SHOTS
const URL = process.env.URL || 'http://localhost:4318/chadverse/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const errs = []
const SPECIES = ['Pumpkin', 'Skeleton', 'Demon']
// creator
{
  const p = await b.newPage({ viewport: { width: 1000, height: 1000 } })
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)))
  await p.goto(URL, { waitUntil: 'networkidle' })
  await p.evaluate(() => localStorage.clear())
  await p.reload({ waitUntil: 'networkidle' })
  await p.click('[data-testid=enter-muted]')
  await p.waitForSelector('[role=tablist]')
  await p.addStyleTag({ content: '[aria-label="Character options"], [aria-label="Species"], h1, [role=radiogroup][aria-label="Preview animation"], button { opacity: 0 !important }' })
  for (const sp of SPECIES) {
    await p.getByRole('radio', { name: sp, exact: true }).first().click({ force: true })
    await p.waitForFunction((s) => window.__chadverse.showroom()?.rig?.species === s, sp.toLowerCase(), { timeout: 30000 })
    await p.waitForTimeout(3500) // let the selection flex finish so every species is captured in the same idle pose
    for (const [tag, yaw, zoom] of [['front', 0, 0], ['34', -0.7, 0], ['side', -1.5, 0], ['back', Math.PI, 0], ['close', -0.3, 1]]) {
      await p.evaluate(([y, z]) => { const r = window.__chadverse.showroom(); r.autoRotate = false; r.previewPose = 'idle'; r.setInsets({ left: 0, right: 0, top: 0, bottom: 0 }); r.zoom = z; r.yaw = y }, [yaw, zoom])
      await p.waitForTimeout(zoom ? 1500 : 900)
      await p.screenshot({ path: `${out}/cmp-${sp.toLowerCase()}-${tag}.jpg`, quality: 88 })
    }
  }
  await p.close()
}
// in game, same spot + camera for each
for (const sp of SPECIES) {
  const p = await b.newPage({ viewport: { width: 1000, height: 800 } })
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)))
  await p.goto(URL, { waitUntil: 'networkidle' })
  await p.evaluate(() => localStorage.clear())
  await p.reload({ waitUntil: 'networkidle' })
  await p.click('[data-testid=enter-muted]')
  await p.waitForSelector('[role=tablist]')
  await p.getByRole('radio', { name: sp, exact: true }).first().click()
  await p.waitForFunction((s) => window.__chadverse.showroom()?.rig?.species === s, sp.toLowerCase(), { timeout: 30000 })
  await p.getByRole('tab', { name: 'Name' }).click()
  await p.fill('#chad-name', `${sp} Chad`)
  await p.getByRole('button', { name: /Enter Chad Square/ }).click()
  await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 30000 })
  await p.evaluate(() => window.__chadverse.teleport(0, 12, Math.PI))
  await p.waitForTimeout(2500)
  await p.screenshot({ path: `${out}/cmp-${sp.toLowerCase()}-world.jpg`, quality: 86 })
  await p.close()
}
console.log('errors:', errs)
await b.close()
