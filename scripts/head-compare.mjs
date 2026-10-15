// PumpChad's head, desktop vs phone, same character / position / pose / camera distance / orientation.
// Desktop: 1280x720, default quality for a mouse device (high). Phone: iPhone 13 profile (touch → default quality medium), portrait.
//   SHOTS=dir node scripts/head-compare.mjs [desktop|phone] [Q=low|medium|high override via env Q]
import { chromium, devices } from 'playwright'
const out = process.env.SHOTS || '.'
const which = process.argv[2] ? [process.argv[2]] : ['desktop', 'phone']
const tag = process.env.TAG || 'head'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
for (const dev of which) {
  const ctx = await b.newContext(dev === 'phone' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } })
  const p = await ctx.newPage()
  const q = process.env.Q || (dev === 'phone' ? 'medium' : 'high')
  await p.addInitScript((q) => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'] }, settings: { quality: q, muted: true } })), q)
  await p.goto(process.env.URL || 'http://localhost:4318/chadverse/')
  await p.click('[data-testid=enter-muted]')
  await p.waitForSelector('[role=tablist]')
  await p.getByRole('tab', { name: 'Name' }).click()
  await p.fill('#chad-name', 'Explorer')
  await p.getByRole('button', { name: /Enter Chad Square/ }).click()
  await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
  const C = (fn, ...a) => p.evaluate(([f, a]) => window.__chadverse[f](...a), [fn, a])
  const vp = p.viewportSize()
  // stand on open cobbles facing north, then orbit the camera by dragging until it sits at the wanted yaw relative to the character
  await C('teleport', 0, 22, Math.PI)
  await p.waitForTimeout(1500)
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))
  const orbit = async (rel) => {
    for (let i = 0; i < 6; i++) {
      const w = await C('world')
      const e = wrap(w.yaw + rel - w.camYaw)
      if (Math.abs(e) < 0.04) break
      const px = Math.max(-300, Math.min(300, -e / 0.006))
      await p.mouse.move(vp.width / 2, vp.height * 0.35)
      await p.mouse.down()
      await p.mouse.move(vp.width / 2 + px / 2, vp.height * 0.35, { steps: 3 })
      await p.mouse.move(vp.width / 2 + px, vp.height * 0.35, { steps: 3 })
      await p.mouse.up()
      await p.waitForTimeout(250)
    }
    await p.waitForTimeout(700)
  }
  for (const [name, rel] of [['back', Math.PI], ['left', Math.PI / 2], ['front', 0], ['right', -Math.PI / 2]]) {
    await orbit(rel)
    const w = await C('world')
    await p.screenshot({ path: `${out}/${tag}-${dev}-${q}-${name}.jpg`, type: 'jpeg', quality: 88 })
    console.log(dev, q, name, 'camYaw', w.camYaw, 'camDist', w.camDist, 'viewport', vp.width + 'x' + vp.height)
  }
  await ctx.close()
}
await b.close()
