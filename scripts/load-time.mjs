// World build time: click "Enter Chad Square" → world ready, a few runs.
//   URL=http://localhost:4318/chadverse/ RUNS=3 node scripts/load-time.mjs
import { chromium } from 'playwright'
const url = process.env.URL || 'http://localhost:4318/chadverse/'
const runs = +(process.env.RUNS || 3)
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const times = []
for (let i = 0; i < runs; i++) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
  await p.goto(url, { waitUntil: 'networkidle' })
  await p.evaluate(() => localStorage.clear())
  await p.reload({ waitUntil: 'networkidle' })
  await p.click('[data-testid=enter-muted]')
  await p.waitForSelector('[role=tablist]')
  await p.getByRole('tab', { name: 'Name' }).click()
  await p.fill('#chad-name', 'Load Time')
  const t0 = Date.now()
  await p.getByRole('button', { name: /Enter Chad Square/ }).click()
  await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 90000, polling: 50 })
  times.push(Date.now() - t0)
  console.log(`run ${i + 1}: ${times[i]} ms`)
  await p.close()
}
console.log(`median ${times.sort((a, b) => a - b)[Math.floor(times.length / 2)]} ms`)
await b.close()
