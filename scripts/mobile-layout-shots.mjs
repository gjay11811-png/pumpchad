// Landscape / portrait layout captures (EMULATED touch viewport; not a real phone): walking, walking with the corner menu open, riding, control-edit mode.  OUT=dir W=844 H=390
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const OUT = process.env.OUT || 'tmp-viewer/layout'
const W = +(process.env.W || 844)
const H = +(process.env.H || 390)
mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] })
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 })
const p = await ctx.newPage()
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'], xp: 800 }, settings: { quality: 'low', muted: true } })))
await p.goto((process.env.URL || 'http://localhost:5180/chadverse/') + '?sky=day')
await p.click('[data-testid=enter-muted]'); await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click(); await p.fill('#chad-name', 'Rider')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const B = () => p.evaluate(() => window.__chadverse.bike()); const adv = (s) => p.evaluate((s) => window.__chadverse.advance(s), s)
const frame = async () => { const n0 = await p.evaluate(() => window.__chadverse.renders()); await p.waitForFunction((n) => window.__chadverse.renders() >= n + 2, n0, { timeout: 60000, polling: 40 }) }
const shot = async (n) => { await adv(0.05); await frame(); await p.screenshot({ path: `${OUT}/${W}x${H}-${n}.png` }) }
const parked = (await B()).parked.find((x) => x.kind === 'surron')
await p.evaluate(([x, z]) => window.__chadverse.teleport(x, z - 1.6, Math.PI), [parked.x, parked.z]); await p.waitForTimeout(2500); await adv(0.3)
await p.evaluate(() => window.__chadverse.freeze(true))
await shot('1-walking')
await p.click('[data-testid=corner-menu-btn]'); await shot('2-walking-menu')
await p.click('[data-testid=corner-menu-btn]')
await p.evaluate(() => window.__chadverse.mountBike('surron')); await adv(1.2)
await p.evaluate(() => window.__chadverse.setBike({ x: 0, z: 14, h: 0, v: 8 })); await adv(0.6)
await shot('3-riding')
await p.click('[data-testid=corner-menu-btn]'); await shot('4-riding-menu')
await p.click('[data-testid=menu-edit-controls]'); await shot('5-edit-mode')
await b.close()
