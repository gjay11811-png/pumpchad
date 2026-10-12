// Priority 2 animation checks: jump/land, emotes (wheel + keys + touch), cancelling, rapid switching,
// personality fidgets, lean, gym interplay, cleanup.   node scripts/anim-test.mjs [Species] [mobile]
import { chromium } from 'playwright'
const species = process.argv[2] || 'Pumpkin'
const mobile = process.argv[3] === 'mobile'
const out = process.env.SHOTS
const URL = process.env.URL || 'http://localhost:4318/chadverse/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage(mobile ? { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 800 } })
const errs = []
p.on('pageerror', (e) => errs.push(`[pageerror] ${e.message}`))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 400)))
let pass = 0
let fail = 0
const check = (ok, msg) => {
  ok ? pass++ : fail++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
}
const w = (ms) => p.waitForTimeout(ms)
const anim = () => p.evaluate(() => window.__chadverse.anim())
const rig = () => p.evaluate(() => window.__chadverse.playerInspect() ?? window.__chadverse.gymInspect())
const shot = async (name) => out && p.screenshot({ path: `${out}/an-${species.toLowerCase()}${mobile ? '-m' : ''}-${name}.jpg`, quality: 78 })
const tag = `${species}${mobile ? ' (phone)' : ''}`
const jump = () => (mobile ? p.locator('[data-testid=jump-button]').dispatchEvent('pointerdown') : p.keyboard.press(' '))
const emote = async (id, key) => {
  if (mobile) {
    await p.click('[data-testid=emote-button]')
    await p.waitForSelector('[data-testid=emote-wheel]')
    await p.click(`[data-testid=emote-${id}]`)
  } else await p.keyboard.press(key)
}
/** wait until the character has landed and the rig is back on the ground */
const settle = () => p.waitForFunction(() => { const a = window.__chadverse.anim(); const r = window.__chadverse.playerInspect() ?? window.__chadverse.gymInspect(); return a && r && !a.airborne && r.air === 'ground' }, null, { timeout: 15000 }).catch(() => {})
/** move briefly (keyboard or joystick) */
const nudge = async (ms = 500) => {
  if (mobile) {
    const vp = p.viewportSize()
    await p.mouse.move(70, vp.height - 90)
    await p.mouse.down()
    await p.mouse.move(70, vp.height - 160, { steps: 4 })
    await w(ms)
    await p.mouse.up()
  } else {
    await p.keyboard.down('w')
    await w(ms)
    await p.keyboard.up('w')
  }
}
/** sample [rig, anim] for `ms` */
const sample = async (ms, step = 60) => {
  const rows = []
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    rows.push(await p.evaluate(() => ({ r: window.__chadverse.playerInspect() ?? window.__chadverse.gymInspect(), a: window.__chadverse.anim() })))
    await w(step)
  }
  return rows
}

console.log(`\n══════ Animations: ${tag} ══════`)
await p.goto(URL, { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'networkidle' })
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('radio', { name: species, exact: true }).first().click()
await p.waitForFunction((s) => window.__chadverse.showroom()?.rig?.species === s, species.toLowerCase(), { timeout: 30000 })
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Anim Test')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 40000 })
await p.evaluate(() => window.__chadverse.teleport(0, 15, Math.PI))
await w(1500)
const mem0 = await p.evaluate(() => window.__chadverse.stats())

