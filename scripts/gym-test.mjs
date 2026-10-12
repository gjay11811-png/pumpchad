// Interactive gym: free roam, every station (pose, real movement, reps, timing, rewards, stop), Chad Press, exit, cleanup.
//   node scripts/gym-test.mjs [Species]      (dev server on :4318)
import { chromium } from 'playwright'
const species = process.argv[2] || 'Pumpkin'
const URL = process.env.URL || 'http://localhost:4318/chadverse/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1280, height: 800 } })
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
const ins = () => p.evaluate(() => window.__chadverse.gymInspect())
const gym = () => p.evaluate(() => window.__chadverse.gym())
const save = () => p.evaluate(() => window.__chadverse.save())
const stats = () => p.evaluate(() => window.__chadverse.stats())
const phase = () => p.evaluate(() => window.__chadverse.phase)
const promptText = () => p.locator('[data-testid=prompt]').textContent({ timeout: 2000 }).catch(() => '')
const enterGym = async () => {
  await p.evaluate(() => window.__chadverse.teleport(14.4, -4))
  await w(400)
  await p.keyboard.press('e')
  await p.waitForFunction(() => window.__chadverse?.phase === 'gym' && window.__chadverse.gymInspect() && window.__chadverse.gym()?.mode === 'free', null, { timeout: 20000 })
  await w(800)
}
/** tap the rep button when the tempo ring is (nearly) closed — i.e. on the beat */
const tapOnBeat = async () => {
  await p.waitForSelector('[data-testid=workout-rep]', { timeout: 5000 })
  return tapOnBeatNow()
}
const tapOnBeatNow = () =>
  p.evaluate(
    () =>
      new Promise((res) => {
        const btn = document.querySelector('[data-testid=workout-rep]')
        const ring = btn?.closest('.panel')?.querySelector('[class*="ring-bone"]')
        const t0 = performance.now()
        let armed = false // wait for the ring to open again, then tap as it closes (one tap per beat)
        const tick = () => {
          const m = /scale\(([\d.]+)\)/.exec(ring?.style.transform ?? '')
          const ph = m ? 1 - (parseFloat(m[1]) - 1) / 1.25 : 1
          if (ph < 0.6) armed = true
          if ((armed && ph > 0.95) || performance.now() - t0 > 4000) {
            btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
            res(ph)
          } else requestAnimationFrame(tick)
        }
        tick()
      }),
  )

console.log(`\n══════ Chad Gym (${species}) ══════`)
await p.goto(URL, { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'networkidle' })
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('radio', { name: species, exact: true }).first().click()
await p.waitForFunction((s) => window.__chadverse.showroom()?.rig?.species === s, species.toLowerCase(), { timeout: 30000 })
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Gym Test')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 30000 })
await enterGym()
const mem0 = await stats()

/* ── free roam ── */
{
  const a = await ins()
  await p.keyboard.down('w')
  await w(1000)
  await p.keyboard.up('w')
  await w(300)
  const c = await ins()
  check(Math.hypot(c.pelvis[0] - a.pelvis[0], c.pelvis[2] - a.pelvis[2]) > 1.2, `walks around the gym floor (moved ${Math.hypot(c.pelvis[0] - a.pelvis[0], c.pelvis[2] - a.pelvis[2]).toFixed(2)} m)`)
  await p.keyboard.down('w')
  await w(5000)
  await p.keyboard.up('w')
  const d = await ins()
  check(d.pelvis[2] > -5.6, `walls stop the player (z ${d.pelvis[2].toFixed(2)})`)
}

