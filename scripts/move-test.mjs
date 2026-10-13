// Movement + desktop camera QA: gait speeds and clips, foot slip, diagonal runs (no circling / slumping),
// walls stop the run, smooth transitions, drag-to-look (incl. a missed mouse release), cursor restore.
//   SHOTS=dir node scripts/move-test.mjs [Species]      (dev server on :4318)
import { chromium } from 'playwright'
const out = process.env.SHOTS || '.'
const species = process.argv[2] || 'Pumpkin'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1200, height: 760 } })
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)))
let pass = 0
let fail = 0
const check = (ok, msg) => {
  ok ? pass++ : fail++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
}
const w = (ms) => p.waitForTimeout(ms)
const W = () => p.evaluate(() => window.__chadverse.world())
const tp = async (x, z, yaw) => {
  await p.evaluate(([x, z, yaw]) => window.__chadverse.teleport(x, z, yaw), [x, z, yaw])
  await w(500)
}
/** sample the player every animation frame for `ms` while `keys` are held */
const run = (keys, ms) =>
  p.evaluate(
    async ([ms]) => {
      const S = []
      const t0 = performance.now()
      await new Promise((res) => {
        const tick = () => {
          const f = window.__chadverse.playerInspect()
          const wd = window.__chadverse.world()
          S.push({ t: performance.now(), f, wd })
          if (performance.now() - t0 < ms) requestAnimationFrame(tick)
          else res()
        }
        tick()
      })
      return S.map((s) => ({ t: s.t, gt: s.wd.t, x: s.wd.x, z: s.wd.z, camYaw: s.wd.camYaw, clip: s.f.clip, head: s.f.headBone, pelvis: s.f.pelvis, ballL: s.f.ballL, ballR: s.f.ballR, lean: s.f.lean }))
    },
    [ms],
  )
const hold = async (keys, ms) => {
  for (const k of keys) await p.keyboard.down(k)
  const s = await run(keys, ms)
  for (const k of keys) await p.keyboard.up(k)
  return s
}
const speedOf = (S, from = 0.5) => {
  const a = S.find((s) => s.t - S[0].t >= from * 1000) ?? S[0]
  const z = S.at(-1)
  return Math.hypot(z.x - a.x, z.z - a.z) / ((z.t - a.t) / 1000)
}
const dominant = (S) => {
  const c = {}
  for (const s of S.slice(Math.floor(S.length / 2))) c[s.clip] = (c[s.clip] ?? 0) + 1
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0]
}
/** planted-foot slip (m/s): while a foot is the lowest and on the ground, how fast does it slide in the world? */
const slip = (S) => {
  let d = 0
  let t = 0
  for (const side of ['ballL', 'ballR']) {
    const ys = S.map((s) => s[side][1])
    const minY = Math.min(...ys)
    for (let i = 1; i < S.length; i++)
      if (ys[i] < minY + 0.02 && ys[i - 1] < minY + 0.02) {
        d += Math.hypot(S[i][side][0] - S[i - 1][side][0], S[i][side][2] - S[i - 1][side][2])
        t += (S[i].t - S[i - 1].t) / 1000
      }
  }
  return t ? d / t : 0
}

console.log(`\n══════ Movement + camera (${species}) ══════`)
await p.goto(process.env.URL || 'http://localhost:4318/chadverse/', { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'networkidle' })
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('radio', { name: species, exact: true }).first().click()
await p.waitForFunction((s) => window.__chadverse.showroom()?.rig?.species === s, species.toLowerCase(), { timeout: 30000 })
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Move Test')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 40000 })
await w(1200)

// ── gaits (open plaza, heading south down the main street)
await tp(0, 13, 0)
const walk = await hold(['w'], 1800)
const vWalk = speedOf(walk)
check(vWalk > 1.8 && vWalk < 2.6, `walk speed ${vWalk.toFixed(2)} m/s`)
check(dominant(walk) === 'Walk_Loop', `walking plays the WALK clip (${dominant(walk)})`)
const sWalk = slip(walk)
check(sWalk < 0.6, `walk foot slip ${sWalk.toFixed(2)} m/s (pre-polish build: 1.58; includes natural heel-to-toe roll)`)
await p.screenshot({ path: `${out}/move-walk.jpg`, quality: 78 })
await tp(0, 13, 0)
const sprint = await hold(['Shift', 'w'], 1800)
const vSprint = speedOf(sprint)
check(vSprint > 6.8 && vSprint < 8.4, `sprint speed ${vSprint.toFixed(2)} m/s`)
check(/Jog|Sprint/.test(dominant(sprint)), `sprinting plays run/sprint clips (${dominant(sprint)})`)
const sSprint = slip(sprint)
check(sSprint < 1.2, `sprint foot slip ${sSprint.toFixed(2)} m/s of ${vSprint.toFixed(1)} m/s travel (pre-polish build: 2.27 of 5.7)`)
const headS = Math.min(...sprint.slice(Math.floor(sprint.length / 3)).map((s) => s.head[1]))
check(headS > 1.15, `sprint stays upright-ish (lowest head ${headS.toFixed(2)} m)`)
await p.screenshot({ path: `${out}/move-sprint.jpg`, quality: 78 })

