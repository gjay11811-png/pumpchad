// Skeleton QA: chain / hood / skull in motion (dance, walk, flex, wave) and without the hood (crown, cap), front + side + back.
import { chromium } from 'playwright'
const out = process.env.SHOTS
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 900, height: 700 } })
const errs = []
p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)))
await p.goto(process.env.URL || 'http://localhost:4318/chadverse/', { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'networkidle' })
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('radio', { name: 'Skeleton', exact: true }).first().click()
await p.waitForFunction(() => window.__chadverse.showroom()?.rig?.species === 'skeleton', null, { timeout: 30000 })
await p.addStyleTag({ content: '[aria-label="Character options"], [aria-label="Species"], h1, [role=radiogroup][aria-label="Preview animation"], [aria-label*="oom"] { opacity: 0 !important }' })
const base = { species: 'skeleton', skin: '#e9e2d0', outfit: '#2a262c', glow: '#7fd6ff', top: 'armor', headwear: 'none', eyewear: 'none', chain: true }
const cases = [
  ['hood-dance', {}, 'dance'], ['hood-walk', {}, 'walk'], ['hood-flex', {}, 'flex'], ['hood-wave', {}, 'wave'],
  ['crown-idle', { headwear: 'crown' }, 'idle'], ['crown-dance', { headwear: 'crown' }, 'dance'], ['horns-shades', { headwear: 'horns', eyewear: 'shades' }, 'idle'],
]
for (const [name, mod, pose] of cases) {
  await p.evaluate(async ([a, pose]) => {
    const r = window.__chadverse.showroom()
    r.autoRotate = false; r.zoom = 1; r.setInsets({ left: 0, right: 0, top: 0, bottom: 0 })
    await r.setAppearance(a)
    r.previewPose = pose
  }, [{ ...base, ...mod }, pose])
  for (const [tag, yaw] of [['f', 0], ['s', -1.45], ['b', 2.6]]) {
    await p.evaluate((y) => { window.__chadverse.showroom().yaw = y }, yaw)
    await p.waitForTimeout(tag === 'f' ? 1500 : 650)
    await p.screenshot({ path: `${out}/sp-${name}-${tag}.jpg`, quality: 82 })
  }
}
console.log('errors:', errs)
await b.close()
