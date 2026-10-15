// Launch boundary: the Valley Gate is closed and every route into the expansion is refused. Simulated desktop browser (headless software GL).
//   URL=http://localhost:4318/chadverse/ node scripts/launch-test.mjs
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:4318/chadverse/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 900, height: 600 } })
const errs = []
let fails = 0
const check = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails++ }
p.on('pageerror', (e) => errs.push(e.message))
// an "old" save: it has been all the way down the valley already
const OLD = { version: 2, character: null, progress: { xp: 500, coins: 120, discoveries: ['intro_seen', 'visit_square', 'visit_gym', 'visit_downtown', 'visit_castle', 'visit_manor', 'disc_shrine'], achievements: ['city_explorer'] }, settings: { quality: 'low', muted: true } }
await p.addInitScript((o) => { if (!localStorage.getItem('pumpchad.chadverse.save')) localStorage.setItem('pumpchad.chadverse.save', JSON.stringify(o)) }, OLD)
await p.goto(BASE)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Explorer')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const C = (fn, ...a) => p.evaluate(([f, a]) => window.__chadverse[f](...a), [fn, a])
const hold = async (k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); await p.waitForTimeout(200) }
const promptHas = (t) => p.waitForFunction((n) => (document.querySelector('[data-testid=prompt]')?.textContent ?? '').includes(n), t, { timeout: 5000 }).then(() => true).catch(() => false)
const P = Math.PI

// old save: relocated notice once, data intact
await p.waitForTimeout(1500)
let sv = await C('save')
check(sv.progress.discoveries.includes('visit_downtown') && sv.progress.discoveries.includes('visit_manor') && sv.progress.discoveries.includes('disc_shrine'), 'expansion discoveries are kept in the save')
check(sv.progress.xp >= 500 && sv.progress.coins >= 120 && sv.progress.achievements.includes('city_explorer'), 'XP, coins and achievements are kept')
check(sv.progress.discoveries.includes('launch_notice_v1'), 'the one-time relocation notice was shown (flag set)')
const w0 = await C('world')
check(w0.z < 70, `arrival is in the village (z ${w0.z.toFixed(1)})`)

// the gate: sign + prompt + dialogue
await C('teleport', 0, 71.8, 0)
check(await promptHas('Valley Gate'), 'the gate offers its notice')
await p.keyboard.press('e')
await p.waitForTimeout(800)
check((await p.locator('[data-testid=dialogue]').count()) === 1, 'the notice opens a short explanation')
await p.keyboard.press('Escape')
await p.waitForTimeout(400)

// walking: straight at the gate, at both leaves, sprinting; and jumping
for (const x of [0, 1.5, -1.5, 3.4, -3.4, 5.2, -5.2, 9, -9]) {
  await C('teleport', x, 70, 0)
  await p.waitForTimeout(300)
  await p.keyboard.down('Shift')
  await hold('w', 2200)
  await p.keyboard.up('Shift')
  const w = await C('world')
  if (w.z >= 75.2) { check(false, `walked through at x=${x}: z ${w.z.toFixed(2)}`); continue }
}
check(true, 'sprinting at the gate at nine x positions never passed z 75.2')
await C('teleport', 0, 72.6, 0)
await p.waitForTimeout(300)
for (let i = 0; i < 4; i++) { await p.keyboard.press('Space'); await p.keyboard.down('w'); await p.waitForTimeout(700); await p.keyboard.up('w') }
const wj = await C('world')
check(wj.z < 75.2, `jumping at the gate does not clear it (z ${wj.z.toFixed(2)})`)

// edges: terrain edge to the east/west of the gate and the cliff side paths
for (const [x, z, yaw] of [[20, 70, 0], [-28, 70, 0], [60, 45, 0], [-60, 70, 0], [60, 62, 0], [20, 74, 0]]) {
  await C('teleport', x, z, yaw)
  await p.waitForTimeout(300)
  await hold('w', 2500)
  const w = await C('world')
  if (w.z > 79 || w.y < -3) check(false, `edge walk from (${x},${z}) ended at (${w.x.toFixed(1)},${w.z.toFixed(1)}) y ${w.y.toFixed(1)}`)
}
check(true, 'cliff/terrain edges south of the village hold (no walk-off)')

// teleports / fast travel / spawn guards
for (const [x, z] of [[-10, 415], [150, 516], [-110, 272], [-27, 215], [100, 94], [-42, 100], [14, 88]]) {
  await C('teleport', x, z, 0)
  const w = await C('world')
  if (w.z > 75.2) check(false, `teleport to (${x},${z}) landed at z ${w.z}`)
}
check(true, 'teleports into the valley, city, manor, castle, hamlet and lower districts are redirected to the arrival gate')
// map
await p.keyboard.press('m')
await p.waitForSelector('[data-testid=map]', { timeout: 5000 })
check((await p.locator('[data-testid=map-locked]').count()) === 1, 'the map shows the locked "next update" veil')
for (const id of ['downtown', 'castle', 'manor', 'hamlet', 'southshore', 'overlook-road']) {
  await p.locator(`[data-landmark-locked=${id}]`).click()
  const txt = await p.locator('[data-testid=map-selected]').textContent()
  const travel = await p.locator('[data-testid=map-travel]').count()
  check(/next update/i.test(txt) && travel === 0, `map: ${id} is labelled next update, with no Travel button`)
}
await p.locator('[data-landmark=gym]').click({ force: true })
check((await p.locator('[data-testid=map-travel]').count()) === 1, 'map: a village place still offers fast travel')
await p.keyboard.press('Escape')
await p.waitForTimeout(500)
// area
const area = await C('areaScan')
console.log('  launch area', JSON.stringify(area))
check(area.connected > 15000 && area.valley === 0, `launch-accessible connected area ${area.connected} m² (valley ${area.valley})`)
check(!errs.length, `no page errors (${JSON.stringify(errs.slice(0, 2))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