// ── diagonal: forward + left arrow, walking and sprinting — straight path, camera holds, no slump
for (const keys of [['ArrowUp', 'ArrowLeft'], ['Shift', 'ArrowUp', 'ArrowLeft']]) {
  await tp(-6, 2, Math.PI)
  const S = await hold(keys, 1600)
  const cam = Math.abs(S.at(-1).camYaw - S[0].camYaw) * (180 / Math.PI)
  const mid = S[Math.floor(S.length / 2)]
  const a = Math.atan2(mid.x - S[0].x, mid.z - S[0].z)
  const c = Math.atan2(S.at(-1).x - mid.x, S.at(-1).z - mid.z)
  const bend = Math.abs(Math.atan2(Math.sin(c - a), Math.cos(c - a))) * (180 / Math.PI)
  const lowHead = Math.min(...S.slice(10).map((s) => s.head[1]))
  const maxLean = Math.max(...S.map((s) => Math.abs(s.lean?.[0] ?? 0)))
  check(cam < 8, `${keys.join('+')}: camera holds (${cam.toFixed(1)}°)`)
  check(bend < 12, `${keys.join('+')}: path runs straight (bend ${bend.toFixed(1)}°)`)
  check(lowHead > 1.15, `${keys.join('+')}: no sideways slump (lowest head ${lowHead.toFixed(2)} m, max turn-lean ${maxLean.toFixed(2)})`)
  if (keys.length === 3) await p.screenshot({ path: `${out}/move-diagonal-sprint.jpg`, quality: 78 })
}

// ── walls: sprinting into the plaza hedge must not keep the run animation going
await tp(1.6, 15.5, Math.PI / 2) // facing +x, hedge at x≈3.05
const wall = await hold(['Shift', 'w'], 1500)
const vWall = speedOf(wall, 0.6)
console.log('  info  hedge path', [wall[0], wall[Math.floor(wall.length/2)], wall.at(-1)].map((s) => `${s.x},${s.z}`).join(' → '))
const clipWall = wall.at(-1).clip
check(vWall < 0.6 && !/Sprint/.test(clipWall ?? ''), `blocked by the hedge: speed ${vWall.toFixed(2)} m/s, clip ${clipWall}`)

// ── transitions: idle → walk → sprint → stop without pose snaps
await tp(0, 12, 0)
await p.keyboard.down('w')
const T1 = await run([], 700)
await p.keyboard.down('Shift')
const T2 = await run([], 900)
await p.keyboard.up('Shift')
await p.keyboard.up('w')
const T3 = await run([], 900)
const T = [...T1, ...T2, ...T3]
let worst = 0
let worstAt = ''
for (let i = 1; i < T.length; i++) {
  const dt = T[i].gt - T[i - 1].gt // game time: robust to samples landing between game frames
  if (dt <= 0 || dt > 0.1) continue
  // head relative to the pelvis: a snap shows up as a big instant change in posture
  const h0 = [T[i - 1].head[0] - T[i - 1].pelvis[0], T[i - 1].head[1] - T[i - 1].pelvis[1], T[i - 1].head[2] - T[i - 1].pelvis[2]]
  const h1 = [T[i].head[0] - T[i].pelvis[0], T[i].head[1] - T[i].pelvis[1], T[i].head[2] - T[i].pelvis[2]]
  const v = Math.hypot(h1[0] - h0[0], h1[1] - h0[1], h1[2] - h0[2]) / dt
  if (v > worst) {
    worst = v
    worstAt = `${i}/${T.length} ${T[i - 1].clip}→${T[i].clip} dt ${(dt * 1000).toFixed(0)}ms`
  }
}
console.log('  info  worst posture change at', worstAt)
check(worst < 4.5, `no posture snaps through idle→walk→sprint→stop (peak head-vs-hips speed ${worst.toFixed(2)} m/s)`)
check(T3.at(-1).clip === 'Idle_Loop', `settles back to idle (${T3.at(-1).clip})`)

