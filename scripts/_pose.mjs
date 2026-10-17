import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const KIND = process.env.KIND || 'surron'
const SPECIES = process.env.SPECIES || ''
mkdirSync('tmp-viewer/pose', { recursive: true })
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] })
const p = await b.newPage({ viewport: { width: 900, height: 520 } })
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'], xp: 800 }, settings: { quality: 'medium', muted: true } })))
await p.goto('http://localhost:5180/chadverse/?sky=day')
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
if (SPECIES) await p.click(`[data-testid=species-${SPECIES}]`)
await p.getByRole('tab', { name: 'Name' }).click(); await p.fill('#chad-name', 'Rider')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const B = () => p.evaluate(() => window.__chadverse.bike()); const adv = (s) => p.evaluate((s) => window.__chadverse.advance(s), s)
const frame = async () => { const n0 = await p.evaluate(() => window.__chadverse.renders()); await p.waitForFunction((n) => window.__chadverse.renders() >= n + 2, n0, { timeout: 60000, polling: 40 }) }
const parked = (await B()).parked.find((x) => x.kind === KIND)
await p.evaluate(([x, z]) => window.__chadverse.teleport(x, z - 1.6, Math.PI), [parked.x, parked.z]); await p.waitForTimeout(2500); await adv(0.3)
await p.evaluate((k) => window.__chadverse.mountBike(k), KIND); await adv(1.2)
await p.evaluate(() => window.__chadverse.freeze(true))
const set = (o) => p.evaluate((o) => window.__chadverse.setBike(o), o)
const side = async (name) => {
  const t = await B(); const g = 0
  // the bike's LEFT is -z of the bike = world +x at heading 0
  await p.evaluate(([x, y, z]) => window.__chadverse.shotCam({ cam: [x + 3.2, y + 1.0, z], look: [x, y + 0.85, z], fov: 42 }), [t.x, g, t.z])
  await adv(0.02); await frame()
  await p.screenshot({ path: `tmp-viewer/pose/${KIND}${SPECIES ? '-' + SPECIES : ''}-${name}.jpg`, type: 'jpeg', quality: 85 })
  console.log(name, JSON.stringify({ pitch: +(t.pitch * 57.3).toFixed(0), fit: t.fit, pelvisMinusSeatZ: t.rig ? +(t.rig.pelvis[2] - t.rig.seat[2]).toFixed(2) : null, grips: [t.rig?.gripL?.[0], t.rig?.gripR?.[0]], shoulders: [t.rig?.shL?.[0], t.rig?.shR?.[0]] }))
}
await set({ x: 0, z: 14, h: 0, v: 0 }); await adv(0.8); await side('rest')
await set({ x: 0, z: 14, h: 0, v: 8 }); await p.keyboard.down('w'); await adv(1.0); await side('riding')
await p.keyboard.press('Shift'); await adv(2.0); await side('wheelie')
await b.close()
