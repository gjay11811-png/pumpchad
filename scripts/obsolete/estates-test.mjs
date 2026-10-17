// Chadville Estates: buy a plot at its gate, build with the editor (place / overlap + bounds + coins checks / rotate /
// move / remove with refund / undo), the build is solid in the world, everything persists, one plot per player.
//   URL=http://localhost:4318/chadverse/ [Q=low] [SHOTS=dir] node scripts/estates-test.mjs
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
  await p.fill('#chad-name', 'Homeowner')
  await p.getByRole('button', { name: /Enter Chad Square/ }).click()
  await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 90000 })
}

const hold = async (key, ms) => {
  await p.keyboard.down(key)
  await p.waitForTimeout(ms)
  await p.keyboard.up(key)
  await p.waitForTimeout(250)
}
const obj = () => p.textContent('[data-testid=objective]')
const promptId = async () => {
  // the prompt check runs a few times a second; on a slow machine give it a moment
  let id = null
  for (let i = 0; i < 15 && !id; i++) {
    id = (await C('world'))?.prompt ?? null
    if (!id) await p.waitForTimeout(200)
  }
  return id
}
const talkThrough = async (option) => {
  await p.waitForSelector('[data-testid=dialogue]', { timeout: 5000 })
  for (let i = 0; i < 10; i++) {
    if (option && (await p.getByRole('button', { name: option }).isVisible().catch(() => false))) return p.getByRole('button', { name: option }).click()
    if (!(await p.locator('[data-testid=dialogue]').count())) return
    await p.click('[data-testid=dialogue]', { timeout: 1500 }).catch(() => {})
    await p.waitForTimeout(220)
  }
}
const at = async (x, z, yaw) => {
  await C('teleport', x, z, yaw)
  await p.waitForTimeout(700)
  // a slow machine can take a moment to raise the prompt
  await p.waitForFunction(() => window.__chadverse.world()?.prompt != null, null, { timeout: 2500 }).catch(() => {})
}
const SHOTS = process.env.SHOTS || null
const est = async () => (await C('save')).progress.estate
const coins = async () => (await C('save')).progress.coins
const msg = async () => (await p.textContent('[data-testid=estate-msg]').catch(() => '')) || ''
const pick = (k) => p.click(`[data-kind=${k}]`)
const cell = (x, z) => p.click(`[data-cell="${x},${z}"]`, { force: true })
await p.goto(BASE, { waitUntil: 'networkidle' })
await p.evaluate(([k, q]) => {
  localStorage.clear()
  localStorage.setItem(k, JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'], coins: 400 }, settings: { quality: q, muted: true } }))
}, [KEY, process.env.Q || 'low'])
await p.reload({ waitUntil: 'networkidle' })
await enterWorld()

// buy Plot A at its gate
await at(-45.6, 56, -Math.PI / 2 + Math.PI)
check((await promptId()) === 'plot:A', `Plot A gate prompt (got ${await promptId()})`)
const cBuy = await coins()
await p.keyboard.press('e')
await talkThrough('Buy it · 120 coins')
await p.waitForSelector('[data-testid=estate-grid]', { timeout: 5000 }).catch(() => {})
const e0 = await est()
check(e0.plot === 'A' && (await coins()) === cBuy - 120, `bought Plot A (${cBuy} → ${await coins()})`)
check((await p.locator('[data-testid=estate-grid]').count()) === 1, 'the editor opens on your new plot')

// place a cottage, then try bad placements
let c = await coins()
await pick('cottage')
await cell(2, 1)
await p.waitForTimeout(200)
check((await est()).pieces.length === 1 && (await coins()) === c - 60, `cottage placed (${c} → ${await coins()})`)
c = await coins()
await cell(1, 0) // a free cell, but a 2×2 cottage from here would overlap the first one
check((await msg()).includes('already there') && (await est()).pieces.length === 1, 'overlap refused')
await cell(5, 4)
check((await msg()).includes('fit') && (await est()).pieces.length === 1, 'outside the plot refused')
// decorations
await pick('tree')
await cell(0, 0)
await pick('lamp')
await cell(5, 0)
await p.waitForTimeout(200)
check((await est()).pieces.length === 3 && (await coins()) === c - 18, `tree + lamp placed (${c} → ${await coins()})`)
c = await coins()
await pick('lamp') // deselect the palette tool
// select the tree → rotate → move
await p.click('[data-piece=tree]', { force: true })
await p.click('[data-testid=estate-rotate]')
await p.click('[data-testid=estate-move]')
await cell(0, 4)
await p.waitForTimeout(200)
const tree = (await est()).pieces.find((q) => q.k === 'tree')
check(tree && tree.x === 0 && tree.z === 4 && tree.r === 1, `tree rotated + moved (${JSON.stringify(tree)})`)
// remove the lamp → refund; undo → back
await p.click('[data-piece=lamp]', { force: true })
await p.click('[data-testid=estate-remove]')
await p.waitForTimeout(200)
check(!(await est()).pieces.some((q) => q.k === 'lamp') && (await coins()) === c + 8, `lamp removed, refunded (${c} → ${await coins()})`)
await p.click('[data-testid=estate-undo]')
await p.waitForTimeout(200)
check((await est()).pieces.some((q) => q.k === 'lamp') && (await coins()) === c, `undo restores it (${await coins()})`)
// spend down: fountains until the coins run out — never below zero
await pick('fountain')
const free = [[1, 0], [2, 0], [3, 0], [4, 0], [0, 1], [1, 1], [4, 1], [5, 1], [0, 2], [1, 2], [4, 2], [5, 2], [0, 3], [1, 3], [2, 3], [3, 3]]
for (const [x, z] of free) {
  await cell(x, z)
  await p.waitForTimeout(80)
  if ((await msg()).includes('Not enough')) break
}
const c1 = await coins()
check(c1 >= 0 && c1 < 25 && (await msg()).includes('Not enough'), `stops when you can't afford it (${c1} left, never negative)`)
if (SHOTS) await p.screenshot({ path: `${SHOTS}/estate-editor.jpg`, quality: 80 })
await p.click('[data-testid=estate-grid] ~ * button:has-text("Done"), button:has-text("Done")')
await p.waitForTimeout(500)
check((await p.locator('[data-testid=estate-grid]').count()) === 0, 'Done closes the editor')

// the cottage is solid: stand in its middle and get pushed out
await C('teleport', -38, 55, 0)
await p.waitForTimeout(800)
const w = await C('world')
check(Math.abs(w.x + 38) > 1.4 || Math.abs(w.z - 55) > 1.4, `can't stand inside your cottage (pushed to ${w.x}, ${w.z})`)
if (SHOTS) {
  await C('shotCam', { cam: [-47, 9, 46], look: [-38, 0.5, 56], fov: 55 })
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `${SHOTS}/estate-built.jpg`, quality: 80 })
  await C('shotCam', null)
}

