import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] })
const p = await b.newPage({ viewport: { width: 1000, height: 600 } })
const msgs = []
p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) msgs.push(m.type() + ': ' + m.text().slice(0, 300)) })
p.on('pageerror', (e) => msgs.push('pageerror: ' + e.message.slice(0, 300)))
await p.addInitScript((q) => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'], xp: 800 }, settings: { quality: q, muted: true } })), process.env.Q || 'medium')
await p.goto('http://localhost:5180/chadverse/?sky=day')
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Rider')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
for (const [x, z, yaw] of [[0, 34, 3.14], [0, 0, 0]]) {
  await p.evaluate(([x, z, yaw]) => window.__chadverse.teleport(x, z, yaw), [x, z, yaw])
  await p.waitForTimeout(5000)
  console.log('at', x, z, JSON.stringify(await p.evaluate(() => ({ stats: window.__chadverse.stats(), log: window.__chadverse.gfxLog().slice(-6) }))))
}
console.log(msgs.slice(0, 12).join('\n'))
await b.close()
