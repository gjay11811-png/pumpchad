// New gym stations visual QA (deadlift, pull-ups, treadmill): poses at both ends of the rep + measurements.
//   SHOTS=dir node scripts/gym-new.mjs [stations] [Species]
import { chromium } from 'playwright'
const out = process.env.SHOTS
const stations = (process.argv[2] || 'deadlift,pullup,treadmill').split(',')
const species = process.argv[3] || 'Pumpkin'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1100, height: 760 } })
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)))
const w = (ms) => p.waitForTimeout(ms)
const ins = () => p.evaluate(() => window.__chadverse.gymInspect())
await p.goto(process.env.URL || 'http://localhost:4318/chadverse/', { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'networkidle' })
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('radio', { name: species, exact: true }).first().click()
await p.waitForFunction((s) => window.__chadverse.showroom()?.rig?.species === s, species.toLowerCase(), { timeout: 30000 })
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Gym New')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 30000 })
await p.evaluate(() => window.__chadverse.teleport(14.4, -4))
await w(400)
await p.keyboard.press('e')
await p.waitForFunction(() => window.__chadverse?.phase === 'gym' && window.__chadverse.gymInspect() && window.__chadverse.gym()?.mode === 'free', null, { timeout: 20000 })
await w(800)
await p.screenshot({ path: `${out}/gn-hall.jpg`, quality: 78 })
const fmt = (v) => v.map((x) => x.toFixed(2)).join(',')
for (const id of stations) {
  await p.evaluate((id) => window.__chadverse.gymGoto(id), id)
  await w(500)
  await p.keyboard.press('e')
  await p.waitForSelector('[data-testid=workout-start]', { timeout: 5000 })
  await w(1200)
  const r = await ins()
  console.log(id, 'rest: hands', fmt(r.handL), '|', fmt(r.handR), 'pelvis', fmt(r.pelvis), 'head', fmt(r.headBone), 'feet', fmt(r.footL), 'clip', r.clip)
  await p.screenshot({ path: `${out}/gn-${id}-rest.jpg`, quality: 78 })
  await p.click('[data-testid=workout-start]')
  await w(300)
  let lo = { y: Infinity }
  let hi = { y: -Infinity }
  for (let rep = 0; rep < (id === 'treadmill' ? 8 : 1); rep++) {
    await p.click('[data-testid=workout-rep]').catch(() => {})
    for (let k = 0; k < (id === 'treadmill' ? 6 : 22); k++) {
      const s = await ins()
      const y = (s.handL[1] + s.handR[1]) / 2
      if (y < lo.y) lo = { y, s }
      if (y > hi.y) hi = { y, s }
      if (id !== 'treadmill' && k === 7) await p.screenshot({ path: `${out}/gn-${id}-mid.jpg`, quality: 78 })
      await w(60)
    }
  }
  const s = await ins()
  console.log(id, 'hand y range', lo.y.toFixed(2), '→', hi.y.toFixed(2), '| pelvis at low', fmt(lo.s.pelvis), 'at high', fmt(hi.s.pelvis), '| feet low', fmt(lo.s.footL), '| clip now', s.clip, '| pace', await p.evaluate(() => window.__chadverse.gym()?.pace ?? null))
  await p.screenshot({ path: `${out}/gn-${id}-end.jpg`, quality: 78 })
  await p.click('[data-testid=workout-stop]')
  await w(700)
}
console.log('errors:', errs)
await b.close()
