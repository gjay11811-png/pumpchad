// Pumpkin Chad look QA: v2 vs ?pumpkin=classic, front / 3-4 / side, full body + chest close-up.  SHOTS=dir node scripts/pumpkin-look.mjs
import { chromium } from 'playwright'
const out = process.env.SHOTS
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 800, height: 900 } })
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)))
for (const look of (process.argv[2] || 'v2,classic').split(',')) {
  const url = (process.env.URL || 'http://localhost:4318/chadverse/') + (look === 'classic' ? '?pumpkin=classic' : '')
  await p.goto(url, { waitUntil: 'networkidle' })
  await p.evaluate(() => localStorage.clear())
  await p.reload({ waitUntil: 'networkidle' })
  await p.click('[data-testid=enter-muted]')
  await p.waitForSelector('[role=tablist]')
  await p.addStyleTag({ content: '[aria-label="Character options"], [aria-label="Species"], h1, [role=radiogroup][aria-label="Preview animation"], button { opacity: 0 !important }' })
  await p.waitForFunction(() => window.__chadverse.showroom()?.rig?.species === 'pumpkin', null, { timeout: 30000 })
  await p.waitForTimeout(3000)
  for (const [zt, zoom] of [['full', 0], ['close', 1]])
    for (const [tag, yaw] of [['f', 0], ['q', -0.6], ['s', -1.45]]) {
      await p.evaluate(([y, z]) => { const r = window.__chadverse.showroom(); r.autoRotate = false; r.setInsets({ left: 0, right: 0, top: 0, bottom: 0 }); r.zoom = z; r.yaw = y }, [yaw, zoom])
      await p.waitForTimeout(1200)
      await p.screenshot({ path: `${out}/pk-${look}-${zt}-${tag}.jpg`, quality: 82, clip: { x: 100, y: 40, width: 600, height: 840 } })
    }
}
console.log('errors:', errs)
await b.close()
