// player-camera captures at named spots, for matched before/after comparisons (software GL, medium quality, 1000×600).
//   SPOTS="avenue:0:40:3.14;motors:46:44:-1.57" SKY=day|night OUT=dir TAG=after node scripts/spots.mjs
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const OUT = process.env.OUT || 'tmp-viewer/spots'
const TAG = process.env.TAG || 'after'
const SKY = process.env.SKY || 'day'
const EXP = process.env.EXPANSION === 'open' ? '&expansion=open' : ''
mkdirSync(OUT, { recursive: true })
const spots = (process.env.SPOTS || 'avenue:0:44:3.14').split(';').map((s) => { const [n, x, z, yaw, camYaw, camPitch] = s.split(':'); return { n, x: +x, z: +z, yaw: +yaw, camYaw: camYaw === undefined ? null : +camYaw, camPitch } })
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] })
const p = await b.newPage({ viewport: { width: 1000, height: 600 } })
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'], xp: 800 }, settings: { quality: 'medium', muted: true } })))
await p.goto(BASE + `?sky=${SKY}${EXP}`)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Rider')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
for (const s of spots) {
  await p.evaluate(([x, z, yaw]) => window.__chadverse.teleport(x, z, yaw), [s.x, s.z, s.yaw])
  await p.waitForTimeout(6500)
  await p.screenshot({ path: `${OUT}/${s.n}-${SKY}-${TAG}.jpg`, type: 'jpeg', quality: 84 })
  console.log('shot', s.n)
}
await b.close()
