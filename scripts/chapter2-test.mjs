// Chapter 2 — Whispers in the Wood: after the sigil, Grim (Haunted Quarter) → the Elder Oak → the moonstone.
// Steps only count in order, each is saved once, the reward lands, and the objective moves on.
//   URL=http://localhost:4318/chadverse/ [Q=low] node scripts/chapter2-test.mjs
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
  await p.fill('#chad-name', 'Oathfinder')
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
  const disc = ['intro_seen', 'q1_start', 'q1_lantern_bridge', 'q1_lantern_square', 'q1_lantern_citadel', 'q1_sigil', 'talk_coach']
  localStorage.setItem(k, JSON.stringify({ version: 2, character: null, progress: { discoveries: disc, gymRuns: 1, xp: 200, coins: 100 }, settings: { quality: q, muted: true } }))
}, [KEY, process.env.Q || 'low'])
await p.reload({ waitUntil: 'networkidle' })
await enterWorld()
check((await obj()).includes('Ask Grim'), `objective: ask Grim (${await obj()})`)

// the moonstone before the oak: just runes you can't read
await at(-93, -55.2, Math.PI)
check((await promptId()) === 'moonstone', `moonstone prompt (got ${await promptId()})`)
await p.keyboard.press('e')
await talkThrough()
check(!(await C('save')).progress.discoveries.includes('q2_stone'), 'moonstone does nothing before the quest')

// Grim
await at(-88.2, 21.6, -Math.PI / 2)
check((await promptId()) === 'gravedig', `Grim's prompt (got ${await promptId()})`)
await p.keyboard.press('e')
await talkThrough('I’ll find the Elder Oak')
await p.waitForTimeout(400)
check((await C('save')).progress.discoveries.includes('q2_start'), 'chapter 2 accepted + saved')
check((await obj()).includes('Elder Oak'), `objective: the Elder Oak (${await obj()})`)

// moonstone still waits for the oak
await at(-93, -55.2, Math.PI)
await p.keyboard.press('e')
await talkThrough()
check(!(await C('save')).progress.discoveries.includes('q2_stone'), 'moonstone waits until the oak has spoken')

// the oak
const x0 = (await C('save')).progress.xp
await at(-70, -55.6, Math.PI)
check((await promptId()) === 'oak', `Elder Oak prompt (got ${await promptId()})`)
await p.keyboard.press('e')
await p.waitForTimeout(400)
const s1 = await C('save')
check(s1.progress.discoveries.includes('q2_oak') && s1.progress.xp === x0 + 20, 'the oak speaks (+20 XP)')
await talkThrough()
check((await obj()).includes('moonstone'), `objective: the moonstone (${await obj()})`)

// the moonstone
const c1 = (await C('save')).progress.coins
await at(-93, -55.2, Math.PI)
await p.keyboard.press('e')
await p.waitForTimeout(400)
const s2 = await C('save')
check(s2.progress.discoveries.includes('q2_stone') && s2.progress.xp === s1.progress.xp + 60 && s2.progress.coins === c1 + 60, `chapter 2 complete: +60 XP, +60 coins (${c1} → ${s2.progress.coins})`)
const said = (await p.textContent('[data-testid=dialogue]').catch(() => '')) || ''
check(said.length > 0, 'the oath is read out')
await talkThrough()
check(!(await obj()).includes('moonstone') && !(await obj()).includes('Grim'), `objective moves on (${await obj()})`)
// doing it again pays nothing
await p.keyboard.press('e')
await talkThrough()
check((await C('save')).progress.xp === s2.progress.xp, 'no second reward')

const lost = errs.some((e) => e.includes('context lost'))
if (lost) console.log('  WARN  WebGL context lost during the run (machine memory) — shader errors after it ignored')
const real = errs.filter((e) => !(lost && (e.includes('context lost') || e.includes('WebGLProgram'))))
check(!real.length, `no page errors (${JSON.stringify(real.slice(0, 3))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
