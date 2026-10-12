// Frame-time probe for the hero + countdown on a throttled phone (CPU x4). Reports how smooth the page is
// overall and specifically around each one-second tick of the countdown.
//   URL=http://localhost:4331/ node scripts/countdown-perf.mjs
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4331/'
const RATE = +(process.env.THROTTLE || 4)
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Europe/London' })
const p = await ctx.newPage()
const cdp = await ctx.newCDPSession(p)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE })
await p.goto(URL, { waitUntil: 'networkidle' })
await p.waitForTimeout(4000) // entrance animations done
const coarse = await p.evaluate(() => matchMedia('(pointer: coarse)').matches)
const r = await p.evaluate(() => new Promise((res) => {
  const g = []
  let last = performance.now()
  const t0 = last
  const f = () => {
    const n = performance.now()
    g.push([n - t0, n - last])
    last = n
    if (n - t0 < 12000) requestAnimationFrame(f)
    else res(g)
  }
  requestAnimationFrame(f)
}))
const gaps = r.slice(1).map((x) => x[1])
const sorted = [...gaps].sort((a, b) => a - b)
const q = (x) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * x))]
// frames that land just after a wall-clock second boundary = the digit-flip frames
const wall = await p.evaluate(() => performance.timeOrigin)
const tick = r.slice(1).filter(([t]) => { const ms = (wall + t) % 1000; return ms < 160 }).map((x) => x[1])
const rest = r.slice(1).filter(([t]) => { const ms = (wall + t) % 1000; return ms >= 160 }).map((x) => x[1])
const avg = (a) => (a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)).toFixed(1)
console.log(`pointer:coarse=${coarse}  CPU x${RATE}  frames=${gaps.length}`)
console.log(`overall   avg ${avg(gaps)} ms  p95 ${q(0.95).toFixed(0)} ms  worst ${Math.max(...gaps).toFixed(0)} ms  >50ms: ${gaps.filter((g) => g > 50).length}`)
console.log(`tick      avg ${avg(tick)} ms  worst ${Math.max(...tick).toFixed(0)} ms  (${tick.length} frames just after a tick)`)
console.log(`between   avg ${avg(rest)} ms  worst ${Math.max(...rest).toFixed(0)} ms`)
await b.close()
