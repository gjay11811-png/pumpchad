// Pumpkin Chad: close-up in the creator, in Chad Square, and pressing in the gym.
import { chromium } from 'playwright'
const out = process.env.SHOTS
const base = process.env.URL || 'http://localhost:4318/chadverse/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1280, height: 860 } })
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
await p.goto(base, { waitUntil: 'networkidle' })
await p.evaluate(() => {
  localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({
    version: 1,
    character: { name: 'Gigagourd', appearance: { species: 'pumpkin', skin: '#e8741c', outfit: '#141216', glow: '#ffb347', top: 'shirtless', headwear: 'none', eyewear: 'shades', chain: true } },
    progress: { xp: 0, achievements: ['welcome'], gymBest: 0, gymRuns: 0, discoveries: [] },
    settings: { quality: 'high', sfx: 0.7, ambience: 0.4, muted: true, reducedEffects: false, cameraSensitivity: 1, stickSensitivity: 1, uiScale: 1 },
  }))
})
await p.reload({ waitUntil: 'networkidle' })
await p.waitForSelector('[data-testid=enter-muted]', { timeout: 20000 })
// close-up from the wardrobe
await p.getByRole('button', { name: /wardrobe/i }).click()
await p.waitForFunction(() => window.__chadverse.showroom()?.rig?.kind === 'model', null, { timeout: 20000 })
await p.addStyleTag({ content: '[aria-label="Character options"], [aria-label="Species"], h1 { opacity: 0 !important }' })
await p.evaluate(() => { const r = window.__chadverse.showroom(); r.zoom = 1; r.yaw = -0.35 })
await p.waitForTimeout(1500)
await p.evaluate(() => { const r = window.__chadverse.showroom(); r.yaw = -0.35 })
await p.waitForTimeout(150)
await p.screenshot({ path: `${out}/cw-closeup.jpg`, quality: 88 })
await p.evaluate(() => { const r = window.__chadverse.showroom(); r.yaw = 0.9 })
await p.waitForTimeout(150)
await p.screenshot({ path: `${out}/cw-closeup2.jpg`, quality: 88 })
// world
await p.reload({ waitUntil: 'networkidle' })
await p.waitForSelector('[data-testid=enter-muted]', { timeout: 20000 })
await p.click('[data-testid=enter-muted]')
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 30000 })
console.log('player kind:', await p.evaluate(() => window.__chadverse.character()))
await p.evaluate(() => window.__chadverse.teleport(-3.5, 19.5, Math.PI - 0.6))
await p.waitForTimeout(1500)
await p.screenshot({ path: `${out}/cw-world-idle.jpg`, quality: 85 })
await p.keyboard.down('w'); await p.waitForTimeout(700)
await p.screenshot({ path: `${out}/cw-world-walk.jpg`, quality: 85 })
await p.keyboard.down('Shift'); await p.waitForTimeout(700)
await p.screenshot({ path: `${out}/cw-world-run.jpg`, quality: 85 })
await p.keyboard.up('Shift'); await p.keyboard.up('w')
// barkeep (pumpkin NPC) uses the new model too
await p.evaluate(() => window.__chadverse.teleport(-3.2, 21.2, -Math.PI / 2))
await p.waitForTimeout(1200)
await p.screenshot({ path: `${out}/cw-barkeep.jpg`, quality: 85 })
console.log('stats', JSON.stringify(await p.evaluate(() => window.__chadverse.world())))
// gym press
await p.evaluate(() => window.__chadverse.teleport(14.4, -4))
await p.waitForTimeout(400)
await p.keyboard.press('e')
await p.waitForFunction(() => window.__chadverse?.phase === 'gym', null, { timeout: 15000 })
await p.waitForSelector('[data-testid=press-start]')
await p.click('[data-testid=press-start]')
await p.waitForTimeout(2600)
await p.screenshot({ path: `${out}/cw-gym-ready.jpg`, quality: 85 })
await p.click('[data-testid=press-button]')
await p.waitForTimeout(380)
await p.screenshot({ path: `${out}/cw-gym-press.jpg`, quality: 85 })
console.log('errors', errs)
await b.close()
