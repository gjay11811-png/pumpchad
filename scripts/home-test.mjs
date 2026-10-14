// Your cottage: a cottage on your plot gets a working front door; inside, the trophy wall shows what you've earned
// (and what's missing); leaving puts you back on your step; turning the cottage moves its door with it.
//   URL=http://localhost:4318/chadverse/ [Q=low] [SHOTS=dir] node scripts/home-test.mjs
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
  await p.fill('#chad-name', 'Homebody')
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
const seed = async (r) => {
  await p.goto(BASE, { waitUntil: 'networkidle' })
  await p.evaluate(([k, q, r]) => {
    localStorage.clear()
    const disc = ['intro_seen', 'q1_start', 'q1_lantern_bridge', 'q1_lantern_square', 'q1_lantern_citadel', 'q1_sigil', 'fish_perch', 'talk_coach']
    localStorage.setItem(k, JSON.stringify({ version: 2, character: null, progress: { discoveries: disc, gymRuns: 1, coins: 50, estate: { plot: 'A', pieces: [{ k: 'cottage', x: 2, z: 1, r }, { k: 'flowers', x: 0, z: 0, r: 0 }] } }, settings: { quality: q, muted: true } }))
  }, [KEY, process.env.Q || 'low', r])
  await p.reload({ waitUntil: 'networkidle' })
  await enterWorld()
}
await seed(0)
// cottage centre (-38, 55), door faces south (+z): the step is ~2.45 m out
await at(-38, 57.5, Math.PI)
check((await promptId()) === 'house:home', `your cottage's door prompt (got ${await promptId()})`)
await p.keyboard.press('e')
await p.waitForFunction(() => window.__chadverse.phase === 'interior' && window.__chadverse.interior(), null, { timeout: 30000 }).catch(() => {})
const i0 = await C('interior')
check(i0?.id === 'home', `inside your cottage (${i0?.id})`)
if (SHOTS) {
  await p.waitForTimeout(800)
  await p.screenshot({ path: `${SHOTS}/home-inside.jpg`, quality: 80 })
}
// the trophy wall
await C('interiorTeleport', 2.4 - 0.9, 0.2, -Math.PI / 2 + Math.PI, 0)
await p.waitForTimeout(500)
const tp = await p.evaluate(() => document.querySelector('[data-testid=prompt]')?.textContent ?? '')
check(tp.includes('trophy'), `trophy wall prompt (${tp})`)
await p.keyboard.press('e')
await p.waitForSelector('[data-testid=dialogue]', { timeout: 4000 }).catch(() => {})
await p.waitForTimeout(2500)
const t1 = (await p.textContent('[data-testid=dialogue]').catch(() => '')) || ''
check(t1.includes('Golden Sigil') && t1.includes('Chad Press cup') && t1.includes('Pumpkinseed Perch'), 'the wall shows what you earned (sigil, gym cup, perch)')
if (SHOTS) {
  await C('interiorTeleport', 0.2, 0.4, Math.PI / 2, 0)
  await talkThrough()
  await p.waitForTimeout(600)
  await p.screenshot({ path: `${SHOTS}/home-trophies.jpg`, quality: 80 })
} else await talkThrough()
// leave
await C('interiorTeleport', 0, 6 / 2 - 0.9, 0, 0)
await p.waitForTimeout(500)
await p.keyboard.press('e')
await p.waitForFunction(() => window.__chadverse.phase === 'world' && window.__chadverse.world(), null, { timeout: 60000 }).catch(() => {})
const w = await C('world')
check(Math.hypot(w.x + 38, w.z - 58.2) < 1.2, `back out on your step (${w.x}, ${w.z})`)

// a cottage turned to face west: the door goes with it
await seed(1)
await at(-38 - 2.45, 55, Math.PI / 2)
check((await promptId()) === 'house:home', `turned cottage: door prompt on the west side (got ${await promptId()})`)
await at(-38, 57.5, Math.PI)
check((await promptId()) !== 'house:home', 'and no longer on the south side')

const lost = errs.some((e) => e.includes('context lost'))
if (lost) console.log('  WARN  WebGL context lost during the run (machine memory) — shader errors after it ignored')
const real = errs.filter((e) => !(lost && (e.includes('context lost') || e.includes('WebGLProgram'))))
check(!real.length, `no page errors (${JSON.stringify(real.slice(0, 3))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
