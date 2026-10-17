import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] })
const p = await b.newPage({ viewport: { width: +(process.env.VW || 1000), height: +(process.env.VH || 600) } })
await p.addInitScript((q) => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'], xp: 800 }, settings: { quality: q, muted: true } })), process.env.Q || 'low')
await p.goto(`http://localhost:${process.env.PORT || 5180}/chadverse/?sky=day` + (process.env.EXTRA || ''))
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Rider')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const t0 = Date.now()
const spots = [[0, 34, 3.14], [0, 0, 0], [-20, 8, 1.57], [20, -6, 3], [46, 44, -1.57], [-50, 30, 1], [0, 62, 3.14], [-70, 2, 1.5]]
let lost = null
for (let round = 0; round < 3 && !lost; round++) for (const [x, z, yaw] of spots) {
  await p.evaluate(([x, z, yaw]) => window.__chadverse.teleport(x, z, yaw), [x, z, yaw])
  await p.waitForTimeout(2500)
  const r = await p.evaluate(() => ({ lost: window.__chadverse.gfxLog().some((e) => e.kind === 'lost'), st: window.__chadverse.stats() }))
  if (r.lost) { lost = { at: ((Date.now() - t0) / 1000).toFixed(0) + 's', spot: [x, z], tex: r.st.textures, geo: r.st.geometries }; break }
}
console.log(process.env.EXTRA || '(default)', lost ? 'LOST ' + JSON.stringify(lost) : 'survived ' + ((Date.now() - t0) / 1000).toFixed(0) + 's')
await b.close()
