// quick look: mount the Sur-Ron, ride a little, screenshot.  SHOTS=dir KIND=surron|street node scripts/bike-smoke.mjs
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const OUT = process.env.SHOTS || '.'
const KIND = process.env.KIND || 'surron'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] })
const p = await b.newPage({ viewport: { width: 1100, height: 650 } })
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'], xp: 800 }, settings: { quality: 'medium', muted: true } })))
await p.goto(BASE + '?sky=day')
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Rider')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const st = await p.evaluate(() => window.__chadverse.bike())
console.log('parked', JSON.stringify(st))
const bk = st.parked.find((x) => x.kind === KIND)
await p.evaluate(([x, z]) => window.__chadverse.teleport(x, z - 1.6, Math.PI), [bk.x, bk.z])
await p.waitForTimeout(1200)
console.log('prompt', (await p.evaluate(() => window.__chadverse.world())).prompt)
await p.keyboard.press('e')
await p.waitForFunction(() => window.__chadverse.bike().riding && window.__chadverse.bike().phase === 'riding', null, { timeout: 60000 })
console.log('after E', JSON.stringify(await p.evaluate(() => window.__chadverse.bike())))
await p.keyboard.down('w')
await p.waitForFunction(() => window.__chadverse.bike().v > 6, null, { timeout: 90000 })
console.log('riding', JSON.stringify(await p.evaluate(() => window.__chadverse.bike())))
await p.screenshot({ path: `${OUT}/bike-${KIND}-ride.jpg`, type: 'jpeg', quality: 85 })
await p.keyboard.up('w')
console.log('errors', JSON.stringify(errs.slice(0, 3)))
await b.close()
