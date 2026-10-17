// The LARGE plots in the browser (ordinary mouse clicks + key presses, SIMULATED headless): an old (v1) furnished save is migrated and shows in the world;
// a new owner buys a plot at its gate, builds a manor + double garage + driveway + gates + garden in the real editor, and it stands in the world and persists.
//   OUT=dir node scripts/estates-large-test.mjs
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { PLOTS, plotGate, plotSize, ESTATE_VERSION } from '../src/game/estates.ts'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const OUT = process.env.OUT || 'tmp-viewer/estates'
mkdirSync(OUT, { recursive: true })
const KEY = 'pumpchad.chadverse.save'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] })
let fails = 0
const check = (ok, msg) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!ok) fails++
}
async function session(seed, fn) {
  const p = await b.newPage({ viewport: { width: 960, height: 620 } })
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message))
  await p.goto(BASE, { waitUntil: 'networkidle' })
  await p.evaluate(([k, s]) => {
    localStorage.clear()
    localStorage.setItem(k, JSON.stringify(s))
  }, [KEY, seed])
  await p.reload({ waitUntil: 'networkidle' })
  await p.click('[data-testid=enter-muted]')
  await p.waitForSelector('[role=tablist]')
  await p.getByRole('tab', { name: 'Name' }).click()
  await p.fill('#chad-name', 'Homeowner')
  await p.getByRole('button', { name: /Enter Chad Square/ }).click()
  await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
  await fn(p, errs)
  await p.close()
}
const C = (p, fn, ...a) => p.evaluate(([f, a]) => window.__chadverse[f](...a), [fn, a])
const frame = async (p) => {
  const n0 = await p.evaluate(() => window.__chadverse.renders())
  await p.evaluate(() => window.__chadverse.advance(0.05))
  await p.waitForFunction((n) => window.__chadverse.renders() >= n + 2, n0, { timeout: 60000, polling: 40 })
}
const view = async (p, plot, name, kind) => {
  const cx = plot.x0 + plotSize.w / 2
  const cz = plot.z0 + plotSize.d / 2
  const street = plot.gate === 's' ? 1 : -1
  const cam = kind === 'high' ? [cx - 14, 30, cz + street * 26] : [cx + 3, 7, cz + street * 22]
  await p.evaluate(([c, l]) => window.__chadverse.shotCam({ cam: c, look: l, fov: 46 }), [cam, [cx, kind === 'high' ? 0 : 3, cz]])
  await frame(p)
  await p.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 82 })
  await p.evaluate(() => window.__chadverse.shotCam(null))
}

/* 1. an OLD furnished save (v1: no version, 6 x 5 plot) */
const old = { version: 2, character: null, progress: { discoveries: ['intro_seen'], coins: 300, estate: { plot: 'C', pieces: [{ k: 'cottage', x: 2, z: 1, r: 1 }, { k: 'tree', x: 5, z: 4, r: 0 }, { k: 'flowers', x: 0, z: 3, r: 0 }, { k: 'bench', x: 4, z: 0, r: 0 }, { k: 'lamp', x: 0, z: 0, r: 0 }, { k: 'hedge', x: 3, z: 4, r: 0 }] } }, settings: { quality: 'low', muted: true } }
if (!process.env.SKIP1) await session(old, async (p, errs) => {
  const plot = PLOTS.find((q) => q.id === 'C')
  const e = (await C(p, 'save')).progress.estate
  check(e.plot === 'C' && e.v === ESTATE_VERSION && e.pieces.length === 6, `old furnished plot C migrated to layout v${e.v}: ${e.pieces.length}/6 pieces kept (the plot is ${plotSize.w} x ${plotSize.d} m now)`)
  const c = e.pieces.find((q) => q.k === 'cottage')
  check(!!c, `its cottage came through (r=${c?.r}; the old gate was west, the new one is ${plot.gate})`)
  const g = plotGate(plot)
  await C(p, 'teleport', g.x, g.z + (plot.gate === 'n' ? -1.2 : 1.2), plot.gate === 'n' ? 0 : Math.PI)
  await p.waitForTimeout(3500)
  await p.evaluate(() => window.__chadverse.freeze(true))
  const w = await C(p, 'world')
  check(w.prompt === 'plot:C', `at the gate the prompt is the build prompt (${w.prompt})`)
  await view(p, plot, 'old-plot-after-migration', 'ground')
  check(errs.length === 0, `no page errors (${JSON.stringify(errs.slice(0, 2))})`)
})

