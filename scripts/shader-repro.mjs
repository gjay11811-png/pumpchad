// Repro harness: repeatedly builds each species in the creator, enters the world and the gym,
// and records every shader/WebGL error with full diagnostics. Optional GPU backend via BACKEND=swiftshader|d3d11.
import { chromium } from 'playwright'
const backend = process.env.BACKEND || 'default'
const args = backend === 'd3d11' ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : backend === 'swiftshader' ? ['--use-angle=swiftshader'] : []
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args })
const rounds = +(process.env.ROUNDS || 4)
let errors = []
for (let r = 0; r < rounds; r++) {
  for (const sp of ['skeleton', 'demon', 'pumpkin']) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } })
    const p = await ctx.newPage()
    p.on('console', (m) => m.type() === 'error' && errors.push({ round: r, sp, text: m.text().slice(0, 1600) }))
    await p.goto('http://localhost:4318/chadverse/', { waitUntil: 'networkidle' })
    await p.evaluate((sp) => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 1, character: { name: 'Repro', appearance: { species: sp, skin: sp === 'skeleton' ? '#e9e2d0' : sp === 'demon' ? '#8e1f18' : '#e8741c', outfit: '#2a262c', glow: '#7fd6ff', top: sp === 'skeleton' ? 'armor' : 'shirtless', headwear: 'none', eyewear: 'none', chain: true } }, progress: { xp: 0, achievements: [], gymBest: 0, gymRuns: 0, discoveries: [] }, settings: { quality: 'high', sfx: 0, ambience: 0, muted: true, reducedEffects: false, cameraSensitivity: 1, stickSensitivity: 1, uiScale: 1 } })), sp)
    await p.reload({ waitUntil: 'networkidle' })
    await p.waitForSelector('[data-testid=enter-muted]', { timeout: 30000 })
    if (r === 0 && sp === 'skeleton') console.log('GL renderer:', await p.evaluate(() => { const c = document.createElement('canvas').getContext('webgl2'); return c?.getParameter(c.RENDERER) }))
    await p.click('[data-testid=enter-muted]')
    await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 40000 })
    await p.waitForTimeout(1500)
    await p.evaluate(() => window.__chadverse.teleport(14.4, -4))
    await p.waitForTimeout(400)
    await p.keyboard.press('e')
    await p.waitForFunction(() => window.__chadverse?.phase === 'gym', null, { timeout: 20000 }).catch(() => {})
    await p.waitForTimeout(2000)
    await ctx.close()
  }
  console.log(`round ${r + 1}/${rounds}: ${errors.length} error(s) so far`)
}
console.log(`\nBACKEND=${backend}: ${errors.length} error(s) in ${rounds * 3} sessions`)
for (const e of errors.slice(0, 4)) console.log(`--- round ${e.round} ${e.sp}\n${e.text}`)
await b.close()
