// Chad Gym v2 visual tour from the real gameplay camera: zones, equipment close-ups, every station (prompt, mid-rep,
// rest) and a phone viewport.   SHOTS=dir Q=high node scripts/gym-shots.mjs <tag> [tour,stations,mobile]
import { chromium } from 'playwright'
const out = process.env.SHOTS || '.'
const tag = process.argv[2] || 'now'
const sections = (process.argv[3] || 'tour,stations').split(',')
const URL = process.env.URL || 'http://localhost:4318/chadverse/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const errs = []
async function enterGym(p) {
  p.on('pageerror', (e) => errs.push(e.message))
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)))
  await p.goto(URL, { waitUntil: 'networkidle' })
  await p.evaluate((q) => {
    localStorage.clear()
    if (q) localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 1, character: null, progress: {}, settings: { quality: q, muted: true } }))
  }, process.env.Q || 'high')
  await p.reload({ waitUntil: 'networkidle' })
  await p.click('[data-testid=enter-muted]')
  await p.waitForSelector('[role=tablist]')
  await p.getByRole('tab', { name: 'Name' }).click()
  await p.fill('#chad-name', 'Gym Shots')
  await p.getByRole('button', { name: /Enter Chad Square/ }).click()
  await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 60000 })
  await p.evaluate(() => window.__chadverse.teleport(14.4, -4))
  await p.waitForTimeout(500)
  await p.keyboard.press('e')
  await p.waitForFunction(() => window.__chadverse?.phase === 'gym' && window.__chadverse.gymInspect() && window.__chadverse.gym()?.mode === 'free', null, { timeout: 60000 })
  await p.waitForTimeout(1500)
}
const shot = async (p, name) => {
  await p.screenshot({ path: `${out}/${tag}-${name}.jpg`, quality: 82, timeout: 60000 })
  console.log('shot', name)
}
/** stand at (x, z) facing yaw (camera behind); then drag: up = tilt (px, + looks down), turn = orbit (px) */
const view = async (p, x, z, yaw, up = 0, turn = 0) => {
  await p.evaluate(([x, z, yaw]) => window.__chadverse.gymTeleport(x, z, yaw), [x, z, yaw])
  await p.waitForTimeout(400)
  if (up || turn) {
    await p.mouse.move(640, 400)
    await p.mouse.down()
    await p.mouse.move(640 + turn, 400 + up, { steps: 8 })
    await p.mouse.up()
  }
  await p.waitForTimeout(700)
}
const PI = Math.PI
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
await enterGym(p)
console.log('info', JSON.stringify(await p.evaluate(() => window.__chadverse.gymInfo())))
if (sections.includes('tour')) {
  await p.addStyleTag({ content: '.panel, [data-testid=objective], p { opacity: 0 !important }' })
  await shot(p, 'entry')
  await view(p, 0, 2.6, PI, -40)
  await shot(p, 'sign')
  await view(p, 4.6, -2.6, PI / 2, -10)
  await shot(p, 'rack')
  await view(p, 6.3, -3.9, PI / 2 + 0.55, 30)
  await shot(p, 'rack-close')
  await view(p, 3.4, -0.2, PI / 2 + 0.5, 10)
  await shot(p, 'benches')
  await view(p, 4.4, -2.9, PI, -10)
  await shot(p, 'cable')
  await view(p, -3.6, -0.6, -PI / 2 - 0.55, 0)
  await shot(p, 'strength')
  await view(p, -4.4, -1.6, -PI / 2 + 0.2, 10)
  await shot(p, 'bench-press')
  await view(p, -4.3, 3.1, -PI / 2, 10)
  await shot(p, 'cardio')
  await view(p, -0.8, 3.9, 0.35, 0)
  await shot(p, 'entrance')
  await view(p, 1.6, 4.2, 0.6, 0)
  await shot(p, 'door')
  await view(p, 0, 5.5, PI, 220)
  await shot(p, 'overview')
}
if (sections.includes('stations')) {
  for (const id of (process.env.ST || 'curl,bench,squat,deadlift,pullup,treadmill,bag').split(',')) {
    await p.evaluate((id) => window.__chadverse.gymGoto(id), id)
    await p.waitForTimeout(800)
    await shot(p, `st-${id}-prompt`)
    await p.keyboard.press('e')
    await p.waitForSelector('[data-testid=workout-start]', { timeout: 8000 })
    await p.waitForTimeout(1000)
    await shot(p, `st-${id}-ready`)
    console.log(id, 'info', JSON.stringify(await p.evaluate(() => window.__chadverse.gymInfo())))
    await p.click('[data-testid=workout-start]')
    await p.waitForTimeout(400)
    for (let i = 0; i < 3; i++) {
      await p.click('[data-testid=workout-rep]')
      await p.waitForTimeout(id === 'bag' ? 230 : 420)
      if (i === 2) await shot(p, `st-${id}-rep`)
      await p.waitForTimeout(id === 'bag' ? 600 : 1300)
    }
    await p.click('[data-testid=workout-stop]')
    await p.waitForTimeout(700)
    await shot(p, `st-${id}-after`)
    console.log(id, 'after', JSON.stringify(await p.evaluate(() => [window.__chadverse.gym(), window.__chadverse.gymInfo()])))
  }
}
await p.close()
if (sections.includes('mobile')) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })
  const m = await ctx.newPage()
  await enterGym(m)
  await shot(m, 'mobile-entry')
  await m.evaluate(() => window.__chadverse.gymGoto('curl'))
  await m.waitForTimeout(800)
  await shot(m, 'mobile-curl-prompt')
}
console.log('errors:', JSON.stringify(errs))
await b.close()
