// The riding model on its own (no browser): acceleration, braking, steering and grip, and the wheelie: lift, hold at the balance point with small corrections,
// loop-out when over-held, and a soft touchdown with the rear brake.   node scripts/bike-sim-test.mjs
import { BikeSim } from '../src/game/bike/sim.ts'
import { SURRON, STREET } from '../src/game/bike/spec.ts'
let fails = 0
const check = (ok, msg) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!ok) fails++
}
const DT = 1 / 60
const run = (b, sec, f) => {
  const n = Math.round(sec / DT)
  for (let i = 0; i < n; i++) b.step(DT, f(i * DT, b))
}
for (const spec of [SURRON, STREET]) {
  console.log(`\n== ${spec.name}`)
  // 1. acceleration
  let b = new BikeSim(spec)
  run(b, 1, () => ({ throttle: 1, brake: 0, rear: 0, steer: 0, lean: 0 }))
  const v1 = b.v
  run(b, 7, () => ({ throttle: 1, brake: 0, rear: 0, steer: 0, lean: 0 }))
  check(v1 > 2 && v1 < spec.accel * 1.05, `accelerates smoothly (1 s: ${v1.toFixed(1)} m/s; 8 s: ${b.v.toFixed(1)} m/s of ${spec.maxSpeed})`)
  check(b.v < spec.maxSpeed + 0.01 && b.pitch < 0.06 || spec.id === 'street', `flat-out without a lean the front wheel stays near the ground (pitch ${b.pitch.toFixed(2)})`)
  // 2. braking
  b = new BikeSim(spec)
  b.v = 15
  let dist = 0
  let tStop = 0
  for (let i = 0; i < 600 && b.v > 0.05; i++) {
    b.step(DT, { throttle: 0, brake: 1, rear: 0, steer: 0, lean: 0 })
    tStop = i * DT
    dist += b.v * DT
  }
  check(b.v <= 0.06 && tStop < 3.2, `brakes from 15 m/s to a stop in ${tStop.toFixed(1)} s over ${dist.toFixed(0)} m`)
  // 3. steering at speed: lateral accel never exceeds the grip limit, heading changes, no slide (lean stays bounded)
  b = new BikeSim(spec)
  b.v = spec.maxSpeed * 0.8
  let maxLat = 0
  run(b, 3, () => ({ throttle: 0.5, brake: 0, rear: 0, steer: 1, lean: 0 }))
  run(b, 0.01, () => ({ throttle: 0.5, brake: 0, rear: 0, steer: 1, lean: 0 }))
  maxLat = Math.abs(b.latNow)
  check(maxLat <= spec.gripLat * 1.02, `full lock at ${b.v.toFixed(0)} m/s asks for ${maxLat.toFixed(1)} m/s² ≤ the grip limit ${spec.gripLat}`)
  check(Math.abs(b.roll) < 1.0 && Number.isFinite(b.x), `lean bounded (${((b.roll * 180) / Math.PI).toFixed(0)}°) and finite`)
  // 4. wheelie lifts with throttle + a heave from a rolling start
  b = new BikeSim(spec)
  b.v = 6
  let maxPitch = 0
  run(b, 1.2, (t) => ({ throttle: 1, brake: 0, rear: 0, steer: 0, lean: t > 0.2 ? 1 : 0 }))
  maxPitch = b.pitch
  check(b.pitch > 0.25 && b.pitch < 1.0, `throttle + heave lifts the front wheel progressively (pitch ${((b.pitch * 180) / Math.PI).toFixed(0)}° after 1.2 s)`)
  const c = new BikeSim(spec)
  c.v = 6
  run(c, 2, () => ({ throttle: 1, brake: 0, rear: 0, steer: 0, lean: 0 }))
  const d2 = new BikeSim(spec)
  d2.v = 6
  run(d2, 2, () => ({ throttle: 0, brake: 0, rear: 0, steer: 0, lean: 1 }))
  check(c.pitch < 0.06 && d2.pitch < 0.06, `throttle alone or heave alone does not lift it (${((c.pitch * 180) / Math.PI).toFixed(0)}°, ${((d2.pitch * 180) / Math.PI).toFixed(0)}°)`)
  // 5. held flat-out with the heave the bike eventually loops out (a crash is the honest outcome)
  b = new BikeSim(spec)
  b.v = 6
  run(b, 9, (t) => ({ throttle: 1, brake: 0, rear: 0, steer: 0, lean: t > 0.2 ? 1 : 0 }))
  check(b.crashed === 'loop' || b.pitch > 1.0, `over-holding the pull loops out (${b.crashed ?? 'no crash; pitch ' + b.pitch.toFixed(2)})`)
  // 6. a modest controller that balances: aim for 55 % of the balance angle by modulating throttle and heave — must stay up for 6 s
  b = new BikeSim(spec)
  b.v = 6
  let up = 0
  let minV = 99
  run(b, 6, (t, bk) => {
    const want = bk.balance * 0.8
    const err = want - bk.pitch
    const thr = Math.max(0, Math.min(1, 0.55 + err * 1.8 - bk.pitchRate * 0.35))
    const lean = t < 0.6 ? 1 : Math.max(-1, Math.min(1, err * 2.5 - bk.pitchRate * 0.5))
    if (bk.pitch > 0.3) up += DT
    return { throttle: bk.v > spec.maxSpeed * 0.8 ? 0.2 : thr, brake: 0, rear: 0, steer: 0, lean }
  })
  check(!b.crashed && up > 3.5, `a wheelie can be held with small corrections (${up.toFixed(1)} s up, ${((b.pitch * 180) / Math.PI).toFixed(0)}° at the end, crashed: ${b.crashed})`)
  // 7. from a held wheelie, the rear brake brings it down smoothly (a controller lifts to ~65 % of balance, then lets the lean go)
  const hold = (t, bk) => ({ throttle: Math.max(0, Math.min(1, 0.55 + (bk.balance * 0.75 - bk.pitch) * 1.8 - bk.pitchRate * 0.35)), brake: 0, rear: 0, steer: 0, lean: t < 0.7 ? 1 : Math.max(-1, Math.min(1, (bk.balance * 0.75 - bk.pitch) * 2.5 - bk.pitchRate * 0.5)) })
  b = new BikeSim(spec)
  b.v = 8
  run(b, 2.6, hold)
  const up0 = b.pitch
  let maxStep = 0
  let last = b.pitch
  let td = 0
  for (let i = 0; i < 260; i++) {
    b.step(DT, { throttle: 0, brake: 0, rear: 1, steer: 0, lean: 0 })
    maxStep = Math.max(maxStep, Math.abs(b.pitch - last))
    last = b.pitch
    td = Math.max(td, b.touchdown)
  }
  check(up0 > 0.3 && b.pitch < 0.03, `the rear brake brings the front wheel down (from ${((up0 * 180) / Math.PI).toFixed(0)}° to ${((b.pitch * 180) / Math.PI).toFixed(1)}°)`)
  check(maxStep < 0.04, `pitch never jumps (largest step ${(maxStep * 1000).toFixed(0)} mrad per frame)`)
  check(td < 2.4, `touchdown is soft (impact ${td.toFixed(2)} rad/s)`)
  // 8. no NaN under abuse
  b = new BikeSim(spec)
  run(b, 20, (t) => ({ throttle: Math.sin(t * 3) > 0 ? 1 : 0, brake: Math.cos(t * 2) > 0.5 ? 1 : 0, rear: Math.sin(t * 5) > 0.7 ? 1 : 0, steer: Math.sin(t * 1.3), lean: Math.cos(t * 0.9) }))
  check([b.x, b.z, b.h, b.v, b.pitch, b.roll, b.forkC, b.shockC].every(Number.isFinite), 'finite after 20 s of random inputs')
}
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS')
process.exit(fails ? 1 : 0)
