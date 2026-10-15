// The valley's destinations end to end: the bridge, the landing + fishing prompt, the hamlet lane, the woodland trail, the watchtower
// (door -> chamber -> lookout loft), the inn, Mooncrest Manor (drive, gates, hall, doorways between rooms, the grand stair, upstairs),
// the discoveries, and the gym forecourt walk. Browser processes are cleaned up by the caller.
//   URL=http://localhost:4318/chadverse/ Q=low node scripts/valley-test.mjs
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:4318/chadverse/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 900, height: 600 } })
const errs = []
let fails = 0
const check = (ok, msg) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!ok) fails++
}
p.on('pageerror', (e) => errs.push(e.message))
await p.addInitScript((q) => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: {}, settings: { quality: q, muted: true } })), process.env.Q || 'low')
await p.goto(BASE)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Explorer')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 90000 })
const C = (fn, ...a) => p.evaluate(([f, a]) => window.__chadverse[f](...a), [fn, a])
const hold = async (k, ms) => {
  await p.keyboard.down(k)
  await p.waitForTimeout(ms)
  await p.keyboard.up(k)
  await p.waitForTimeout(250)
}
const promptHas = (t) => p.waitForFunction((n) => (document.querySelector('[data-testid=prompt]')?.textContent ?? '').includes(n), t, { timeout: 5000 }).then(() => true).catch(() => false)
const P = Math.PI
// the bridge: due west along the avenue's axis, the deck rises and falls, the walker stays on it
await C('teleport', 40, 415, -P / 2)
await p.waitForTimeout(600)
const a0 = await C('world')
await hold('w', 4500)
const a1 = await C('world')
check(a1.x < a0.x - 8 && Math.abs(a1.z - 415) < 3.4, `walks across Moonspan Bridge (x ${a0.x.toFixed(1)} -> ${a1.x.toFixed(1)}, z ${a1.z.toFixed(1)})`)
await C('teleport', 20, 415, -P / 2)
await p.waitForTimeout(500)
const mid = await C('world')
check(mid.y > -50.8, `the deck arches up over the water (y ${mid.y.toFixed(2)} at mid-span, the floor is -52)`)
// the landing: the fishing prompt at the pier head, the fishing overlay opens
await C('teleport', 40.4, 432, -P / 2)
check(await promptHas('Fish off the lakeside pier'), 'the lakeside pier offers fishing')
await p.keyboard.press('e')
await p.waitForTimeout(1200)
await p.keyboard.press('Escape')
await p.waitForTimeout(500)
// hamlet lane + woodland trail
await C('teleport', -7, 208, -P / 2)
await p.waitForTimeout(500)
const h0 = await C('world')
await hold('w', 4500)
const h1 = await C('world')
check(h1.x < h0.x - 6, `the lane leads into the hamlet (x ${h0.x.toFixed(1)} -> ${h1.x.toFixed(1)})`)
await C('teleport', -14, 177, -P / 2 - 0.1)
await p.waitForTimeout(500)
const t0 = await C('world')
await hold('w', 5000)
const t1 = await C('world')
check(Math.hypot(t1.x - t0.x, t1.z - t0.z) > 7, `the woodland trail is walkable from the road (${Math.hypot(t1.x - t0.x, t1.z - t0.z).toFixed(1)} m)`)
// discoveries
const xp0 = (await C('save')).progress.xp
await C('teleport', -68, 209, 0)
check(await promptHas('old shrine'), 'the old shrine shows its prompt')
await p.keyboard.press('e')
await p.waitForTimeout(1800)
check((await C('save')).progress.xp > xp0, 'the shrine pays XP once')
await p.keyboard.press('Escape')
await p.waitForTimeout(400)
// the enterable places
const houses = await C('houses')
const enter = async (id, inside) => {
  const h = houses.find((x) => x.id === id)
  if (!h) return check(false, `${id} is registered`)
  await C('teleport', h.door.x, h.door.z, h.door.yaw + P)
  await p.waitForTimeout(900)
  check(await promptHas(h.name), `${id}: prompt "Enter ${h.name}"`)
  await p.keyboard.press('e')
  await p.waitForFunction(() => window.__chadverse.phase === 'interior' && window.__chadverse.interior(), null, { timeout: 40000 }).catch(() => {})
  const i0 = await C('interior')
  check(i0?.id === id, `${id}: inside`)
  await inside?.(h)
  await C('interiorTeleport', 0, h.room.d / 2 - 0.9, 0, 0)
  await p.waitForTimeout(500)
  await p.keyboard.press('e')
  await p.waitForFunction(() => window.__chadverse.phase === 'world' && window.__chadverse.world(), null, { timeout: 40000 }).catch(() => {})
  const w = await C('world')
  check(Math.hypot(w.x - h.door.exit.x, w.z - h.door.exit.z) < 1.0, `${id}: back outside at the door (${Math.hypot(w.x - h.door.exit.x, w.z - h.door.exit.z).toFixed(2)} m)`)
}
await enter('inn')
await enter('watchtower', async (h) => {
  const L = h.room.loft
  await C('interiorTeleport', (L.stair.x0 + L.stair.x1) / 2, L.stair.zb + 0.25, P, 0)
  await p.waitForTimeout(300)
  await hold('w', 3000)
  const up = await C('interior')
  check(up.level === 1 && up.y > L.y - 0.3, `watchtower: climbs to the lookout (level ${up.level}, y ${up.y})`)
})
await enter('manor', async (h) => {
  const L = h.room.loft
  const through = async (label, x, z, yaw, dir) => {
    await C('interiorTeleport', x, z, yaw, 0)
    await p.waitForTimeout(350)
    const s0 = await C('interior')
    await hold('w', 2600)
    const s1 = await C('interior')
    check(dir === 'x-' ? s1.x < s0.x - 2.5 : s1.x > s0.x + 2.5, `manor: ${label} (${s0.x.toFixed(1)},${s0.z.toFixed(1)} -> ${s1.x.toFixed(1)},${s1.z.toFixed(1)})`)
  }
  await through('hall -> living room', -2.4, 7.0, -P / 2, 'x-')
  await through('hall -> dining room', -2.4, 1.0, -P / 2, 'x-')
  await through('hall -> library', -2.4, -6.0, -P / 2, 'x-')
  await through('hall -> conservatory', 2.4, 6.5, P / 2, 'x+')
  await through('hall -> kitchen', 2.4, -3.0, P / 2, 'x+')
  await C('interiorTeleport', (L.stair.x0 + L.stair.x1) / 2, L.stair.zb + 0.25, P, 0)
  await p.waitForTimeout(300)
  await hold('w', 5200)
  const up = await C('interior')
  check(up.level === 1 && up.y > L.y - 0.3, `manor: the grand staircase reaches the upper floor (level ${up.level}, y ${up.y})`)
  await C('interiorTeleport', 0, -3, 0, 1)
  await p.waitForTimeout(300)
  const lan = await C('interior')
  check(lan.level === 1, 'manor: the landing is walkable')
})
// manor drive, gates and forecourt (outside)
await C('teleport', 100, 508, -P / 2)
await p.waitForTimeout(500)
const d0 = await C('world')
await hold('w', 4500)
const d1 = await C('world')
check(Math.hypot(d1.x - d0.x, d1.z - d0.z) > 6, `the drive carries you toward the gates (${Math.hypot(d1.x - d0.x, d1.z - d0.z).toFixed(1)} m)`)
// the gym forecourt (the walk that used to fail)
await C('teleport', 12, -4, P / 2)
await p.waitForTimeout(500)
const g0 = await C('world')
await hold('w', 2200)
const g1 = await C('world')
check(Math.hypot(g1.x - g0.x, g1.z - g0.z) > 1.5, `gym forecourt is walkable (${Math.hypot(g1.x - g0.x, g1.z - g0.z).toFixed(2)} m)`)
check(!errs.length, `no page errors (${JSON.stringify(errs.slice(0, 2))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
