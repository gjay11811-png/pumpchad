// Six short wheelie / braking checks on the riding model (no browser): lift from a standstill; hold a slow wheelie with Gas taps; full throttle; recover from a small wobble;
// let it fall when overbalanced; braking alone never lifts.   node scripts/wheelie-checks.mjs      (SIMULATED numbers)
import { BikeSim } from '../src/game/bike/sim.ts'
import { SURRON, STREET } from '../src/game/bike/spec.ts'
let fails = 0
const check = (ok, msg) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!ok) fails++
}
const flat = () => ({ yRear: 0, yFront: 0 })
const I = (o = {}) => ({ throttle: 0, brake: 0, rear: 0, steer: 0, lean: 0, ...o })
const deg = (r) => Math.round((r * 180) / Math.PI)
const run = (b, sec, f) => {
  for (let t = 0; t < sec; t += 1 / 60) b.advance(1 / 60, f(t, b), flat())
}
for (const spec of [SURRON, STREET]) {
  console.log(`\n== ${spec.name}`)
  // 1. lift from a standstill: progressive, and the bike only creeps
  const a = new BikeSim(spec)
  a.assist = 0.3
  let last = 0
  let step = 0
  let t20 = -1
  run(a, 2, (t, bk) => {
    step = Math.max(step, Math.abs(bk.pitch - last))
    last = bk.pitch
    if (t20 < 0 && bk.pitch > 0.35) t20 = t
    return I({ throttle: 1 })
  })
  check(t20 > 0.3 && t20 < 2 && step < 0.03 && a.v < 3, `1. lift from a standstill: 20° after ${t20.toFixed(1)} s, smooth (${(step * 1000).toFixed(0)} mrad/frame), creeping ${a.v.toFixed(1)} m/s`)
  // 2. hold a slow wheelie with Gas taps (a rider tapping to keep it around 15-30°)
  const h = new BikeSim(spec)
  h.assist = 0.3
  let up = 0
  let pk = 0
  run(h, 8, (t, bk) => {
    if (bk.pitch > 0.17) up += 1 / 60
    pk = Math.max(pk, bk.pitch)
    const tapOn = bk.pitch < 0.35 && bk.pitchRate < 0.25 && t % 0.45 < 0.2
    return I({ throttle: tapOn ? 1 : 0, brake: bk.pitch > 0.7 ? 1 : 0 })
  })
  check(!h.crashed && up > 4 && pk < 0.8 && h.v < 6, `2. a slow wheelie held with gas taps: ${up.toFixed(1)} s up of 8, peak ${deg(pk)}°, no surge (${h.v.toFixed(1)} m/s)`)
  // 3. full throttle held: it no longer parks at one angle for as long as the gas is held; it climbs through the balance point and goes over (a rider eases off before that)
  const f = new BikeSim(spec)
  f.assist = 0.3
  let fpk = 0
  let overAt = -1
  let tt = 0
  run(f, 10, (t, bk) => {
    fpk = Math.max(fpk, bk.pitch)
    tt = t
    if (overAt < 0 && bk.crashed) overAt = t
    return I({ throttle: 1 })
  })
  check(f.crashed === 'loop' && overAt > 1 && overAt < 6, `3. full throttle: lifts to ${deg(fpk)}° and goes over backwards after ${overAt.toFixed(1)} s (not parked at an angle)`)
  // ... and a rider who eases off at 40° brings it down instead
  const e = new BikeSim(spec)
  e.assist = 0.3
  let eased = false
  run(e, 8, (t, bk) => {
    if (bk.pitch > 0.7) eased = true
    return I({ throttle: eased ? 0 : 1 })
  })
  check(!e.crashed && e.pitch < 0.02, `   ...and easing off at 40° settles the front back down (${e.crashed ?? deg(e.pitch) + '°'})`)
  // 4. recover from a small wobble: a 6° kick near balance, corrected with gas taps / easing
  const w = new BikeSim(spec)
  w.assist = 0.3
  w.v = 3
  const hist = []
  let wob = 0
  run(w, 6, (t, bk) => {
    hist.push([bk.pitch, bk.pitchRate])
    const [pp, rr] = hist[Math.max(0, hist.length - 1 - 12)]
    const pred = pp + rr * 0.25
    if (t > 2 && t < 2.1) bk.pitchRate += 0.05 // a small wobble: +6°/s for a moment
    if (t > 2) wob = Math.max(wob, Math.abs(bk.pitch - 0.6))
    return I({ throttle: pred < 0.6 ? 1 : 0, brake: pred > 0.95 ? 1 : 0 })
  })
  check(!w.crashed && w.pitch > 0.25, `4. a small wobble at ~35° is recovered with small corrections (${w.crashed ?? deg(w.pitch) + '°'}, drifted ${deg(wob)}° from the target)`)
  // 5. overbalanced: past the point it falls over naturally, smoothly, never snapped upright; the Brake still saves the moment before
  const o = new BikeSim(spec)
  o.v = 3
  o.pitch = 1.38
  o.pitchRate = 0.5
  let ostep = 0
  let oback = false
  let ol = o.pitch
  run(o, 3, (t, bk) => {
    ostep = Math.max(ostep, Math.abs(bk.pitch - ol))
    if (bk.pitch < ol - 1e-6) oback = true
    ol = bk.pitch
    return I()
  })
  check(o.crashed === 'loop' && o.pitch > 1.5 && !oback && ostep < 0.04, `5. overbalanced: goes over backwards smoothly (${o.crashed}, ${deg(o.pitch)}°, no snap: biggest step ${(ostep * 1000).toFixed(0)} mrad/frame)`)
  const sv = new BikeSim(spec)
  sv.v = 3
  sv.pitch = 1.38
  sv.pitchRate = 0.5
  run(sv, 3, () => I({ brake: 1 }))
  check(!sv.crashed && sv.pitch < 0.05, '   ...the same moment is still saved by the Brake')
  // 6. braking alone never lifts the front: it slows, compresses the fork, keeps the front planted
  for (const v0 of [3, 8, 15, spec.maxSpeed * 0.9]) {
    const bb = new BikeSim(spec)
    bb.v = v0
    let mp = 0
    let fork = 0
    run(bb, 3, (t, bk) => ((mp = Math.max(mp, bk.pitch)), (fork = Math.max(fork, bk.forkC)), I({ brake: 1 })))
    check(mp === 0 && fork > 0.002 && bb.v < v0, `6. Brake alone from ${v0.toFixed(0)} m/s: front never lifts (${deg(mp)}°), fork ${fork.toFixed(3)} m, slowed to ${bb.v.toFixed(1)} m/s`)
  }
  // braking also lowers a wheelie faster than easing off
  const lower = (brake) => {
    const r = new BikeSim(spec)
    r.v = 3
    let g = 0
    while (g < 6 && r.pitch < 0.7 && !r.crashed) (r.advance(1 / 60, I({ throttle: 1 }), flat()), (g += 1 / 60)) // lift to 40° then ease off / brake
    let tm = 0
    while (tm < 8 && r.pitch > 0.02 && !r.crashed) {
      r.advance(1 / 60, I({ throttle: 0, brake }), flat())
      tm += 1 / 60
    }
    return tm
  }
  const te = lower(0)
  const tb = lower(1)
  check(tb < te * 0.8, `   Brake lowers the front faster than easing off (${tb.toFixed(1)} s vs ${te.toFixed(1)} s)`)
}
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS')
process.exit(fails ? 1 : 0)
