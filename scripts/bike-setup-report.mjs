// The set-up of each bike (SI units), what the handling model derives from it, a check of the front-lift threshold a = g x / h against the running model, and measured results
// (acceleration, stopping distance, turning, pitch response).     node scripts/bike-setup-report.mjs      (SIMULATED numbers; estimates are marked)
import { BikeSim, FIXED_DT } from '../src/game/bike/sim.ts'
import { SURRON, STREET } from '../src/game/bike/spec.ts'
const G = 9.81
let fails = 0
const check = (ok, msg) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!ok) fails++
}
const flat = () => ({ yRear: 0, yFront: 0 })
const I = (o = {}) => ({ throttle: 0, brake: 0, rear: 0, steer: 0, lean: 0, ...o })
const run = (b, sec, f) => {
  for (let t = 0; t < sec; t += 1 / 60) b.advance(1 / 60, f(t, b), flat())
}
const deg = (r) => (r * 180) / Math.PI
for (const sp of [SURRON, STREET]) {
  const m = sp.mass
  const L = sp.wheelbase
  const x = sp.comD
  const h = sp.comH
  console.log(`\n== ${sp.name}   (SI: m, kg, s, rad; * = estimate, not a measurement)`)
  console.log(`  wheelbase ${L} m (measured at in-game scale) · wheel radius ${sp.wheelR} m (measured) · mass ${sp.massBike}* kg bike + ${sp.massRider}* kg rider = ${m} kg`)
  console.log(`  combined COM ${x}* m ahead of the rear contact (${((x / L) * 100).toFixed(0)}% of the wheelbase), ${h}* m up · radius of gyration ${sp.kGyr}* m → pitch inertia about the rear contact ${(m * sp.gyr2).toFixed(1)} kg·m² (gyr2 = k² + x² + h² = ${sp.gyr2.toFixed(2)} m²)`)
  console.log(`  peak road thrust ${sp.thrustMax}* N → ${sp.accel.toFixed(2)} m/s² from rest · brakes ${sp.brakeFront}* / ${sp.brakeRear}* m/s² (front / rear) · tyre grip mu 1.0* (limit ${(G * 1.05).toFixed(1)} m/s²) · max speed ${sp.maxSpeed} m/s`)
  console.log(`  suspension travel fork ${sp.forkTravel}* m, shock ${sp.shockTravel}* m · pitch damping ${sp.pitchDamp}* 1/s (rider / tyre / frame dissipation)`)
  const nf0 = (m * G * (L - x)) / L
  const nfAcc = (m * (G * x - sp.accel * h)) / L
  const aLift = (G * x) / h
  const xRev = x - sp.revShift
  console.log(`  static front load m g (L-x)/L = ${nf0.toFixed(0)} N (${(((L - x) / L) * 100).toFixed(0)}% of the weight) ; at full thrust m (g x - a h)/L = ${nfAcc.toFixed(0)} N (still positive: the front stays down)`)
  console.log(`  front-lift threshold a = g x / h = ${aLift.toFixed(2)} m/s² (neutral posture) vs ${sp.accel.toFixed(2)} m/s² available → ordinary riding cannot lift it (margin ${((aLift / sp.accel - 1) * 100).toFixed(0)}%)`)
  console.log(`  with the weight shifted back by a REV (x → ${xRev.toFixed(2)} m): threshold ${((G * Math.max(xRev, 0)) / h).toFixed(2)} m/s²; balance angle atan(x/h) = ${deg(Math.atan2(x, h)).toFixed(0)}° neutral, ${deg(Math.atan2(Math.max(xRev, 0), h)).toFixed(0)}° with REV`)
  check(sp.accel < aLift, 'ordinary full thrust is below the unload threshold with the neutral posture')
  // the running model against the threshold: record (a, x_eff) every step through some REV taps and compare the first-lift instants with g x_eff / h
  const b = new BikeSim(sp)
  b.assist = 0.3
  let lifts = 0
  let worst = 0
  let lastPitch = 0
  let tt = 0
  for (let i = 0; i < 120 * 12; i++) {
    const t = i * FIXED_DT
    const k = Math.floor(t / 0.8)
    const press = k < 4 && t % 0.8 < 0.15 ? 1 : 0
    b.step(FIXED_DT, I({ throttle: press }), flat())
    if (b.pitch > 0.005 && lastPitch <= 0.005) {
      // at the instant the front leaves the ground the net acceleration must have exceeded the unload threshold for the posture at that time (a tolerance for the one-step lag)
      const need = (G * b.xEff) / h
      worst = Math.max(worst, need - b.accelNow)
      lifts++
    }
    lastPitch = b.pitch
    tt = t
  }
  check(lifts >= 1 && worst < 1.2, `the model lifts the front only when a ≥ g x_eff / h (${lifts} lift-offs; the worst shortfall at lift-off ${worst.toFixed(2)} m/s²)`)
  // signs: braking must give a nose-DOWN pseudo-torque, acceleration nose-UP
  const sgn = new BikeSim(sp)
  sgn.pitch = 0.3
  sgn.v = 8
  const p0 = sgn.pitchRate
  run(sgn, 0.1, () => I({ brake: 1 }))
  const down = sgn.pitchRate - p0
  const sg2 = new BikeSim(sp)
  sg2.pitch = 0.3
  sg2.v = 3
  run(sg2, 0.1, () => I({ throttle: 1 }))
  check(down < 0 && sg2.pitchRate > down, `torque directions: braking turns the nose down (${down.toFixed(2)} rad/s in 0.1 s), drive turns it up relative to braking (${sg2.pitchRate.toFixed(2)} rad/s)`)
  // measured results: acceleration
  const a = new BikeSim(sp)
  let t50 = -1
  let t80 = -1
  let a0 = 0
  let prev = 0
  run(a, 30, (t, bk) => {
    if (t > 0.05 && t < 0.4) a0 = Math.max(a0, (bk.v - prev) * 60)
    prev = bk.v
    if (t50 < 0 && bk.v > sp.maxSpeed * 0.5) t50 = t
    if (t80 < 0 && bk.v > sp.maxSpeed * 0.8) t80 = t
    return I({ throttle: 1 })
  })
  console.log(`  MEASURED acceleration: ${a0.toFixed(1)} m/s² at the start, 0 → 50% of top speed (${(sp.maxSpeed * 0.5).toFixed(0)} m/s = ${(sp.maxSpeed * 1.8).toFixed(0)} km/h) in ${t50.toFixed(1)} s, 0 → 80% in ${t80.toFixed(1)} s, ${a.v.toFixed(1)} m/s after 30 s`)
  // stopping distance
  const stops = []
  for (const v0 of [10, 20]) {
    const s = new BikeSim(sp)
    s.v = v0
    let d = 0
    let t = 0
    while (s.v > 0.05 && t < 10) {
      s.advance(1 / 60, I({ brake: 1 }), flat())
      d += Math.max(0, s.v) / 60
      t += 1 / 60
    }
    stops.push(`${v0} m/s (${(v0 * 3.6).toFixed(0)} km/h): ${d.toFixed(1)} m in ${t.toFixed(1)} s`)
  }
  console.log(`  MEASURED stopping (both brakes): ${stops.join(' · ')}`)
  // turning: low-speed radius and a fast sweeper
  const lo = new BikeSim(sp)
  lo.v = 4
  run(lo, 2, () => I({ throttle: 0.15, steer: 1 }))
  const hi = new BikeSim(sp)
  hi.v = sp.maxSpeed * 0.6
  run(hi, 2, () => I({ throttle: 0.3, steer: 0.4 }))
  console.log(`  MEASURED turning: at ${lo.v.toFixed(1)} m/s full lock turns ${deg(Math.abs(lo.h)).toFixed(0)}° in 2 s (radius ≈ ${(lo.v / Math.max(0.01, Math.abs(lo.h) / 2)).toFixed(1)} m); at ${hi.v.toFixed(0)} m/s a gentle input leans ${deg(Math.abs(hi.roll)).toFixed(0)}° with bars at ${deg(Math.abs(hi.delta)).toFixed(1)}°`)
  // pitch response to REV taps
  const resp = []
  for (const n of [1, 2, 3]) {
    const c = new BikeSim(sp)
    let pk = 0
    let tUp = 0
    let tSettle = -1
    run(c, 7, (t, bk) => {
      pk = Math.max(pk, bk.pitch)
      if (bk.pitch > 0.05) tUp = t
      const k = Math.floor(t / 0.7)
      return I({ throttle: k < n && t % 0.7 < 0.15 ? 1 : 0 })
    })
    tSettle = tUp
    resp.push(`${n} tap${n > 1 ? 's' : ''}: peak ${deg(pk).toFixed(0)}° front down by ${tSettle.toFixed(1)} s`)
  }
  console.log(`  MEASURED pitch response (0.15 s taps, 0.7 s apart, from rest): ${resp.join(' · ')}`)
  // pitch rate response and overbalance
  const ob = new BikeSim(sp)
  ob.v = 3
  ob.pitch = 1.1
  ob.pitchRate = 0.5
  run(ob, 3, () => I())
  console.log(`  MEASURED overbalance: released at 63° with 0.5 rad/s → ${ob.crashed ?? 'recovered'} (${deg(ob.pitch).toFixed(0)}° after 3 s)`)
}
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS')
process.exit(fails ? 1 : 0)
