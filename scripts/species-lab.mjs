// Visual check of a species in the creator: 4 angles + close-ups. Usage: node species-lab.mjs Skeleton|Demon|Pumpkin [tag]
import { chromium } from 'playwright'
const out = process.env.SHOTS
const species = process.argv[2] || 'Skeleton'
const tag = process.argv[3] || species.toLowerCase()
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1280, height: 860 } })
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 300)))
await p.goto(process.env.URL || 'http://localhost:4318/chadverse/', { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'networkidle' })
await p.waitForSelector('[data-testid=enter-muted]')
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('radio', { name: species, exact: true }).first().click()
await p.waitForFunction((sp) => window.__chadverse.showroom()?.rig?.species === sp, species.toLowerCase(), { timeout: 30000 })
await p.waitForTimeout(1500)
console.log('inspect:', JSON.stringify(await p.evaluate(() => { const i = window.__chadverse.showroom().rig.inspect(); return { species: i.species, parts: i.parts, tris: i.tris, draws: i.draws, headBone: i.headBone, headObj: i.headObj, toe: Math.min(i.ballL[1], i.ballR[1]) } })))
await p.addStyleTag({ content: '[aria-label="Character options"], [aria-label="Species"], h1, [role=radiogroup][aria-label="Preview animation"] { opacity: 0 !important }' })
await p.evaluate(() => { const r = window.__chadverse.showroom(); r.autoRotate = false; r.previewPose = 'idle' })
const shot = async (file, yaw, zoom = 0) => {
  await p.evaluate(([y, z]) => { const r = window.__chadverse.showroom(); r.zoom = z; r.yaw = y }, [yaw, zoom])
  await p.waitForTimeout(zoom ? 1200 : 500)
  await p.screenshot({ path: `${out}/${tag}-${file}.jpg`, quality: 86 })
}
for (const [i, y] of [0, -0.6, -Math.PI / 2, Math.PI].entries()) await shot(`a${i}`, y)
await shot('close', -0.3, 1)
await shot('close-side', -1.3, 1)
console.log('errors:', errs)
await b.close()
