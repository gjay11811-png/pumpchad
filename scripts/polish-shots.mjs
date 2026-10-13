// Before/after QA for the v3 polish pass: movement (lean, gait), skyline, vegetation, gym.
//   SHOTS=dir node scripts/polish-shots.mjs <tag> [sections=move,city,veg,gym]
import { chromium } from 'playwright'
const out = process.env.SHOTS || '.'
const tag = process.argv[2] || 'now'
const sections = (process.argv[3] || 'move,city,veg,gym').split(',')
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)))
const w = (ms) => p.waitForTimeout(ms)
const shot = (name) => p.screenshot({ path: `${out}/${tag}-${name}.jpg`, quality: 80 })
await p.goto(process.env.URL || 'http://localhost:4318/chadverse/', { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'networkidle' })
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Polish Shots')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 40000 })
await p.addStyleTag({ content: '.panel, [data-testid=objective], p { opacity: 0 !important }' })
await w(1200)
const tp = async (x, z, yaw, up = 0) => {
  await p.evaluate(([x, z, yaw]) => window.__chadverse.teleport(x, z, yaw), [x, z, yaw])
  await w(500)
  if (up) {
    await p.mouse.move(640, 420)
    await p.mouse.down()
    await p.mouse.move(640, 420 - up, { steps: 6 })
    await p.mouse.up()
  }
  await w(700)
}
/** shoulder-line roll (deg) of the player: 0 = level */
const roll = () =>
  p.evaluate(() => {
    const f = window.__chadverse.playerInspect()
    const [ax, ay, az] = f.shoulderL
    const [bx, by, bz] = f.shoulderR
    return (Math.atan2(ay - by, Math.hypot(ax - bx, az - bz)) * 180) / Math.PI
  })

if (sections.includes('move')) {
  // straight walk (default speed)
  await tp(0, 16, 0)
  await p.keyboard.down('w')
  await w(1300)
  await shot('walk')
  const c0 = await p.evaluate(() => window.__chadverse.world())
  await p.keyboard.up('w')
  // diagonal run: forward + left arrow + Shift for 2 s — measure body roll and how far the path curls
  await tp(-2, 4, Math.PI)
  const a = await p.evaluate(() => window.__chadverse.world())
  await p.keyboard.down('Shift')
  await p.keyboard.down('ArrowUp')
  await p.keyboard.down('ArrowLeft')
  let maxRoll = 0
  for (let i = 0; i < 12; i++) {
    await w(150)
    maxRoll = Math.max(maxRoll, Math.abs(await roll()))
  }
  await shot('diag-run')
  const z = await p.evaluate(() => window.__chadverse.world())
  await p.keyboard.up('ArrowLeft')
  await p.keyboard.up('ArrowUp')
  await p.keyboard.up('Shift')
  console.log(`move: walk clip ${c0 ? '' : ''}| diagonal run: max shoulder roll ${maxRoll.toFixed(1)}°, camera turned ${(((z.camYaw - a.camYaw) * 180) / Math.PI).toFixed(0)}° in 1.8 s`)
  const anim = await p.evaluate(() => window.__chadverse.playerInspect())
  console.log('clip while walking:', anim.clip)
}
if (sections.includes('city')) {
  await tp(-3.2, 33.4, 0.18, 70)
  await shot('city-lookout')
  await tp(4.5, 31.5, -0.35, 55)
  await shot('city-wide')
}
if (sections.includes('veg')) {
  await tp(0, -11, Math.PI, 40)
  await shot('veg-north-road')
  await tp(-4.2, 15.5, 2.6, 30)
  await shot('veg-plaza-west')
  await tp(-20, 9, 0.6, 30)
  await shot('veg-houses-west')
  await tp(21, 4, -0.4, 30)
  await shot('veg-houses-east')
}
if (sections.includes('gym')) {
  await p.evaluate(() => window.__chadverse.teleport(14.4, -4))
  await w(400)
  await p.keyboard.press('e')
  await p.waitForFunction(() => window.__chadverse?.phase === 'gym' && window.__chadverse.gym()?.mode === 'free', null, { timeout: 20000 })
  await w(1200)
  await shot('gym-entry')
  await p.mouse.move(640, 420)
  await p.mouse.down()
  await p.mouse.move(380, 400, { steps: 8 })
  await p.mouse.up()
  await w(700)
  await shot('gym-left')
  await p.mouse.move(640, 420)
  await p.mouse.down()
  await p.mouse.move(1150, 400, { steps: 10 })
  await p.mouse.up()
  await w(700)
  await shot('gym-right')
}
console.log('errors:', errs)
await b.close()
