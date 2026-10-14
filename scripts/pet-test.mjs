// CHAD PETS companions: adopt from Patches with Chad Coins, bring along → follows you indoors and out, catches up
// after a teleport, send home / call from the pause menu, saved across reloads; an unowned pet stays home on load.
//   URL=http://localhost:4318/chadverse/ [Q=low] node scripts/pet-test.mjs
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:4318/chadverse/'
const KEY = 'pumpchad.chadverse.save'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1100, height: 720 } })
const errs = []
let fails = 0
const check = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails++ }
p.on('pageerror', (e) => errs.push(e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)))
const C = (fn, ...a) => p.evaluate(([f, a]) => window.__chadverse[f](...a), [fn, a])
const stored = () => p.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY)
const enterWorld = async () => {
  await p.click('[data-testid=enter-muted]')
  await p.waitForSelector('[role=tablist]')
  await p.getByRole('tab', { name: 'Name' }).click()
  await p.fill('#chad-name', 'Pet Owner')
  await p.getByRole('button', { name: /Enter Chad Square/ }).click()
  await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 90000 })
}

const hold = async (key, ms) => {
  await p.keyboard.down(key)
  await p.waitForTimeout(ms)
  await p.keyboard.up(key)
  await p.waitForTimeout(250)
}
const near = async (max) => {
  const pt = await C('pet')
  const me = (await C('interior')) ?? (await C('world'))
  const d = pt ? Math.hypot(pt.x - me.x, pt.z - me.z) : Infinity
  return { ok: d < max, d: d.toFixed(2), pt }
}
await p.goto(BASE, { waitUntil: 'networkidle' })
await p.evaluate(([k, q]) => {
  localStorage.clear()
  localStorage.setItem(k, JSON.stringify({ version: 2, character: null, progress: { xp: 0, coins: 300, discoveries: ['intro_seen'] }, settings: { quality: q, muted: true } }))
}, [KEY, process.env.Q || 'low'])
await p.reload({ waitUntil: 'networkidle' })
await enterWorld()
check((await C('pet')) === null, 'no companion before adopting')

// CHAD PETS → Patches
const pets = (await C('houses')).find((h) => h.id === 'pets')
await C('teleport', pets.door.x, pets.door.z, pets.door.yaw + Math.PI)
await p.waitForTimeout(1200)
await p.keyboard.press('e')
await p.waitForFunction(() => window.__chadverse.phase === 'interior' && window.__chadverse.interior(), null, { timeout: 30000 })
await C('interiorTeleport', 1.6, -1.1, Math.PI, 0)
await p.waitForTimeout(500)
const kp = await p.evaluate(() => document.querySelector('[data-testid=prompt]')?.textContent ?? '')
check(kp.includes('Patches'), `keeper prompt (got "${kp}")`)
await p.keyboard.press('e')
await p.waitForSelector('[data-testid=shop-items]', { timeout: 5000 }).catch(() => {})
check((await p.locator('[data-testid=shop-items] li').count()) === 4, 'Patches lists four companions')
const c0 = (await C('save')).progress.coins
await p.click('[data-item=pet_cat] button')
await p.waitForTimeout(300)
const s1 = await C('save')
check(s1.progress.coins === c0 - 100 && s1.progress.owned.includes('pet_cat') && s1.progress.pet === null, `adopt Midnight: ${c0} → ${s1.progress.coins} coins`)
await p.click('[data-item=pet_cat] button')
await p.waitForTimeout(500)
check((await C('save')).progress.pet === 'pet_cat' && (await C('pet'))?.kind === 'cat', 'Bring along: Midnight appears + is saved')
await p.keyboard.press('Escape')
await p.waitForTimeout(300)
await hold('s', 1200)
await p.waitForTimeout(1200)
const n1 = await near(2.6)
check(n1.ok, `follows you round the shop (${n1.d} m)`)

// out into the street
await C('interiorTeleport', 0, pets.room.d / 2 - 0.9, 0, 0)
await p.waitForTimeout(500)
await p.keyboard.press('e')
await p.waitForFunction(() => window.__chadverse.phase === 'world' && window.__chadverse.world(), null, { timeout: 60000 })
await p.waitForTimeout(800)
const n2 = await near(2.6)
check(n2.pt?.kind === 'cat' && n2.ok, `comes outside with you (${n2.d} m)`)
const w0 = await C('world')
await C('teleport', w0.x - 30, w0.z, 0)
await p.waitForTimeout(1200)
const n3 = await near(3)
check(n3.ok, `catches up after a teleport (${n3.d} m)`)
const a0 = await C('pet')
await hold('w', 2000)
await p.waitForTimeout(1000)
const a1 = await C('pet')
const n4 = await near(3.2)
check(Math.hypot(a1.x - a0.x, a1.z - a0.z) > 1 && n4.ok, `trails you while you walk (moved ${Math.hypot(a1.x - a0.x, a1.z - a0.z).toFixed(1)} m, ${n4.d} m behind)`)
check(Math.abs(a1.y - (await C('world')).y) < 0.6, 'stays on the ground')

// pause menu: send home / call
await p.keyboard.press('Escape')
await p.waitForSelector('[data-testid=pause-companion]', { timeout: 5000 }).catch(() => {})
check(((await p.textContent('[data-testid=pause-companion]').catch(() => '')) || '').includes('Send Midnight home'), 'pause menu offers Send Midnight home')
await p.click('[data-testid=pause-companion]')
await p.waitForTimeout(300)
check((await C('pet')) === null && (await C('save')).progress.pet === null, 'sent home: gone + saved')
check(((await p.textContent('[data-testid=pause-companion]')) || '').includes('Call Midnight'), 'then offers Call Midnight')
await p.click('[data-testid=pause-companion]')
await p.waitForTimeout(300)
check((await C('pet'))?.kind === 'cat', 'called back')
await p.keyboard.press('Escape')
await p.waitForTimeout(300)

// persistence + tamper
await p.reload({ waitUntil: 'networkidle' })
await p.waitForFunction(() => window.__chadverse?.save, null, { timeout: 30000 })
check((await C('save')).progress.pet === 'pet_cat', 'companion choice survives a reload')
await p.evaluate((k) => {
  const s = JSON.parse(localStorage.getItem(k))
  s.progress.owned = s.progress.owned.filter((i) => i !== 'pet_cat')
  localStorage.setItem(k, JSON.stringify(s))
}, KEY)
await p.reload({ waitUntil: 'networkidle' })
await p.waitForFunction(() => window.__chadverse?.save, null, { timeout: 30000 })
check((await C('save')).progress.pet === null, 'an unowned pet stays home on load')

const lost = errs.some((e) => e.includes('context lost'))
if (lost) console.log('  WARN  WebGL context lost during the run (machine memory) — shader errors after it ignored')
const real = errs.filter((e) => !(lost && (e.includes('context lost') || e.includes('WebGLProgram'))))
check(!real.length, `no page errors (${JSON.stringify(real.slice(0, 3))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
