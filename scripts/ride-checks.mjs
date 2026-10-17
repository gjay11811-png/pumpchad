// Riding checks on the model (no browser): ordinary riding stays planted (Gas only accelerates; no gas-tap wheelies); the WHEELIE button lifts smoothly into a held wheelie that Gas raises
// and Brake lowers; a rear-fender scrape is supported by the ground, can be sustained and braked out of; nothing flips in normal stunts.   node scripts/ride-checks.mjs  (SIMULATED)
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
/** press the Wheelie button at time t0 (a 0.1 s press) */
const wb = (t, t0 = 0.1) => t >= t0 && t < t0 + 0.1
for (const spec of [SURRON, STREET]) {
  console.log(`\n== ${spec.name}`)
  // 1. ordinary riding: pull away, build speed, cruise: planted, smooth, no hop
  const n = new BikeSim(spec)
  let nmax = 0
  let jerk = 0
  let lv = 0
  run(n, 14, (t, bk) => {
    nmax = Math.max(nmax, bk.pitch)
    if (t > 0.3) jerk = Math.max(jerk, Math.abs(bk.v - lv) * 60)
    lv = bk.v
    return I({ throttle: 1 })
  })
  check(nmax === 0 && !n.crashed && n.v > spec.maxSpeed * 0.75 && jerk < spec.accel * 1.15, `1. Gas pulls away normally: front never leaves the road (${deg(nmax)}°), ${n.v.toFixed(1)} m/s after 14 s (${((n.v / spec.maxSpeed) * 100).toFixed(0)}% of top), peak acceleration ${jerk.toFixed(1)} m/s²`)
  // 2. no gas-tap wheelies: taps, repeated taps, held gas at several speeds
  let tapMax = 0
  for (const v0 of [0, 3, 8]) {
    const t = new BikeSim(spec)
    t.v = v0
    run(t, 6, (tt, bk) => ((tapMax = Math.max(tapMax, bk.pitch)), I({ throttle: tt % 0.4 < 0.15 ? 1 : 0 })))
  }
  check(tapMax === 0, `2. Gas taps never lift the front (peak ${deg(tapMax)}°, taps at 0, 3 and 8 m/s)`)
  // 3. the Wheelie button: press once → smooth lift into the balance region, from a standstill and at speed
  for (const v0 of [0, 5]) {
    const w = new BikeSim(spec)
    w.v = v0
    let step = 0
    let lp = 0
    let pk = 0
    run(w, 3, (t, bk) => {
      step = Math.max(step, Math.abs(bk.pitch - lp))
      lp = bk.pitch
      pk = Math.max(pk, bk.pitch)
      return I({ wheelie: wb(t) })
    })
    check(w.wheelieOn && w.pitch > 0.25 && w.pitch < 0.75 && step < 0.03 && !w.crashed, `3. Wheelie pressed once at ${v0} m/s: lifts smoothly (${(step * 1000).toFixed(0)} mrad/frame at most) to ${deg(w.pitch)}° and holds (peak ${deg(pk)}°)`)
  }
  // 4. hold a wheelie for 12 s with modest Gas / Brake corrections: no fall, stays in the 15-45° region
  const h = new BikeSim(spec)
  let inRegion = 0
  let hpk = 0
  run(h, 12.1, (t, bk) => {
    if (t > 0.5 && bk.pitch > 0.26 && bk.pitch < 0.8) inRegion += 1 / 60
    hpk = Math.max(hpk, bk.pitch)
    // modest corrections: a little Gas when it sinks low, a touch of Brake when it climbs high
    return I({ wheelie: wb(t), throttle: bk.pitch < 0.44 && t > 0.6 ? 0.5 : 0, brake: bk.pitch > 0.7 ? 0.5 : 0 })
  })
  check(h.wheelieOn && !h.crashed && inRegion > 10 && hpk < 1.0, `4. a wheelie held for 12 s with modest corrections: ${inRegion.toFixed(1)} s in the 15-45° region, peak ${deg(hpk)}°, no fall (${h.crashed ?? 'ok'}), ${h.v.toFixed(1)} m/s at the end`)
  // 5. Gas raises it, Brake lowers it
  const g = new BikeSim(spec)
  let before = 0
  let high = 0
  run(g, 8, (t, bk) => {
    if (t > 2.4 && t < 2.6) before = bk.pitch
    if (t > 5.4 && t < 5.6) high = bk.pitch
    return I({ wheelie: wb(t), throttle: t > 3 && t < 5.5 ? 1 : 0 })
  })
  check(high > before + 0.15, `5. Gas raises the wheelie (${deg(before)}° before, ${deg(high)}° with Gas held)`)
  const bl = new BikeSim(spec)
  let t0g = -1
  let step5 = 0
  let lp5 = 0
  let ended = -1
  run(bl, 10, (t, bk) => {
    step5 = Math.max(step5, Math.abs(bk.pitch - lp5))
    lp5 = bk.pitch
    if (t > 3 && t0g < 0) t0g = t
    if (t0g > 0 && ended < 0 && bk.pitch < 0.03) ended = t - t0g
    return I({ wheelie: wb(t), throttle: t < 3 ? 0.5 : 0, brake: t > 3 ? 1 : 0 })
  })
  check(ended > 0.4 && ended < 3 && !bl.crashed && step5 < 0.03 && !bl.wheelieOn, `   Brake lowers it progressively to the ground in ${ended.toFixed(1)} s (biggest step ${(step5 * 1000).toFixed(0)} mrad/frame), the mode ends`)
  // press again lowers it smoothly
  const pa = new BikeSim(spec)
  let down = -1
  run(pa, 8, (t, bk) => {
    if (t > 4.1 && down < 0 && bk.pitch < 0.03) down = t - 4.1
    return I({ wheelie: wb(t) || wb(t, 4) })
  })
  check(down > 0.5 && down < 4 && !pa.wheelieOn && !pa.crashed, `   pressing Wheelie again lowers it smoothly (${down.toFixed(1)} s)`)
  // 6. the rear scrape: Gas leans it back until the tail bar meets the ground; the ground supports it (no pass-through, no bounce), friction slows the bike, the rider stays on,
  //    and a short Brake press brings it back into a wheelie
  const sc = new BikeSim(spec)
  const thS = Math.atan2(spec.tailH, -spec.tailX)
  let enter = -1
  let scrapeTime = 0
  let maxPast = 0
  let bounce = 0
  let lastP = 0
  let vIn = 0
  let vOut = 0
  let back = -1
  run(sc, 10, (t, bk) => {
    maxPast = Math.max(maxPast, bk.pitch - thS)
    if (bk.scrape.part === 'tail') {
      if (enter < 0) {
        enter = t
        vIn = bk.v
      }
      if (t < 6) scrapeTime += 1 / 60
      vOut = bk.v
    }
    if (enter > 0 && lastP - bk.pitch > 0.04) bounce++
    lastP = bk.pitch
    if (t > 6.2 && back < 0 && bk.pitch < thS - 0.12) back = t - 6.2
    return I({ wheelie: wb(t), throttle: t > 2.5 && t < 6 ? 1 : 0, brake: t > 6 && t < 6.5 ? 0.9 : 0 })
  })
  check(enter > 0 && scrapeTime > 1.5 && maxPast < 0.06 && !sc.crashed, `6. rear scrape at ${deg(thS)}° (tail bar ${spec.tailH} m up, ${-spec.tailX} m behind the contact): entered at ${enter.toFixed(1)} s, sustained ${scrapeTime.toFixed(1)} s, never passed ${(maxPast * 57.3).toFixed(1)}° into the ground, no crash`)
  check(bounce === 0 && vOut > 0, `   no bouncing off the ground (${bounce} rebounds), the bike keeps moving (${vIn.toFixed(1)} → ${vOut.toFixed(1)} m/s)`)
  check(back > 0 && back < 1.5 && sc.wheelieOn && sc.pitch > 0.2, `   a short Brake press brings it back off the scrape into a wheelie (${back.toFixed(2)} s; ${deg(sc.pitch)}° after)`)
  // 7. steering in a wheelie: turns, leans, no crash
  for (const dir of [1, -1]) {
    const st = new BikeSim(spec)
    st.v = 4
    let roll = 0
    let pmin = 9
    run(st, 5, (t, bk) => {
      if (t > 3) (roll = Math.max(roll, Math.abs(bk.roll))), (pmin = Math.min(pmin, bk.pitch))
      return I({ wheelie: wb(t), throttle: 0.3, steer: t > 2 ? 0.5 * dir : 0 })
    })
    check(!st.crashed && Math.sign(st.h) === -dir && Math.abs(st.h) > 0.1 && roll > 0.05 && pmin > 0.1, `7. steering ${dir > 0 ? 'right' : 'left'} in a wheelie: turned ${deg(Math.abs(st.h))}°, leaned ${deg(roll)}°, front stays up (min ${deg(pmin)}°), no crash`)
  }
  // 8. braking: Brake alone never lifts the front; with Gas pressed the Brake still lowers a wheelie
  for (const v0 of [0, 3, 8, 15, spec.maxSpeed * 0.9]) {
    const bb = new BikeSim(spec)
    bb.v = v0
    let mp = 0
    run(bb, 3, (t, bk) => ((mp = Math.max(mp, bk.pitch)), I({ brake: 1 })))
    check(mp === 0, `8. Brake alone from ${v0.toFixed(0)} m/s never lifts the front (${deg(mp)}°)`)
  }
  const gb = new BikeSim(spec)
  let ghp = 0
  run(gb, 8, (t, bk) => {
    if (t > 4 && t < 4.2) ghp = bk.pitch
    return I({ wheelie: wb(t), throttle: 1, brake: t > 4 ? 1 : 0 })
  })
  check(gb.pitch < ghp - 0.2 && !gb.crashed, `   Brake with Gas still pressed lowers the wheelie (${deg(ghp)}° → ${deg(gb.pitch)}°)`)
  // short Brake presses give progressive corrections
  const sb = new BikeSim(spec)
  const ps = []
  run(sb, 6, (t, bk) => {
    if (Math.abs(t - 2.95) < 0.01 || Math.abs(t - 3.55) < 0.01 || Math.abs(t - 4.25) < 0.01) ps.push(bk.pitch)
    return I({ wheelie: wb(t), throttle: 0.4, brake: (t > 3 && t < 3.15) || (t > 3.6 && t < 4.2) ? 0.7 : 0 })
  })
  check(ps.length === 3 && ps[1] < ps[0] - 0.01 && ps[2] < ps[1] - 0.02, `   short Brake presses give progressive corrections (${ps.map((p) => deg(p) + '°').join(' → ')})`)
}
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS')
process.exit(fails ? 1 : 0)
