// Front-facing in-game captures of every emote + jump phases (camera dragged round to face the character).
//   node scripts/emote-showcase.mjs [Species]
import { chromium } from 'playwright'
const species = process.argv[2] || 'Pumpkin'
const out = process.env.SHOTS
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1000, height: 760 } })
const errs = []
p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)))
const w = (ms) => p.waitForTimeout(ms)
const tag = species.toLowerCase()
await p.goto(process.env.URL || 'http://localhost:4318/chadverse/', { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'networkidle' })
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('radio', { name: species, exact: true }).first().click()
await p.waitForFunction((s) => window.__chadverse.showroom()?.rig?.species === s, species.toLowerCase(), { timeout: 30000 })
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Showcase')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 40000 })
await p.evaluate(() => window.__chadverse.teleport(-6, 20, Math.PI * 0.75))
await w(1500)
// drag the camera round to look at the character's front-three-quarter
await p.mouse.move(500, 380)
await p.mouse.down()
await p.mouse.move(1000, 360, { steps: 12 })
await p.mouse.up()
await w(1200)
await p.addStyleTag({ content: '[data-testid=objective], [data-testid=prompt], [data-testid=emote-flash] { opacity: 0 !important }' })
const crop = { x: 250, y: 120, width: 500, height: 560 }
for (const [id, key, wait] of [['flex', '1', 900], ['dance', '2', 1300], ['wave', '3', 900], ['pushups', '4', 1500], ['celebrate', '5', 700], ['chad', '6', 900], ['point', '7', 900], ['unbothered', '8', 1100]]) {
  await p.keyboard.press(key)
  await w(wait)
  await p.screenshot({ path: `${out}/sc-${tag}-${id}.jpg`, quality: 82, clip: crop })
  if (id === 'pushups') {
    await w(450)
    await p.screenshot({ path: `${out}/sc-${tag}-pushups2.jpg`, quality: 82, clip: crop })
  }
  if (id === 'celebrate') await w(1800)
}
await p.keyboard.press('8') // stop the loop
await w(800)
await p.keyboard.press(' ')
for (const [i, d] of [[0, 60], [1, 260], [2, 320]].entries()) {
  await w(d[1])
  await p.screenshot({ path: `${out}/sc-${tag}-jump${i}.jpg`, quality: 82, clip: crop })
}
await w(1500)
// idle personality: wait for a fidget
const t0 = Date.now()
while (Date.now() - t0 < 15000) {
  if ((await p.evaluate(() => window.__chadverse.playerInspect().fidget))) break
  await w(200)
}
await w(450)
await p.screenshot({ path: `${out}/sc-${tag}-fidget.jpg`, quality: 82, clip: crop })
console.log('errors:', errs)
await b.close()
