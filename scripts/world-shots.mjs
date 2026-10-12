// World visual QA: fixed viewpoints (lookout → Chad City, plaza → castle keep, gate), optional style param.
//   node scripts/world-shots.mjs [tag] [query]      e.g.  node scripts/world-shots.mjs gothic "?castle=gothic"
import { chromium } from 'playwright'
const out = process.env.SHOTS
const tag = process.argv[2] || 'v3'
const query = process.argv[3] || ''
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)))
await p.goto((process.env.URL || 'http://localhost:4318/chadverse/') + query, { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'networkidle' })
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'World Shots')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 60000 })
await p.addStyleTag({ content: '.panel, [data-testid=objective], [data-testid=emote-button], p { opacity: 0 !important }' })
// [name, x, z, yaw, dragUp px (tilts the camera up like a player dragging)]
const views = [
  ['lookout', -3.2, 33.4, 0.18, 70],
  ['lookout-wide', 4.5, 31.5, -0.35, 55],
  ['plaza-keep', 0, 9, Math.PI, 80],
  ['north-road', 0, -12, Math.PI, 90],
  ['terrace-mid', -4.6, 33.9, -0.25, 60],
  ['gate', 2.5, 27, 0.15, 20],
  ['east-wall', 22, 14, -2.2, 40],
  ['west-towers', -18, 14, 2.4, 50],
]
for (const [name, x, z, yaw, up] of views) {
  await p.evaluate(([x, z, yaw]) => window.__chadverse.teleport(x, z, yaw), [x, z, yaw])
  await p.waitForTimeout(600)
  if (up) {
    await p.mouse.move(640, 420)
    await p.mouse.down()
    await p.mouse.move(640, 420 - up, { steps: 6 })
    await p.mouse.up()
  }
  await p.waitForTimeout(2200)
  await p.screenshot({ path: `${out}/w-${tag}-${name}.jpg`, quality: 82 })
}
console.log('stats', JSON.stringify(await p.evaluate(() => ({ ...window.__chadverse.world(), ...window.__chadverse.stats() }))))
console.log('errors:', errs)
await b.close()
