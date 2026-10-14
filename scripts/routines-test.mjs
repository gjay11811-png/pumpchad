// NPC daily routines: the day crowd and the night crowd differ, walkers keep moving, and none ever stands in a doorway.
//   URL=http://localhost:4318/chadverse/ [Q=medium] node scripts/routines-test.mjs
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:4318/chadverse/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
let fails = 0
const check = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails++ }
const run = async (sky) => {
  const p = await b.newPage({ viewport: { width: 900, height: 600 } })
  const warn = []
  p.on('pageerror', (e) => warn.push(e.message))
  const C = (fn, ...a) => p.evaluate(([f, a]) => window.__chadverse[f](...a), [fn, a])
  await p.addInitScript((q) => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: {}, settings: { quality: q, muted: true } })), process.env.Q || 'medium')
  await p.goto(`${BASE}${sky === 'night' ? '' : `?sky=${sky}`}`)
  await p.click('[data-testid=enter-muted]')
  await p.waitForSelector('[role=tablist]')
  await p.getByRole('tab', { name: 'Name' }).click()
  await p.fill('#chad-name', 'Watcher')
  await p.getByRole('button', { name: /Enter Chad Square/ }).click()
  await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 90000 })
  const doors = (await C('houses')).map((h) => h.door)
  const ids = (await C('integrity')).walkerIds
  const start = (await C('integrity')).walkers
  let nearest = Infinity
  for (let i = 0; i < 20; i++) {
    await p.waitForTimeout(1000)
    for (const [x, z] of (await C('integrity')).walkers) for (const d of doors) nearest = Math.min(nearest, Math.hypot(x - d.x, z - d.z))
  }
  const end = (await C('integrity')).walkers
  const moved = end.filter((a, i) => Math.hypot(a[0] - start[i][0], a[1] - start[i][1]) > 0.5).length
  await p.close()
  return { ids, moved, nearest, warn }
}
const night = await run('night')
console.log(`night crowd: ${night.ids.join(', ')}`)
check(night.ids.includes('lamplighter') && night.ids.includes('lateShopper'), 'night: the lamplighter and the late shopper are out')
check(!night.ids.includes('wander3'), 'night: the day strollers are indoors')
check(night.moved >= 2, `night: walkers keep to their rounds (${night.moved}/${night.ids.length} moved in 20 s)`)
check(night.nearest > 0.9, `night: nobody blocks a doorway (closest ${night.nearest.toFixed(2)} m)`)
const day = await run('day')
console.log(`day crowd: ${day.ids.join(', ')}`)
check(day.ids.includes('wander3'), 'day: the strollers are out')
check(!day.ids.includes('lamplighter') && !day.ids.includes('lateShopper') && !day.ids.includes('wander6'), 'day: the night crew is off shift')
check(day.moved >= 2, `day: walkers keep to their rounds (${day.moved}/${day.ids.length} moved in 20 s)`)
check(day.nearest > 0.9, `day: nobody blocks a doorway (closest ${day.nearest.toFixed(2)} m)`)
check(![...night.warn, ...day.warn].length, `no page errors (${JSON.stringify([...night.warn, ...day.warn].slice(0, 2))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
