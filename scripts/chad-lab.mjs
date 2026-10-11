// Pumpkin Chad visual check: creator turntable at 4 angles + close-up + pose previews.
import { chromium } from 'playwright'
const out = process.env.SHOTS
const base = process.env.URL || 'http://localhost:4318/chadverse/'
const [w, h, tag] = [+(process.argv[2] || 1200), +(process.argv[3] || 900), process.argv[4] || 'lab']
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: w, height: h } })
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
p.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && !m.text().includes('X4122') && errs.push(m.type() + ': ' + m.text().slice(0, 200)))
await p.goto(base + (process.env.Q || ''), { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'networkidle' })
await p.waitForSelector('[data-testid=enter-muted]', { timeout: 20000 })
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.waitForFunction(() => window.__chadverse.showroom()?.rig?.kind === 'model', null, { timeout: 20000 }).catch(() => {})
console.log('kind:', await p.evaluate(() => window.__chadverse.showroom()?.rig?.kind))
await p.waitForTimeout(1200)
// hide UI for clean model shots
await p.addStyleTag({ content: '[aria-label="Character options"], h1, [role=tablist] { opacity: 0 !important }' })
const angles = [0, Math.PI / 2, Math.PI, -Math.PI / 2, -0.5]
for (const [i, a] of angles.entries()) {
  await p.evaluate((a) => {
    const r = window.__chadverse.showroom()
    r.yaw = a
    r.rotateBy(0)
  }, a)
  await p.waitForTimeout(250)
  await p.screenshot({ path: `${out}/${tag}-angle${i}.jpg`, quality: 85 })
}
for (const pose of ['flex', 'walk', 'press', 'wave', 'dance']) {
  await p.evaluate((pose) => {
    const r = window.__chadverse.showroom()
    r.yaw = -0.4
    r.forcePose = null
    r.previewPose = pose === 'press' ? 'idle' : pose
    if (pose === 'press') {
      r.previewPose = 'idle'
      r.rig.pressAmount = 1
      r.forcePose = 'press'
    }
  }, pose)
  await p.waitForTimeout(900)
  await p.screenshot({ path: `${out}/${tag}-pose-${pose}.jpg`, quality: 85 })
}
console.log('console:', errs.slice(0, 8))
await b.close()
