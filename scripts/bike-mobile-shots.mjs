// mounted mobile UI captures (EMULATED touch viewport; not a real phone): landscape + portrait, on foot vs mounted, with the ride menu open.  OUT=dir KIND=surron
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const KIND = process.env.KIND || 'surron'
const OUT = process.env.OUT || 'tmp-viewer/mobile'
mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] })
for (const [name, w, h] of [['landscape', 844, 390], ['portrait', 390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 })
  const p = await ctx.newPage()
  await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'], xp: 800 }, settings: { quality: 'low', muted: true } })))
  await p.goto(BASE + '?sky=day')
  await p.click('[data-testid=enter-muted]')
  await p.waitForSelector('[role=tablist]')
  await p.getByRole('tab', { name: 'Name' }).click()
  await p.fill('#chad-name', 'Rider')
  await p.getByRole('button', { name: /Enter Chad Square/ }).click()
  await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
  const B = () => p.evaluate(() => window.__chadverse.bike())
  const adv = (s) => p.evaluate((s) => window.__chadverse.advance(s), s)
  const frame = async () => { const n0 = await p.evaluate(() => window.__chadverse.renders()); await p.waitForFunction((n) => window.__chadverse.renders() >= n + 2, n0, { timeout: 60000, polling: 40 }) }
  const parked = (await B()).parked.find((x) => x.kind === KIND)
  await p.evaluate(([x, z]) => window.__chadverse.teleport(x, z - 1.6, Math.PI), [parked.x, parked.z])
  await p.waitForTimeout(2500)
  await adv(0.3)
  await p.evaluate(() => window.__chadverse.freeze(true))
  await adv(0.05); await frame()
  await p.screenshot({ path: `${OUT}/${name}-on-foot.jpg`, type: 'jpeg', quality: 80 })
  await p.evaluate((k) => window.__chadverse.mountBike(k), KIND)
  await adv(1.2)
  await p.evaluate(() => window.__chadverse.setBike({ x: 0, z: 14, h: 0, v: 9 }))
  await adv(1.5); await frame()
  await p.screenshot({ path: `${OUT}/${name}-mounted.jpg`, type: 'jpeg', quality: 80 })
  await p.click('[data-testid=ride-menu-btn]')
  await adv(0.05); await frame()
  await p.screenshot({ path: `${OUT}/${name}-menu.jpg`, type: 'jpeg', quality: 80 })
  console.log(name, 'done')
  await ctx.close()
}
await b.close()
