// Finds the clip-speed calibration with the least foot sliding, measured in the real world.
import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1000, height: 700 } })
await p.goto('http://localhost:4318/chadverse/', { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 1, character: { name: 'Sweep', appearance: { species: 'pumpkin', skin: '#e8741c', outfit: '#141216', glow: '#ffb347', top: 'shirtless', headwear: 'none', eyewear: 'shades', chain: true } }, progress: { xp: 0, achievements: [], gymBest: 0, gymRuns: 0, discoveries: [] }, settings: { quality: 'low', sfx: 0, ambience: 0, muted: true, reducedEffects: true, cameraSensitivity: 1, stickSensitivity: 1, uiScale: 1 } })))
await p.reload({ waitUntil: 'networkidle' })
await p.waitForSelector('[data-testid=enter-muted]')
await p.click('[data-testid=enter-muted]')
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 30000 })
async function slip(run) {
  await p.evaluate(() => window.__chadverse.teleport(0, 21, Math.PI))
  await new Promise((r) => setTimeout(r, 300))
  if (run) await p.keyboard.down('Shift')
  await p.keyboard.down('w')
  await new Promise((r) => setTimeout(r, 600))
  const d = await p.evaluate(() => new Promise((res) => {
    const s = []; const t0 = performance.now()
    const tick = () => { s.push({ t: performance.now(), f: window.__chadverse.playerInspect(), w: window.__chadverse.world() }); if (performance.now() - t0 < 1500) requestAnimationFrame(tick); else res(s) }
    tick()
  }))
  await p.keyboard.up('w'); if (run) await p.keyboard.up('Shift')
  // stance = a foot within 1.5 cm of the lowest toe height seen (true ground contact only)
  let dist = 0, time = 0
  for (const side of ['ballL', 'ballR']) {
    const ys = d.map((x) => x.f[side][1])
    const minY = Math.min(...ys)
    for (let i = 1; i < d.length; i++) {
      if (ys[i] > minY + 0.015 || ys[i - 1] > minY + 0.015) continue
      dist += Math.hypot(d[i].f[side][0] - d[i - 1].f[side][0], d[i].f[side][2] - d[i - 1].f[side][2])
      time += (d[i].t - d[i - 1].t) / 1000
    }
  }
  const body = Math.hypot(d.at(-1).w.x - d[0].w.x, d.at(-1).w.z - d[0].w.z) / ((d.at(-1).t - d[0].t) / 1000)
  return { slip: dist / time / body, body }
}
for (const [clip, run, values] of [['jog', false, [3.4, 4.6, 5.6, 6.2, 7.0, 8.0]], ['sprint', true, [6.2, 7.5, 8.5, 9.4, 10.5, 12]]]) {
  for (const v of values) {
    await p.evaluate(([clip, v]) => (globalThis.__chadClipSpeed = { [clip]: v }), [clip, v])
    const r = await slip(run)
    console.log(clip.padEnd(7), 'clipSpeed', String(v).padEnd(4), 'slip', (r.slip * 100).toFixed(0) + '%', 'body', r.body.toFixed(2))
  }
}
await b.close()