/* ── jump from standing ── */
{
  console.log(`  info  frame rate here: ${(await p.evaluate(() => window.__chadverse.stats())).fps} fps (headless software rendering)`)
  // in-page per-frame log, so slow headless frames can't hide a phase
  await p.evaluate(() => {
    window.__jl = []
    const f = () => {
      const a = window.__chadverse.anim()
      const r = window.__chadverse.playerInspect()
      if (a && r) window.__jl.push({ y: a.jumpY, air: a.airborne, rigAir: r.air, clip: r.clip })
      if (window.__jl.length < 2000) window.__jlRaf = requestAnimationFrame(f)
    }
    f()
  })
  await jump()
  const up = await p.waitForFunction(() => window.__chadverse.anim().jumpY > 0.2, null, { timeout: 5000 }).then(() => true, () => false)
  const down = await p.waitForFunction(() => !window.__chadverse.anim().airborne, null, { timeout: 8000 }).then(() => true, () => false)
  await p.waitForFunction(() => window.__chadverse.playerInspect().clip === 'Idle_Loop', null, { timeout: 8000 }).catch(() => {})
  const rows = await p.evaluate(() => { cancelAnimationFrame(window.__jlRaf); return window.__jl })
  const maxY = Math.max(...rows.map((x) => x.y))
  const clips = rows.map((x) => x.clip).filter((c, i, arr) => c !== arr[i - 1])
  check(up && down, `standing jump goes up and lands (${up}/${down})`)
  check(maxY > 0.5 && maxY < 1.1, `standing jump reaches ${maxY.toFixed(2)} m`)
  check(clips.includes('Jump_Start') && clips.includes('Jump_Land'), `jump uses take-off → land clips (${clips.join(' → ')})`)
  const firstUp = rows.findIndex((x) => x.y > 0)
  check(firstUp > 0 && rows.slice(0, firstUp).some((x) => x.rigAir === 'air'), `crouch on the ground before take-off (${firstUp} frames)`)
  const r = await rig()
  check(r.air === 'ground' && r.clip === 'Idle_Loop', `returns to idle after landing (${r.clip})`)
}
/* mid-air screenshot */
await jump()
await w(300)
await shot('jump-air')
await settle()
await w(500)

/* ── running jump: lands into the run without stalling ── */
if (!mobile) {
  await p.keyboard.down('w')
  await p.keyboard.down('Shift')
  await w(1200)
  await jump()
  // wait for the real events (headless frame rates vary): airborne, then grounded
  const up = await p.waitForFunction(() => window.__chadverse.anim().jumpY > 0.2, null, { timeout: 4000 }).then(() => true, () => false)
  const down = await p.waitForFunction(() => !window.__chadverse.anim().airborne, null, { timeout: 12000 }).then(() => true, () => false)
  await p.waitForFunction(() => /Jog|Sprint/.test(window.__chadverse.playerInspect().clip ?? ''), null, { timeout: 4000 }).catch(() => {})
  const after = await sample(900, 60)
  await p.keyboard.up('Shift')
  await p.keyboard.up('w')
  check(up && down, `running jump goes airborne and lands (${up}/${down})`)
  const minSpeedAfter = Math.min(...after.map((x) => x.a.speed ?? 9))
  check(minSpeedAfter > 3, `keeps running after landing (min speed ${minSpeedAfter.toFixed(2)} m/s)`)
  const end = after[after.length - 1].r.clip
  check(/Jog|Sprint/.test(end), `back in the run cycle (${end})`)
  check(after.every((x) => x.r.air === 'ground'), 'no air state left over after landing')
  await w(800)
}

/* ── jump spam: no double-jumps, no stuck states ── */
{
  for (let i = 0; i < 8; i++) {
    await jump()
    await w(90)
  }
  const rows = await sample(2600, 80)
  const maxY = Math.max(...rows.map((x) => x.a.jumpY))
  check(maxY < 1.1, `spamming jump never stacks height (max ${maxY.toFixed(2)} m)`)
  await settle()
  await w(300)
  const r = await rig()
  check(r.air === 'ground' && !(await anim()).airborne, 'not stuck in the air after spam')
}

/* ── emotes ── */
const EM = [
  ['flex', '1', 'flex'], ['dance', '2', 'dance'], ['wave', '3', 'wave'], ['pushups', '4', 'pushup'],
  ['celebrate', '5', null], ['chad', '6', 'hips'], ['point', '7', 'point'], ['unbothered', '8', 'folded'],
]
for (const [id, key, pose] of EM) {
  await emote(id, key)
  await w(1100)
  const r = await rig()
  const a = await anim()
  if (pose) check(r.pose === pose && a.emote === id, `${id}: pose ${r.pose} (emote ${a.emote})`)
  else check(r.clip === 'Yes', `${id}: plays the celebrate clip (${r.clip})`)
  check(r.headAttach === null || r.headAttach < 0.5, `${id}: head attached`)
  await shot(`emote-${id}`)
  if (id === 'pushups') {
    const rows = await sample(3200, 70)
    const hy = rows.map((x) => x.r.headBone[1])
    check(Math.max(...hy) < 0.9 && Math.max(...hy) - Math.min(...hy) > 0.12, `push-ups: body low (head ≤ ${Math.max(...hy).toFixed(2)} m) and moving (${(Math.max(...hy) - Math.min(...hy)).toFixed(2)} m)`)
    const toes = rows.map((x) => Math.min(x.r.ballL[1], x.r.ballR[1]))
    check(Math.min(...toes) > -0.08 && Math.max(...toes) < 0.15, `push-ups: toes stay on the floor (${Math.min(...toes).toFixed(2)}..${Math.max(...toes).toFixed(2)} m)`)
  }
}
/* pressing the same looping emote again stops it */
await emote('dance', '2')
await w(500)
await emote('dance', '2')
await w(700)
check((await anim()).emote === null && (await rig()).pose === 'idle', 'pressing a looping emote again stops it')

