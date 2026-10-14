// Fishing at Moonlight Lake: the pier prompt opens it; an automated angler plays a full round the way a person would
// (cast, wait, strike on the bite, hold/release by line tension); results, record, XP and the fish log are saved;
// striking early spooks the fish; Fish again resets; Esc leaves.
//   URL=http://localhost:4318/chadverse/ [Q=low] node scripts/fishing-test.mjs
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
  await p.fill('#chad-name', 'Angler')
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
await at(98, 33.9, Math.PI)
check((await promptId()) === 'fishing', `pier prompt (got ${await promptId()})`)
await p.keyboard.press('e')
await p.waitForSelector('[data-testid=fish]', { timeout: 5000 }).catch(() => {})
check((await p.locator('[data-testid=fish]').count()) === 1, 'fishing panel opens')
const st = () => p.evaluate(() => { const e = document.querySelector('[data-testid=fish]'); return e ? { phase: e.getAttribute('data-phase'), tension: +e.getAttribute('data-tension'), cast: +e.getAttribute('data-cast') } : null })
const x0 = (await C('save')).progress.xp

// play a round
let holding = false
const t0 = Date.now()
let seenReel = false
const powers = []
while (Date.now() - t0 < 150000) {
  const s = await st()
  if (!s || s.phase === 'done') break
  if (s.phase === 'aim') { await p.waitForTimeout(200 + Math.random() * 600); await p.keyboard.press(' '); await p.waitForTimeout(60); powers.push(await p.evaluate(() => document.querySelector('[data-testid=fish]')?.getAttribute('data-power'))) }
  else if (s.phase === 'bite') { await p.keyboard.down(' '); holding = true }
  else if (s.phase === 'reel') {
    if (!seenReel && process.env.SHOTS) { await p.waitForTimeout(500); await p.screenshot({ path: `${process.env.SHOTS}/fish-reel.jpg`, quality: 80 }) }
    seenReel = true
    if (s.tension < 0.5 && !holding) { await p.keyboard.down(' '); holding = true }
    else if (s.tension >= 0.5 && holding) { await p.keyboard.up(' '); holding = false }
  } else if (holding) { await p.keyboard.up(' '); holding = false }
  await p.waitForTimeout(40)
}
if (holding) await p.keyboard.up(' ')
const end = await st()
if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/fish-done.jpg`, quality: 80 })
check(end?.phase === 'done' && end.cast === 5, `a full round of 5 casts (phase ${end?.phase}, cast ${end?.cast})`)
check(seenReel, 'got at least one bite and reeled')
const caught = await p.locator('[data-testid=fish-catches] li .flex-1').allTextContents()
const res = (await p.textContent('[data-testid=fish-results]').catch(() => '')) || ''
const score = parseInt(res)
console.log(`  (caught: ${caught.join(', ') || 'nothing'} · ${score} points · cast powers ${powers.join(' ')})`)
const s1 = await C('save')
check(s1.progress.records.fishing === score, `record saved (${s1.progress.records.fishing})`)
check(score > 0 ? s1.progress.xp > x0 && s1.progress.xp - x0 <= 60 : s1.progress.xp === x0, `XP from the score, capped (+${s1.progress.xp - x0})`)
check(caught.length === 0 || caught.every((n) => s1.progress.discoveries.some((d) => d.startsWith('fish_'))), 'new species added to the fish log')

// round 2: strike too early → spooked
await p.click('[data-testid=fish-again]')
await p.waitForTimeout(300)
check((await st())?.cast === 0, 'Fish again starts a fresh round')
await p.keyboard.press(' ')
await p.waitForTimeout(150)
await p.keyboard.press(' ')
await p.waitForTimeout(300)
check(((await p.textContent('[data-testid=fish-msg]')) || '').includes('spooked') && (await st())?.cast === 1, 'striking before the bite spooks the fish (costs the cast)')

// leave
await p.keyboard.press('Escape')
await p.waitForTimeout(400)
check((await p.locator('[data-testid=fish]').count()) === 0, 'Esc leaves fishing')
const w0 = await C('world')
await hold('s', 600)
const w1 = await C('world')
check(Math.hypot(w1.x - w0.x, w1.z - w0.z) > 0.3, 'can walk again afterwards')

// journal fish log
await p.keyboard.press('m')
await p.waitForSelector('[data-testid=map]', { timeout: 5000 }).catch(() => {})
await p.getByRole('radio', { name: 'Journal' }).click()
const log = (await p.textContent('[data-quest=fish]').catch(() => '')) || ''
check(log.includes('Fish Log') && (caught.length === 0 || caught.some((n) => log.includes(n))), 'journal fish log lists your catches')
await p.keyboard.press('Escape')

const lost = errs.some((e) => e.includes('context lost'))
if (lost) console.log('  WARN  WebGL context lost during the run (machine memory) — shader errors after it ignored')
const real = errs.filter((e) => !(lost && (e.includes('context lost') || e.includes('WebGLProgram'))))
check(!real.length, `no page errors (${JSON.stringify(real.slice(0, 3))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
