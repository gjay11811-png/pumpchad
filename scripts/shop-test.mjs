// Chad Coins + Chad Fits: v1 → v2 save migration (coins from XP), coins follow XP, Vera's shop (buy, not enough
// coins, wear → re-dressed), and everything survives a reload; an unowned premium colour falls back on load.
//   URL=http://localhost:4318/chadverse/ [Q=low] node scripts/shop-test.mjs
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
  await p.fill('#chad-name', 'Coin Spender')
  await p.getByRole('button', { name: /Enter Chad Square/ }).click()
  await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 90000 })
}

await p.goto(BASE, { waitUntil: 'networkidle' })
// a v1 save with 300 XP and no coins field: migrates to 150 coins
await p.evaluate(([k, q]) => {
  localStorage.clear()
  localStorage.setItem(k, JSON.stringify({ version: 1, character: null, progress: { xp: 300, discoveries: ['intro_seen'] }, settings: { quality: q, muted: true } }))
}, [KEY, process.env.Q || 'low'])
await p.reload({ waitUntil: 'networkidle' })
await p.waitForFunction(() => window.__chadverse?.save, null, { timeout: 30000 })
const m0 = await C('save')
check(m0.version === 2 && m0.progress.coins === 150 && Array.isArray(m0.progress.owned), `v1 save migrates: 300 XP → ${m0.progress.coins} coins`)
await enterWorld()
const s0 = await C('save')
check(Number((await p.textContent('[data-testid=hud-coins]')).replace(/\D/g, '')) === s0.progress.coins, 'HUD shows the coin balance')

// into Chad Fits
const fits = (await C('houses')).find((h) => h.id === 'fits')
await C('teleport', fits.door.x, fits.door.z, fits.door.yaw + Math.PI)
await p.waitForTimeout(1200)
await p.keyboard.press('e')
await p.waitForFunction(() => window.__chadverse.phase === 'interior' && window.__chadverse.interior(), null, { timeout: 30000 })
// coins follow XP: the rack's first look pays 10 XP → 5 coins
await C('interiorTeleport', 0, 1.55, Math.PI, 0)
await p.waitForTimeout(500)
const before = await C('save')
const pr = await p.evaluate(() => document.querySelector('[data-testid=prompt]')?.textContent ?? '')
if (pr.includes('rack')) {
  await p.keyboard.press('e')
  await p.waitForTimeout(400)
  await p.keyboard.press('Escape')
  await p.waitForTimeout(400)
  const after = await C('save')
  check(after.progress.xp === before.progress.xp + 10 && after.progress.coins === before.progress.coins + 5, `10 XP pays 5 coins (${before.progress.coins} → ${after.progress.coins})`)
} else check(false, `rack prompt (got "${pr}")`)

// Vera
await C('interiorTeleport', 0, -1.4, Math.PI, 0)
await p.waitForTimeout(500)
const vp = await p.evaluate(() => document.querySelector('[data-testid=prompt]')?.textContent ?? '')
check(vp.includes('Vera'), `keeper prompt (got "${vp}")`)
await p.keyboard.press('e')
await p.waitForSelector('[data-testid=shop-items]', { timeout: 5000 }).catch(() => {})
check((await p.locator('[data-testid=shop-items] li').count()) === 6, 'shop lists the six Chad Fits items')
const c1 = (await C('save')).progress.coins
await p.click('[data-item=fit_gold] button')
await p.waitForTimeout(300)
const s2 = await C('save')
check(s2.progress.coins === c1 - 120 && s2.progress.owned.includes('fit_gold'), `buy Gold Lamé: ${c1} → ${s2.progress.coins}, owned`)
check((await p.locator('[data-item=fit_gold] button', { hasText: 'Wear' }).count()) === 1, 'owned item offers Wear (no second buy)')
// not enough coins for Gold glow (80) now
await p.click('[data-item=glow_gold] button')
await p.waitForTimeout(300)
const s3 = await C('save')
check(s3.progress.coins === s2.progress.coins && !s3.progress.owned.includes('glow_gold'), 'not enough coins: nothing spent, nothing granted')
check((await p.textContent('[data-testid=shop-msg]')).includes('80 coins'), 'tells you the price and your balance')
// wear it
await p.click('[data-item=fit_gold] button')
await p.waitForTimeout(1500)
const s4 = await C('save')
check(s4.character.appearance.outfit === '#e0a83e', 'Wear: outfit colour saved')
check((await p.locator('[data-item=fit_gold]', { hasText: 'Wearing' }).count()) === 1, 'shows Wearing')
await p.keyboard.press('Escape')
await p.waitForTimeout(400)
check((await p.locator('[data-testid=shop-items]').count()) === 0 && (await p.evaluate(() => window.__chadverse.phase)) === 'interior', 'Esc closes the shop, still inside')
check(!!(await C('interior')), 'player still present after re-dress')

// reload: everything persists
const keep = await stored()
await p.reload({ waitUntil: 'networkidle' })
const s5 = await p.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY)
check(s5.version === 2 && s5.progress.coins === keep.progress.coins && s5.progress.owned.includes('fit_gold') && s5.character.appearance.outfit === '#e0a83e', 'coins, ownership + outfit survive a reload')
// tampered: wearing a premium colour you don't own → falls back to a free colour on load
await p.evaluate((k) => {
  const s = JSON.parse(localStorage.getItem(k))
  s.progress.owned = []
  s.progress.coins = -50
  localStorage.setItem(k, JSON.stringify(s))
}, KEY)
await p.reload({ waitUntil: 'networkidle' })
await p.click('[data-testid=enter-muted]').catch(() => {})
await p.waitForFunction(() => window.__chadverse?.save, null, { timeout: 30000 })
const s6 = await C('save')
check(s6.character.appearance.outfit !== '#e0a83e' && s6.progress.coins === 0, `unowned premium colour falls back (${s6.character.appearance.outfit}); coins never negative (${s6.progress.coins})`)

// a lost WebGL context (low-memory machine) + the shader errors that follow it are environment, not game, failures
const lost = errs.some((e) => e.includes('context lost'))
if (lost) console.log('  WARN  WebGL context lost during the run (machine memory) — shader errors after it ignored')
const real = errs.filter((e) => !(lost && (e.includes('context lost') || e.includes('WebGLProgram'))))
check(!real.length, `no page errors (${JSON.stringify(real.slice(0, 3))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
