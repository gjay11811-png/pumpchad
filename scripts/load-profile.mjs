// CPU profile of the world build (click "Enter Chad Square" → world ready): top self-time functions.
//   URL=http://localhost:4318/chadverse/ node scripts/load-profile.mjs
import { chromium } from 'playwright'
const url = process.env.URL || 'http://localhost:4318/chadverse/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
await p.goto(url, { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'networkidle' })
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Profile')
const cdp = await p.context().newCDPSession(p)
await cdp.send('Profiler.enable')
await cdp.send('Profiler.setSamplingInterval', { interval: 500 })
await cdp.send('Profiler.start')
const t0 = Date.now()
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 90000, polling: 50 })
const ms = Date.now() - t0
const { profile } = await cdp.send('Profiler.stop')
const self = new Map()
const dt = profile.timeDeltas
const byId = new Map(profile.nodes.map((n) => [n.id, n]))
profile.samples.forEach((id, i) => {
  const n = byId.get(id)
  const k = `${n.callFrame.functionName || '(anon)'} :${n.callFrame.lineNumber}:${n.callFrame.columnNumber} ${n.callFrame.url.split('/').pop()}`
  self.set(k, (self.get(k) || 0) + (dt[i] || 0))
})
const total = [...self.values()].reduce((a, b) => a + b, 0)
console.log(`world ready in ${ms} ms`)
for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`${(v / 1000).toFixed(0).padStart(6)} ms  ${((v / total) * 100).toFixed(1).padStart(5)}%  ${k}`)
await b.close()
