// Environment QA: interactions, collectibles, NPC activity, movement + camera stress.
import { chromium } from 'playwright'
const base = process.env.URL || 'http://localhost:4318/chadverse/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
let failures = 0
const check = (ok, msg) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!ok) failures++
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

for (const [w, h, tag, mobile, quality] of [
  [1440, 900, 'desktop/high', false, 'high'],
  [393, 852, 'iphone/medium', true, 'medium'],
  [393, 852, 'iphone/low', true, 'low'],
]) {
  console.log(`\n=== ${tag} ===`)
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message))
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
  await p.goto(base, { waitUntil: 'networkidle' })
  await p.evaluate((q) => {
    localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({
      version: 1,
      character: { name: 'Tester', appearance: { species: 'demon', skin: '#b3261e', outfit: '#141216', glow: '#ff4d3d', top: 'hoodie', headwear: 'horns', eyewear: 'none', chain: true } },
      progress: { xp: 0, achievements: ['welcome'], gymBest: 0, gymRuns: 0, discoveries: [] },
      settings: { quality: q, sfx: 0.7, ambience: 0.4, muted: true, reducedEffects: false, cameraSensitivity: 1, stickSensitivity: 1, uiScale: 1 },
    }))
  }, quality)
  await p.reload({ waitUntil: 'networkidle' })
  await p.waitForSelector('[data-testid=enter-muted]', { timeout: 20000 })
  await p.click('[data-testid=enter-muted]')
  await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 30000 })
  await sleep(800)
  const cv = (fn, arg) => p.evaluate(fn, arg)

  // every interaction point shows its prompt when you stand there
  const spots = {
    statue: [0, 6.7], gate: [0, -28.2], gym: [14.4, -4], board: [8.55, -7.14], well: [-29.4, 2.5], window: [16.6, -19.5],
    arcade: [45.3, 19], rune: [-24.5, -26.4], pumpkin: [-9.6, 11.6], barkeep: [-5.2, 21.2], smith: [-15.2, -10.6], potion: [-21, 0.6], captain: [3.6, -22.2], coach: [12.4, 1.6], hodl: [-5.6, 7.8],
  }
  const missing = []
  for (const [id, [x, z]] of Object.entries(spots)) {
    await cv(([x, z]) => window.__chadverse.teleport(x, z), [x, z])
    await p.waitForFunction((id) => window.__chadverse.world().prompt === id, id, { timeout: 1500 }).catch(() => {})
    const pr = await cv(() => window.__chadverse.world().prompt)
    if (pr !== id) missing.push(`${id}→${pr}`)
  }
  check(missing.length === 0, `all 15 interaction prompts reachable${missing.length ? ' (problems: ' + missing.join(', ') + ')' : ''}`)

  // talk to a new resident through the real UI
  await cv(() => window.__chadverse.teleport(-5.2, 21.2))
  await sleep(250)
  if (mobile) await p.getByRole('button', { name: /Talk to Barley/ }).click()
  else await p.keyboard.press('e')
  await p.waitForSelector('[data-testid=dialogue]', { timeout: 3000 })
  check((await p.textContent('[data-testid=dialogue]')).includes('Barley'), 'Barley the barkeep has a conversation')
  for (let i = 0; i < 10 && (await p.locator('[data-testid=dialogue]').count()); i++) {
    await p.click('[data-testid=dialogue]', { force: true, timeout: 1500 }).catch(() => {})
    await sleep(200)
  }

  await sleep(700) // let the dialogue-close interaction cooldown expire, like a real player walking over
  // collect all 5 golden seeds
  const seeds = [[-20.4, 24.8], [26.6, -21.6], [-30.4, -2.3], [-14.5, -18.3], [44.6, 30.4]]
  let collected = 0
  for (const [x, z] of seeds) {
    await cv(([x, z]) => window.__chadverse.teleport(x, z), [x, z])
    await p.waitForFunction(() => window.__chadverse.world().prompt?.startsWith('seed_'), null, { timeout: 1500 }).catch(() => {})
    const pr = await cv(() => window.__chadverse.world().prompt)
    if (!pr?.startsWith('seed_')) {
      console.log(`  info  no seed prompt at ${x},${z} (got ${pr})`)
      continue
    }
    if (mobile) await p.getByRole('button', { name: /golden seed/ }).click()
    else await p.keyboard.press('e')
    await sleep(350)
    collected++
  }
  const sv = await cv(() => window.__chadverse.save())
  const seedCount = sv.progress.discoveries.filter((d) => d.startsWith('seed_')).length
  check(collected === 5 && seedCount === 5, `all 5 golden seeds reachable and collected (${seedCount}/5)`)
  check(sv.progress.achievements.includes('seed_collector'), 'Seed Collector achievement awarded')
  check(sv.progress.discoveries.includes('talk_barkeep'), 'talking is recorded (talk_barkeep)')
  // seeds can't be farmed: after reload they stay collected and give no prompt
  await p.reload({ waitUntil: 'networkidle' })
  await p.waitForSelector('[data-testid=enter-muted]', { timeout: 20000 })
  await p.click('[data-testid=enter-muted]')
  await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 30000 })
  await cv(() => window.__chadverse.teleport(-20.4, 24.8))
  await sleep(300)
  const pr2 = await cv(() => window.__chadverse.world().prompt)
  const xp2 = (await cv(() => window.__chadverse.save())).progress.xp
  check(!pr2?.startsWith('seed_') && xp2 === sv.progress.xp, 'collected seed stays gone after reload (no re-claiming)')

  // NPCs are actually moving
  const w0 = (await cv(() => window.__chadverse.integrity())).walkers
  await sleep(4000)
  const w1 = (await cv(() => window.__chadverse.integrity())).walkers
  const movedCount = w0.filter((a, i) => Math.hypot(a[0] - w1[i][0], a[1] - w1[i][1]) > 0.5).length
  check(w0.length >= 2 && movedCount >= 1, `patrolling/wandering NPCs move (${movedCount}/${w0.length} moved in 4 s)`)

  // movement + camera stress: run in random directions, sample integrity
  await cv(() => window.__chadverse.teleport(0, 15))
  let bad = 0
  let camBad = 0
  let samples = 0
  const keys = ['w', 'a', 's', 'd']
  const t0 = Date.now()
  const dur = mobile ? 25000 : 40000
  let lastPos = null
  let stuckSamples = 0
  while (Date.now() - t0 < dur) {
    const k1 = keys[Math.floor(Math.random() * 4)]
    const k2 = Math.random() > 0.5 ? keys[Math.floor(Math.random() * 4)] : null
    await p.keyboard.down('Shift')
    await p.keyboard.down(k1)
    if (k2) await p.keyboard.down(k2)
    // also swing the camera sometimes
    if (Math.random() > 0.6) {
      await p.mouse.move(w / 2, h / 2)
      await p.mouse.down()
      await p.mouse.move(w / 2 + (Math.random() - 0.5) * 400, h / 2 + (Math.random() - 0.5) * 120, { steps: 4 })
      await p.mouse.up()
    }
    for (let i = 0; i < 6; i++) {
      await sleep(120)
      const it = await cv(() => window.__chadverse.integrity())
      samples++
      if (it.playerInside || !it.finite) bad++
      if (it.cameraInside) {
        camBad++
        if (camBad <= 3) console.log('  info  camera inside at', JSON.stringify(await cv(() => window.__chadverse.world())))
      }
    }
    await p.keyboard.up(k1)
    if (k2) await p.keyboard.up(k2)
    await p.keyboard.up('Shift')
    const pos = await cv(() => window.__chadverse.world())
    if (lastPos && Math.hypot(pos.x - lastPos.x, pos.z - lastPos.z) < 0.01) stuckSamples++
    lastPos = pos
  }
  check(bad === 0, `player never inside a building or NaN across ${samples} samples while sprinting randomly`)
  check(camBad / samples < 0.02, `camera inside geometry in ${camBad}/${samples} samples (<2%)`)
  const dbg = await cv(() => window.__chadverse.world())
  console.log(`  info  render: ${dbg.calls} draw calls, ${dbg.triangles} triangles, ${dbg.npcs} NPCs`)
  check(errs.length === 0, `no console errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
  await ctx.close()
}
await b.close()
console.log(`\n${failures ? failures + ' FAILURE(S)' : 'ALL CHECKS PASSED'}`)
process.exit(failures ? 1 : 0)
