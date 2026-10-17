// The riding model on its own (no browser): fixed-step physics that behaves the same at any frame rate; acceleration, braking, steering and grip; slopes;
// the wheelie (lift, hold by small corrections, loop-out when over-held, rear-brake recovery, soft touchdown, momentum kept); the optional assist; suspension.
//   node scripts/bike-sim-test.mjs          (SIMULATED numbers only: this says nothing about how the riding FEELS)
import { BikeSim } from '../src/game/bike/sim.ts'
import { SURRON, STREET } from '../src/game/bike/spec.ts'
let fails = 0
const check = (ok, msg) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!ok) fails++
}
const flat = () => ({ yRear: 0, yFront: 0 })
const slopeGround = (grade, spec) => () => ({ yRear: 0, yFront: grade * spec.wheelbase })
/** run for `sec` of game time at a frame time of `fdt`, input from f(t, bike) */
const run = (b, sec, f, fdt = 1 / 60, gr = flat) => {
  let t = 0
  while (t < sec) {
    b.advance(fdt, f(t, b), gr())
    t += fdt
  }
}
const I = (o = {}) => ({ throttle: 0, brake: 0, rear: 0, steer: 0, lean: 0, ...o })
const deg = (r) => Math.round((r * 180) / Math.PI)
for (const spec of [SURRON, STREET]) {
  console.log(`\n== ${spec.name}`)
  // 1. acceleration, momentum, throttle release and rolling resistance
  let b = new BikeSim(spec)
  // (the gas lifts the front now, so the plain acceleration / hill checks hold the rider's weight forward, the C key, to keep the front planted)
  run(b, 1, () => I({ throttle: 1, lean: -1 }))
  const v1 = b.v
  run(b, 7, () => I({ throttle: 1, lean: -1 }))
  const v8 = b.v
  check(v1 > 2 && v1 < spec.accel * 1.05 && v8 > spec.maxSpeed * 0.6, `progressive acceleration (1 s ${v1.toFixed(1)}, 8 s ${v8.toFixed(1)} of ${spec.maxSpeed} m/s)`)
  run(b, 0.5, () => I())
  const vc = b.v
  run(b, 6, () => I())
  check(vc < v8 && vc > v8 * 0.6 && b.v < vc && b.v > 0.1, `throttle release: it coasts, slowing gradually (${v8.toFixed(1)} → ${vc.toFixed(1)} after 0.5 s → ${b.v.toFixed(1)} after 6.5 s)`)
  // 2. braking
  b = new BikeSim(spec)
  b.v = 15
  b.advance(1 / 60, I(), flat())
  let dist = 0
  let tStop = 0
  for (let i = 0; i < 600 && b.v > 0.05; i++) {
    b.advance(1 / 60, I({ brake: 1 }), flat())
    dist += b.v / 60
    tStop = i / 60
  }
  check(b.v <= 0.06 && tStop < 3.2, `brakes from 15 m/s to a stop in ${tStop.toFixed(1)} s over ${dist.toFixed(0)} m`)
  const bd = new BikeSim(spec)
  bd.v = 15
  run(bd, 0.6, () => I({ brake: 1 }))
  check(bd.forkC > spec.forkTravel * 0.1 && bd.chassis > 0, `braking loads the front: fork ${bd.forkC.toFixed(3)} m, chassis nose-down ${(bd.chassis * 57.3).toFixed(1)}°`)
  // 3. steering and grip
  b = new BikeSim(spec)
  b.v = spec.maxSpeed * 0.8
  run(b, 3, () => I({ throttle: 0.5, steer: 1 }))
  check(Math.abs(b.latNow) <= spec.gripLat * 1.35 && Math.abs(b.roll) < 1.0 && Number.isFinite(b.x), `full lock at ${b.v.toFixed(0)} m/s: ${b.latNow.toFixed(1)} m/s² (limit ${spec.gripLat}), lean ${deg(b.roll)}°, slide ${b.vlat.toFixed(2)} m/s`)
  const lo = new BikeSim(spec)
  lo.v = 3
  run(lo, 1.5, () => I({ throttle: 0.2, steer: 1 }))
  const hi = new BikeSim(spec)
  hi.v = spec.maxSpeed * 0.7
  run(hi, 1.5, () => I({ throttle: 0.5, steer: 1 }))
  check(Math.abs(lo.h) > Math.abs(hi.h) * 1.2 && Math.abs(hi.delta) < Math.abs(lo.delta), `manoeuvrable when slow, calm when fast (turned ${deg(Math.abs(lo.h))}° at ${lo.v.toFixed(0)} m/s vs ${deg(Math.abs(hi.h))}° at ${hi.v.toFixed(0)} m/s; bars ${deg(lo.delta)}° vs ${deg(hi.delta)}°)`)
  run(b, 2.5, () => I({ throttle: 0.4 }))
  check(Math.abs(b.roll) < 0.06, `the lean returns upright once the turn ends (${deg(b.roll)}°)`)
  b = new BikeSim(spec)
  run(b, 3, () => I({ throttle: 1 }))
  check(Math.abs(b.x) < 1e-9 && Math.abs(b.vlat) < 1e-9, 'straight line: no sideways drift')
  b = new BikeSim(spec)
  b.v = 12
  let slide = 0
  run(b, 1.2, (t, bk) => {
    slide = Math.max(slide, Math.abs(bk.vlat))
    return I({ steer: 0.45, rear: 1 })
  })
  const c0 = new BikeSim(spec)
  c0.v = 12
  let slide0 = 0
  run(c0, 1.2, (t, bk) => {
    slide0 = Math.max(slide0, Math.abs(bk.vlat))
    return I({ steer: 0.45 })
  })
  check(slide > 0.15 && slide < 2.7 && slide0 < 0.05, `a slide appears only with the rear brake locked in a turn (peak ${slide.toFixed(2)} m/s vs ${slide0.toFixed(2)} without)`)
  // 4. slopes
  const hold = new BikeSim(spec)
  hold.v = 3
  run(hold, 6, () => I({ rear: 1 }), 1 / 60, slopeGround(0.08, spec))
  check(Math.abs(hold.v) < 0.05, 'a braked bike stays put on a slope')
  const gentle = new BikeSim(spec)
  run(gentle, 3, () => I(), 1 / 60, slopeGround(0.08, spec))
  check(Math.abs(gentle.v) < 0.05, 'a stopped bike is held on a gentle slope (8 %)')
  const steep = new BikeSim(spec)
  run(steep, 4, () => I(), 1 / 60, slopeGround(-0.3, spec))
  check(steep.v > 1, `a steep downhill rolls the bike when nothing holds it (${steep.v.toFixed(1)} m/s)`)
  const up = new BikeSim(spec)
  run(up, 4, () => I({ throttle: 1, lean: -1 }), 1 / 60, slopeGround(0.12, spec))
  const flatv = new BikeSim(spec)
  run(flatv, 4, () => I({ throttle: 1, lean: -1 }))
  check(up.v > 3 && up.v < flatv.v * 0.95, `starting and climbing a 12 % hill works but is slower (${up.v.toFixed(1)} vs ${flatv.v.toFixed(1)} m/s)`)
  // 5. wheelie
  b = new BikeSim(spec)
  b.v = 6
  b.assist = 0
  run(b, 1.2, (t) => I({ throttle: 1, lean: t > 0.2 ? 1 : 0 }))
  check(b.pitch > 0.18 && b.pitch < 1.0, `throttle + heave lifts the front wheel progressively (${deg(b.pitch)}° after 1.2 s)`)
  // THE GAS lifts the front, progressively, from a standstill, and the bike only creeps while it is up
  const st0 = new BikeSim(spec)
  st0.assist = 0.3
  let maxStepG = 0
  let lastG = 0
  let t15 = -1
  let vAt15 = 0
  let tt0 = 0
  run(st0, 1.5, (t, bk) => {
    maxStepG = Math.max(maxStepG, Math.abs(bk.pitch - lastG))
    lastG = bk.pitch
    tt0 = t
    if (t15 < 0 && bk.pitch > 0.26) (t15 = t), (vAt15 = bk.v)
    return I({ throttle: 1 })
  })
  check(t15 > 0.3 && t15 < 2 && maxStepG < 0.02, `gas from a standstill lifts the front progressively (15° after ${t15.toFixed(1)} s, largest step ${(maxStepG * 1000).toFixed(0)} mrad per frame)`)
  check(vAt15 < 2.2 && st0.v < 6, `...and the bike only creeps forward while the front is up (${vAt15.toFixed(1)} m/s at 15°, ${st0.v.toFixed(1)} m/s after 3 s)`)
  // short taps raise and hold the wheelie without a surge
  const tap = new BikeSim(spec)
  tap.assist = 0.3
  let tapMax = 0
  let tapUp = 0
  run(tap, 5, (t, bk) => (tapMax = Math.max(tapMax, bk.pitch), bk.pitch > 0.1 && (tapUp += 1 / 60), I({ throttle: t % 1 < 0.25 ? 1 : 0 })))
  check(tapMax > 0.15 && tapUp > 2 && tap.v < 5, `short gas taps (0.25 s) raise it and keep it up without a surge (peak ${deg(tapMax)}°, up ${tapUp.toFixed(1)} s of 5, speed ${tap.v.toFixed(1)} m/s)`)
  // no low angle cap: a rider (reaction time 0.25 s) can balance it far beyond the old 35° ceiling, up to near vertical, with the gas and the brake
  for (const tgt of [0.6, 1.1]) {
    const hb = new BikeSim(spec)
    hb.assist = 0.3
    const hist = []
    let held = 0
    let maxp = 0
    let tt = 0
    while (tt < 10 && !hb.crashed) {
      hist.push([hb.pitch, hb.pitchRate])
      const [pp, rr] = hist[Math.max(0, hist.length - 1 - 15)]
      const pred = pp + rr * 0.25
      hb.advance(1 / 60, I({ throttle: pred < tgt ? 1 : 0, brake: pred > tgt + 0.3 ? 1 : 0 }), flat())
      tt += 1 / 60
      if (hb.pitch > tgt - 0.25) held += 1 / 60
      maxp = Math.max(maxp, hb.pitch)
    }
    check(!hb.crashed && held > (tgt > 1.2 ? 1.5 : 2.5) && maxp > tgt - 0.12, `it can be balanced at ${deg(tgt)}° with small gas / brake corrections (${held.toFixed(1)} s there, peak ${deg(maxp)}°)`)
  }
  // past the recoverable point it falls over backwards, smoothly: no snap in either direction
  const fall = new BikeSim(spec)
  fall.v = 3
  fall.pitch = 1.38
  fall.pitchRate = 0.5
  let fallStep = 0
  let fallBack = false
  let fl = fall.pitch
  run(fall, 3, () => {
    fallStep = Math.max(fallStep, Math.abs(fall.pitch - fl))
    if (fall.pitch < fl - 1e-6) fallBack = true
    fl = fall.pitch
    return I()
  })
  check(fall.crashed === 'loop' && fall.pitch > 1.5 && !fallBack && fallStep < 0.04, `past the recoverable point it goes over backwards and never snaps upright (${fall.crashed}, ${deg(fall.pitch)}°, biggest step ${(fallStep * 1000).toFixed(0)} mrad per frame)`)
  const save = new BikeSim(spec)
  save.v = 3
  save.pitch = 1.38
  save.pitchRate = 0.5
  run(save, 3, () => I({ brake: 1 }))
  check(!save.crashed && save.pitch < 0.05, 'the same moment is still recoverable with the Brake (it brings the front down)')
  // easing off lowers it gradually, Brake lowers it faster
  const lower = (brake) => {
    const r = new BikeSim(spec)
    r.v = 3
    r.assist = 0.3
    let g = 0
    while (g < 6 && r.pitch < 0.7) (r.advance(1 / 60, I({ throttle: 1 }), flat()), (g += 1 / 60)) // lift to 40° (full throttle held longer goes over backwards)
    const p0 = r.pitch
    let tt = 0
    let rise = false
    let peak = r.pitch
    let lp = r.pitch
    while (tt < 8 && r.pitch > 0.02 && !r.crashed) {
      r.advance(1 / 60, I({ throttle: 0, brake }), flat())
      if (r.pitch > peak) peak = r.pitch
      else if (r.pitch > lp + 0.004 && r.pitch < peak - 0.02) rise = true // a rebound after it has started down
      lp = r.pitch
      tt += 1 / 60
    }
    return { p0, t: tt, rise, crashed: r.crashed, td: r.lastTouchdown, over: peak - p0 }
  }
  const ease = lower(0)
  const brk = lower(1)
  check(ease.p0 > 0.5 && !ease.crashed && ease.t > 1.1 && !ease.rise && ease.over < 0.4 && ease.td < 1.5, `easing off the gas lowers the front gradually (${deg(ease.p0)}° down in ${ease.t.toFixed(1)} s, no bounce, touchdown ${ease.td.toFixed(2)} rad/s)`)
  check(!brk.crashed && brk.t < ease.t * 0.8, `Brake brings it down faster (${brk.t.toFixed(1)} s vs ${ease.t.toFixed(1)} s)`)
  // BRAKE ALONE never lifts the front: it slows the bike, compresses the fork and keeps the front tyre planted
  for (const v0 of [3, 8, 15, spec.maxSpeed * 0.9]) {
    const bb = new BikeSim(spec)
    bb.v = v0
    let mp = 0
    let fork = 0
    run(bb, 3, (t, bk) => (mp = Math.max(mp, bk.pitch), fork = Math.max(fork, bk.forkC), I({ brake: 1 })))
    check(mp === 0 && fork > 0.002 && bb.v < v0, `Brake alone from ${v0.toFixed(0)} m/s never lifts the front (max pitch ${deg(mp)}°), the fork compresses (${fork.toFixed(3)} m) and it slows (${bb.v.toFixed(1)} m/s)`)
  }
  const rb = new BikeSim(spec)
  rb.v = 12
  let rbp = 0
  run(rb, 2, (t, bk) => (rbp = Math.max(rbp, bk.pitch), I({ rear: 1 })))
  check(rbp === 0, 'the rear brake alone never lifts the front either')
  for (const assist of [0, 0.3, 1]) {
    const h = new BikeSim(spec)
    h.v = 6
    h.assist = assist
    run(h, 9, (t) => I({ throttle: 1, lean: t > 0.2 ? 1 : 0 }))
    check(h.crashed === 'loop' || h.pitch > 1.0, `holding throttle + heave never holds a wheelie for you: it loops out (assist ${assist}: ${h.crashed ?? 'no crash, pitch ' + deg(h.pitch) + '°'})`)
  }
  for (const assist of [0, 0.3]) {
    const h = new BikeSim(spec)
    h.v = 6
    h.assist = assist
    let up2 = 0
    run(h, 6, (t, bk) => {
      const want = bk.balance * 0.8
      const err = want - bk.pitch
      if (bk.pitch > 0.3) up2 += 1 / 60
      return I({ throttle: bk.v > spec.maxSpeed * 0.8 ? 0.2 : Math.max(0, Math.min(1, 0.55 + err * 1.8 - bk.pitchRate * 0.35)), lean: t < 0.6 ? 1 : Math.max(-1, Math.min(1, err * 2.5 - bk.pitchRate * 0.5)) })
    })
    check(!h.crashed && up2 > 3.4, `a wheelie can be held with small corrections (assist ${assist}: ${up2.toFixed(1)} s up, ${deg(h.pitch)}°)`)
  }
  b = new BikeSim(spec)
  b.v = 8
  b.assist = 0.3
  const ctl = (t, bk) => I({ throttle: Math.max(0, Math.min(1, 0.55 + (bk.balance * 0.75 - bk.pitch) * 1.8 - bk.pitchRate * 0.35)), lean: t < 0.7 ? 1 : Math.max(-1, Math.min(1, (bk.balance * 0.75 - bk.pitch) * 2.5 - bk.pitchRate * 0.5)) })
  run(b, 2.6, ctl)
  const up0 = b.pitch
  const vUp = b.v
  const rel = new BikeSim(spec)
  rel.v = b.v
  rel.pitch = b.pitch
  rel.pitchRate = b.pitchRate
  rel.assist = 0.3
  rel.lean = 0
  let relMax = 0
  let lastP = rel.pitch
  for (let i = 0; i < 40; i++) {
    rel.advance(1 / 60, I({ throttle: 0.55 }), flat())
    relMax = Math.max(relMax, lastP - rel.pitch)
    lastP = rel.pitch
  }
  check(relMax < 0.04, `letting go of the heave does not slam the wheel down (largest drop ${(relMax * 1000).toFixed(0)} mrad per frame)`)
  let maxStep = 0
  let last = b.pitch
  let td = 0
  let vTouch = -1
  for (let i = 0; i < 300; i++) {
    b.advance(1 / 60, I({ rear: 1 }), flat())
    maxStep = Math.max(maxStep, Math.abs(b.pitch - last))
    if (vTouch < 0 && b.pitch <= 0.001) vTouch = b.v
    last = b.pitch
    td = Math.max(td, b.touchdown)
  }
  check(up0 > 0.3 && b.pitch < 0.03, `the rear brake brings the front wheel down (from ${deg(up0)}° to ${deg(b.pitch)}°)`)
  check(maxStep < 0.04, `pitch never jumps (largest step ${(maxStep * 1000).toFixed(0)} mrad per frame)`)
  check(td < 2.4 && b.forkC >= 0, `touchdown is soft (impact ${td.toFixed(2)} rad/s); the front suspension compresses (fork ${b.forkC.toFixed(3)} m)`)
  check(vTouch > vUp * 0.3, `forward momentum survives the touchdown (${vUp.toFixed(1)} m/s up → ${vTouch.toFixed(1)} m/s as the wheel lands, with the rear brake on)`)
  const st = new BikeSim(spec)
  st.v = 8
  st.assist = 0.3
  run(st, 3, (t, bk) => I({ ...ctl(t, bk), steer: t > 2 ? 0.4 : 0 }))
  check(Math.abs(st.h) > 0.03 && !st.crashed, `gentle steering works during a wheelie (heading ${deg(st.h)}°)`)
  // 6. frame-rate independence
  const outs = []
  for (const fdt of [1 / 30, 1 / 60, 1 / 144, 0.0097]) {
    const f = new BikeSim(spec)
    run(f, 6, (t) => I({ throttle: 1, steer: t > 3 ? 0.4 : 0, rear: t > 5 ? 1 : 0 }), fdt)
    outs.push(f)
  }
  const spread = (k) => Math.max(...outs.map((o) => o[k])) - Math.min(...outs.map((o) => o[k]))
  check(spread('x') < 1.6 && spread('z') < 1.6 && spread('v') < 0.15 && spread('h') < 0.04, `the same ride at 30 / 60 / 144 fps and a jittery frame time (a ~1 frame input-sampling difference is all that remains: position spread ${spread('x').toFixed(2)}, ${spread('z').toFixed(2)} m; speed ${spread('v').toFixed(3)} m/s)`)
  const sm = new BikeSim(spec)
  sm.v = 10
  let prevR = null
  let jump = 0
  for (let i = 0; i < 120; i++) {
    sm.advance(1 / 47, I({ throttle: 1 }), flat())
    const vw = sm.view()
    if (prevR !== null) jump = Math.max(jump, Math.abs(vw.z - prevR))
    prevR = vw.z
  }
  check(jump < 0.6, `the drawn position advances smoothly at an odd frame rate (largest frame step ${jump.toFixed(2)} m at ~${sm.v.toFixed(0)} m/s)`)
  // 7. suspension
  const bump = new BikeSim(spec)
  bump.v = 12
  let t0 = 0
  run(bump, 1.5, () => I({ throttle: 0.4 }), 1 / 60, () => {
    t0 += 1 / 60
    return { yRear: t0 > 0.58 && t0 < 0.68 ? 0.12 : 0, yFront: t0 > 0.5 && t0 < 0.6 ? 0.12 : 0 }
  })
  check(bump.forkC <= spec.forkTravel * 1.1 && bump.shockC <= spec.shockTravel * 1.1, `a bump never bottoms the suspension past its travel (fork ${bump.forkC.toFixed(3)} / ${spec.forkTravel}, shock ${bump.shockC.toFixed(3)} / ${spec.shockTravel})`)
  const acc = new BikeSim(spec)
  run(acc, 0.8, () => I({ throttle: 1 }))
  check(acc.shockC > 0.005 && acc.shockC > acc.forkC, `acceleration squats the rear (shock ${acc.shockC.toFixed(3)} m, fork ${acc.forkC.toFixed(3)} m)`)
  // 8. no NaN under abuse at an awkward frame rate
  b = new BikeSim(spec)
  run(b, 20, (t) => I({ throttle: Math.sin(t * 3) > 0 ? 1 : 0, brake: Math.cos(t * 2) > 0.5 ? 1 : 0, rear: Math.sin(t * 5) > 0.7 ? 1 : 0, steer: Math.sin(t * 1.3), lean: Math.cos(t * 0.9) }), 0.023)
  check([b.x, b.z, b.h, b.v, b.pitch, b.roll, b.forkC, b.shockC, b.vlat].every(Number.isFinite), 'finite after 20 s of random inputs at an odd frame rate')
  // 9. grip, lean, scrape, one-hand, reverse
  {
    const dry = new BikeSim(spec)
    const wet = new BikeSim(spec)
    dry.v = wet.v = 4
    wet.surface = 0.45
    let dryBest = 0
    let wetBest = 0
    let spinMax = 0
    run(dry, 2, (t, bk) => (dryBest = Math.max(dryBest, bk.pitch), I({ throttle: 1 })))
    run(wet, 2, (t, bk) => (wetBest = Math.max(wetBest, bk.pitch), spinMax = Math.max(spinMax, bk.spin), I({ throttle: 1 })))
    check(spinMax > 0.25 && wetBest < dryBest * 0.8, `low grip: the rear wheel spins instead of lifting (spin ${spinMax.toFixed(2)}, lift ${deg(wetBest)}° vs ${deg(dryBest)}° on dry tarmac)`)
    const ws = new BikeSim(spec)
    ws.surface = 0.45
    run(ws, 0.8, () => I({ throttle: 1 }))
    check(ws.spin > 0.3 && ws.rearSpin * spec.wheelR > ws.z * 1.1 + 0.5, `a spinning rear wheel turns faster than the road passes (wheel ${(ws.rearSpin * spec.wheelR).toFixed(1)} m vs ground ${ws.z.toFixed(1)} m)`)
    // the rider shifts weight by themselves: back on the gas, forward under braking, into the turn
    const br = new BikeSim(spec)
    br.v = 12
    run(br, 0.6, () => I({ brake: 1 }))
    const gs = new BikeSim(spec)
    gs.v = 6
    run(gs, 0.6, () => I({ throttle: 1 }))
    check(br.lean < -0.2 && gs.lean > 0.2, `the rider's weight moves by itself: forward under braking (${br.lean.toFixed(2)}), back on the gas (${gs.lean.toFixed(2)})`)
    // scrape: only when a part really reaches the ground
    const easy = new BikeSim(spec)
    easy.v = 8
    let easyScrape = 0
    run(easy, 2, (t, bk) => (easyScrape = Math.max(easyScrape, bk.scrape.k), I({ throttle: 0.15, steer: 0.25 })))
    const hard = new BikeSim(spec)
    hard.v = spec.maxSpeed * 0.7
    let hardPart = null
    run(hard, 3, (t, bk) => (bk.scrape.part && (hardPart = bk.scrape.part), I({ throttle: 0.5, steer: 1 })))
    check(easyScrape === 0 && hardPart === 'peg', `a peg scrapes only on a hard lean (gentle turn: ${easyScrape.toFixed(2)}, full lock at ${hard.v.toFixed(0)} m/s: ${hardPart ?? 'nothing'}, roll ${deg(hard.roll)}°)`)
    // one-hand: a pose that needs the front wheel already up; it never starts or holds a wheelie
    const o1 = new BikeSim(spec)
    o1.v = 8
    run(o1, 2, () => I({ throttle: 0.3, trick: true }))
    check(o1.oneHand === 0 && o1.pitch < 0.02, 'the one-hand trick does nothing on the ground (no lift, no pose)')
    const o2 = new BikeSim(spec)
    const o3 = new BikeSim(spec)
    o2.v = o3.v = 6
    run(o2, 1.6, () => I({ throttle: 1, trick: true }))
    run(o3, 1.6, () => I({ throttle: 1 }))
    check(o2.oneHand > 0.8 && Math.abs(o2.pitch - o3.pitch) < 0.02 && o2.oneHandTime > 0.3, `in a wheelie it moves the hand and nothing else (pose ${o2.oneHand.toFixed(2)}, pitch ${deg(o2.pitch)}° vs ${deg(o3.pitch)}° without; ${o2.oneHandTime.toFixed(1)} s one-handed)`)
    // reverse: only from nearly stopped, separate from the gas
    const rv = new BikeSim(spec)
    run(rv, 2, () => I({ reverse: true }))
    const rv2 = new BikeSim(spec)
    rv2.v = 8
    run(rv2, 0.5, () => I({ reverse: true }))
    check(rv.v < -0.8 && rv2.v > 0, `reverse works from a standstill (${rv.v.toFixed(1)} m/s) and is ignored at speed (${rv2.v.toFixed(1)} m/s)`)
  }
}
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS')
process.exit(fails ? 1 : 0)
