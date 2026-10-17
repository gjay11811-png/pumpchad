// review capture of an area: top-down by default (X Z H FOV), or CAM=x,y,z LOOK=x,y,z for a view. OUT=file.jpg SKY=day|night node scripts/area-top.mjs
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const [X, Z, H, FOV] = [+process.env.X, +process.env.Z, +(process.env.H || 90), +(process.env.FOV || 40)]
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] })
const p = await b.newPage({ viewport: { width: +(process.env.W || 1000), height: +(process.env.HT || 700) } })
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'], xp: 800 }, settings: { quality: 'low', muted: true } })))
await p.goto(BASE + `?sky=${process.env.SKY || 'day'}`)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Rider')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
await p.evaluate(([x, z]) => window.__chadverse.teleport(x, z, 0), [X, Z])
await p.waitForTimeout(3000)
const CAM = process.env.CAM ? process.env.CAM.split(',').map(Number) : [X, H, Z + 0.01]
const LOOK = process.env.LOOK ? process.env.LOOK.split(',').map(Number) : [X, 0, Z]
await p.evaluate(([cam, look, fov]) => window.__chadverse.shotCam({ cam, look, fov }), [CAM, LOOK, FOV])
await p.waitForTimeout(2500)
await p.screenshot({ path: process.env.OUT || 'tmp-viewer/top.jpg', type: 'jpeg', quality: 85 })
await b.close()
