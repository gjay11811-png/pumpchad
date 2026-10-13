// Social teaser stills of the Chad Gym: photo-mode cameras (UI hidden), rendered at 2× and saved as PNG.
//   SHOTS=dir node scripts/gym-teaser.mjs [shots] [formats]     formats: wide (1920×1080), post (1080×1350), story (1080×1920)
import { chromium } from 'playwright'
const out = process.env.SHOTS || '.'
const only = (process.argv[2] || 'hero,weights,wide').split(',')
const formats = (process.argv[3] || 'wide,post,story').split(',')
const SIZES = { wide: [1920, 1080], post: [1080, 1350], story: [1080, 1920] }
const SCALE = +(process.env.SCALE || 2)
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const errs = []
// each shot: where the Chad stands + faces, the pose, and a camera per aspect (tall frames step back / go lower)
const SHOTS = {
  hero: {
    at: { x: 0, z: -1.2, yaw: 0, pose: 'flex' },
    cam: { wide: [[0.35, 1.85, 3.6], [0, 2.0, -3.2], 43], post: [[0.3, 1.8, 4.2], [0, 2.1, -3.0], 46], story: [[0.25, 1.7, 5.4], [0, 2.2, -3.0], 60] },
  },
  weights: {
    at: { x: 6.55, z: -2.35, yaw: -1.0, pose: 'flex' },
    cam: { wide: [[3.7, 1.75, -0.7], [7.4, 1.0, -2.75], 44], post: [[3.9, 1.7, -0.9], [7.3, 1.05, -2.7], 48], story: [[3.6, 1.7, -0.6], [7.2, 1.15, -2.6], 56] },
  },
  wide: {
    at: { x: 0.3, z: -0.4, yaw: 0.25, pose: 'flex' },
    cam: { wide: [[-7.9, 3.9, 6.9], [1.2, 0.9, -2.6], 50], post: [[-7.9, 4.2, 6.9], [0.8, 0.8, -2.4], 54], story: [[-7.9, 4.4, 6.9], [0.4, 0.7, -2.2], 62] },
  },
}
for (const fmt of formats) {
  const [W, H] = SIZES[fmt]
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => errs.push(e.message))
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)))
  await p.goto(process.env.URL || 'http://localhost:4318/chadverse/', { waitUntil: 'networkidle' })
  await p.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 1, character: null, progress: {}, settings: { quality: 'high', muted: true } }))
  })
  await p.reload({ waitUntil: 'networkidle' })
  await p.click('[data-testid=enter-muted]')
  await p.waitForSelector('[role=tablist]')
  await p.getByRole('tab', { name: 'Name' }).click()
  await p.fill('#chad-name', 'Pump Chad')
  await p.getByRole('button', { name: /Enter Chad Square/ }).click()
  await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 90000 })
  await p.evaluate(() => window.__chadverse.teleport(14.4, -4))
  await p.waitForTimeout(500)
  await p.keyboard.press('e')
  await p.waitForFunction(() => window.__chadverse?.phase === 'gym' && window.__chadverse.gym()?.mode === 'free', null, { timeout: 90000 })
  await p.addStyleTag({ content: 'body * { visibility: hidden !important } canvas { visibility: visible !important }' })
  await p.waitForTimeout(2500)
  for (const name of only) {
    const s = SHOTS[name]
    const [cam, look, fov] = s.cam[fmt]
    await p.evaluate((o) => window.__chadverse.gymPhoto(o), { ...s.at, cam, look, fov })
    await p.waitForTimeout(2600) // let the pose settle and the NPCs get into their rhythm
    await p.screenshot({ path: `${out}/teaser-${name}-${fmt}.png`, timeout: 90000 })
    console.log('shot', name, fmt)
  }
  await ctx.close()
}
console.log('errors:', JSON.stringify(errs))
await b.close()
