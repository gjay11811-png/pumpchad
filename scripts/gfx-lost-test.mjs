// GPU context loss: force it with WEBGL_lose_context → the recovery screen shows; a restore hides it; Reload brings
// the player back with their progress intact (the save is written on every change).
//   URL=http://localhost:4318/chadverse/ [Q=low] node scripts/gfx-lost-test.mjs
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
  await p.fill('#chad-name', 'Survivor')
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
  localStorage.setItem(k, JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'], xp: 120, coins: 60 }, settings: { quality: q, muted: true } }))
}, [KEY, process.env.Q || 'low'])
await p.reload({ waitUntil: 'networkidle' })
await enterWorld()
const lose = (fn) => p.evaluate((fn) => {
  // keep the extension from before the loss: a lost context hands out no extensions
  if (!window.__loseExt) {
    const c = document.querySelector('canvas')
    const gl = c.getContext('webgl2') || c.getContext('webgl')
    window.__loseExt = gl && gl.getExtension('WEBGL_lose_context')
  }
  const ext = window.__loseExt
  if (!ext) return false
  ext[fn]()
  return true
}, fn)
check(await lose('loseContext'), 'context loss forced')
await p.waitForSelector('[data-testid=gfx-lost]', { timeout: 5000 }).catch(() => {})
check((await p.locator('[data-testid=gfx-lost]').count()) === 1, 'recovery screen shows')
check(await lose('restoreContext'), 'context restore requested')
await p.waitForTimeout(1500)
check((await p.locator('[data-testid=gfx-lost]').count()) === 0, 'a restored context hides it')
if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/after-restore.jpg`, quality: 75 })
// lose it again, and use Reload
await lose('loseContext')
await p.waitForSelector('[data-testid=gfx-lost]', { timeout: 5000 }).catch(() => {})
await Promise.all([p.waitForNavigation({ timeout: 30000 }).catch(() => {}), p.click('[data-testid=gfx-lost] button')])
await p.waitForSelector('[data-testid=enter-muted]', { timeout: 60000 })
await p.click('[data-testid=enter-muted]')
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 90000 }).catch(() => {})
const s = await C('save')
check((await p.evaluate(() => window.__chadverse.phase)) === 'world' && s.character?.name === 'Survivor' && s.progress.xp >= 120, `Reload: back in the world, progress intact (xp ${s.progress.xp})`)
check((await p.locator('[data-testid=gfx-lost]').count()) === 0, 'no recovery screen after reload')
const unexpected = errs.filter((e) => !e.includes('context lost') && !e.includes('WebGLProgram') && !e.includes('CONTEXT_LOST'))
check(!unexpected.length, `no other page errors (${JSON.stringify(unexpected.slice(0, 3))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
