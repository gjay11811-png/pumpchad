// Gait calibration: for each target speed, play the locomotion blend IN PLACE (showroom) and measure how fast a
// planted foot moves backwards — the speed at which the feet would not slide. Ratio target/measured → cadence fix.
//   node scripts/sweep-gait.mjs
import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1200, height: 760 } })
await p.goto('http://localhost:4318/chadverse/', { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'networkidle' })
await p.click('[data-testid=enter-muted]')
await p.waitForFunction(() => window.__chadverse.showroom()?.rig?.kind === 'model', null, { timeout: 30000 })
const species = process.env.SPECIES
if (species) {
  await p.waitForSelector('[role=tablist]')
  await p.getByRole('radio', { name: species, exact: true }).first().click()
  await p.waitForFunction((s) => window.__chadverse.showroom()?.rig?.species === s, species.toLowerCase(), { timeout: 30000 })
  await p.waitForTimeout(1500)
}
const speeds = (process.argv[2] || '0.8,1.35,2.2,3.2,4.2,5.2,6.1,7,7.6,8.6').split(',').map(Number)
for (const v of speeds) {
  const s = await p.evaluate(async (v) => {
    const room = window.__chadverse.showroom()
    room.autoRotate = false
    room.yaw = 0
    room.forcePose = 'walk'
    room.forceSpeed = v / 3.4
    room.forceTimeScale = null
    await new Promise((r) => setTimeout(r, 700))
    const S = []
    const t0 = performance.now()
    await new Promise((res) => {
      const tick = () => {
        S.push({ t: performance.now(), f: room.rig.inspect() })
        if (performance.now() - t0 < 2500) requestAnimationFrame(tick)
        else res()
      }
      tick()
    })
    return S.map((x) => ({ t: x.t, L: x.f.ballL, R: x.f.ballR, clip: x.f.clip }))
  }, v)
  let back = 0
  let time = 0
  for (const side of ['L', 'R']) {
    const ys = s.map((x) => x[side][1])
    const minY = Math.min(...ys)
    for (let i = 1; i < s.length; i++)
      if (ys[i] < minY + 0.02 && ys[i - 1] < minY + 0.02) {
        back += Math.abs(s[i][side][2] - s[i - 1][side][2])
        time += (s[i].t - s[i - 1].t) / 1000
      }
  }
  const g = back / time
  console.log(`target ${v.toFixed(2)} m/s → feet natural ${g.toFixed(2)} m/s  ratio ${(v / g).toFixed(3)}  (${s.at(-1).clip})`)
}
await b.close()
