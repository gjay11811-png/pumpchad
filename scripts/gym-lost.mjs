// When does the GPU context die in the gym? Enter, then poll (no input): log the time of the Graphics-reset overlay + memory counters.
import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: process.env.GLARGS ? process.env.GLARGS.split(' ') : [] })
const p = await b.newPage({ viewport: { width: 900, height: 600 } })
const logs = []
p.on('console', (m) => logs.push(`${m.type()}: ${m.text().slice(0, 160)}`))
await p.addInitScript((q) => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: {}, settings: { quality: q, muted: true } })), process.env.Q || 'low')
await p.goto(process.env.URL || 'http://localhost:4318/chadverse/')
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Lifter')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 90000 })
await p.evaluate(() => window.__chadverse.teleport(14.4, -4, Math.PI / 2))
await p.waitForTimeout(800)
await p.keyboard.press('e')
await p.waitForFunction(() => window.__chadverse.phase === 'gym', null, { timeout: 60000 }).catch(() => {})
console.log('phase', await p.evaluate(() => window.__chadverse.phase))
const prog = () => p.evaluate(() => window.__chadverse.stats().programs)
console.log('programs before', await prog())
await p.evaluate((st) => window.__chadverse.gymGoto(st), process.env.STATION || 'bench')
await p.waitForTimeout(600)
await p.keyboard.press('e')
for (let i = 0; i < 12; i++) {
  await p.waitForTimeout(250)
  const lost = await p.locator('[data-testid=gfx-lost]').count()
  console.log(`+${(i + 1) * 250} ms  lost=${lost}  programs=${await prog().catch(() => '?')}`)
  if (lost) break
}
console.log(logs.slice(-12).join(' | '))
await b.close()
