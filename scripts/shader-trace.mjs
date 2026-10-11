// Quality gates for Skeleton + Demon Chad (same measurements as Pumpkin's character-test).
import { chromium } from 'playwright'
const base = process.env.URL || 'http://localhost:4318/chadverse/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
let failures = 0
const tally = {}
const check = (gate, ok, msg) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  [${gate}] ${msg}`)
  tally[gate] ??= { pass: 0, fail: 0 }
  tally[gate][ok ? 'pass' : 'fail']++
  if (!ok) failures++
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const range = (arr) => Math.max(...arr) - Math.min(...arr)
const qMotion = (fr, key) => {
  let t = 0
  for (let i = 1; i < fr.length; i++) {
    const a = fr[i - 1][key], c = fr[i][key]
    t += 2 * Math.acos(Math.min(1, Math.abs(a[0] * c[0] + a[1] * c[1] + a[2] * c[2] + a[3] * c[3])))
  }
  return t
}

const SPEC = {
  Skeleton: { skinLabel: 'Bone', skins: ['#d4c9ad', '#2b2a2e', '#e9e2d0'], tops: [['Ranger light', 'cloth:hoodie'], ['Ranger armour', 'cloth:armor']], headwear: [['Crown', 'acc:crown'], ['Cap', 'acc:cap'], ['Horns', 'acc:horns'], ['Hood', 'cloth:hood']], outfitLabel: 'Gear colour' },
  Demon: { skinLabel: 'Skin', skins: ['#5b2a86', '#1f6b5a', '#8e1f18'], tops: [['Sleeved top', 'cloth:hoodie'], ['Battle armour', 'cloth:armor'], ['Bare chest', 'cloth:feet_boots']], headwear: [['Crown', 'acc:crown'], ['Horns only', 'acc:horns']], outfitLabel: 'Shorts colour' },
}

for (const [species, cfg] of Object.entries(SPEC)) {
  console.log(`\n══════ ${species} Chad ══════`)
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } })
  const p = await ctx.newPage()
  await p.addInitScript(() => {
    const del = new WeakMap(), born = new WeakMap()
    for (const C of [WebGL2RenderingContext, WebGLRenderingContext]) {
      const cp = C.prototype.createProgram, dp = C.prototype.deleteProgram, gp = C.prototype.getProgramParameter
      C.prototype.createProgram = function () { const pr = cp.call(this); born.set(pr, new Error()); return pr }
      C.prototype.deleteProgram = function (pr) { if (pr) del.set(pr, new Error()); return dp.call(this, pr) }
      C.prototype.getProgramParameter = function (pr, n) {
        if (n === this.LINK_STATUS && !this.isProgram(pr)) console.error('[trace] use-after-delete. deletedViaCall=' + del.has(pr) + ' DELETED AT: ' + (del.get(pr)?.stack) + ' CREATED AT: ' + (born.get(pr)?.stack) + ' CHECKED AT: ' + new Error().stack)
        return gp.call(this, pr, n)
      }
    }
  })
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message))
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 12000)))
  await p.goto(base, { waitUntil: 'networkidle' })
  await p.evaluate(() => localStorage.clear())
  await p.reload({ waitUntil: 'networkidle' })
  await p.waitForSelector('[data-testid=enter-muted]', { timeout: 20000 })
  await p.click('[data-testid=enter-muted]')
  await p.waitForSelector('[role=tablist]')
  await p.getByRole('radio', { name: species, exact: true }).first().click()
  const sp = species.toLowerCase()
  await p.waitForFunction((s) => window.__chadverse.showroom()?.rig?.species === s, sp, { timeout: 30000 })
  await sleep(2200)
  const ins = () => p.evaluate(() => window.__chadverse.showroom().rig.inspect())
  check('visual', (await p.evaluate(() => window.__chadverse.showroom().rig.kind)) === 'model', `${species} uses the real rigged model (not primitives)`)

  // ── animation ──
  const sample = async (setup, ms = 1800) => {
    await p.evaluate(setup)
    await sleep(700)
    const f = []
    const t0 = Date.now()
    while (Date.now() - t0 < ms) {
      f.push(await ins())
      await sleep(60)
    }
    return f
  }
  const pose = (n) => `(() => { const r = window.__chadverse.showroom(); r.forcePose = null; r.previewPose = '${n}' })()`
  const P = {
    idle: await sample(pose('idle')),
    walk: await sample(pose('walk')),
    dance: await sample(pose('dance')),
    flex: await sample(pose('flex')),
    wave: await sample(pose('wave')),
    press: await sample(`(() => { const r = window.__chadverse.showroom(); r.previewPose = 'idle'; r.forcePose = 'press'; r.rig.pressAmount = 1 })()`, 900),
  }
  await p.evaluate(pose('idle'))
  check('anim', P.walk.at(-1).clip === 'Walk_Loop' && P.dance.at(-1).clip === 'Dance_Loop' && P.idle.at(-1).clip === 'Idle_Loop', 'idle / walk / dance play the library clips')
  check('anim', qMotion(P.walk, 'thighQ') > 1 && qMotion(P.dance, 'upperArmQ') > 1, `skeleton actually moves (walk ${qMotion(P.walk, 'thighQ').toFixed(2)} rad, dance ${qMotion(P.dance, 'upperArmQ').toFixed(2)} rad)`)
  for (const [n, fr] of Object.entries(P)) {
    const att = fr.map((f) => f.headAttach)
    const ch = fr.map((f) => f.chainAttach ?? 0)
    const toe = Math.min(...fr.map((f) => Math.min(f.ballL[1], f.ballR[1])))
    check('anim', range(att) < 0.002 && range(ch) < 0.002 && toe > -0.035 && toe < 0.1 && !JSON.stringify(fr).includes('NaN'), `${n}: head/accessories attached (drift ${range(att).toFixed(4)}), feet grounded (toe ${toe.toFixed(3)}), no NaN`)
  }
  const fx = P.flex.at(-1), wv = P.wave.at(-1), pr = P.press.at(-1)
  check('anim', fx.handL[1] > fx.shoulderL[1] && fx.handR[1] > fx.shoulderR[1], 'flex: fists above shoulders')
  check('anim', Math.max(wv.handL[1], wv.handR[1]) > wv.headBone[1] - 0.1, 'wave: hand raised')
  check('anim', pr.handL[1] > pr.headBone[1] && pr.handR[1] > pr.headBone[1], 'press: both hands overhead')

  // ── customisation through the real UI ──
  const rid = () => p.evaluate(() => window.__chadverse.showroom().rig?.root.uuid)
  const pick = async (role, name, group) => {
    const prev = await rid()
    const loc = group ? p.getByRole('radiogroup', { name: group }).getByRole(role, { name, exact: true }) : p.getByRole(role, { name, exact: true })
    await loc.first().click()
    await p.waitForFunction((pv) => window.__chadverse.showroom().rig?.root.uuid !== pv, prev, { timeout: 8000 }).catch(() => {})
    await sleep(150)
    return ins()
  }
  await p.getByRole('tab', { name: 'Look' }).click()
  for (const c of cfg.skins) {
    const r = await pick('radio', `${cfg.skinLabel} ${c}`)
    check('custom', r.skin === c, `${cfg.skinLabel.toLowerCase()} ${c} applied`)
  }
  for (const c of ['#19f19a', '#ff4d3d']) {
    const r = await pick('radio', `Glow ${c}`)
    check('custom', r.glow === c, `glow ${c} applied to the eyes`)
  }
  await p.getByRole('tab', { name: 'Outfit' }).click()
  for (const [label, part] of cfg.tops) {
    const r = await pick('radio', label, 'Top')
    check('custom', r.parts.includes(part), `${label} → ${part} present (${r.parts.join(', ')})`)
  }
  await p.getByRole('tab', { name: 'Gear' }).click()
  for (const [label, part] of cfg.headwear) {
    const r = await pick('radio', label, 'Headwear')
    check('custom', r.parts.includes(part), `${label} → ${part} present`)
  }
  for (const [label, part] of [['Shades', 'acc:shades'], ['Visor', 'acc:visor']]) {
    const r = await pick('radio', label, 'Eyewear')
    check('custom', r.parts.includes(part), `${label} equipped`)
  }
  {
    const r = await pick('radio', 'Glowing eyes', 'Eyewear')
    check('custom', !r.parts.some((x) => x === 'acc:shades' || x === 'acc:visor'), 'Glowing eyes removes eyewear')
  }
  {
    const prev = await rid()
    await p.getByRole('switch', { name: /Gold chain/ }).click()
    await p.waitForFunction((pv) => window.__chadverse.showroom().rig?.root.uuid !== pv, prev, { timeout: 8000 }).catch(() => {})
    const off = await ins()
    const prev2 = await rid()
    await p.getByRole('switch', { name: /Gold chain/ }).click()
    await p.waitForFunction((pv) => window.__chadverse.showroom().rig?.root.uuid !== pv, prev2, { timeout: 8000 }).catch(() => {})
    const on = await ins()
    check('custom', !off.parts.includes('acc:chain') && on.parts.includes('acc:chain'), 'gold chain toggles')
  }
  const chosen = await ins()
  await p.getByRole('tab', { name: 'Name' }).click()
  await p.fill('#chad-name', `Test ${species}`)
  await p.getByRole('button', { name: /Enter Chad Square/ }).click()
  await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 30000 })
  await sleep(900)
  const w = await p.evaluate(() => window.__chadverse.playerInspect())
  check('custom', w.species === sp && JSON.stringify(w.parts) === JSON.stringify(chosen.parts) && w.glow === chosen.glow, 'world character matches the creator')
  await p.reload({ waitUntil: 'networkidle' })
  await p.waitForSelector('[data-testid=enter-muted]', { timeout: 20000 })
  await p.click('[data-testid=enter-muted]')
  await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 30000 })
  await sleep(900)
  const w2 = await p.evaluate(() => window.__chadverse.playerInspect())
  check('custom', JSON.stringify(w2.parts) === JSON.stringify(chosen.parts) && w2.species === sp, 'saved look restored after reload')

  // ── integration ──
  await p.evaluate(() => window.__chadverse.teleport(0, 21, Math.PI))
  await sleep(300)
  await p.keyboard.down('w')
  await sleep(600)
  const d = await p.evaluate(() => new Promise((res) => {
    const s = []; const t0 = performance.now()
    const tick = () => { s.push({ t: performance.now(), f: window.__chadverse.playerInspect(), w: window.__chadverse.world() }); if (performance.now() - t0 < 1400) requestAnimationFrame(tick); else res(s) }
    tick()
  }))
  await p.keyboard.up('w')
  let dist = 0, time = 0
  for (const side of ['ballL', 'ballR']) {
    const ys = d.map((x) => x.f[side][1]); const mn = Math.min(...ys)
    for (let i = 1; i < d.length; i++) if (ys[i] < mn + 0.015 && ys[i - 1] < mn + 0.015) { dist += Math.hypot(d[i].f[side][0] - d[i - 1].f[side][0], d[i].f[side][2] - d[i - 1].f[side][2]); time += (d[i].t - d[i - 1].t) / 1000 }
  }
  const body = Math.hypot(d.at(-1).w.x - d[0].w.x, d.at(-1).w.z - d[0].w.z) / ((d.at(-1).t - d[0].t) / 1000)
  check('integ', dist / time / body < 0.3, `foot sliding while jogging ${((dist / time / body) * 100).toFixed(0)}% (<30%)`)
  await sleep(1200)
  const st = await p.evaluate(() => window.__chadverse.playerInspect())
  check('integ', st.headBone[1] > 1.4 && st.headBone[1] < 1.85, `scale fits the town (head ${st.headBone[1].toFixed(2)} m)`)
  check('integ', st.tris < 45000 && st.draws <= 16, `mobile budget: ${st.tris} tris, ${st.draws} draw calls`)
  await p.evaluate(() => window.__chadverse.teleport(14.4, -4))
  await sleep(400)
  await p.keyboard.press('e')
  await p.waitForFunction(() => window.__chadverse?.phase === 'gym' && window.__chadverse.gymInspect(), null, { timeout: 15000 })
  await p.waitForSelector('[data-testid=press-start]')
  await p.click('[data-testid=press-start]')
  await sleep(2500)
  await p.click('[data-testid=press-button]')
  await sleep(380)
  const g = await p.evaluate(() => window.__chadverse.gymInspect())
  check('integ', g.species === sp && g.handL[1] > g.headBone[1] - 0.05, 'gym: presses the bar overhead')
  check('integ', errs.length === 0, `no console errors${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`)
  await ctx.close()
}
await b.close()
console.log('\nSUMMARY', JSON.stringify(tally))
console.log(failures ? `${failures} FAILURE(S)` : 'ALL CHECKS PASSED')
process.exit(failures ? 1 : 0)