// one plot per player
await at(-48.4, 56, Math.PI / 2 + Math.PI)
check((await promptId()) === 'plot:B', `Plot B prompt (got ${await promptId()})`)
await p.keyboard.press('e')
await p.waitForSelector('[data-testid=dialogue]', { timeout: 4000 }).catch(() => {})
await p.waitForTimeout(1800) // the line types itself out
check(((await p.textContent('[data-testid=dialogue]').catch(() => '')) || '').includes('one plot per Chad'), 'a second plot is refused')
await talkThrough()

// persistence
const before = await est()
await p.reload({ waitUntil: 'networkidle' })
await p.waitForSelector('[data-testid=enter-muted]', { timeout: 60000 })
await p.click('[data-testid=enter-muted]')
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 90000 }).catch(() => {})
const after = await est()
check(after.plot === 'A' && JSON.stringify(after.pieces) === JSON.stringify(before.pieces), `plot + build survive a reload (${after.pieces.length} pieces)`)
await at(-45.6, 56, Math.PI / 2)
check((await promptId()) === 'plot:A', 'your gate still opens the editor')

const lost = errs.some((e) => e.includes('context lost'))
if (lost) console.log('  WARN  WebGL context lost during the run (machine memory) — shader errors after it ignored')
const real = errs.filter((e) => !(lost && (e.includes('context lost') || e.includes('WebGLProgram'))))
check(!real.length, `no page errors (${JSON.stringify(real.slice(0, 3))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
