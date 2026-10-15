// Pistol Range (the second weapon on the Pumpkin Toss range): pick the Pistol on the card, ten REAL mouse clicks at the boards, results, separate record,
// the pumpkin mode still works. Simulated desktop browser (headless software GL); not a real phone.
//   URL=... SHOTS=dir node scripts/pistol-test.mjs
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const SHOTS = process.env.SHOTS || ''
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 900, height: 600 } })
const errs = []
let fails = 0
const check = (ok, msg) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!ok) fails++
}
p.on('pageerror', (e) => errs.push(e.message))
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'], xp: 5000 }, settings: { quality: 'low', muted: true } })))
await p.goto(BASE)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Marksman')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const C = (fn, ...a) => p.evaluate(([f, a]) => window.__chadverse[f](...a), [fn, a])
const R = await C('range')
const back = { x: R.stand.x - Math.sin(R.stand.yaw) * 6, z: R.stand.z - Math.cos(R.stand.yaw) * 6 }
await C('teleport', back.x, back.z, R.stand.yaw)
await p.waitForTimeout(500)
await p.keyboard.down('w')
for (let i = 0; i < 30 && !(await p.locator('[data-testid=prompt]').textContent().catch(() => '')).includes('Pumpkin Toss'); i++) await p.waitForTimeout(120)
await p.keyboard.up('w')
await p.keyboard.press('e')
await p.waitForSelector('[data-testid=toss-start]')
check((await p.locator('[data-testid=weapon-pistol]').count()) === 1, 'the card offers a Pistol choice')
await p.click('[data-testid=weapon-pistol]')
check((await p.locator('text=Pistol Range').count()) >= 1, 'choosing it retitles the card Pistol Range')
await p.click('[data-testid=toss-start]')
await p.waitForFunction(() => window.__chadverse.range()?.phase === 'playing', null, { timeout: 5000 })
await p.waitForTimeout(700)
const click = async (nx, ny) => {
  await p.mouse.move(((nx + 1) / 2) * 900, ((1 - ny) / 2) * 600)
  await p.waitForTimeout(250)
  await p.mouse.click(((nx + 1) / 2) * 900, ((1 - ny) / 2) * 600)
}
if (SHOTS) {
  // a side-on still of the pistol arm tracking the aim point
  const bs0 = await C('rangeBoards')
  await p.mouse.move(((bs0[1].x + 1) / 2) * 900, ((1 - bs0[1].y) / 2) * 600)
  await p.waitForTimeout(500)
  const f = [Math.sin(R.stand.yaw), Math.cos(R.stand.yaw)]
  const r = [-Math.cos(R.stand.yaw), Math.sin(R.stand.yaw)]
  for (const [name, side] of [['pistol-side', 1.5], ['pistol-side-near', 0.9], ['pistol-side-other', -1.0]]) {
    const h = await C('handPos')
    await p.evaluate(([c, l]) => window.__chadverse.shotCam({ cam: c, look: l, fov: 38 }), [[h.x + r[0] * side - f[0] * 0.2, h.y + 0.25, h.z + r[1] * side - f[1] * 0.2], [h.x + f[0] * 0.25, h.y, h.z + f[1] * 0.25]])
    await p.waitForTimeout(500)
    await p.screenshot({ path: `${SHOTS}/${name}.jpg`, quality: 85 })
  }
  await p.evaluate(() => window.__chadverse.shotCam(null))
}
let shots = 0
for (let i = 0; i < 10; i++) {
  const bs = await C('rangeBoards')
  const pick = i === 9 ? null : bs[i % bs.length]
  if (pick) await click(pick.x, pick.y)
  else await click(-0.95, -0.9)
  shots++
  if (i === 2 && SHOTS) await p.screenshot({ path: `${SHOTS}/pistol-aim.jpg`, quality: 82 })
  await p.waitForFunction((n) => window.__chadverse.range()?.thrown >= n, shots, { timeout: 5000 })
  if (i === 3 && SHOTS) await p.screenshot({ path: `${SHOTS}/pistol-after-shot.jpg`, quality: 82 })
  await p.waitForTimeout(450)
}
await p.waitForSelector('[data-testid=toss-final]', { timeout: 8000 })
const st = await C('range')
const final = Number(await p.locator('[data-testid=toss-final]').textContent())
check(st.thrown === 10 && final === st.score && st.hits >= 7, `ten shots, ${st.hits} hits, score ${final}`)
const sv = (await C('save')).progress
check(sv.records.pistol_range === final, `the pistol best is its own record (${sv.records.pistol_range})`)
check((sv.records.pumpkin_toss ?? 0) === 0, 'the pumpkin record is untouched')
check((await p.locator('text=Shoot again').count()) === 1, 'the results card says Shoot again')
await p.click('[data-testid=toss-done]')
await p.waitForTimeout(500)
check(!errs.length, `no page errors (${JSON.stringify(errs.slice(0, 2))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