// ── desktop drag-to-look
await tp(0, 12, 0)
let c0 = (await W()).camYaw
await p.mouse.move(600, 420)
await p.mouse.down()
await p.mouse.move(400, 420, { steps: 10 })
const cursorDuring = await p.evaluate(() => document.querySelector('canvas').parentElement.style.cursor)
await p.mouse.up()
await w(200)
let c1 = (await W()).camYaw
check(Math.abs(c1 - c0) > 0.5, `mouse drag turns the camera (${(((c1 - c0) * 180) / Math.PI).toFixed(0)}°)`)
const cursorAfter = await p.evaluate(() => document.querySelector('canvas').parentElement.style.cursor)
check(cursorDuring === 'grabbing' && cursorAfter === '', `grab cursor while dragging, restored after ("${cursorDuring}" → "${cursorAfter}")`)
const dy0 = await W()
await p.mouse.move(600, 420)
await p.mouse.down()
await p.mouse.move(600, 200, { steps: 10 })
await p.mouse.up()
await w(200)
check(Math.abs((await W()).camYaw - dy0.camYaw) < 0.05, 'vertical drag tilts without spinning the camera')
// a press whose release was never delivered (let go outside the window) must not break the next drag
await p.evaluate(() => {
  const c = document.querySelector('canvas')
  c.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, clientX: 500, clientY: 400, bubbles: true }))
})
c0 = (await W()).camYaw
await p.mouse.move(600, 420)
await p.mouse.down()
await p.mouse.move(800, 420, { steps: 10 })
await p.mouse.up()
await w(200)
c1 = (await W()).camYaw
check(Math.abs(c1 - c0) > 0.5, `drag still works after a missed release (${(((c1 - c0) * 180) / Math.PI).toFixed(0)}°)`)
// dragging + walking together; the camera stays where you put it for a moment
const pos0 = await W()
await p.keyboard.down('w')
await p.mouse.move(600, 420)
await p.mouse.down()
await p.mouse.move(450, 420, { steps: 12 })
await p.mouse.up()
await w(500)
await p.keyboard.up('w')
const pos1 = await W()
check(Math.hypot(pos1.x - pos0.x, pos1.z - pos0.z) > 0.8, 'you can walk while dragging the view')
// after a mouse look, walking forward must not swing the camera back behind the player
const k0 = (await W()).camYaw
await p.keyboard.down('w')
await w(2500)
await p.keyboard.up('w')
const k1 = (await W()).camYaw
check(Math.abs(k1 - k0) < 0.02, `the camera stays where you dragged it while walking (${(((k1 - k0) * 180) / Math.PI).toFixed(1)}°)`)
check((await p.evaluate(() => document.querySelector('canvas').style.cursor)) === 'grab', 'desktop shows a grab cursor over the 3D view')
// a click on a UI button must not start a camera drag
const c2 = (await W()).camYaw
const btn = await p.locator('button[aria-label="Pause menu"]').boundingBox()
await p.mouse.move(btn.x + btn.width / 2, btn.y + btn.height / 2)
await p.mouse.down()
await p.mouse.move(btn.x - 200, btn.y + 100, { steps: 8 })
await p.mouse.up()
await w(300)
check(Math.abs((await W()).camYaw - c2) < 0.02, 'pressing on UI buttons never drags the camera')
if (await p.locator('[role=dialog]').isVisible().catch(() => false)) await p.keyboard.press('Escape')

// ── gym floor: indoor gaits + drag
await p.evaluate(() => window.__chadverse.teleport(14.4, -4))
await w(400)
await p.keyboard.press('e')
await p.waitForFunction(() => window.__chadverse?.phase === 'gym' && window.__chadverse.gym()?.mode === 'free', null, { timeout: 20000 })
await w(800)
const g0 = await p.evaluate(() => window.__chadverse.gymInspect())
await p.keyboard.down('w')
await w(900)
const gClip = (await p.evaluate(() => window.__chadverse.gymInspect())).clip
await p.keyboard.up('w')
check(gClip === 'Walk_Loop', `gym floor walking plays the walk clip (${gClip})`)
check(errs.length === 0, `no console errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`)
console.log(fail ? `${fail} FAILURE(S)` : 'ALL CHECKS PASSED')
await b.close()
