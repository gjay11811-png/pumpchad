// rider pose check: numbers (hands-to-grips, head-to-bars) and side / three-quarter / front stills in several riding states.
//   KIND=surron|street SPECIES=''|skeleton|demon OUT=dir node scripts/bike-pose.mjs
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const KIND = process.env.KIND || 'surron'
const SPECIES = process.env.SPECIES || ''
const OUT = process.env.OUT || 'tmp-viewer/pose'
const SHOTS = process.env.SHOTS !== '0'
mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] })
const p = await b.newPage({ viewport: { width: 760, height: 520 } })
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'], xp: 800 }, settings: { quality: 'low', muted: true } })))
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
const parked = (await B()).parked.find((x) => x.kind === KIND)
await p.evaluate(([x, z]) => window.__chadverse.teleport(x, z - 1.6, Math.PI), [parked.x, parked.z])
await adv(0.4)
await p.waitForTimeout(2500) // let the scan GLBs arrive
await p.keyboard.press('e')
await adv(1.2)
await p.evaluate(() => window.__chadverse.freeze(true))
await set({ x: 0, z: 14, h: 0, v: 0 })
const tag = `${KIND}-${SPECIES || 'pumpchad'}`
const frame = async () => {
  const n0 = await p.evaluate(() => window.__chadverse.renders())
  await p.waitForFunction((n) => window.__chadverse.renders() >= n + 2, n0, { timeout: 60000, polling: 40 })
}
const view = async (name, s, kind) => {
  const f = [Math.sin(s.heading), Math.cos(s.heading)], r = [Math.cos(s.heading), -Math.sin(s.heading)]
  const cam = kind === 'side' ? [s.x + r[0] * 3.0, 1.0, s.z + r[1] * 3.0] : kind === 'front' ? [s.x + f[0] * 3.2, 1.2, s.z + f[1] * 3.2] : [s.x + r[0] * 2.3 + f[0] * 2.0, 1.4, s.z + r[1] * 2.3 + f[1] * 2.0]
  await p.evaluate(([c, l]) => window.__chadverse.shotCam({ cam: c, look: l, fov: 36 }), [cam, [s.x - f[0] * 0.1, 0.85, s.z - f[1] * 0.1]])
  await adv(0.01) // the scene places the camera inside its update, which the frozen engine does not run
  await frame()
  if (SHOTS) await p.screenshot({ path: `${OUT}/${tag}-${name}-${kind}.jpg`, type: 'jpeg', quality: 82, clip: { x: 80, y: 60, width: 600, height: 400 } })
}
const keys = {}
const press = async (k, on) => { if (!!keys[k] === on) return; keys[k] = on; await (on ? p.keyboard.down(k) : p.keyboard.up(k)) }
const report = async (name) => { const s = await B(); console.log(`${tag} ${name.padEnd(10)} ${s.phase} at ${s.x},${s.z} h ${s.heading} v ${s.v.toFixed(1)} pitch ${s.pitch.toFixed(2)} roll ${s.roll.toFixed(2)} stand ${s.pose.stand.toFixed(2)} fit ${JSON.stringify(s.fit)}`); return s }
// rest
await adv(0.5); let s = await report('rest')
for (const k of ['side', 'three', 'front']) await view('rest', s, k)
// cruising
await set({ x: 0, z: 14, h: 0, v: 12 }); await press('w', true); await adv(0.8); s = await report('cruise')
for (const k of ['side', 'three']) await view('cruise', s, k)
// cornering
await set({ x: 0, z: 16, h: 0, v: 9 }); await press('d', true); await adv(0.7); s = await report('corner')
for (const k of ['three']) await view('corner', s, k)
await press('d', false); await press('w', false)
// braking
await adv(2.5); await set({ x: 0, z: 14, h: 0, v: 14 }); await press('s', true); await adv(0.5); s = await report('brake')
await view('brake', s, 'side'); await press('s', false)
// wheelie
await set({ x: 0, z: 10, h: 0, v: 7 }); await press('w', true); await press('Shift', true)
for (let i = 0; i < 60; i++) { const q = await B(); if (q.pitch > 0.42 || q.crashed) break; await adv(0.05) }
await press('Shift', false)
s = await report('wheelie')
for (const k of ['side', 'three']) await view('wheelie', s, k)
await press('w', false); await press(' ', true); await adv(1.5); await press(' ', false)
await b.close()
