// Review evidence for the village launch: arrival, Chad Square, the closed Valley Gate, Time Trial, Pumpkin Toss, Ghost Hunt, map.
// Gameplay camera, headless software GL (so lighting/shadow quality is indicative only).
//   SHOTS="C:/Users/zafe5/Desktop/Chadverse-Overnight-Review" Q=medium node scripts/launch-shots.mjs [only,names]
import { chromium } from 'playwright'
const out = process.env.SHOTS || '.'
const only = process.argv[2] ? process.argv[2].split(',') : null
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
await p.addInitScript((q) => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen', 'visit_square', 'visit_gym', 'visit_arcade', 'visit_haunted', 'visit_lake', 'visit_rides'], coins: 40 }, settings: { quality: q, muted: true } })), process.env.Q || 'medium')
await p.goto(process.env.URL || 'http://localhost:4318/chadverse/')
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Explorer')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const C = (fn, ...a) => p.evaluate(([f, a]) => window.__chadverse[f](...a), [fn, a])
const wait = (ms) => p.waitForTimeout(ms)
const shot = async (name) => { if (only && !only.includes(name)) return; await p.screenshot({ path: `${out}/launch-${name}.jpg`, quality: 85, type: 'jpeg' }); console.log('shot', name) }
const drag = async (dx, dy) => { await p.mouse.move(640, 360); await p.mouse.down(); await p.mouse.move(640 + dx, 360 + dy, { steps: 4 }); await p.mouse.up() }
const go = async (x, z, yaw, lookDown = 0) => { await C('teleport', x, z, yaw); await wait(1200); if (lookDown) { await drag(0, lookDown); await wait(500) } }

await wait(1000)
await go(0, 64.5, Math.PI)
await shot('01-arrival')
await go(0, 14, Math.PI)
await shot('02-chad-square')
await go(0, 69.5, 0)
await shot('03-valley-gate-closed')
await go(5.5, 71.5, 0.9)
await shot('04-valley-gate-angle')
await go(0, 72.1, 0)
await p.keyboard.press('e')
await wait(900)
await shot('05-valley-gate-notice')
await p.keyboard.press('Escape')
await wait(400)
// map with the locked veil
await p.keyboard.press('m')
await p.waitForSelector('[data-testid=map]')
await wait(500)
await shot('06-map-locked-next-update')
await p.keyboard.press('Escape')
await wait(500)
await go(12.4, 4.5, Math.PI / 2 + 0.2)
await shot('07-pump-gym-exterior')
await go(40, 19, Math.PI / 2)
await shot('08-pump-arcade-street')
// time trial, mid-run
await go(7.4, 11.4, Math.PI)
await p.keyboard.press('e')
await p.waitForSelector('[data-testid=event-race]')
await shot('09-events-board-card')
await p.click('[data-testid=event-race]')
await p.waitForFunction(() => window.__chadverse.events()?.phase === 'playing', null, { timeout: 8000 })
await wait(800)
const e = await C('events')
// stand a few metres short of the lit gate so the hoop + beam are in frame
const m = e.marks[0]
const w = await C('world')
const dx = m.x - w.x
const dz = m.z - w.z
const d = Math.hypot(dx, dz)
await C('teleport', m.x - (dx / d) * 6, m.z - (dz / d) * 6, Math.atan2(dx, dz))
await wait(1200)
await shot('10-time-trial-gate')
await p.keyboard.press('Escape')
await wait(500)
// target range
const R = await C('range')
await C('teleport', R.stand.x - Math.sin(R.stand.yaw) * 1.8, R.stand.z - Math.cos(R.stand.yaw) * 1.8, R.stand.yaw)
await wait(1000)
await shot('11-toss-range-approach')
await p.keyboard.press('e')
await p.waitForSelector('[data-testid=toss-start]')
await wait(500)
await shot('12-toss-instructions')
await p.click('[data-testid=toss-start]')
await p.waitForFunction(() => window.__chadverse.range()?.phase === 'playing', null, { timeout: 5000 })
await wait(700)
const bs = await C('rangeBoards')
for (const bd of [bs[0], bs[2]]) {
  await p.mouse.click(((bd.x + 1) / 2) * 1280, ((1 - bd.y) / 2) * 720)
  await wait(200)
  if (bd === bs[0]) await shot('13-toss-pumpkin-in-flight')
  await wait(700)
}
await shot('14-toss-hit-feedback')
await p.keyboard.press('Escape')
await wait(500)
// ghost hunt
await go(-61.8, 3.2, -Math.PI / 2)
await p.keyboard.press('e')
await p.waitForSelector('[data-testid=event-ghosthunt]')
await wait(500)
await shot('15-ghost-hunt-instructions')
await p.click('[data-testid=event-ghosthunt]')
await p.waitForFunction(() => window.__chadverse.events()?.phase === 'playing', null, { timeout: 8000 })
await wait(800)
const ghosts = (await C('events')).marks
// find a spot 6 m from some ghost where the camera has room (open lane/square), then turn the camera (mouse drag) onto it
let done = false
for (const gh of ghosts) {
  for (let k = 0; k < 12 && !done; k++) {
    const a = (k / 12) * Math.PI * 2
    const px = gh.x + Math.cos(a) * 6
    const pz = gh.z + Math.sin(a) * 6
    await C('teleport', px, pz, Math.atan2(gh.x - px, gh.z - pz))
    await wait(700)
    let w = await C('world')
    if (Math.hypot(w.x - px, w.z - pz) > 0.5) continue
    for (let i = 0; i < 4; i++) {
      w = await C('world')
      let e = Math.atan2(-(gh.x - w.x), -(gh.z - w.z)) - w.camYaw
      e = Math.atan2(Math.sin(e), Math.cos(e))
      if (Math.abs(e) < 0.05) break
      await drag(Math.max(-250, Math.min(250, -e / 0.006)), 0)
      await wait(450)
    }
    await wait(900)
    w = await C('world')
    if (w.camDist > 5.8) done = true
  }
  if (done) break
}
await wait(1200)
await shot('16-ghost-hunt-ghost-revealed')
await p.keyboard.press('Escape')
await wait(400)
console.log('errors:', JSON.stringify(errs.slice(0, 3)))
await b.close()