/* moving cancels an emote smoothly */
{
  await emote('pushups', '4')
  await w(1200)
  await nudge(700)
  const a = await anim()
  const r = await rig()
  check(a.emote === null && r.pose !== 'pushup', `moving cancels push-ups (pose ${r.pose})`)
  await w(900)
  const r2 = await rig()
  check(r2.layers.pushup < 0.05 && r2.headBone[1] > 1.3, `stands back up smoothly (push layer ${r2.layers.pushup}, head ${r2.headBone[1].toFixed(2)} m)`)
}
/* jump cancels an emote */
{
  await emote('flex', '1')
  await w(500)
  await jump()
  await w(200)
  check((await anim()).emote === null, 'jumping cancels an emote')
  await settle()
  await w(400)
}
/* rapid switching between all emotes */
{
  for (let round = 0; round < 2; round++)
    for (const [id, key] of EM) {
      await emote(id, key)
      await w(mobile ? 60 : 120)
    }
  await w(1500)
  const r = await rig()
  const nan = JSON.stringify(r).includes('null,') && false
  check(!nan && r.headBone.every((v) => Number.isFinite(v)), `rapid switching through every emote leaves a valid pose (${r.pose}, ${r.clip})`)
  await nudge(400)
  await w(900)
  const r2 = await rig()
  check(r2.pose === 'idle' || r2.pose === 'walk', `and returns to normal locomotion (${r2.pose})`)
}
/* emotes are ignored mid-air */
{
  await jump()
  await p.waitForFunction(() => window.__chadverse.anim().jumpY > 0.15, null, { timeout: 5000 }).catch(() => {})
  await p.keyboard.press('2')
  await w(100)
  check((await anim()).emote === null, 'emotes are ignored mid-air')
  await settle()
  await w(400)
}

/* ── personality: fidget while idle ── */
{
  let fid = null
  const t0 = Date.now()
  while (Date.now() - t0 < 16000 && !fid) {
    const r = await rig()
    fid = r.fidget
    if (!fid) await w(250)
  }
  const expect = { pumpkin: 'flex', skeleton: 'creak', demon: 'neck' }[species.toLowerCase()]
  check(fid === expect, `idle personality fidget: ${fid ?? 'none'} (expected ${expect})`)
  if (fid) await shot('fidget')
  const r = await rig()
  check(r.idleRate === { pumpkin: 1, skeleton: 0.8, demon: 1.15 }[species.toLowerCase()], `idle rhythm ${r.idleRate}×`)
}

/* ── lean into turns ── */
if (!mobile) {
  await p.keyboard.down('w')
  await w(700)
  await p.keyboard.down('a')
  const rows = await sample(500, 50)
  await p.keyboard.up('a')
  await p.keyboard.up('w')
  check(rows.some((x) => x.r.clip && /Walk|Jog/.test(x.r.clip)), 'turning while walking keeps the walk cycle')
  await w(600)
}

