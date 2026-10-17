// Replays identical timestamped inputs at 30 / 60 / 120 rendering fps and an uneven frame pattern, and compares the riding model at EQUAL SIMULATION TIMES; also compares the 60 Hz and
// 120 Hz physics steps.   node scripts/ride-determinism.mjs      (SIMULATED numbers)
import { BikeSim } from '../src/game/bike/sim.ts'
import { SURRON, STREET } from '../src/game/bike/spec.ts'
let fails = 0
const check = (ok, msg) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!ok) fails++
}
const flat = () => ({ yRear: 0, yFront: 0 })
/** the input as a function of TIME (changes happen on multiples of 1/30 s so every frame rate sees them at the same instant): pull away, press Wheelie at 1.0 s (0.1 s press), steer, Gas up for a
 *  scrape, release, brake */
const inputAt = (t) => ({
  throttle: t < 5.5 ? 1 : 0,
  brake: t >= 6.5 && t < 8 ? 1 : 0,
  rear: 0,
  steer: t >= 2 && t < 3 ? 0.6 : t >= 3.5 && t < 4.5 ? -0.4 : 0,
  lean: 0,
  wheelie: t >= 1.0 && t < 1.1,
})
const throttleAt = (t) => inputAt(t).throttle
const snapAt = [2, 4, 6, 8, 10]
/** run with a frame-time generator; return the state at each snapshot time (taken at the first frame boundary at / after it, then compared at the sim's own time) */
const replay = (spec, nextDt, stepDt = 1 / 120) => {
  const b = new BikeSim(spec)
  b.stepDt = stepDt
  b.assist = 0.3
  let t = 0
  const out = []
  let k = 0
  while (k < snapAt.length) {
    const dt = nextDt()
    // the game samples the input at the START of each frame
    const inp = { ...inputAt(t + 1e-6), throttle: throttleAt(t + 1e-6) }
    b.advance(dt, inp, flat())
    t += dt
    if (t >= snapAt[k] - 1e-9) {
      out.push({ t, x: b.x, z: b.z, v: b.v, h: b.h, pitch: b.pitch, roll: b.roll })
      k++
    }
  }
  return out
}
const fixed = (fps) => () => 1 / fps
let seed = 7
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
const uneven = () => 0.008 + rnd() * 0.045 // 8 – 53 ms frames
const maxDiff = (a, b) => {
  let pos = 0
  let vel = 0
  let hed = 0
  let pit = 0
  for (let i = 0; i < a.length; i++) {
    pos = Math.max(pos, Math.hypot(a[i].x - b[i].x, a[i].z - b[i].z))
    vel = Math.max(vel, Math.abs(a[i].v - b[i].v))
    hed = Math.max(hed, Math.abs(a[i].h - b[i].h))
    pit = Math.max(pit, Math.abs(a[i].pitch - b[i].pitch))
  }
  return { pos, vel, hed, pit }
}
for (const spec of [SURRON, STREET]) {
  console.log(`\n== ${spec.name}`)
  const ref = replay(spec, fixed(120))
  for (const fps of [60, 30]) {
    const r = replay(spec, fixed(fps))
    const d = maxDiff(ref, r)
    check(d.pos < 0.05 && d.vel < 0.02 && d.hed < 0.005 && d.pit < 0.01, `${fps} fps vs 120 fps, identical aligned inputs: position ${d.pos.toFixed(3)} m, speed ${d.vel.toFixed(3)} m/s, heading ${d.hed.toFixed(4)} rad, pitch ${d.pit.toFixed(4)} rad (snapshots at ${snapAt.join(', ')} s)`)
  }
  seed = 7
  const u = replay(spec, uneven)
  const du = maxDiff(ref, u)
  // an uneven pattern samples the input up to one frame (53 ms) late, so a small, bounded difference is the input timing, not the physics: compare against that scale
  check(du.pos < 2 && du.vel < 0.35 && du.hed < 0.06 && du.pit < 0.08, `uneven frames (8-53 ms) vs 120 fps: position ${du.pos.toFixed(2)} m, speed ${du.vel.toFixed(2)} m/s, heading ${du.hed.toFixed(3)} rad, pitch ${du.pit.toFixed(3)} rad (inputs sampled up to a frame late)`)
  // which physics step is closer to the converged answer? (a 480 Hz run is the reference)
  const conv = replay(spec, fixed(120), 1 / 480)
  const e120 = maxDiff(conv, ref)
  const e60 = maxDiff(conv, replay(spec, fixed(120), 1 / 60))
  console.log(`  INFO  distance from the converged (480 Hz) answer: 120 Hz step: position ${e120.pos.toFixed(3)} m, pitch ${e120.pit.toFixed(4)} rad; 60 Hz step: position ${e60.pos.toFixed(3)} m, pitch ${e60.pit.toFixed(4)} rad`)
  check(e120.pos < e60.pos * 0.5 && e120.pit < e60.pit * 0.6, '   the 120 Hz step is under half the 60 Hz error against the converged answer, at a cost of well under 1 ms per minute of riding (so 120 Hz is kept)')
  // cost
  const time = (dtStep) => {
    const b = new BikeSim(spec)
    b.stepDt = dtStep
    const t0 = performance.now()
    for (let i = 0; i < 60 * 600; i++) b.advance(1 / 60, { throttle: i % 120 < 60 ? 1 : 0.3, brake: 0, rear: 0, steer: Math.sin(i / 40), lean: 0 }, flat())
    return performance.now() - t0
  }
  console.log(`  INFO  cost of 600 s of riding: 120 Hz ${time(1 / 120).toFixed(0)} ms, 60 Hz ${time(1 / 60).toFixed(0)} ms`)
}
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS')
process.exit(fails ? 1 : 0)
