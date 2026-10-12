// Gym visual smoke: free roam + each station mid-rep (screenshots). node scripts/gym-peek.mjs [Species] [w] [h]
import { chromium } from 'playwright'
const out = process.env.SHOTS
const species = process.argv[2] || 'Pumpkin'
const [W, H] = [+(process.argv[3] || 1280), +(process.argv[4] || 800)]
const mobile = H > W
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: W, height: H }, isMobile: mobile, hasTouch: mobile })
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 300)))
const w = (ms) => p.waitForTimeout(ms)
const tag = `${species.toLowerCase()}-${mobile ? 'm' : 'd'}`
await p.goto(process.env.URL || 'http://localhost:4318/chadverse/', { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'networkidle' })
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('radio', { name: species, exact: true }).first().click()
await p.waitForFunction((s) => window.__chadverse.showroom()?.rig?.species === s, species.toLowerCase(), { timeout: 30000 })
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Gym Rat')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 30000 })
await p.evaluate(() => window.__chadverse.teleport(14.4, -4))
await w(400)
await p.keyboard.press('e')
await p.waitForFunction(() => window.__chadverse?.phase === 'gym' && window.__chadverse.gymInspect(), null, { timeout: 20000 })
await w(1500)
await p.screenshot({ path: `${out}/g-${tag}-entry.jpg`, quality: 80 })
for (const id of ['bench', 'curl', 'squat', 'bag']) {
  await p.evaluate((id) => window.__chadverse.gymGoto(id), id)
  await w(700)
  await p.screenshot({ path: `${out}/g-${tag}-${id}-prompt.jpg`, quality: 75 })
  await p.keyboard.press('e')
  await p.waitForSelector('[data-testid=workout-start]', { timeout: 5000 })
  await w(1200)
  await p.click('[data-testid=workout-start]')
  await w(400)
  for (let i = 0; i < 3; i++) {
    await p.click('[data-testid=workout-rep]')
    await w(id === 'bag' ? 230 : 420)
    if (i === 2) await p.screenshot({ path: `${out}/g-${tag}-${id}-rep.jpg`, quality: 80 })
    await w(id === 'bag' ? 600 : 1300)
  }
  await p.screenshot({ path: `${out}/g-${tag}-${id}-rest.jpg`, quality: 80 })
  await p.click('[data-testid=workout-stop]')
  await w(600)
}
console.log('mode', JSON.stringify(await p.evaluate(() => window.__chadverse.gym())))
console.log('errors:', errs)
await b.close()
