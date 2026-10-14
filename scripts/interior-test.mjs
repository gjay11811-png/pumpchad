// House interiors: every enterable building — the door prompt in town, entering, walking, the loft stair,
// one thing to look at (dialogue + a one-time XP reward), leaving back out onto the step outside its door.
//   URL=http://localhost:4318/chadverse/ [ONLY=steward,witch] [SHOTS=dir] node scripts/interior-test.mjs
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:4318/chadverse/'
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null
const SHOTS = process.env.SHOTS || null
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1100, height: 720 } })
const errs = []
let fails = 0
const check = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails++ }
p.on('pageerror', (e) => errs.push(e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)))
await p.goto(BASE, { waitUntil: 'networkidle' })
await p.evaluate(() => {
  localStorage.clear()
  localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 1, character: null, progress: { discoveries: ['intro_seen'] }, settings: { quality: 'medium', muted: true } }))
})
await p.reload({ waitUntil: 'networkidle' })
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'House Guest')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 90000 })
const C = (fn, ...a) => p.evaluate(([f, a]) => window.__chadverse[f](...a), [fn, a])
const prompt = () => p.evaluate(() => document.querySelector('[data-testid=prompt]')?.textContent ?? '')
const phase = () => p.evaluate(() => window.__chadverse.phase)
const hold = async (key, ms) => {
  await p.keyboard.down(key)
  await p.waitForTimeout(ms)
  await p.keyboard.up(key)
  await p.waitForTimeout(250)
}
const houses = await C('houses')
check(houses.length >= 12, `enterable buildings registered (${houses.length})`)
for (const h of houses) {
  if (ONLY && !ONLY.includes(h.id)) continue
  console.log(`-- ${h.name}`)
  await C('teleport', h.door.x, h.door.z, h.door.yaw + Math.PI)
  await p.waitForTimeout(1200)
  const at = await C('world')
  check(Math.hypot(at.x - h.door.x, at.z - h.door.z) < 0.15, `door approach is clear (pushed ${Math.hypot(at.x - h.door.x, at.z - h.door.z).toFixed(2)} m)`)
  const pr = await prompt()
  check(pr.includes(h.name), `door prompt "Enter ${h.name}" (got "${pr}")`)
  await p.keyboard.press('e')
  await p.waitForFunction(() => window.__chadverse.phase === 'interior' && window.__chadverse.interior(), null, { timeout: 30000 }).catch(() => {})
  const i0 = await C('interior')
  check((await phase()) === 'interior' && i0?.id === h.id, `inside ${h.name}`)
  if (!i0) continue
  await p.waitForTimeout(600)
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/in-${h.id}.jpg`, quality: 80 })
  // walk in
  await hold('w', 900)
  const i1 = await C('interior')
  check(i1.z < i0.z - 0.5, `walks into the room (z ${i0.z} → ${i1.z})`)
  // the loft
  if (h.room.loft) {
    const L = h.room.loft
    const sx = (L.stair.x0 + L.stair.x1) / 2
    await C('interiorTeleport', sx, L.stair.zb + 0.25, Math.PI, 0)
    await p.waitForTimeout(300)
    await hold('w', 2600)
    const up = await C('interior')
    check(up.level === 1 && up.y > L.y - 0.3, `climbs the stair to the loft (level ${up.level}, y ${up.y})`)
    await hold('a', 900)
    const loft = await C('interior')
    check(loft.level === 1 && loft.z < L.zl, `walks around the loft (z ${loft.z}, y ${loft.y})`)
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/in-${h.id}-loft.jpg`, quality: 80 })
    // come back down
    await C('interiorTeleport', sx, L.zl + 0.1, 0, 1)
    await p.waitForTimeout(300)
    await hold('w', 2600)
    const down = await C('interior')
    check(down.level === 0 && down.y < 0.2, `walks back down (level ${down.level}, y ${down.y})`)
  }
  // look at something
  const [lk, lv] = Object.entries(h.looks)[0] ?? []
  if (lk) {
    const x0 = await C('save')
    // stand a little in front of the thing (toward the door), facing it
    let ok = false
    for (const [dx, dz] of [[0, 0.95], [0.95, 0], [-0.95, 0], [0, -0.95], [0.7, 0.7], [-0.7, 0.7]]) {
      await C('interiorTeleport', lv.at[0] + dx, lv.at[1] + dz, Math.atan2(-dx, -dz), lv.level)
      await p.waitForTimeout(450)
      const pr2 = await prompt()
      if (pr2 && !pr2.includes('Leave')) { ok = true; break }
    }
    check(ok, `"${lk}" prompt shown`)
    await p.keyboard.press('e')
    await p.waitForTimeout(500)
    check((await p.locator('[data-testid=dialogue]').count()) === 1, `"${lk}" opens a dialogue`)
    await p.keyboard.press('Escape')
    await p.waitForTimeout(400)
    const x1 = await C('save')
    check(x1.progress.xp === x0.progress.xp + 10, `first look pays 10 XP once (${x0.progress.xp} → ${x1.progress.xp})`)
  }
  // leave
  await C('interiorTeleport', 0, h.room.d / 2 - 0.9, 0, 0)
  await p.waitForTimeout(500)
  const pr3 = await prompt()
  check(pr3.includes('Leave'), `exit prompt (got "${pr3}")`)
  await p.keyboard.press('e')
  await p.waitForFunction(() => window.__chadverse.phase === 'world' && window.__chadverse.world(), null, { timeout: 60000 }).catch(() => {})
  const w = await C('world')
  const dd = Math.hypot(w.x - h.door.exit.x, w.z - h.door.exit.z)
  check((await phase()) === 'world' && dd < 0.8, `back outside ${h.name}'s door (${dd.toFixed(2)} m off)`)
}
check(!errs.length, `no page errors (${JSON.stringify(errs.slice(0, 3))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
