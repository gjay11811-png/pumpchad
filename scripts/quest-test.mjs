// The opening adventure: Goldie at the gateway → relight the three Guardian Lanterns → claim the Golden Sigil at
// the Citadel doors (XP + coins, points to the castle). Every step saved; nothing repeats after a reload.
//   URL=http://localhost:4318/chadverse/ [Q=low] node scripts/quest-test.mjs
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
  await p.fill('#chad-name', 'Lamplighter')
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
await p.goto(BASE, { waitUntil: 'networkidle' })
await p.evaluate(([k, q]) => {
  localStorage.clear()
  localStorage.setItem(k, JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'] }, settings: { quality: q, muted: true } }))
}, [KEY, process.env.Q || 'low'])
await p.reload({ waitUntil: 'networkidle' })
await enterWorld()
check((await obj()).includes('Talk to Goldie'), `first objective: Goldie (${await obj()})`)

// a lantern before the quest: just a cold lantern + a pointer to Goldie
await at(3.4, 36.8, Math.PI / 2)
check((await promptId()) === 'lantern:bridge', `cold lantern prompt on Chad Bridge (got ${await promptId()})`)
await p.keyboard.press('e')
await talkThrough()
check(!(await C('save')).progress.discoveries.includes('q1_lantern_bridge'), 'cannot relight before Goldie asks')

// Goldie
await at(-2.4, 61.8, -2.2)
check((await promptId()) === 'greeter', `Goldie's prompt (got ${await promptId()})`)
await p.keyboard.press('e')
await talkThrough('I’ll relight them')
await p.waitForTimeout(400)
check((await C('save')).progress.discoveries.includes('q1_start'), 'quest accepted + saved')
check((await obj()).includes('Guardian Lanterns 0/3'), `objective: lanterns 0/3 (${await obj()})`)

// the three lanterns
const spots = [['bridge', 3.4, 36.8, Math.PI / 2], ['square', -6.0, 7.4, -Math.PI / 2], ['citadel', -3.4, -16.6, -Math.PI / 2]]
let xp = (await C('save')).progress.xp
for (const [id, x, z, yaw] of spots) {
  await at(x, z, yaw)
  const pid = await promptId()
  check(pid === `lantern:${id}`, `${id} lantern prompt (got ${pid})`)
  await p.keyboard.press('e')
  await p.waitForTimeout(500)
  const s = await C('save')
  check(s.progress.discoveries.includes(`q1_lantern_${id}`) && s.progress.xp === xp + 10, `${id} lantern relit (+10 XP)`)
  xp = s.progress.xp
  check((await promptId()) !== `lantern:${id}`, `${id}: a lit lantern can't be used again`)
}
check((await obj()).includes('Golden Sigil'), `objective: the sigil (${await obj()})`)

// the sigil
const c0 = (await C('save')).progress.coins
await at(0, -21.0, Math.PI)
check((await promptId()) === 'sigil', `sigil prompt at the Citadel doors (got ${await promptId()})`)
await p.keyboard.press('e')
await p.waitForTimeout(400)
const s1 = await C('save')
check(s1.progress.discoveries.includes('q1_sigil') && s1.progress.xp === xp + 50 && s1.progress.coins === c0 + 50, `sigil: +50 XP, +50 coins (${c0} → ${s1.progress.coins})`)
const said = await p.textContent('[data-testid=dialogue]').catch(() => '')
check(said.includes('Golden Sigil'), 'the sigil speaks (points to the Citadel)')
await talkThrough()
check((await obj()).includes('Coach Gourdon'), `then the city opens up (${await obj()})`)
check((await promptId()) !== 'sigil', 'sigil gone once claimed')

// no repeat after a reload
await p.reload({ waitUntil: 'networkidle' })
await p.waitForSelector('[data-testid=enter-muted]', { timeout: 90000 })
await p.click('[data-testid=enter-muted]')
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 90000 }).catch(() => {})
if ((await p.evaluate(() => window.__chadverse.phase)) === 'world') {
  await at(-2.4, 61.8, -2.2)
  await p.keyboard.press('e')
  await p.waitForSelector('[data-testid=dialogue]', { timeout: 5000 }).catch(() => {})
  const g = await p.textContent('[data-testid=dialogue]').catch(() => '')
  check(!g.includes('Guardian Lanterns have gone cold'), 'Goldie doesn’t ask again after a reload')
  await talkThrough()
  await at(-6.0, 7.4, -Math.PI / 2)
  check((await promptId()) !== 'lantern:square', 'lanterns stay lit after a reload')
} else check(false, 'back in the world after reload')

const lost = errs.some((e) => e.includes('context lost'))
if (lost) console.log('  WARN  WebGL context lost during the run (machine memory) — shader errors after it ignored')
const real = errs.filter((e) => !(lost && (e.includes('context lost') || e.includes('WebGLProgram'))))
check(!real.length, `no page errors (${JSON.stringify(real.slice(0, 3))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
