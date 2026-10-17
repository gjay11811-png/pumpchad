// Wheelie / riding captures (EMULATED touch viewport, software GL — not a real phone): the riding HUD, the side camera in a wheelie, ONE HAND, a peg scrape.  OUT=dir KIND=surron|street SPECIES=skeleton|demon
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const KIND = process.env.KIND || 'surron'
const SPECIES = process.env.SPECIES || ''
const OUT = process.env.OUT || 'tmp-viewer/wheelie'
mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] })
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 })
const p = await ctx.newPage()
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'], xp: 800 }, settings: { quality: 'medium', muted: true } })))
await p.goto(BASE + '?sky=day')
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
if (SPECIES) await p.click(`[data-testid=species-${SPECIES}]`)
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Rider')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const B = () => p.evaluate(() => window.__chadverse.bike())
const adv = (s) => p.evaluate((s) => window.__chadverse.advance(s), s)
const set = (o) => p.evaluate((o) => window.__chadverse.setBike(o), o)
const frame = async () => { const n0 = await p.evaluate(() => window.__chadverse.renders()); await p.waitForFunction((n) => window.__chadverse.renders() >= n + 2, n0, { timeout: 60000, polling: 40 }) }
const shot = async (name) => { await adv(0.02); await frame(); await p.screenshot({ path: `${OUT}/${KIND}${SPECIES ? '-' + SPECIES : ''}-${name}.jpg`, type: 'jpeg', quality: 82 }) }
const parked = (await B()).parked.find((x) => x.kind === KIND)
await p.evaluate(([x, z]) => window.__chadverse.teleport(x, z - 1.6, Math.PI), [parked.x, parked.z])
await p.waitForTimeout(2500)
await adv(0.3)
await p.evaluate((k) => window.__chadverse.mountBike(k), KIND)
await adv(1.2)
await p.evaluate(() => window.__chadverse.freeze(true))
await set({ x: 0, z: 14, h: 0, v: 6 })
await adv(0.6)
await shot('1-hud-chase')
// a wheelie from the gas alone, on the side camera
await p.click('[data-testid=ride-view-btn]')
await adv(1.2)
await p.keyboard.down('w')
let st = await B()
for (let i = 0; i < 60 && st.pitch < 0.3; i++) { await adv(0.1); st = await B(); if (st.z > 68) await set({ x: 0, z: 14, v: 6 }) }
await adv(0.4)
await shot('2-side-wheelie')
console.log('wheelie', JSON.stringify({ pitch: (await B()).pitch, v: (await B()).v, autoLean: (await B()).autoLean }))
const close = async (name) => {
  const t = await B()
  const g = (await p.evaluate(() => window.__chadverse.world())).y ?? 0
  await p.evaluate(([x, y, z]) => window.__chadverse.shotCam({ cam: [x + 3.4, y + 1.5, z + 0.1], look: [x, y + 1.5, z - 0.1], fov: 46 }), [t.x, g, t.z])
  await adv(0.01)
  await shot(name)
  await p.evaluate(() => window.__chadverse.shotCam(null))
}
await close('3a-grip-close')
await p.keyboard.down('Shift')
await adv(0.6)
await shot('3-one-hand')
console.log('one hand', JSON.stringify({ oneHand: (await B()).oneHand, pitch: (await B()).pitch }))
await close('3b-one-hand-close')
await p.keyboard.up('Shift')
await p.keyboard.up('w')
await adv(3)
// a peg scrape: hard lean at speed
await set({ x: 0, z: 14, h: 0, v: KIND === 'surron' ? 16 : 22 })
await p.keyboard.down('w')
await p.keyboard.down('d')
let sc = null
for (let i = 0; i < 40 && !sc; i++) { await adv(0.1); const t = await B(); if (t.scrape.part) sc = t }
await adv(0.15)
await shot('4-scrape')
console.log('scrape', JSON.stringify(sc?.scrape ?? null), 'roll', sc?.roll)
await p.keyboard.up('d')
await p.keyboard.up('w')
await b.close()
