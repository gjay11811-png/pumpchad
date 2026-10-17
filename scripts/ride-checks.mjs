// The focused riding checks on the riding model (no browser): ordinary riding (pull away, build speed, cruise, turn, slow down) is never carried into a wheelie; the wheelie is an
// OPTION that the rider asks for with fresh presses of the gas and controls with taps and the brake.     node scripts/ride-checks.mjs      (SIMULATED numbers)
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
/** a rider tapping the gas: one fresh 0.15 s press every `every` seconds while `want(bike)` is true */
const tapper = (want, every = 0.7) => {
  let next = 0
  return (t, bk) => {
    if (t >= next && want(bk)) next = t + every
    return I({ throttle: t >= next - every && t < next - every + 0.15 && want(bk) ? 1 : 0 })
  }
}
for (const spec of [SURRON, STREET]) {
  console.log(`\n== ${spec.name}`)
  // 1. NORMAL pull-away and cruising on the gas held down: a small hop of the nose at most, then planted, smooth acceleration, a cruise near top speed, never a wheelie
  const n = new BikeSim(spec)
  let nmax = 0
  let nlate = 0
  let jerk = 0
  let lv = 0
  run(n, 14, (t, bk) => {
    nmax = Math.max(nmax, bk.pitch)
    if (t > 2.2) nlate = Math.max(nlate, bk.pitch)
    if (t > 0.3) jerk = Math.max(jerk, Math.abs(bk.v - lv) * 60)
    lv = bk.v
    return I({ throttle: 1 })
  })
  check(nmax < 0.25 && nlate < 0.03 && !n.crashed, `1. holding the gas pulls away normally: nose hop ${deg(nmax)}° at most, planted after 2.2 s (${deg(nlate)}°), ${n.v.toFixed(1)} m/s after 14 s`)
  check(n.v > spec.maxSpeed * 0.75 && jerk < spec.accel * 1.2, `   ...it builds speed smoothly (${(n.v / spec.maxSpeed * 100).toFixed(0)}% of top speed, peak acceleration ${jerk.toFixed(1)} m/s²) and cruises`)
  // 2. steering at speed while accelerating: it turns, leans, stays planted
  const s = new BikeSim(spec)
  run(s, 3, () => I({ throttle: 1 }))
  const h0 = s.h
  let smax = 0
  run(s, 2, (t, bk) => ((smax = Math.max(smax, bk.pitch)), I({ throttle: 1, steer: 0.5 })))
  check(Math.abs(s.h - h0) > 0.25 && Math.abs(s.roll) > 0.05 && smax < 0.03 && !s.crashed, `2. steering while accelerating: turned ${deg(Math.abs(s.h - h0))}°, leant ${deg(Math.abs(s.roll))}°, front planted (${deg(smax)}°)`)
  // 3. slowing and braking: coasting rolls down, Brake stops it, nose never up
  const c = new BikeSim(spec)
  c.v = spec.maxSpeed * 0.6
  run(c, 3, () => I())
  const cv = c.v
  const k = new BikeSim(spec)
  k.v = spec.maxSpeed * 0.6
  let kp = 0
  run(k, 3, (t, bk) => ((kp = Math.max(kp, bk.pitch)), I({ brake: 1 })))
  check(cv < spec.maxSpeed * 0.6 && cv > 1 && k.v < cv * 0.4 && kp === 0 && k.forkC > 0.002, `3. slowing: coasting ${(spec.maxSpeed * 0.6).toFixed(0)} → ${cv.toFixed(1)} m/s in 3 s, Brake → ${k.v.toFixed(1)} m/s with the front planted and the fork compressed (${k.forkC.toFixed(3)} m)`)
  // 4. lifting from a standstill: one fresh press hops the nose; presses add up; the lift is progressive
  const lift = (taps) => {
    const b = new BikeSim(spec)
    b.assist = 0.3
    let pk = 0
    let step = 0
    let lp = 0
    run(b, 5, (t, bk) => {
      pk = Math.max(pk, bk.pitch)
      step = Math.max(step, Math.abs(bk.pitch - lp))
      lp = bk.pitch
      const k2 = Math.floor(t / 0.7)
      return I({ throttle: k2 < taps && t % 0.7 < 0.15 ? 1 : 0 })
    })
    return { pk, step, crashed: b.crashed }
  }
  const l1 = lift(1)
  const l2 = lift(2)
  const l3 = lift(3)
  check(l1.pk > 0.1 && l2.pk > l1.pk + 0.04 && l3.pk > l2.pk && l1.step < 0.03 && !l3.crashed, `4. lifting from a standstill is progressive: 1 press ${deg(l1.pk)}°, 2 presses ${deg(l2.pk)}°, 3 presses ${deg(l3.pk)}° (smooth, ${(l3.step * 1000).toFixed(0)} mrad/frame)`)
  // 5. a slow wheelie held with Gas taps: the bike creeps, taps raise / hold without a surge
  const h = new BikeSim(spec)
  h.assist = 0.3
  let up = 0
  let pk = 0
  let dist = 0
  const hold = tapper((bk) => bk.pitch < 0.4 && bk.pitchRate < 0.3, 0.55)
  run(h, 9, (t, bk) => {
    if (bk.pitch > 0.17) (up += 1 / 60), (dist += Math.max(0, bk.v) / 60)
    pk = Math.max(pk, bk.pitch)
    return hold(t, bk)
  })
  check(!h.crashed && up > 4 && pk < 0.85 && h.v < spec.maxSpeed * 0.4 && h.v > 0.5 && dist > 3 && h.v / 9 < 1.8, `5. a wheelie held with Gas taps: up ${up.toFixed(1)} s of 9, peak ${deg(pk)}°, ${dist.toFixed(0)} m covered, speed gain ${(h.v / 9).toFixed(1)} m/s² on average (${h.v.toFixed(1)} m/s at the end)`)
  // 6. full throttle: no unnatural lock — the nose hops and the bike drives off; it never sits in a wheelie
  const f = new BikeSim(spec)
  let late = 0
  run(f, 10, (t, bk) => (t > 2 && (late = Math.max(late, bk.pitch)), I({ throttle: 1 })))
  check(late < 0.05 && !f.crashed, `6. full throttle held: no wheelie lock (front down after 2 s: ${deg(late)}°, ${f.v.toFixed(1)} m/s)`)
  // 7. recovering from a small wobble near balance: easing off lets it settle, taps / brake correct it
  const w = new BikeSim(spec)
  w.assist = 0.3
  const wt = tapper((bk) => bk.pitch < 0.55 && bk.pitchRate < 0.3, 0.5)
  let wobbled = false
  run(w, 8, (t, bk) => {
    if (!wobbled && bk.pitch > 0.45) {
      bk.pitchRate += 0.25 // a small wobble: an extra push of the nose
      wobbled = true
    }
    return I({ ...wt(t, bk), brake: bk.pitch > 0.95 ? 1 : 0 })
  })
  check(wobbled && !w.crashed, `7. a small wobble near ${deg(0.45)}° is recovered with taps / easing off (${wobbled ? (w.crashed ?? 'no loop-out, ' + deg(w.pitch) + '° at the end') : 'never got that high'})`)
  const e = new BikeSim(spec)
  e.assist = 0.3
  let eased = false
  let released = 0
  const et = tapper((bk) => !eased, 0.5)
  run(e, 9, (t, bk) => {
    if (!eased && bk.pitch > 0.38) eased = true
    if (eased) released += 1 / 60
    return I(et(t, bk))
  })
  check(eased && !e.crashed && e.pitch < 0.03, `   ...easing off near the balance point lets the front settle (${deg(e.pitch)}° after ${released.toFixed(1)} s, ${e.crashed ?? 'no loop-out'})`)
  // 8. overbalanced: it falls over backwards naturally, smoothly, never snapped upright; the Brake still saves the moment before
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
  check(o.crashed === 'loop' && o.pitch > 1.5 && !oback && ostep < 0.04, `8. overbalanced: goes over backwards smoothly (${o.crashed}, ${deg(o.pitch)}°, biggest step ${(ostep * 1000).toFixed(0)} mrad/frame, no snap)`)
  const sv = new BikeSim(spec)
  sv.v = 3
  sv.pitch = 0.9
  sv.pitchRate = 0.3
  run(sv, 3, () => I({ brake: 1 }))
  check(!sv.crashed && sv.pitch < 0.05, '   ...earlier, with the front still below the braking balance point, the Brake saves it (rear braking recovers while recovery is physically possible)')
  // 9. Brake brings a wheelie down faster than easing off, and Brake alone never lifts the front
  const lower = (brake) => {
    const r = new BikeSim(spec)
    r.v = 3
    const tp = tapper((bk) => bk.pitch < 0.6, 0.5)
    let g = 0
    while (g < 9 && r.pitch < 0.6 && !r.crashed) (r.advance(1 / 60, I(tp(g, r)), flat()), (g += 1 / 60))
    let tm = 0
    while (tm < 8 && r.pitch > 0.02 && !r.crashed) {
      r.advance(1 / 60, I({ throttle: 0, brake }), flat())
      tm += 1 / 60
    }
    return tm
  }
  const te = lower(0)
  const tb = lower(1)
  check(tb < te * 0.85, `9. Brake lowers the front faster than easing off (${tb.toFixed(1)} s vs ${te.toFixed(1)} s)`)
  for (const v0 of [0, 3, 8, 15, spec.maxSpeed * 0.9]) {
    const bb = new BikeSim(spec)
    bb.v = v0
    let mp = 0
    run(bb, 3, (t, bk) => ((mp = Math.max(mp, bk.pitch)), I({ brake: 1 })))
    const bb2 = new BikeSim(spec)
    bb2.v = v0
    let mp2 = 0
    run(bb2, 3, (t, bk) => ((mp2 = Math.max(mp2, bk.pitch)), I({ rear: 1 })))
    check(mp === 0 && mp2 === 0, `   Brake / rear brake alone from ${v0.toFixed(0)} m/s never lift the front (${deg(mp)}° / ${deg(mp2)}°)`)
  }
}
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS')
process.exit(fails ? 1 : 0)
