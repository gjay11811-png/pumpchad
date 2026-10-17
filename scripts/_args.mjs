import { chromium } from 'playwright'
const variants = { base: [], nogpucomp: ['--disable-gpu-compositing'], sandbox: ['--disable-gpu-sandbox'], mem: ['--disable-gpu-memory-buffer-video-frames', '--disable-features=UseSkiaRenderer'], sw: ['--use-gl=angle'] }
const only = process.argv[2]
for (const [name, extra] of Object.entries(variants)) {
  if (only && name !== only) continue
  const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog', ...extra] })
  const p = await b.newPage({ viewport: { width: 1000, height: 600 } })
  await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'], xp: 800 }, settings: { quality: 'low', muted: true } })))
  await p.goto('http://localhost:' + (process.env.PORT || 5180) + '/chadverse/?sky=day')
  await p.click('[data-testid=enter-muted]')
  await p.waitForSelector('[role=tablist]')
  await p.getByRole('tab', { name: 'Name' }).click()
  await p.fill('#chad-name', 'Rider')
  await p.getByRole('button', { name: /Enter Chad Square/ }).click()
  await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
  await p.evaluate(() => window.__chadverse.teleport(0, 34, 3.14))
  let lostAt = null
  for (let i = 0; i < 12 && !lostAt; i++) { await p.waitForTimeout(2000); if (await p.evaluate(() => window.__chadverse.gfxLog().some((e) => e.kind === 'lost'))) lostAt = (i + 1) * 2 }
  console.log(name, lostAt ? 'LOST after ' + lostAt + 's' : 'ok 24s')
  await b.close()
}
