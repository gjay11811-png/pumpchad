// Map + journal: M opens it, your position + the tracked objective show, filters hide/show markers, places reached
// on foot unlock fast travel (others don't), travel moves you there, the journal lists quests with steps.
//   URL=http://localhost:4318/chadverse/ [Q=low] [SHOTS=dir] node scripts/map-test.mjs
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
  await p.fill('#chad-name', 'Cartographer')
  await p.getByRole('button', { name: /Enter Chad Square/ }).click()
  await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 90000 })
}

const hold = async (key, ms) => {
  await p.keyboard.down(key)
  await p.waitForTimeout(ms)
  await p.keyboard.up(key)
  await p.waitForTimeout(250)
}
const SHOTS = process.env.SHOTS || null
await p.goto(BASE, { waitUntil: 'networkidle' })
await p.evaluate(([k, q]) => {
  localStorage.clear()
  localStorage.setItem(k, JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'] }, settings: { quality: q, muted: true } }))
}, [KEY, process.env.Q || 'low'])
await p.reload({ waitUntil: 'networkidle' })
await enterWorld()

// discover the lake on foot (the zone check runs a few times a second), then come back
await C('teleport', 80, 40, Math.PI / 2)
await p.waitForTimeout(1200)
check((await C('save')).progress.discoveries.includes('visit_lake'), 'reached Moonlight Lake on foot')
await C('teleport', 0, 62, Math.PI)
await p.waitForTimeout(800)

await p.keyboard.press('m')
await p.waitForSelector('[data-testid=map]', { timeout: 5000 }).catch(() => {})
check((await p.locator('[data-testid=map]').count()) === 1, 'M opens the map')
check(((await p.textContent('[data-testid=map-tracked]').catch(() => '')) || '').includes('Goldie'), 'tracks the current objective (Goldie)')
check((await p.locator('[data-testid=map-target]').count()) === 1 && (await p.locator('[data-testid=map-player]').count()) === 1, 'objective + your position drawn')
const w0 = await C('world')
await hold('w', 400)
check(Math.hypot((await C('world')).x - w0.x, (await C('world')).z - w0.z) < 0.05, 'the world is paused under the map')
if (SHOTS) await p.screenshot({ path: `${SHOTS}/map-desktop.jpg`, quality: 80 })

// filters
await p.click('[data-filter=shop]')
check((await p.locator('[data-landmark=fits]').count()) === 0, 'Shops filter hides shops')
await p.click('[data-filter=shop]')
check((await p.locator('[data-landmark=fits]').count()) === 1, 'and shows them again')

// travel: locked for places not reached, open for the lake
await p.click('[data-landmark=forest]', { force: true })
check(((await p.textContent('[data-testid=map-selected]')) || '').includes('Undiscovered') && (await p.locator('[data-testid=map-travel]').count()) === 0, 'undiscovered place: no travel')
await p.click('[data-landmark=lake]', { force: true })
check((await p.locator('[data-testid=map-travel]').count()) === 1, 'discovered place offers Travel')
await p.click('[data-testid=map-travel]')
await p.waitForTimeout(800)
const t = await C('world')
check((await p.locator('[data-testid=map]').count()) === 0 && Math.hypot(t.x - 74, t.z - 36.25) < 1.5, `fast travel to Moonlight Lake (${t.x}, ${t.z})`)
await hold('w', 600)
const t2 = await C('world')
check(Math.hypot(t2.x - t.x, t2.z - t.z) > 0.3, 'can move again after travelling')

// journal
await p.keyboard.press('m')
await p.waitForSelector('[data-testid=map]', { timeout: 5000 }).catch(() => {})
await p.getByRole('radio', { name: 'Journal' }).click().catch(async () => p.getByRole('button', { name: 'Journal' }).click())
await p.waitForSelector('[data-testid=journal]', { timeout: 3000 }).catch(() => {})
const q1 = (await p.textContent('[data-quest=q1]').catch(() => '')) || ''
check(q1.includes('Guardian Lanterns') && q1.includes('In progress') && q1.includes('Talk to Goldie'), 'journal: the opening adventure with its steps')
const wl = (await p.textContent('[data-quest=wilds]').catch(() => '')) || ''
check(wl.includes('Moonlight Lake'), 'journal: districts beyond the old town')
await p.keyboard.press('Escape')
await p.waitForTimeout(400)
check((await p.locator('[data-testid=journal]').count()) === 0, 'Esc closes it')

// phone portrait layout
if (SHOTS) {
  await p.setViewportSize({ width: 390, height: 664 })
  await p.waitForTimeout(500)
  await p.keyboard.press('m')
  await p.waitForTimeout(700)
  await p.screenshot({ path: `${SHOTS}/map-phone.jpg`, quality: 80 })
  await p.keyboard.press('Escape')
}

const lost = errs.some((e) => e.includes('context lost'))
if (lost) console.log('  WARN  WebGL context lost during the run (machine memory) — shader errors after it ignored')
const real = errs.filter((e) => !(lost && (e.includes('context lost') || e.includes('WebGLProgram'))))
check(!real.length, `no page errors (${JSON.stringify(real.slice(0, 3))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
