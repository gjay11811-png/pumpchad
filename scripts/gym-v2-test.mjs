// Chad Gym v2: layout + interaction safety. Every station's prompt spot is reachable (not inside equipment), the
// main walking routes are clear, spamming E can't open two sessions, repeated start/stop never duplicates or loses
// the curl dumbbells, Escape always restores free movement, NPCs exist per quality tier.
//   Q=high node scripts/gym-v2-test.mjs
import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1100, height: 720 } })
const errs = []
let fails = 0
const check = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails++ }
p.on('pageerror', (e) => errs.push(e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)))
const Q = process.env.Q || 'high'
await p.goto(process.env.URL || 'http://localhost:4318/chadverse/', { waitUntil: 'networkidle' })
await p.evaluate((q) => {
  localStorage.clear()
  localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 1, character: null, progress: {}, settings: { quality: q, muted: true } }))
}, Q)
await p.reload({ waitUntil: 'networkidle' })
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Gym Tester')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 60000 })
await p.evaluate(() => window.__chadverse.teleport(14.4, -4))
await p.waitForTimeout(500)
await p.keyboard.press('e')
await p.waitForFunction(() => window.__chadverse?.phase === 'gym' && window.__chadverse.gym()?.mode === 'free', null, { timeout: 60000 })
await p.waitForTimeout(1200)
const info = () => p.evaluate(() => window.__chadverse.gymInfo())
const gym = () => p.evaluate(() => window.__chadverse.gym())
const prompt = () => p.evaluate(() => document.querySelector('[data-testid=prompt]')?.textContent ?? '')
const tp = async (x, z, yaw) => {
  await p.evaluate(([x, z, yaw]) => window.__chadverse.gymTeleport(x, z, yaw), [x, z, yaw])
  await p.waitForTimeout(550)
}
const walk = async (key, ms) => {
  const a = (await info()).pos
  await p.keyboard.down(key)
  await p.waitForTimeout(ms)
  await p.keyboard.up(key)
  await p.waitForTimeout(250)
  const c = (await info()).pos
  return Math.hypot(c[0] - a[0], c[1] - a[1])
}

// ── NPCs by quality tier ──
const i0 = await info()
const want = Q === 'low' ? 0 : Q === 'high' ? 2 : 1
check(i0.npcs.length === want, `quality ${Q}: ${i0.npcs.length} background NPC(s) (${i0.npcs.join(', ') || 'none'})`)

// ── every station's prompt spot is free floor (collision doesn't push you off it) and shows its prompt ──
const STATIONS = { press: [0, -0.3], bench: [-5.3, 0.4], curl: [5.75, -2.6], squat: [-6.6, -2.3], bag: [5.2, 5.2], deadlift: [-3.4, 3.75], pullup: [-3.7, -3.25], treadmill: [-5.6, 3.5], exit: [0, 6.9] }
const LABELS = { press: 'Chad Press', bench: 'Bench press', curl: 'Dumbbell curls', squat: 'Squat rack', bag: 'Heavy bag', deadlift: 'Deadlift', pullup: 'Pull-up', treadmill: 'Treadmill', exit: 'Back to Chad Square' }
for (const [id, [x, z]] of Object.entries(STATIONS)) {
  await tp(x, z)
  const pos = (await info()).pos
  const off = Math.hypot(pos[0] - x, pos[1] - z)
  check(off < 0.05, `${id}: prompt spot (${x}, ${z}) is open floor (pushed ${off.toFixed(2)} m)`)
  check((await prompt()).includes(LABELS[id]), `${id}: prompt "${LABELS[id]}" (${await prompt()})`)
}

