// Character selection screen: desktop + emulated phone stills (and keyboard / focus checks). SIMULATED.
//   URL=... SHOTS=dir TAG=before node scripts/creator-shots.mjs
import { chromium, devices } from 'playwright'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const OUT = process.env.SHOTS || '.'
const TAG = process.env.TAG || 'creator'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const wait = (p, ms) => p.waitForTimeout(ms)
for (const [name, ctxOpts, vp] of [
  ['desktop', {}, { width: 1280, height: 720 }],
  ['phone', { ...devices['iPhone 13'] }, null],
  ['phone-landscape', { ...devices['iPhone 13 landscape'] }, null],
]) {
  const ctx = await b.newContext(vp ? { viewport: vp } : ctxOpts)
  const p = await ctx.newPage()
  await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: {}, settings: { quality: 'medium', muted: true } })))
  await p.goto(BASE)
  await p.click('[data-testid=enter-muted]')
  await p.waitForSelector('[role=tablist]')
  await wait(p, 3500)
  await p.screenshot({ path: `${OUT}/${TAG}-${name}-pumpchad.jpg`, quality: 85 })
  for (const sp of ['Skeleton', 'Demon']) {
    await p.getByRole('radio', { name: new RegExp(sp, 'i') }).first().click()
    await wait(p, 3000)
    await p.screenshot({ path: `${OUT}/${TAG}-${name}-${sp.toLowerCase()}.jpg`, quality: 85 })
  }
  console.log('shot', name)
  await ctx.close()
}
await b.close()
