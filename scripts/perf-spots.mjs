// render cost at spots: draw calls, triangles (all passes, per frame), geometries, textures, JS heap. SOFTWARE-RENDERED: frame times are not meaningful, the counts are.
//   SPOTS="avenue:0:34:3.14;motors:46:44:-1.57" Q=medium SKY=day node scripts/perf-spots.mjs
import { chromium } from 'playwright'
const spots = (process.env.SPOTS || 'avenue:0:34:3.14').split(';').map((s) => { const [n, x, z, yaw] = s.split(':'); return { n, x: +x, z: +z, yaw: +yaw } })
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] })
const p = await b.newPage({ viewport: { width: 1000, height: 600 } })
await p.addInitScript((q) => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'], xp: 800 }, settings: { quality: q, muted: true } })), process.env.Q || 'medium')
await p.goto(`http://localhost:${process.env.PORT || 5180}/chadverse/?sky=${process.env.SKY || 'day'}${process.env.EXTRA || ''}${process.env.EXPANSION === 'open' ? '&expansion=open' : ''}`)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Rider')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const row = (n, s, h) => console.log(`${n.padEnd(10)} calls ${String(s.calls).padStart(4)}  tris ${String(s.triangles).padStart(8)}  geo ${String(s.geometries).padStart(4)}  tex ${String(s.textures).padStart(3)}  programs ${String(s.programs).padStart(3)}  heap ${h} MB`)
for (const s of spots) {
  await p.evaluate(([x, z, yaw]) => window.__chadverse.teleport(x, z, yaw), [s.x, s.z, s.yaw])
  await p.waitForTimeout(4500)
  const r = await p.evaluate(() => ({ st: window.__chadverse.stats(), heap: Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576), lost: window.__chadverse.gfxLog().some((e) => e.kind === 'lost') }))
  row(s.n, r.st, r.heap)
  if (r.lost) { console.log('  !! WebGL context lost'); break }
}
await b.close()
