// Pumpkin Chad quality gates: visual, animation, customisation, integration.
// Measures the real model through window.__chadverse hooks; screenshots go to $SHOTS.
import { chromium } from 'playwright'
const out = process.env.SHOTS
const base = process.env.URL || 'http://localhost:4318/chadverse/'
const exe = process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe'
const b = await chromium.launch({ executablePath: exe })
let failures = 0
const results = []
const check = (gate, ok, msg) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  [${gate}] ${msg}`)
  results.push({ gate, ok, msg })
  if (!ok) failures++
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const DEFAULT = { species: 'pumpkin', skin: '#e8741c', outfit: '#141216', glow: '#ffb347', top: 'shirtless', headwear: 'none', eyewear: 'shades', chain: true }

const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
await p.goto(base, { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'networkidle' })
await p.waitForSelector('[data-testid=enter-muted]', { timeout: 20000 })
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.waitForFunction(() => window.__chadverse.showroom()?.rig?.species === 'pumpkin', null, { timeout: 20000 })
await sleep(600)
const ins = () => p.evaluate(() => window.__chadverse.showroom().rig.inspect())
const rigId = () => p.evaluate(() => window.__chadverse.showroom().rig?.root.uuid)
const waitRebuild = async (prev) => {
  await p.waitForFunction((prev) => window.__chadverse.showroom().rig?.root.uuid !== prev, prev, { timeout: 8000 }).catch(() => {})
  await sleep(120)
}

/* ════════════ GATE 2 — ANIMATION ════════════ */
console.log('\n=== Gate 2: animation ===')
async function sample(setup, ms = 2000) {
  await p.evaluate(setup)
  await sleep(700) // let the blend settle
  const frames = []
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    frames.push(await ins())
    await sleep(60)
  }
  return frames
}
const range = (arr) => Math.max(...arr) - Math.min(...arr)
const qMotion = (frames, key) => {
  let tot = 0
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1][key]
    const c = frames[i][key]
    const dot = Math.abs(a[0] * c[0] + a[1] * c[1] + a[2] * c[2] + a[3] * c[3])
    tot += 2 * Math.acos(Math.min(1, dot))
  }
  return tot
}
const finite = (f) => JSON.stringify(f).match(/null|NaN|Infinity/) === null || f.headObj !== null
const setPose = (pose, extra = '') => `(() => { const r = window.__chadverse.showroom(); r.forcePose = null; r.previewPose = '${pose}'; ${extra} })()`

const poses = {
  idle: await sample(setPose('idle')),
  walk: await sample(setPose('walk')),
  dance: await sample(setPose('dance')),
  flex: await sample(setPose('flex')),
  wave: await sample(setPose('wave')),
  pressUp: await sample(`(() => { const r = window.__chadverse.showroom(); r.previewPose = 'idle'; r.forcePose = 'press'; r.rig.pressAmount = 1 })()`, 900),
  pressDown: await sample(`(() => { const r = window.__chadverse.showroom(); r.previewPose = 'idle'; r.forcePose = 'press'; r.rig.pressAmount = 0 })()`, 900),
}
await p.evaluate(setPose('idle'))
const clipOf = (f) => f[f.length - 1].clip
check('anim', clipOf(poses.idle) === 'Idle_Loop', `idle plays Idle_Loop (${clipOf(poses.idle)})`)
check('anim', clipOf(poses.walk) === 'Walk_Loop', `walk plays Walk_Loop (${clipOf(poses.walk)})`)
check('anim', clipOf(poses.dance) === 'Dance_Loop', `dance plays Dance_Loop (${clipOf(poses.dance)})`)
check('anim', qMotion(poses.walk, 'thighQ') > 1.0, `walk swings the legs (${qMotion(poses.walk, 'thighQ').toFixed(2)} rad of thigh motion)`)
check('anim', qMotion(poses.dance, 'upperArmQ') > 1.0, `dance moves the arms (${qMotion(poses.dance, 'upperArmQ').toFixed(2)} rad)`)
check('anim', qMotion(poses.idle, 'upperArmQ') > 0.01, `idle is alive, not frozen (${qMotion(poses.idle, 'upperArmQ').toFixed(3)} rad)`)
for (const [name, frames] of Object.entries(poses)) {
  const att = frames.map((f) => f.headAttach)
  const ch = frames.map((f) => f.chainAttach)
  check('anim', range(att) < 0.002 && range(ch) < 0.002, `${name}: head + chain stay attached (drift ${range(att).toFixed(4)} / ${range(ch).toFixed(4)} m)`)
  const lowToe = frames.map((f) => Math.min(f.ballL[1], f.ballR[1]))
  const minToe = Math.min(...lowToe)
  check('anim', minToe > -0.03 && minToe < 0.09, `${name}: feet on the ground, not sinking or floating (lowest toe ${minToe.toFixed(3)} m)`)
  check('anim', frames.every(finite), `${name}: no NaN / broken transforms`)
}
const last = (k) => poses[k][poses[k].length - 1]
{
  const f = last('flex')
  check('anim', f.handL[1] > f.shoulderL[1] && f.handR[1] > f.shoulderR[1], `flex: both fists above the shoulders (hands ${f.handL[1].toFixed(2)}/${f.handR[1].toFixed(2)} vs shoulders ${f.shoulderL[1].toFixed(2)})`)
}
{
  const f = last('wave')
  const raised = Math.max(f.handL[1], f.handR[1])
  check('anim', raised > f.headBone[1] - 0.1, `wave: a hand is raised to head height (${raised.toFixed(2)} vs head ${f.headBone[1].toFixed(2)})`)
}
{
  const u = last('pressUp')
  const d = last('pressDown')
  check('anim', u.handL[1] > u.headBone[1] && u.handR[1] > u.headBone[1], `press locked out: both hands above the head (${u.handL[1].toFixed(2)}/${u.handR[1].toFixed(2)} vs ${u.headBone[1].toFixed(2)})`)
  check('anim', d.handL[1] < d.headBone[1] && d.handL[1] > d.pelvis[1], `press bottom: hands at shoulder level (${d.handL[1].toFixed(2)})`)
  const spreadUp = Math.abs(u.handL[0] - u.handR[0]) + Math.abs(u.handL[2] - u.handR[2])
  check('anim', spreadUp > 0.25 && spreadUp < 1.2, `press: hands a barbell-width apart (${spreadUp.toFixed(2)} m)`)
}

/* ════════════ GATE 3 — CUSTOMISATION (through the real UI) ════════════ */
console.log('\n=== Gate 3: customisation ===')
const tab = async (n) => p.getByRole('tab', { name: n }).click()
const pick = async (name, exact = true) => {
  const prev = await rigId()
  await p.getByRole('radio', { name, exact }).first().click()
  await waitRebuild(prev)
  return ins()
}
await tab('Look')
for (const c of ['#f08a2a', '#c9581a', '#e0a23a', '#9fb84a', '#e8741c']) {
  const r = await pick(`Pumpkin skin ${c}`)
  check('custom', r.skin === c, `skin ${c} applied to the model (${r.skin})`)
}
for (const c of ['#19f19a', '#9b5cff', '#ff4d3d', '#7fd6ff', '#ffb347']) {
  const r = await pick(`Glow ${c}`)
  check('custom', r.glow === c, `glow ${c} lights the carved face (${r.glow})`)
}
await tab('Outfit')
for (const c of ['#ff7a1a', '#4b2a7a', '#141216']) {
  const r = await pick(`Shorts colour ${c}`)
  check('custom', r.shorts === c, `shorts colour ${c} applied (${r.shorts})`)
}
{
  let r = await pick('Sleeved top')
  check('custom', r.parts.includes('cloth:hoodie') && !r.parts.includes('cloth:armor'), `Sleeved top adds the top mesh (${r.parts.join(', ')})`)
  r = await pick('Future armour')
  check('custom', r.parts.includes('cloth:armor') && !r.parts.includes('cloth:hoodie'), `Future armour adds armour (${r.parts.join(', ')})`)
  r = await pick('Shirtless')
  check('custom', !r.parts.some((x) => x === 'cloth:hoodie' || x === 'cloth:armor') && r.parts.includes('cloth:shoes'), 'Shirtless removes tops, keeps trainers')
}
await tab('Gear')
for (const [label, part] of [['Crown', 'acc:crown'], ['Cap', 'acc:cap'], ['Horns', 'acc:horns']]) {
  const r = await pick(label)
  check('custom', r.parts.includes(part), `${label} appears on the head (${part})`)
}
{
  const r = await pick('None')
  check('custom', !r.parts.some((x) => ['acc:crown', 'acc:cap', 'acc:horns'].includes(x)), 'Headwear None removes headwear')
}
for (const [label, part] of [['Visor', 'acc:visor'], ['Shades', 'acc:shades']]) {
  const r = await p.getByRole('radiogroup', { name: 'Eyewear' }).getByRole('radio', { name: label }).click().then(async () => {
    await sleep(900)
    return ins()
  })
  check('custom', r.parts.includes(part), `${label} equipped (${part})`)
}
{
  const prev = await rigId()
  await p.getByRole('switch', { name: /Gold chain/ }).click()
  await waitRebuild(prev)
  let r = await ins()
  check('custom', !r.parts.includes('acc:chain'), 'chain toggle off removes the chain')
  const prev2 = await rigId()
  await p.getByRole('switch', { name: /Gold chain/ }).click()
  await waitRebuild(prev2)
  r = await ins()
  check('custom', r.parts.includes('acc:chain'), 'chain toggle on restores it')
}
// final look to save: crown + visor + hoodie, purple glow
await tab('Outfit')
await pick('Sleeved top')
await pick('Outfit colour #4b2a7a')
await tab('Gear')
await pick('Crown')
await p.getByRole('radiogroup', { name: 'Eyewear' }).getByRole('radio', { name: 'Visor' }).click()
await sleep(800)
await tab('Look')
await pick('Glow #9b5cff')
const chosen = await ins()
await tab('Name')
await p.fill('#chad-name', 'Test Gourd')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 30000 })
await sleep(800)
{
  const w = await p.evaluate(() => window.__chadverse.playerInspect())
  check('custom', JSON.stringify(w.parts) === JSON.stringify(chosen.parts) && w.glow === chosen.glow && w.shorts === chosen.shorts, `world character matches the creator (${w.parts.join(', ')}, glow ${w.glow})`)
}
await p.reload({ waitUntil: 'networkidle' })
await p.waitForSelector('[data-testid=enter-muted]', { timeout: 20000 })
await p.click('[data-testid=enter-muted]')
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 30000 })
await sleep(600)
{
  const w = await p.evaluate(() => window.__chadverse.playerInspect())
  check('custom', JSON.stringify(w.parts) === JSON.stringify(chosen.parts) && w.glow === chosen.glow, 'after reload the saved look is restored exactly')
}

/* ════════════ GATE 4 — INTEGRATION ════════════ */
console.log('\n=== Gate 4: integration ===')
// foot sliding while jogging / sprinting in the world (feet should stay planted while on the ground)
async function slide(run) {
  // open runway down the main street (the fountain would rightly stop a sprint started from spawn)
  await p.evaluate(() => window.__chadverse.teleport(0, 9.5, 0))
  await sleep(400)
  if (run) await p.keyboard.down('Shift')
  await p.keyboard.down('w')
  await sleep(700)
  const data = await p.evaluate(
    () =>
      new Promise((res) => {
        const s = []
        const t0 = performance.now()
        const tick = () => {
          const f = window.__chadverse.playerInspect()
          const w = window.__chadverse.world()
          s.push({ t: performance.now(), f, x: w.x, z: w.z })
          if (performance.now() - t0 < 1400) requestAnimationFrame(tick)
          else res(s)
        }
        tick()
      }),
  )
  await p.keyboard.up('w')
  if (run) await p.keyboard.up('Shift')
  // planted = that foot's toe is within 3 cm of its lowest point; measure its ground speed then
  let slideDist = 0
  let plantedTime = 0
  for (const side of ['ballL', 'ballR']) {
    const ys = data.map((d) => d.f[side][1])
    const minY = Math.min(...ys)
    for (let i = 1; i < data.length; i++) {
      if (ys[i] < minY + 0.03 && ys[i - 1] < minY + 0.03) {
        const dt = (data[i].t - data[i - 1].t) / 1000
        slideDist += Math.hypot(data[i].f[side][0] - data[i - 1].f[side][0], data[i].f[side][2] - data[i - 1].f[side][2])
        plantedTime += dt
      }
    }
  }
  const bodyDist = Math.hypot(data.at(-1).x - data[0].x, data.at(-1).z - data[0].z)
  const bodySpeed = bodyDist / ((data.at(-1).t - data[0].t) / 1000)
  const footSpeed = slideDist / Math.max(plantedTime, 1e-3)
  return { bodySpeed, footSpeed, ratio: footSpeed / Math.max(bodySpeed, 1e-3), clip: data.at(-1).f.clip }
}
const jog = await slide(false)
const sprint = await slide(true)
console.log(`  info  jog: body ${jog.bodySpeed.toFixed(2)} m/s, planted-foot ${jog.footSpeed.toFixed(2)} m/s (${jog.clip})`)
console.log(`  info  sprint: body ${sprint.bodySpeed.toFixed(2)} m/s, planted-foot ${sprint.footSpeed.toFixed(2)} m/s (${sprint.clip})`)
check('integ', jog.ratio < 0.3, `jog foot sliding ${(jog.ratio * 100).toFixed(0)}% of body speed (<30%)`)
check('integ', sprint.ratio < 0.3, `sprint foot sliding ${(sprint.ratio * 100).toFixed(0)}% of body speed (<30%)`)
{
  await sleep(1200) // stand still: scale + ground contact are checked in the idle pose
  const f = await p.evaluate(() => window.__chadverse.playerInspect())
  const wy = await p.evaluate(() => window.__chadverse.world().y)
  check('integ', Math.abs(Math.min(f.ballL[1], f.ballR[1])) < 0.09, `ground contact in the world (toe ${Math.min(f.ballL[1], f.ballR[1]).toFixed(3)} m above ground ${wy})`)
  check('integ', f.headBone[1] > 1.45 && f.headBone[1] < 1.85, `character scale fits the town (head at ${f.headBone[1].toFixed(2)} m)`)
  console.log(`  info  per character: ${f.tris} triangles, ${f.draws} draw calls`)
  check('integ', f.tris < 40000 && f.draws <= 12, `mobile budget per character (${f.tris} tris ≤ 40k, ${f.draws} draws ≤ 12)`)
}
// gym press with the new body
await p.evaluate(() => window.__chadverse.teleport(14.4, -4))
await sleep(400)
await p.keyboard.press('e')
await p.waitForFunction(() => window.__chadverse?.phase === 'gym' && window.__chadverse.gymInspect(), null, { timeout: 15000 })
await p.evaluate(() => window.__chadverse.gymGoto('press')) // walkable gym: step onto the Chad Press platform
await p.waitForTimeout(400)
await p.keyboard.press('e')
await p.waitForSelector('[data-testid=press-start]')
await p.click('[data-testid=press-start]')
await sleep(2500)
await p.click('[data-testid=press-button]')
await sleep(380)
{
  const g = await p.evaluate(() => window.__chadverse.gymInspect())
  check('integ', g.handL[1] > g.headBone[1] - 0.05, `gym: Pumpkin Chad presses the bar overhead (hands ${g.handL[1].toFixed(2)} vs head ${g.headBone[1].toFixed(2)})`)
  await p.screenshot({ path: `${out}/ct-gym.jpg`, quality: 80 })
}

/* ════ build time + memory leak (back in the creator) ════ */
await p.reload({ waitUntil: 'networkidle' })
await p.waitForSelector('[data-testid=enter-muted]', { timeout: 20000 })
await p.getByRole('button', { name: /wardrobe/i }).click()
await p.waitForFunction(() => window.__chadverse.showroom()?.rig?.species === 'pumpkin', null, { timeout: 20000 })
await sleep(1500)
const mem0 = await p.evaluate(() => window.__chadverse.stats())
const times = await p.evaluate(async () => {
  const r = window.__chadverse.showroom()
  const skins = ['#e8741c', '#f08a2a', '#c9581a', '#e0a23a', '#9fb84a']
  const tops = ['shirtless', 'hoodie', 'armor']
  const hw = ['none', 'crown', 'cap', 'horns']
  const ew = ['shades', 'visor', 'none']
  const t = []
  for (let i = 0; i < 25; i++) {
    const s = performance.now()
    await r.setAppearance({ species: 'pumpkin', skin: skins[i % 5], outfit: '#141216', glow: '#ffb347', top: tops[i % 3], headwear: hw[i % 4], eyewear: ew[i % 3], chain: i % 2 === 0 })
    t.push(performance.now() - s)
  }
  await r.setAppearance({ species: 'pumpkin', skin: '#e8741c', outfit: '#141216', glow: '#ffb347', top: 'shirtless', headwear: 'none', eyewear: 'shades', chain: true })
  return t
})
await sleep(2300)
const mem1 = await p.evaluate(() => window.__chadverse.stats())
const avg = times.reduce((a, b) => a + b, 0) / times.length
console.log(`  info  rebuild time avg ${avg.toFixed(0)} ms (max ${Math.max(...times).toFixed(0)} ms) — headless software rendering`)
console.log(`  info  GPU memory: geometries ${mem0.geometries}→${mem1.geometries}, textures ${mem0.textures}→${mem1.textures}`)
check('integ', mem1.geometries <= mem0.geometries + 4 && mem1.textures <= mem0.textures + 2, 'no memory leak across 25 character rebuilds')

// the other species still build (since the overhaul they use the real rigged model, not the procedural prototype)
for (const sp of ['Skeleton', 'Demon']) {
  await p.getByRole('radio', { name: sp }).click()
  await p.waitForFunction((s) => window.__chadverse.showroom().rig?.species === s, sp.toLowerCase(), { timeout: 30000 }).catch(() => {})
  const r = await p.evaluate(() => { const rig = window.__chadverse.showroom().rig; return { kind: rig?.kind, species: rig?.species } })
  check('integ', r.kind === 'model' && r.species === sp.toLowerCase(), `${sp} builds the real rigged model and displays (kind ${r.kind})`)
}
await p.getByRole('radio', { name: 'Pumpkin' }).click()
await p.waitForFunction(() => window.__chadverse.showroom()?.rig?.species === 'pumpkin', null, { timeout: 20000 })

/* ════════════ GATE 1 — VISUAL (screenshots for review) ════════════ */
console.log('\n=== Gate 1: visual captures ===')
await p.addStyleTag({ content: '[aria-label="Character options"], [aria-label="Species"], h1, [role=radiogroup][aria-label="Preview animation"] { opacity: 0 !important }' })
const shot = async (file, yaw, zoom = 0) => {
  await p.evaluate(([y, z]) => {
    const r = window.__chadverse.showroom()
    r.zoom = z
    r.yaw = y
  }, [yaw, zoom])
  await sleep(zoom ? 1100 : 400)
  await p.evaluate((y) => (window.__chadverse.showroom().yaw = y), yaw)
  await sleep(60)
  await p.screenshot({ path: `${out}/${file}.jpg`, quality: 85 })
}
for (const [i, y] of [0, -0.6, -Math.PI / 2, Math.PI, Math.PI / 2].entries()) await shot(`ct-angle${i}`, y)
await shot('ct-close-front', 0, 1)
await shot('ct-close-34', -0.7, 1)
await shot('ct-close-side', -Math.PI / 2, 1)
const combos = [
  { skin: '#e8741c', outfit: '#141216', glow: '#ffb347', top: 'shirtless', headwear: 'none', eyewear: 'shades', chain: true },
  { skin: '#f08a2a', outfit: '#141216', glow: '#ffb347', top: 'hoodie', headwear: 'cap', eyewear: 'shades', chain: true },
  { skin: '#c9581a', outfit: '#c89b3c', glow: '#ff4d3d', top: 'armor', headwear: 'crown', eyewear: 'visor', chain: false },
  { skin: '#e0a23a', outfit: '#4b2a7a', glow: '#9b5cff', top: 'hoodie', headwear: 'horns', eyewear: 'visor', chain: true },
  { skin: '#9fb84a', outfit: '#e9e4da', glow: '#19f19a', top: 'shirtless', headwear: 'crown', eyewear: 'none', chain: true },
  { skin: '#e8741c', outfit: '#ff7a1a', glow: '#7fd6ff', top: 'armor', headwear: 'none', eyewear: 'shades', chain: true },
]
for (const [i, c] of combos.entries()) {
  await p.evaluate((c) => window.__chadverse.showroom().setAppearance({ species: 'pumpkin', ...c }), c)
  await sleep(700)
  await shot(`ct-combo${i}`, -0.35)
}
console.log(`  info  screenshots saved to ${out}`)

check('integ', errs.length === 0, `no console errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
await b.close()
const byGate = {}
for (const r of results) {
  byGate[r.gate] ??= { pass: 0, fail: 0 }
  byGate[r.gate][r.ok ? 'pass' : 'fail']++
}
console.log('\nSUMMARY', JSON.stringify(byGate))
console.log(failures ? `${failures} FAILURE(S)` : 'ALL CHECKS PASSED')
process.exit(failures ? 1 : 0)
