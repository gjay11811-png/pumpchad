// Species card portraits: the LIVE models (head and shoulders, on the night-village stage), captured once from the creator and stored as small JPEGs.
// Re-run after changing a model or the stage:  node scripts/species-thumbs.mjs   (needs the preview on 5180 and a built dist)
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const OUT = 'public/chadverse/ui'
mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: {}, settings: { quality: 'medium', muted: true } })))
await p.goto(BASE)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.waitForTimeout(3000)
await p.addStyleTag({ content: 'body *:not(canvas):not(html):not(body) { visibility: hidden !important } canvas { visibility: visible !important }' })
for (const [id, label] of [['pumpkin', 'Pumpkin'], ['skeleton', 'Skeleton'], ['demon', 'Demon']]) {
  await p.evaluate((l) => [...document.querySelectorAll('[role=radio]')].find((e) => e.getAttribute('aria-label') === l)?.click(), label)
  await p.waitForTimeout(2600)
  await p.evaluate(() => window.__chadverse.stage({ auto: false, yaw: -0.15, zoom: 0.55 }))
  await p.waitForTimeout(1800)
  await p.screenshot({ path: `${OUT}/species-${id}.jpg`, type: 'jpeg', quality: 86, clip: { x: 575 - 150, y: 60, width: 300, height: 340 } })
  await p.evaluate(() => window.__chadverse.stage({ auto: true, zoom: 0 }))
  console.log('thumb', id)
}
await b.close()
