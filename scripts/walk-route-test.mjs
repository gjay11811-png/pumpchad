// An ORDINARY walk (W + Shift only; the heading is set at each waypoint like a player turning) from the spawn to the parkour yard, the show homes, the
// far plots and the weapon activities. A stall (no progress for 1 s) reports exactly where the character is stuck — the invisible-blocker hunt.
//   URL=http://localhost:5180/chadverse/ node scripts/walk-route-test.mjs [route]     route: parkour (default) | sword | range | far
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const ROUTES = {
  parkour: [[0, 64.5], [-10, 56], [-27, 47], [-34, 47], [-64, 47], [-68, 44], [-68, 38], [-120, 38], [-234, 38], [-234, 28], [-234, 12]],
  sword: [[-234, 12], [-234, 2], [-228, -2], [-222, -10], [-196, -11.2]],
  far: [[-68, 38], [-240, 38], [-240, 62], [-72, 62]],
  show: [[-68, 38], [-77, 38], [-90, 38], [-103, 38]],
  range: [[0, 64.5], [20, 52], [60, 52], [100, 56], [104, 64]],
}
const route = ROUTES[process.argv[2] || 'parkour']
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 800, height: 520 } })
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'] }, settings: { quality: 'low', muted: true } })))
await p.goto(BASE)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Walker')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const W = () => p.evaluate(() => window.__chadverse.world())
const wait = (ms) => p.waitForTimeout(ms)
let fails = 0
await p.evaluate(([x, z]) => window.__chadverse.teleport(x, z, 0), route[0])
await wait(700)
for (let i = 1; i < route.length; i++) {
  const [tx, tz] = route[i]
  const w0 = await W()
  // face the next waypoint: the game's yaw 0 faces +z, so the heading is atan2(dx, dz)
  const yaw = Math.atan2(tx - w0.x, tz - w0.z)
  await p.evaluate(([x, z, yaw]) => window.__chadverse.teleport(x, z, yaw), [w0.x, w0.z, yaw])
  await wait(300)
  await p.keyboard.down('w')
  await p.keyboard.down('Shift')
  let last = [w0.x, w0.z]
  let lastMove = Date.now()
  let ok = false
  let minD = 1e9
  for (let k = 0; k < 400; k++) {
    await wait(60)
    const w = await W()
    const dd = Math.hypot(w.x - tx, w.z - tz)
    // the follow-camera drifts behind a runner, which bends a held-W path: a player corrects by steering, so re-aim every few polls (position kept)
    if (k % 6 === 5) {
      await p.evaluate(([yy]) => window.__chadverse.steer?.(yy), [Math.atan2(tx - w.x, tz - w.z)])
    }
    minD = Math.min(minD, dd)
    if (dd < 3 || (minD < 7 && dd > minD + 1.2)) {
      ok = true // reached (or passed it: a sprinting step is ~1.5 m between polls)
      break
    }
    if (Math.hypot(w.x - last[0], w.z - last[1]) > 0.08) {
      last = [w.x, w.z]
      lastMove = Date.now()
    } else if (Date.now() - lastMove > 1000) {
      console.log(`  STALL on leg ${i} (${route[i - 1]} -> ${route[i]}): stuck at (${w.x.toFixed(2)}, ${w.z.toFixed(2)}), heading yaw ${yaw.toFixed(2)}`)
      fails++
      break
    }
  }
  await p.keyboard.up('w')
  await p.keyboard.up('Shift')
  if (ok) console.log(`  ok  leg ${i} reached (${tx}, ${tz})`)
  else if (!fails) console.log(`  TIMEOUT leg ${i}`)
  if (!ok) break
}
const end = await W()
console.log(`  finished at (${end.x.toFixed(1)}, ${end.z.toFixed(1)}) prompt=${end.prompt}`)
console.log(fails ? 'BLOCKED' : 'ROUTE WALKED')
await b.close()
process.exit(fails ? 1 : 0)