/* 2. a NEW owner builds the example mansion in the real editor */
const fresh = { version: 2, character: null, progress: { discoveries: ['intro_seen'], coins: 600 }, settings: { quality: 'low', muted: true } }
await session(fresh, async (p, errs) => {
  const plot = PLOTS.find((q) => q.id === 'H14') // street on the north
  const g = plotGate(plot)
  await C(p, 'teleport', g.x, g.z - 1.2, 0)
  await p.waitForFunction(() => window.__chadverse.world()?.prompt != null, null, { timeout: 8000 }).catch(() => {})
  check((await C(p, 'world')).prompt === `plot:${plot.id}`, `walking up to ${plot.name} offers Buy (${(await C(p, 'world')).prompt})`)
  await p.keyboard.press('e')
  for (let i = 0; i < 10; i++) {
    if (await p.getByRole('button', { name: 'Buy it · 120 coins' }).isVisible().catch(() => false)) {
      await p.getByRole('button', { name: 'Buy it · 120 coins' }).click()
      break
    }
    await p.click('[data-testid=dialogue]', { timeout: 1500 }).catch(() => {})
    await p.waitForTimeout(250)
  }
  await p.waitForSelector('[data-testid=estate-grid]', { timeout: 8000 }).catch(async () => {
    await p.screenshot({ path: `${OUT}/debug.jpg` })
    console.log('   page text:', (await p.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300))
    throw new Error('editor did not open')
  })
  const cells = await p.locator('[data-cell]').count()
  check(cells === 11 * 13, `the editor shows the ${cells}-cell grid (11 x 13)`)
  await p.screenshot({ path: `${OUT}/editor-empty.jpg`, type: 'jpeg', quality: 80 })
  // the street is NORTH on this plot: build with the door facing north (rotation 2): manor, garage beside it, drive to the street, gates, path, garden
  const pick = (k) => p.click(`[data-kind=${k}]`)
  const rot = async (n) => {
    for (let i = 0; i < n; i++) await p.click('[data-testid=estate-rot-new]')
  }
  const cell = (x, z) => p.click(`[data-cell="${x},${z}"]`, { force: true })
  // (picking the tool that is already selected would switch it off, so each kind is picked once and then clicked onto every cell)
  await pick('manor')
  await rot(2)
  await cell(1, 3)
  await pick('garage')
  await cell(7, 4)
  await pick('drive')
  for (let z = 0; z <= 3; z++) await cell(8, z)
  await pick('gates')
  await cell(3, 0)
  await pick('path')
  for (const [x, z] of [[3, 1], [4, 1], [3, 2], [4, 2]]) await cell(x, z)
  await pick('tree')
  await cell(0, 2)
  await cell(10, 11)
  await pick('fountain')
  await cell(3, 10)
  await pick('terrace')
  await cell(1, 8)
  await p.waitForTimeout(300)
  const est = (await C(p, 'save')).progress.estate
  const kinds = est.pieces.reduce((a, q) => ((a[q.k] = (a[q.k] || 0) + 1), a), {})
  check(est.plot === plot.id && kinds.manor === 1 && kinds.garage === 1 && kinds.drive === 4 && est.pieces.length >= 14, `built in the editor: ${JSON.stringify(kinds)} (${est.pieces.length} pieces)`)
  const coins = (await C(p, 'save')).progress.coins
  check(coins < 600 - 120 - 240 - 90, `pieces cost coins (${coins} left of 600)`)
  await p.screenshot({ path: `${OUT}/editor-built.jpg`, type: 'jpeg', quality: 80 })
  await p.click('button:has-text("Done")')
  await p.waitForTimeout(2500)
  await p.evaluate(() => window.__chadverse.freeze(true))
  await view(p, plot, 'new-mansion-ground', 'ground')
  await view(p, plot, 'new-mansion-high', 'high')
  check(errs.length === 0, `no page errors (${JSON.stringify(errs.slice(0, 2))})`)
  await p.waitForTimeout(1500)
  const saved = await p.evaluate((k) => JSON.parse(localStorage.getItem(k)).progress.estate, KEY)
  check(saved.v === ESTATE_VERSION && saved.pieces.length === est.pieces.length, 'the build persisted in the save (layout v2)')
})
await b.close()
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
process.exit(fails ? 1 : 0)
