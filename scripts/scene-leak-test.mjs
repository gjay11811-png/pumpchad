// Graphics-memory evidence: enter and leave a shop interior and the gym N times; geometry / texture / program counts and the JS heap after each
// round show whether scene switches leak (a leak is the likeliest reason a phone eventually loses its WebGL context). SIMULATED (headless software GL).
//   URL=http://localhost:5180/chadverse/ N=8 Q=low node scripts/scene-leak-test.mjs
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const N = +(process.env.N || 8)
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--enable-precise-memory-info'] })
const p = await b.newPage({ viewport: { width: 800, height: 520 } })
const errs = []
p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 120)))
await p.addInitScript((q) => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'] }, settings: { quality: q, muted: true } })), process.env.Q || 'low')
await p.goto(BASE)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Leaky')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const wait = (ms) => p.waitForTimeout(ms)
const snap = async (label) => {
  const r = await p.evaluate(() => {
    const s = window.__chadverse.stats()
    const st = Array.isArray(s) ? s[0] : s
    const m = performance.memory
    return { geo: st.geometries, tex: st.textures, prog: st.programs, heapMB: m ? +(m.usedJSHeapSize / 1048576).toFixed(1) : 0, phase: window.__chadverse.phase }
  })
  console.log(`${label.padEnd(10)} phase=${r.phase.padEnd(8)} geometries=${r.geo} textures=${r.tex} programs=${r.prog} heap=${r.heapMB} MB`)
  return r
}
const doorTo = async (x, z, yaw, wantPhase) => {
  await p.evaluate(([x, z, yaw]) => window.__chadverse.teleport(x, z, yaw), [x, z, yaw])
  await wait(700)
  await p.keyboard.press('e')
  await p.waitForFunction((ph) => window.__chadverse.phase === ph, wantPhase, { timeout: 60000 }).catch(() => {})
  await wait(700)
}
const out = async () => {
  await p.keyboard.down('s')
  await wait(1800)
  await p.keyboard.up('s')
  await wait(300)
  await p.keyboard.press('e')
  await p.waitForFunction(() => window.__chadverse.phase === 'world', null, { timeout: 60000 }).catch(() => {})
  await wait(800)
}
const rows = [await snap('start')]
for (let i = 1; i <= N; i++) {
  await doorTo(32.9, 16.8, Math.PI, 'interior')
  await out()
  rows.push(await snap(`round ${i}`))
}
const first = rows[1]
const last = rows[rows.length - 1]
console.log(`growth over rounds 1..${N}: geometries ${last.geo - first.geo}, textures ${last.tex - first.tex}, programs ${last.prog - first.prog}, heap ${(last.heapMB - first.heapMB).toFixed(1)} MB`)
console.log('console errors:', JSON.stringify(errs.slice(0, 4)))
await b.close()
