// Buy and build on a Chadville Heights plot whose gate faces NORTH (and one facing south): purchase, editor lane strip, place a cottage, reload keeps it,
// and an old save that owns plot A still loads. SIMULATED browser.
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1000, height: 700 } })
let fails = 0
const check = (ok, msg) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!ok) fails++
}
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
const SAVE = (extra) => JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'], coins: 600, xp: 500, ...extra }, settings: { quality: 'low', muted: true } })
await p.addInitScript((s) => localStorage.getItem('pumpchad.chadverse.save') === null && localStorage.setItem('pumpchad.chadverse.save', s), SAVE({}))
await p.goto(BASE)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Builder')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const wait = (ms) => p.waitForTimeout(ms)
// plot gate of a lane-A-south plot (gate faces north): H14 = row 2 slot 4: x0 = -71 - 13*4 - 12 = -135, z0 = 40 → gate (-129, 39.1)
await p.evaluate(() => window.__chadverse.teleport(-129, 38.2, 0))
await wait(900)
const pr = (await p.evaluate(() => window.__chadverse.world())).prompt
check(pr === 'plot:H14', `standing at the north-facing gate of H14 offers it (${pr})`)
await p.keyboard.press('e')
await wait(800)
console.log('  dialogue:', (await p.locator('[role=dialog]').allInnerTexts()).join(' | ').slice(0, 300), '| coins in save:', await p.evaluate(() => JSON.parse(localStorage.getItem('pumpchad.chadverse.save')).progress.coins))
for (let i = 0; i < 6 && (await p.getByRole('button', { name: /Buy it/ }).count()) === 0; i++) {
  console.log('  buttons:', (await p.locator('[role=dialog] button').allInnerTexts()).join(' / '))
  await p.keyboard.press('e')
  await wait(500)
}
const buy = p.getByRole('button', { name: /Buy it/ })
check((await buy.count()) === 1, 'the purchase dialogue offers Buy')
await buy.click()
await wait(1200)
const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('pumpchad.chadverse.save')))
check(saved.progress.estate?.plot === 'H14', `the plot is owned and saved (${saved.progress.estate?.plot})`)
// open the editor at the gate
await p.keyboard.press('e')
await wait(900)
check((await p.locator('[data-testid=estate-grid]').count()) === 1, 'the plot editor opens')
const laneText = await p.locator('text=lane · gate').count()
check(laneText === 1, 'the editor shows the lane / gate strip once')
const strip = await p.locator('text=lane · gate').first().evaluate((el) => {
  const r = el.getBoundingClientRect()
  const g = document.querySelector('[data-testid=estate-grid]').getBoundingClientRect()
  return { above: r.bottom <= g.top + 2, below: r.top >= g.bottom - 2, left: r.right <= g.left + 2, right: r.left >= g.right - 2 }
})
check(strip.above, `a north-facing gate puts the lane strip ABOVE the grid (${JSON.stringify(strip)})`)
// place a cottage: choose the Cottage tool then tap a cell
await p.locator('[data-kind=cottage]').click()
await p.locator('[data-cell="2,2"]').click()
await wait(500)
await p.getByRole('button', { name: 'Done', exact: true }).first().click()
await wait(900)
const s2 = await p.evaluate(() => JSON.parse(localStorage.getItem('pumpchad.chadverse.save')))
check((s2.progress.estate?.pieces?.length ?? 0) >= 1, `a cottage is placed and saved (${s2.progress.estate?.pieces?.length} pieces)`)
// reload: still owned
await p.reload()
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist], [data-testid=enter-world], button')
const s3 = await p.evaluate(() => JSON.parse(localStorage.getItem('pumpchad.chadverse.save')))
check(s3.progress.estate?.plot === 'H14' && s3.progress.estate.pieces.length >= 1, 'the plot and its cottage survive a reload')
// an old save that owns plot A still loads
await p.evaluate((s) => localStorage.setItem('pumpchad.chadverse.save', s), SAVE({ estate: { plot: 'A', pieces: [{ k: 'cottage', x: 2, z: 1, r: 0 }, { k: 'tree', x: 5, z: 4, r: 0 }] } }))
await p.reload()
await p.waitForSelector('[data-testid=enter-muted]')
const s4 = await p.evaluate(() => JSON.parse(localStorage.getItem('pumpchad.chadverse.save')))
check(s4.progress.estate.plot === 'A' && s4.progress.estate.pieces.length === 2, 'an older save with plot A is untouched by the new plots')
check(!errs.length, `no page errors (${JSON.stringify(errs.slice(0, 2))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
