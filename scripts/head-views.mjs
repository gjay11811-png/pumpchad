// PumpChad's head: matching views on the selection stage (front, three-quarter, side, back, close + normal gameplay distance) for a before/after pair.
//   TAG=head-before SHOTS=dir node scripts/head-views.mjs      (needs the preview on 5180)
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const OUT = process.env.SHOTS || '.'
const TAG = process.env.TAG || 'head'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: {}, settings: { quality: 'medium', muted: true } })))
await p.goto(BASE)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.waitForTimeout(3500)
await p.addStyleTag({ content: 'body *:not(canvas):not(html):not(body) { visibility: hidden !important } canvas { visibility: visible !important }' })
const views = [
  ['front', 0, 0.8],
  ['threequarter', -0.7, 0.8],
  ['side', -1.57, 0.8],
  ['back', 3.14, 0.8],
  ['body-front', -0.2, 0.0],
]
for (const [name, yaw, zoom] of views) {
  await p.evaluate(([y, z]) => window.__chadverse.stage({ auto: false, yaw: y, zoom: z }), [yaw, zoom])
  await p.waitForTimeout(1600)
  await p.screenshot({ path: `${OUT}/${TAG}-${name}.jpg`, type: 'jpeg', quality: 88, clip: { x: 125, y: 40, width: 600, height: 640 } })
  console.log('view', name)
}
await b.close()