/* ── stations ── */
const STA = { bench: { reps: 10, label: 'Bench press' }, curl: { reps: 12, label: 'Dumbbell curls' }, squat: { reps: 10, label: 'Squat rack' }, bag: { reps: 15, label: 'Heavy bag' } }
for (const [id, cfg] of Object.entries(STA)) {
  console.log(`  -- ${id}`)
  await p.evaluate((id) => window.__chadverse.gymGoto(id), id)
  await w(500)
  check((await promptText()).includes(cfg.label), `prompt "${cfg.label}" appears at the ${id}`)
  await p.keyboard.press('e')
  await p.waitForSelector('[data-testid=workout-start]', { timeout: 5000 })
  check((await gym()).mode === id, `E starts the ${id} station`)
  await w(900)
  const rest = await ins()
  if (id === 'bench') check(rest.headBone[1] < 0.95 && rest.pelvis[1] > 0.4, `lies on the bench (head ${rest.headBone[1].toFixed(2)} m, hips ${rest.pelvis[1].toFixed(2)} m)`)
  else check(rest.headBone[1] > 1.3, `stands at the ${id} (head ${rest.headBone[1].toFixed(2)} m)`)
  const before = (await save()).progress
  await p.click('[data-testid=workout-start]')
  await w(300)
  // sample the movement through one rep
  let lo = Infinity
  let hi = -Infinity
  let punchClip = ''
  await tapOnBeat()
  for (let k = 0; k < 12; k++) {
    const s = await ins()
    const y = id === 'squat' ? s.pelvis[1] : (s.handL[1] + s.handR[1]) / 2
    lo = Math.min(lo, y)
    hi = Math.max(hi, y)
    if (/Punch|Melee/.test(s.clip ?? '')) punchClip = s.clip
    await w(60)
  }
  if (id === 'bag') check(!!punchClip, `throws a real punch clip (${punchClip || 'none'})`)
  else check(hi - lo > 0.22, `${id}: visible ${id === 'squat' ? 'hip' : 'hand'} travel through the rep (${(hi - lo).toFixed(2)} m)`)
  const s1 = await ins()
  check(s1.headAttach !== null ? s1.headAttach < 0.5 : true, `head stays attached during the ${id}`)
  // finish the set on the beat
  for (let r = 1; r < cfg.reps; r++) await tapOnBeat()
  await p.waitForSelector('[data-testid=workout-done]', { timeout: 6000 }).catch(() => {})
  const doneTxt = await p.locator('[data-testid=workout-done]').textContent().catch(() => '')
  check(/\+\d+/.test(doneTxt), `set completes with strength reward (${doneTxt?.trim()})`)
  const after = (await save()).progress
  check(after.strength > before.strength && (after.reps[id] ?? 0) === (before.reps[id] ?? 0) + cfg.reps, `saved: strength ${before.strength}→${after.strength}, ${id} reps ${before.reps[id] ?? 0}→${after.reps[id]}`)
  const grades = await p.locator('[data-testid=workout-count]').textContent()
  check(after.xp > before.xp, `XP awarded (${before.xp}→${after.xp})`)
  await p.click('[data-testid=workout-again]')
  await w(300)
  check((await p.locator('[data-testid=workout-count]').textContent()).trim().startsWith('0'), `"Go again" resets the counter (was ${grades?.trim()})`)
  await p.click('[data-testid=workout-stop]')
  await w(700)
  const g2 = await gym()
  const after2 = await ins()
  check(g2.mode === 'free' && after2.headBone[1] > 1.3, `Stop returns to free movement standing (mode ${g2.mode})`)
  check((await promptText()).includes(cfg.label), 'prompt is back after stepping away')
}

/* ── Chad Press still works from its platform ── */
{
  await p.evaluate(() => window.__chadverse.gymGoto('press'))
  await w(400)
  await p.keyboard.press('e')
  await p.waitForSelector('[data-testid=press-start]', { timeout: 5000 })
  await p.click('[data-testid=press-start]')
  await w(2600)
  for (let i = 0; i < 10; i++) {
    await p.click('[data-testid=press-button]').catch(() => {})
    await w(820)
  }
  await p.waitForSelector('[data-testid=press-final]', { timeout: 8000 }).catch(() => {})
  check(await p.locator('[data-testid=press-final]').isVisible().catch(() => false), 'Chad Press set completes on the platform')
  await p.click('[data-testid=press-exit]')
  await w(600)
  check((await gym()).mode === 'free', 'leaving Chad Press returns to the gym floor')
}

/* ── achievements ── */
{
  const ach = (await save()).progress.achievements
  check(ach.includes('full_circuit'), `Full Circuit unlocked after a set on every station (${ach.join(', ')})`)
}

/* ── exit + re-entry cleanup ── */
{
  await p.evaluate(() => window.__chadverse.gymGoto('exit'))
  await w(400)
  check((await promptText()).includes('Back to Chad Square'), 'exit door prompt')
  await p.keyboard.press('e')
  await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 20000 })
  check((await phase()) === 'world', 'door returns to Chad Square')
  const mems = []
  for (let i = 0; i < 3; i++) {
    await enterGym()
    await p.evaluate(() => window.__chadverse.gymGoto('curl'))
    await w(300)
    await p.keyboard.press('e')
    await w(500)
    await p.click('[data-testid=workout-stop]')
    await w(1200)
    mems.push(await stats())
    await p.evaluate(() => window.__chadverse.gymGoto('exit'))
    await w(300)
    await p.keyboard.press('e')
    await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 20000 })
  }
  const flat = mems.every((m) => m.geometries === mems[0].geometries && m.textures === mems[0].textures && m.programs === mems[0].programs)
  check(flat, `no GPU growth across gym re-entries (${mems.map((m) => `${m.geometries}g/${m.textures}t/${m.programs}p`).join(' → ')}; first visit ${mem0.geometries}g/${mem0.textures}t)`)
}

check(errs.length === 0, `no console errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
await b.close()
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`)
console.log(fail ? `${fail} FAILURE(S)` : 'ALL CHECKS PASSED')
process.exit(fail ? 1 : 0)
