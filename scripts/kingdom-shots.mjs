// Chad Kingdom v4 before/after captures: spawn, fountain (3 angles), paving, market, pumpkins, the bench NPC,
// an elevated plaza view and a phone viewport.   SHOTS=dir node scripts/kingdom-shots.mjs <tag> [sections]
import { chromium } from 'playwright'
const out = process.env.SHOTS || '.'
const tag = process.argv[2] || 'now'
const sections = (process.argv[3] || 'spawn,fountain,floor,market,pumpkins,b4s,aerial,mobile').split(',')
const URL = process.env.URL || 'http://localhost:4318/chadverse/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const errs = []
async function enter(p) {
  p.on('pageerror', (e) => errs.push(e.message))
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)))
  await p.goto(URL, { waitUntil: 'networkidle' })
  await p.evaluate((q) => {
    localStorage.clear()
    // optional quality tier (Q=medium|low): lighter GPU memory on a starved machine
    if (q) localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 1, character: null, progress: {}, settings: { quality: q, muted: true } }))
  }, process.env.Q || '')
  await p.reload({ waitUntil: 'networkidle' })
  await p.click('[data-testid=enter-muted]')
  await p.waitForSelector('[role=tablist]')
  await p.getByRole('tab', { name: 'Name' }).click()
  await p.fill('#chad-name', 'Kingdom Shots')
  await p.getByRole('button', { name: /Enter Chad Square/ }).click()
  await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 40000 })
  await p.waitForTimeout(1500)
}
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
await enter(p)
await p.addStyleTag({ content: '.panel, [data-testid=objective], p { opacity: 0 !important }' })
const shot = async (name, page = p) => {
  await page.screenshot({ path: `${out}/${tag}-${name}.jpg`, quality: 82, timeout: 60000 })
  console.log('shot', name)
}
/** teleport + optional drag: up = tilt camera up (px), turn = orbit (px) */
const view = async (x, z, yaw, up = 0, turn = 0, page = p) => {
  await page.evaluate(([x, z, yaw]) => window.__chadverse.teleport(x, z, yaw), [x, z, yaw])
  await page.waitForTimeout(450)
  if (up || turn) {
    await page.mouse.move(640, 420)
    await page.mouse.down()
    await page.mouse.move(640 + turn, 420 - up, { steps: 8 })
    await page.mouse.up()
  }
  await page.waitForTimeout(700)
}

if (sections.includes('spawn')) {
  await p.evaluate(() => window.__chadverse.teleport(0, 19.5, Math.PI))
  await p.waitForTimeout(900)
  await shot('spawn')
}
if (sections.includes('fountain')) {
  await view(0, 11.5, Math.PI, 30)
  await shot('fountain-front')
  await view(8.2, 4.2, -2.05, 25)
  await shot('fountain-side')
  await view(3.2, 7.2, Math.PI + 0.4, -60)
  await shot('fountain-close')
}
if (sections.includes('floor')) {
  await view(-3, 9, 2.2, -90)
  await shot('floor-plaza')
  await view(0, -14, Math.PI, -70)
  await shot('floor-road')
}
if (sections.includes('market')) {
  await view(-12, 7, -1.9, 20)
  await shot('market-row')
  await view(-20, 6.2, -2.6, 10)
  await shot('market-stalls')
}
if (sections.includes('pumpkins')) {
  await view(-12.5, 13.5, -2.6, -20)
  await shot('pumpkins-odd')
  await view(-17.5, 4.5, 2.5, -30)
  await shot('pumpkins-stall')
}
if (sections.includes('wayfinding')) {
  await view(-1.8, 21.5, Math.PI + 0.5, 10)
  await shot('wayfinding-post')
  await view(-6.5, 16.0, -2.3, -5)
  await shot('wayfinding-back')
  await view(-1.6, 9.8, 2.4, -45)
  await shot('lamp-lantern')
}
if (sections.includes('b4s')) {
  // b4s on the north-west plaza bench: stand beside the bench, then orbit the camera round for front / back
  const B = [-6.0, 6.0]
  const t = [0.707, 0.707] // along the bench
  const u = [-0.707, 0.707] // outward from the fountain
  const px = B[0] + t[0] * 2.3 + u[0] * 0.2
  const pz = B[1] + t[1] * 2.3 + u[1] * 0.2
  const yaw = Math.atan2(B[0] - px, B[1] - pz)
  await view(px, pz, yaw, -20)
  await shot('bench-npc-side')
  await view(px, pz, yaw, -20, 210)
  await shot('bench-npc-front')
  await view(px, pz, yaw, -20, -230)
  await shot('bench-npc-back')
}
if (sections.includes('aerial')) {
  await view(0, 18, Math.PI, 260)
  await shot('aerial')
}
await p.close()
if (sections.includes('mobile')) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })
  const m = await ctx.newPage()
  await enter(m)
  await m.screenshot({ path: `${out}/${tag}-mobile-spawn.jpg`, quality: 82 })
  await m.evaluate(() => window.__chadverse.teleport(0, 11.5, Math.PI))
  await m.waitForTimeout(900)
  await m.screenshot({ path: `${out}/${tag}-mobile-fountain.jpg`, quality: 82 })
  await ctx.close()
}
console.log('errors:', errs)
await b.close()