// ── walking routes: door → platform aisle, east aisle (benches ↔ rack), west aisle (strength ↔ cardio) ──
await tp(0, 5.6, Math.PI)
check((await walk('w', 2200)) > 3.2, 'door → Chad Press: the centre aisle is clear')
await tp(7.15, 0.0, Math.PI)
check((await walk('w', 1300)) > 1.8, 'east aisle between the benches and the rack is walkable (and the NPC curler is out of it)')
await tp(4.2, -2.6, -Math.PI / 2)
check((await walk('w', 600)) > 0.8, 'the gap between the two adjustable benches leads straight to the curl spot')
await tp(-4.9, 4.4, Math.PI)
check((await walk('w', 2000)) > 2.8, 'west aisle past the treadmills and bench press is walkable')
await tp(-1.5, 0.2, Math.PI / 2)
check((await walk('w', 1500)) > 1.8, 'cross aisle in front of the platform is walkable')
// walls / equipment stop you (no walking through the rack)
await tp(6.6, -2.6, -Math.PI / 2)
await p.mouse.move(550, 360)
await walk('s', 1500) // camera behind → S walks toward the rack (east)
check((await info()).pos[0] < 7.95, `the dumbbell rack blocks you (x ${(await info()).pos[0]})`)

// ── curls: spam E → one session; rack pair ↔ held pair swap; Escape back to free; repeat ──
for (let round = 1; round <= 3; round++) {
  await tp(5.75, -2.6)
  for (let i = 0; i < 5; i++) {
    await p.keyboard.press('e')
    await p.waitForTimeout(60)
  }
  await p.waitForTimeout(500)
  const g = await gym()
  const panels = await p.locator('[data-testid=workout-start], [data-testid=workout-rep]').count()
  check(g.mode === 'curl' && panels >= 1, `round ${round}: spamming E opens one curl session (mode ${g.mode})`)
  const s = await info()
  check(s.rackBellsVisible.every((v) => !v) && s.heldVisible.every((v) => v), `round ${round}: the pair leaves the rack and is in the hands (rack ${s.rackBellsVisible}, held ${s.heldVisible})`)
  await p.keyboard.press('Escape')
  await p.waitForTimeout(600)
  const f = await info()
  check((await gym()).mode === 'free', `round ${round}: Escape ends the set`)
  check(f.rackBellsVisible.every((v) => v) && f.heldVisible.every((v) => !v), `round ${round}: the pair is back on the rack, hands empty (rack ${f.rackBellsVisible}, held ${f.heldVisible})`)
  await p.keyboard.press('Escape') // close the pause menu if the second Escape opened it
  await p.waitForTimeout(300)
  if (await p.getByRole('dialog', { name: 'Paused' }).isVisible().catch(() => false)) await p.keyboard.press('Escape')
}
check((await walk('w', 900)) > 0.8, 'free to walk away after the last set (not trapped)')

// ── every other station: start, Escape out, movement works ──
for (const id of ['bench', 'squat', 'deadlift', 'pullup', 'treadmill', 'bag']) {
  const [x, z] = STATIONS[id]
  await tp(x, z)
  await p.keyboard.press('e')
  await p.waitForTimeout(500)
  check((await gym()).mode === id, `${id}: E starts it`)
  await p.keyboard.press('Escape')
  await p.waitForTimeout(600)
  const g = await gym()
  const pos = (await info()).pos
  const off = Math.hypot(pos[0] - x, pos[1] - z)
  check(g.mode === 'free' && off < 0.3, `${id}: Escape returns you to the prompt spot in free mode (${off.toFixed(2)} m)`)
  if (await p.getByRole('dialog', { name: 'Paused' }).isVisible().catch(() => false)) await p.keyboard.press('Escape')
}

// ── exit ──
await tp(0, 6.9)
await p.keyboard.press('e')
await p.waitForFunction(() => window.__chadverse?.phase === 'world', null, { timeout: 60000 }).catch(() => {})
check((await p.evaluate(() => window.__chadverse.phase)) === 'world', 'the door takes you back to Chad Square')
check(errs.length === 0, `no page errors (${JSON.stringify(errs.slice(0, 3))})`)
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED')
await b.close()
process.exit(fails ? 1 : 0)