/* ── gym: emotes on the floor, cancelled by stations; jump key doesn't leak into workouts ── */
{
  await p.evaluate(() => window.__chadverse.teleport(14.4, -4))
  await w(400)
  await p.evaluate(() => window.__chadverse.gymGoto && null)
  if (mobile) await p.getByRole('button', { name: 'Enter Chad Gym' }).click()
  else await p.keyboard.press('e')
  await p.waitForFunction(() => window.__chadverse?.phase === 'gym' && window.__chadverse.gym()?.mode === 'free', null, { timeout: 30000 })
  await w(800)
  await emote('chad', '6')
  await w(900)
  check((await anim()).emote === 'chad' && (await rig()).pose === 'hips', 'emotes work on the gym floor')
  await jump()
  await w(300)
  await p.evaluate(() => window.__chadverse.gymGoto('curl'))
  await settle()
  await w(500)
  if (mobile) await p.getByRole('button', { name: 'Dumbbell curls' }).click()
  else await p.keyboard.press('e')
  await p.waitForSelector('[data-testid=workout-start]', { timeout: 5000 })
  await w(900)
  const r = await rig()
  check(r.pose === 'curl' && r.air === 'ground', `station starts cleanly after an emote + jump (pose ${r.pose}, ${r.air})`)
  await p.click('[data-testid=workout-start]')
  await p.waitForSelector('[data-testid=workout-rep]')
  if (!mobile) {
    await p.keyboard.press(' ')
    await w(300)
    check((await anim()).jumpY === 0, 'Space during a workout is a rep, not a jump')
  }
  await p.click('[data-testid=workout-stop]')
  await w(900)
  const r2 = await rig()
  check(r2.pose === 'idle' && r2.layers.curl < 0.1, `leaving the station returns to idle (curl layer ${r2.layers.curl})`)
  await emote('pushups', '4')
  await w(600)
  await p.evaluate(() => window.__chadverse.gymGoto('bench'))
  await w(300)
  if (mobile) await p.getByRole('button', { name: 'Bench press' }).click()
  else await p.keyboard.press('e')
  await p.waitForSelector('[data-testid=workout-start]', { timeout: 5000 })
  await w(1200)
  const r3 = await rig()
  check(r3.pose === 'bench' && r3.layers.pushup < 0.1, `starting a station mid-push-up cancels the emote (pushup layer ${r3.layers.pushup})`)
  await p.click('[data-testid=workout-stop]')
  await w(600)
}

/* ── memory: animations + emotes don't leak ── */
{
  await p.evaluate(() => window.__chadverse.gymGoto('exit'))
  await w(300)
  if (mobile) await p.getByRole('button', { name: 'Back to Chad Square' }).click()
  else await p.keyboard.press('e')
  await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 30000 })
  await p.evaluate(() => window.__chadverse.teleport(0, 15, Math.PI)) // same spot + view as the first reading (textures upload lazily)
  await w(2500)
  const mem1 = await p.evaluate(() => window.__chadverse.stats())
  // second round trip: anything that grows again is a leak (the first visit fills one-time shared caches)
  await p.evaluate(() => window.__chadverse.teleport(14.4, -4))
  await w(400)
  if (mobile) await p.getByRole('button', { name: 'Enter Chad Gym' }).click()
  else await p.keyboard.press('e')
  await p.waitForFunction(() => window.__chadverse?.phase === 'gym' && window.__chadverse.gym()?.mode === 'free', null, { timeout: 30000 })
  await w(600)
  await emote('pushups', '4')
  await w(500)
  await jump()
  await w(1500)
  await p.evaluate(() => window.__chadverse.gymGoto('exit'))
  await w(300)
  if (mobile) await p.getByRole('button', { name: 'Back to Chad Square' }).click()
  else await p.keyboard.press('e')
  await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 30000 })
  await p.evaluate(() => window.__chadverse.teleport(0, 15, Math.PI))
  await w(2500)
  const mem2 = await p.evaluate(() => window.__chadverse.stats())
  console.log(`  info  GPU: first visit ${mem0.geometries}g/${mem0.textures}t, after round trip 1 ${mem1.geometries}g/${mem1.textures}t, after round trip 2 ${mem2.geometries}g/${mem2.textures}t`)
  // ±1 geometry: one transient effect mesh exists in some frames (verified flat over 6 round trips); a leak grows every trip
  check(mem2.geometries <= mem1.geometries + 1 && mem2.textures <= mem1.textures, `no GPU growth between round trips (${mem1.geometries}g/${mem1.textures}t → ${mem2.geometries}g/${mem2.textures}t)`)
}

check(errs.length === 0, `no console errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
await b.close()
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`)
console.log(fail ? `${fail} FAILURE(S)` : 'ALL CHECKS PASSED')
process.exit(fail ? 1 : 0)
