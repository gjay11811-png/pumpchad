// frame cost at named spots (headless software GL: compare spots with each other, not with a real GPU)
//   Q=medium node scripts/perf-spots.mjs
import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 900, height: 600 } })
await p.addInitScript((q) => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: {}, settings: { quality: q, muted: true } })), process.env.Q || 'medium')
await p.goto(process.env.URL || 'http://localhost:4318/chadverse/')
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Explorer')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const SPOTS = JSON.parse(process.env.SPOTS || '{"square":[0,8,0]}')
for (const [name, [x, z, yaw]] of Object.entries(SPOTS)) {
  await p.evaluate(([x, z, yaw]) => window.__chadverse.teleport(x, z, yaw), [x, z, yaw])
  await p.waitForTimeout(6000)
  const s = []
  for (let i = 0; i < 4; i++) { s.push(await p.evaluate(() => window.__chadverse.stats())); await p.waitForTimeout(700) }
  const f = s.map((r) => r.fps ?? r[0]?.fps)
  const last = s[s.length - 1]
  const wd = await p.evaluate(() => window.__chadverse.world())
  console.log(name.padEnd(15), JSON.stringify(last).slice(0, 150), `calls=${wd.calls} tris=${wd.triangles}`)
}
await b.close()
