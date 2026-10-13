// Gym performance: average frame time + WebGL draw calls per frame at a few gameplay viewpoints.
// Works on any build (draw calls are counted by hooking the GL draw functions, not via engine internals).
//   URL=... Q=high|medium|low node scripts/gym-perf.mjs
import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
await p.addInitScript(() => {
  window.__draws = 0
  for (const C of [WebGL2RenderingContext, WebGLRenderingContext])
    for (const f of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const o = C.prototype[f]
      if (!o) continue
      C.prototype[f] = function (...a) {
        window.__draws++
        return o.apply(this, a)
      }
    }
})
await p.goto(process.env.URL || 'http://localhost:4318/chadverse/', { waitUntil: 'networkidle' })
await p.evaluate((q) => {
  localStorage.clear()
  localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 1, character: null, progress: {}, settings: { quality: q, muted: true } }))
}, process.env.Q || 'high')
await p.reload({ waitUntil: 'networkidle' })
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Perf')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 60000 })
await p.evaluate(() => window.__chadverse.teleport(14.4, -4))
await p.waitForTimeout(500)
await p.keyboard.press('e')
await p.waitForFunction(() => window.__chadverse?.phase === 'gym' && window.__chadverse.gym()?.mode === 'free', null, { timeout: 60000 })
await p.waitForTimeout(3000)
const sample = () =>
  p.evaluate(
    () =>
      new Promise((res) => {
        const d0 = window.__draws
        let n = 0
        const t0 = performance.now()
        const f = () => {
          n++
          if (performance.now() - t0 < 3000) requestAnimationFrame(f)
          else res({ ms: +((performance.now() - t0) / n).toFixed(1), draws: Math.round((window.__draws - d0) / n) })
        }
        requestAnimationFrame(f)
      }),
  )
const views = { entry: null, curl: 'curl', squat: 'squat', treadmill: 'treadmill' }
for (const [name, id] of Object.entries(views)) {
  if (id) await p.evaluate((id) => window.__chadverse.gymGoto(id), id)
  await p.waitForTimeout(1200)
  console.log(name, JSON.stringify(await sample()), JSON.stringify(await p.evaluate(() => window.__chadverse.stats())))
}
await b.close()
