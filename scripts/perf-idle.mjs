// Frame-time probe: stand in Chad Square (crowd visible) and report average/worst frame times + CPU profile top functions.
import { chromium } from 'playwright'
const sp = process.argv[2] || 'Pumpkin'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1000, height: 700 } })
await p.goto(process.env.URL || 'http://localhost:4318/chadverse/', { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'networkidle' })
await p.click('[data-testid=enter-muted]'); await p.waitForSelector('[role=tablist]')
await p.getByRole('radio', { name: sp, exact: true }).first().click()
await p.waitForFunction((s) => window.__chadverse.showroom()?.rig?.species === s, sp.toLowerCase(), { timeout: 30000 })
await p.getByRole('tab', { name: 'Name' }).click(); await p.fill('#chad-name', 'Perf Probe')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 40000 })
await p.waitForTimeout(6000) // let first-time compiles settle
const cdp = await p.context().newCDPSession(p)
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start')
const st = await p.evaluate(() => new Promise((res) => { const g = []; let last = performance.now(); const f = () => { const n = performance.now(); g.push(n - last); last = n; if (g.length < 90) requestAnimationFrame(f); else res(g) }; requestAnimationFrame(f) }))
const { profile } = await cdp.send('Profiler.stop')
st.shift()
const avg = st.reduce((a, b) => a + b, 0) / st.length
console.log(`${sp}: avg frame ${avg.toFixed(1)} ms, worst ${Math.max(...st).toFixed(0)} ms over ${st.length} frames`)
const byId = new Map(profile.nodes.map((n) => [n.id, n])); const self = new Map()
profile.samples.forEach((id, i) => { const n = byId.get(id); const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop().split('?')[0]}`; self.set(k, (self.get(k) || 0) + (profile.timeDeltas[i] || 0)) })
const total = [...self.values()].reduce((a, b) => a + b, 0)
;[...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([k, us]) => console.log(`  ${((us / total) * 100).toFixed(1).padStart(5)}%  ${k}`))
await b.close()
