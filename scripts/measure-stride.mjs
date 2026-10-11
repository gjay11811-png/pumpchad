// Measures each locomotion clip's natural ground speed: how fast a planted foot moves
// backwards (in place, timeScale 1). That is the speed the character must travel at for zero sliding.
import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 900, height: 700 } })
await p.goto('http://localhost:4318/chadverse/', { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'networkidle' })
await p.waitForSelector('[data-testid=enter-muted]')
await p.click('[data-testid=enter-muted]')
await p.waitForFunction(() => window.__chadverse.showroom()?.rig?.kind === 'model', null, { timeout: 20000 })
for (const [label, speed] of [['walk', 0.42], ['jog', 1.0], ['sprint', 1.82]]) {
  const r = await p.evaluate(async ([speed]) => {
    const room = window.__chadverse.showroom()
    room.autoRotate = false
    room.yaw = 0
    room.previewPose = 'idle'
    room.forcePose = 'walk'
    room.forceSpeed = speed
    room.forceTimeScale = 1
    const rig = room.rig
    await new Promise((r) => setTimeout(r, 600))
    const samples = []
    const t0 = performance.now()
    await new Promise((res) => {
      const tick = () => {
        samples.push({ t: performance.now(), f: rig.inspect(), clip: rig['current']?.getClip().name })
        if (performance.now() - t0 < 3000) requestAnimationFrame(tick)
        else res()
      }
      tick()
    })
    return samples
  }, [speed])
  // clip time runs at timeScale 1 only after our override applies; use samples after 0.5 s
  const s = r.filter((x) => x.t - r[0].t > 500)
  let back = 0, time = 0
  for (const side of ['ballL', 'ballR']) {
    const ys = s.map((x) => x.f[side][1])
    const minY = Math.min(...ys)
    for (let i = 1; i < s.length; i++)
      if (ys[i] < minY + 0.025 && ys[i - 1] < minY + 0.025) {
        back += Math.abs(s[i].f[side][2] - s[i - 1].f[side][2])
        time += (s[i].t - s[i - 1].t) / 1000
      }
  }
  console.log(label.padEnd(7), s.at(-1).clip, 'natural ground speed ≈', (back / time).toFixed(2), 'm/s')
}
await b.close()
