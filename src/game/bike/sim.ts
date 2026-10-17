import type { BikeSpec } from './spec'

/**
 * THE RIDING MODEL. Pure numbers (no meshes, no THREE). It runs on a FIXED 120 Hz step, so the bike behaves the same at 30, 60 or 144 fps (the scene calls
 * `advance(frameDt, …)`; the sim takes as many fixed steps as the time allows) and exposes an interpolated `view()` for drawing, so the picture is smooth
 * while the controls act on the true state and never feel sluggish.
 *
 * What is modelled:
 *  - POSITION follows the WHEELS: the rear contact patch moves along the heading and the heading turns with the front wheel (a bicycle model:
 *    yaw rate = v·tan(steer)/wheelbase), so the bike goes where its wheels point. Sideways motion exists ONLY in a slide (below).
 *  - STEERING angle fades with speed (tight and quick when slow, calm and stable when fast); the bars move at a finite rate.
 *  - GRIP: the tyres give `gripLat` of lateral acceleration. Ask for more and the bike runs wide (understeers) and scrubs speed. A slide (a little lateral
 *    velocity that the tyres then reel back in) only appears when justified: the rear brake locked while turning at speed, or a corner pushed far past the limit.
 *  - LEAN into a turn by atan(lateral accel / g), smoothed, returning upright as the turn ends.
 *  - DRIVE: electric = a flat wall of torque from standstill tapering near top speed; the street bike tapers earlier and dips a little at each gear change.
 *    Rolling resistance, air drag, motor/engine braking, braking (front-biased, the front only bites with the wheel down), reverse (hold the brake at a
 *    standstill), slopes (gravity along the ground; a gentle slope holds a stopped bike, a steep one rolls it unless a brake is on).
 *  - WHEELIE: the bike pivots about the rear contact patch. Gravity pulls the nose down while the centre of mass is ahead of the pivot and the other way once
 *    it is behind it, so there is a BALANCE POINT (tanθ = d/h). Drive torque, the rider heaving back (and moving their weight), the rear brake and leaning
 *    forward act on it. NOTHING holds the wheelie for you: the optional ASSIST only adds damping near the balance point and softens the runaway past it.
 *  - SUSPENSION: front and rear springs with damping, loaded by braking, acceleration, the wheelie, landings and the bumps in the ground under each wheel.
 */
export type RideInput = {
  throttle: number // 0..1
  brake: number // 0..1  both brakes (front-biased)
  rear: number // 0..1  rear brake only
  steer: number // −1 (left) .. 1 (right)
  /** −1 (weight forward) .. 1 (weight back): an EXTRA push from a key (desktop C = forward). The rider shifts their own weight automatically from the throttle, brakes and pitch. */
  lean: number
  /** the WHEELIE button (held state; a fresh press toggles wheelie mode: lift smoothly, press again to lower) */
  wheelie?: boolean
  /** hold Reverse (only acts when nearly stopped) */
  reverse?: boolean
  /** the one-hand trick: only has an effect while the front wheel is already up; it moves the rider's hand, never the wheelie */
  trick?: boolean
}
export const NO_INPUT: RideInput = { throttle: 0, brake: 0, rear: 0, steer: 0, lean: 0 }

/** what the scene tells the sim about the ground each frame: the height under each contact patch */
export type Ground = { yRear: number; yFront: number }

/** a part of the bike that touched the ground this step (peg = footpeg on a hard lean, tail = rear end on a big wheelie, bash = fork / shock bottomed out) */
export type Scrape = { part: 'peg' | 'tail' | 'bash' | null; side: number; k: number }
export type CrashKind = 'loop' | 'collision'
export const FIXED_DT = 1 / 120
const G = 9.81

export type BikeView = {
  x: number
  z: number
  h: number
  roll: number
  pitch: number
  delta: number
  forkC: number
  shockC: number
  rearSpin: number
  frontSpin: number
  /** chassis pitch on its suspension (rad): dive under braking, squat under power */
  chassis: number
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const lerpAngle = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t

export class BikeSim {
  spec: BikeSpec
  /** player setting 0..1: how much the wheelie assist softens the instability (0 = none) */
  assist = 0.3
  /** surface grip multiplier (1 = dry tarmac) */
  surface = 1

  /** the point midway between the axles (what the scene calls the bike's position) */
  x = 0
  z = 0
  /** heading: forward = (sin h, cos h) */
  h = 0
  /** forward speed along the heading (m/s; negative = reversing) and lateral slide velocity (m/s, + right) */
  v = 0
  vlat = 0
  /** steering angle (rad, + = right) */
  delta = 0
  /** roll (rad, + = leaning right) */
  roll = 0
  /** wheelie angle (rad, 0 = front wheel down) and its rate */
  pitch = 0
  pitchRate = 0
  /** suspension compression (m) and speed */
  forkC = 0
  forkV = 0
  shockC = 0
  shockV = 0
  /** wheel spin angles (rad) */
  rearSpin = 0
  frontSpin = 0
  /** smoothed rider inputs */
  thr = 0
  brk = 0
  rbk = 0
  lean = 0
  /** accelerations this step (m/s²): along the bike, and lateral (+ right) */
  accelNow = 0
  latNow = 0
  /** gear (street bike) and engine speed 0..1 within it, for the sound */
  gear = 1
  rpm = 0
  /** wheelie bookkeeping (a readout, never an input to the balance): time up, distance covered while up, the pitch reached */
  wheelieTime = 0
  wheelieDist = 0
  wheelieBest = 0
  /** the front wheel touched down this step (rad/s impact), and the largest since the scene last cleared `events` */
  touchdown = 0
  events = { touchdown: 0, scrape: 0, spin: 0 }
  /** WHEELIE MODE: pressed once it lifts the front smoothly to a balance region and holds it there with gameplay assistance (a pitch controller on top of the calculated physics, see the
   *  assist block in `step`); Gas raises the angle, Brake lowers it, pressing again (or braking all the way down) ends it. `wm` (0..1) is how strongly the assistance is applied. */
  wheelieOn = false
  wm = 0
  private prevWheelie = false
  /** 0..1 rider posture shift (the wheelie mode's weight shift back), read by the pose and the sound */
  rev = 0
  /** how far the tail bar is pressed into the ground (rad of pitch beyond the contact angle): the scrape depth */
  tailPen = 0
  /** where the combined centre of mass is, forward of the rear contact (m), this step: the neutral position moved by the rider's posture */
  xEff = 0
  /** fixed physics step (s); 1/120 by default (see the 60 vs 120 Hz measurement in the plan) */
  stepDt = FIXED_DT
  /** the rider's own weight shift (−1 forward .. 1 back), made automatically from the throttle, brakes and landings */
  autoLean = 0
  /** rear wheel slip 0..1: the tyre is being asked for more than the surface gives */
  spin = 0
  /** one-hand pose 0..1 (eased) and seconds spent in it during this wheelie */
  oneHand = 0
  oneHandTime = 0
  /** the part touching the ground now, if any */
  scrape: Scrape = { part: null, side: 0, k: 0 }
  /** the smoothest landing / worst impact of the last touchdown, for scoring (rad/s) */
  lastTouchdown = 0
  /** crash state */
  crashed: CrashKind | null = null
  crashT = 0
  /** slope of the ground along the bike (rad, + uphill) */
  slope = 0
  /** chassis pitch on the suspension (rad) */
  chassis = 0

  /** the rear contact patch (the sim's true reference point) */
  private rx = 0
  private rz = 0
  private revT = 0
  private acc = 0
  private prev: BikeView
  private cur: BikeView
  private yRearF = 0
  private yFrontF = 0
  private yRearPrev = 0
  private yFrontPrev = 0
  private groundInit = false

  constructor(spec: BikeSpec) {
    this.spec = spec
    this.prev = this.snapshot()
    this.cur = this.snapshot()
  }

  /** put the bike's mid-point somewhere (the scene resolving a collision, a teleport) */
  setMid(x: number, z: number) {
    const L = this.spec.wheelbase * 0.5
    this.x = x
    this.z = z
    this.rx = x - Math.sin(this.h) * L
    this.rz = z - Math.cos(this.h) * L
  }
  private sync() {
    const L = this.spec.wheelbase * 0.5
    this.x = this.rx + Math.sin(this.h) * L
    this.z = this.rz + Math.cos(this.h) * L
  }

  reset(x: number, z: number, h: number) {
    this.h = h
    this.setMid(x, z)
    this.v = 0
    this.vlat = 0
    this.delta = 0
    this.roll = 0
    this.pitch = 0
    this.pitchRate = 0
    this.forkC = this.forkV = this.shockC = this.shockV = 0
    this.thr = this.brk = this.rbk = this.lean = 0
    this.autoLean = this.spin = this.oneHand = this.oneHandTime = this.rev = this.wm = 0
    this.wheelieOn = false
    this.prevWheelie = false
    this.xEff = this.spec.comD
    this.scrape = { part: null, side: 0, k: 0 }
    this.wheelieTime = this.wheelieDist = this.wheelieBest = 0
    this.crashed = null
    this.crashT = 0
    this.revT = 0
    this.acc = 0
    this.chassis = 0
    this.groundInit = false
    this.prev = this.snapshot()
    this.cur = this.snapshot()
  }

  /** the front wheel is off the ground */
  get wheelie() {
    return this.pitch > 0.06
  }
  /** the angle (rad) at which the centre of mass is directly over the rear contact patch for the current posture, on level ground at zero acceleration: tan = x / h (QA / sound only, never shown) */
  get balance() {
    return Math.atan2(this.xEff || this.spec.comD, this.spec.comH)
  }

  private snapshot(): BikeView {
    return { x: this.x, z: this.z, h: this.h, roll: this.roll, pitch: this.pitch, delta: this.delta, forkC: this.forkC, shockC: this.shockC, rearSpin: this.rearSpin, frontSpin: this.frontSpin, chassis: this.chassis }
  }

  /** the interpolated state to DRAW (between the last two fixed steps) */
  view(): BikeView {
    const a = this.acc / this.stepDt
    const p = this.prev
    const c = this.cur
    return {
      x: lerp(p.x, c.x, a),
      z: lerp(p.z, c.z, a),
      h: lerpAngle(p.h, c.h, a),
      roll: lerp(p.roll, c.roll, a),
      pitch: lerp(p.pitch, c.pitch, a),
      delta: lerp(p.delta, c.delta, a),
      forkC: lerp(p.forkC, c.forkC, a),
      shockC: lerp(p.shockC, c.shockC, a),
      rearSpin: lerp(p.rearSpin, c.rearSpin, a),
      frontSpin: lerp(p.frontSpin, c.frontSpin, a),
      chassis: lerp(p.chassis, c.chassis, a),
    }
  }

  /** a hit: scrub speed */
  hit(severity: number) {
    this.v *= Math.max(0, 1 - severity)
    this.vlat *= Math.max(0, 1 - severity)
    if (Math.abs(this.v) < 0.1) this.v = 0
  }
  crash(kind: CrashKind) {
    if (this.crashed) return
    this.crashed = kind
    this.crashT = 0
  }

  /** advance by a frame's time: any number of fixed steps, the leftover kept for interpolation */
  advance(dt: number, inp: RideInput, ground: Ground) {
    this.acc += Math.min(dt, 0.1)
    let n = 0
    while (this.acc >= this.stepDt && n < Math.ceil(0.12 / this.stepDt)) {
      this.prev = this.cur
      this.step(this.stepDt, inp, ground)
      this.cur = this.snapshot()
      this.acc -= this.stepDt
      n++
    }
    if (n >= Math.ceil(0.12 / this.stepDt)) this.acc = 0
  }

  /** one FIXED step */
  step(dt: number, inp: RideInput, ground: Ground) {
    const s = this.spec
    const L = s.wheelbase
    this.touchdown = 0
    if (!this.groundInit) {
      this.yRearF = this.yRearPrev = ground.yRear
      this.yFrontF = this.yFrontPrev = ground.yFront
      this.groundInit = true
    }
    this.slope = Math.atan2(ground.yFront - ground.yRear, L)
    const rearUp = Math.max(-3, Math.min(3, (ground.yRear - this.yRearPrev) / dt))
    const frontUp = Math.max(-3, Math.min(3, (ground.yFront - this.yFrontPrev) / dt))
    this.yRearPrev = ground.yRear
    this.yFrontPrev = ground.yFront

    if (this.crashed) {
      this.crashT += dt
      this.v *= Math.exp(-dt * 2.6)
      this.vlat *= Math.exp(-dt * 3)
      if (this.crashed === 'loop' && this.pitch > 0) {
        // falling over backwards: gravity keeps turning it, the momentum it had is kept and it comes to rest on its tail, not snapped anywhere
        this.pitchRate = Math.min(2.2, Math.max(this.pitchRate, 0.4) + 3.2 * dt)
        this.pitch = Math.min(1.95, this.pitch + this.pitchRate * dt)
        if (this.pitch >= 1.95) this.pitchRate = 0
      } else this.pitchRate *= Math.exp(-dt * 3)
      this.travel(dt, 0)
      this.thr = this.brk = this.rbk = 0
      this.rearSpin += (this.v / s.wheelR) * dt * 0.3
      this.frontSpin += (this.v / s.wheelR) * dt * 0.3
      return
    }

    // ── rider inputs, smoothed so nothing jerks (a phone button is on/off; a key too) ──
    const ease = (cur: number, tgt: number, up: number, down: number) => cur + (tgt - cur) * Math.min(1, dt * (tgt > cur ? up : down))
    this.thr = ease(this.thr, inp.throttle, 9, 9)
    this.brk = ease(this.brk, inp.brake, 10, 11)
    this.rbk = ease(this.rbk, inp.rear, 10, 11)
    // the rider's weight: pushed back by hard throttle (but only while the tyre is gripping, and less the faster the bike already goes), forward under braking and
    // when the nose is dropping back to the ground. Nothing here is a button: the rider just does what a rider does.
    const mu0 = this.surface
    const spd = Math.max(0, this.v) / s.maxSpeed
    const demand = s.accel * this.thr * (1 - Math.pow(spd, s.powerPow))
    const avail = mu0 * G * 1.05
    this.spin = Math.max(0, Math.min(1, demand / avail - 0.92)) * (this.v < s.maxSpeed * 0.7 ? 1 : 0.4)
    // WHEELIE MODE (the Wheelie button): a fresh press toggles it. Braking all the way down also ends it. Gas is ONLY drive: there are no gas-tap wheelies.
    if (inp.wheelie && !this.prevWheelie && !this.crashed) this.wheelieOn = !this.wheelieOn
    this.prevWheelie = !!inp.wheelie
    if (this.wheelieOn && this.brk > 0.6 && this.pitch < 0.04) this.wheelieOn = false
    this.wm += ((this.wheelieOn ? 1 : 0) - this.wm) * Math.min(1, dt / (this.wheelieOn ? 0.35 : 0.9))
    if (this.wm < 0.002) this.wm = 0
    this.rev = this.wm
    // THE RIDER'S POSTURE moves the combined centre of mass (m, forward of the rear contact): back a little in wheelie mode, forward under braking, forward as the nose climbs (hanging off the
    // bars), forward on a plain launch (a crouch), forward when the nose is coming down
    const hang = Math.max(0, Math.min(1, (this.pitch - 0.25) / 0.85))
    let xEff = s.comD - s.revShift * this.wm + s.hangShift * hang + s.brakeShift * Math.min(1, this.brk * 0.9 + this.rbk * 0.4)
    xEff += s.launchShift * this.thr * (1 - this.wm) * (this.pitch < 0.3 ? 1 : 0)
    if (this.pitch > 0.05 && this.pitchRate < -0.25) xEff += Math.min(0.12, -this.pitchRate * 0.06)
    xEff -= inp.lean * 0.3 // the C key: an extra push of the weight (forward is lean -1)
    this.xEff = xEff
    // for the rider pose (the visual reads `lean`: 1 = weight right back, -1 = right forward)
    this.autoLean = ease(this.autoLean, Math.max(-1, Math.min(1, (s.comD - (xEff + inp.lean * 0.3)) / s.revShift)), 16, 12)
    this.lean = ease(this.lean, Math.max(-1, Math.min(1, (s.comD - xEff) / s.revShift)), 16, 12)

    // ── longitudinal ──
    const frontDown = this.pitch < 0.05
    const mu = this.surface
    const vmax = s.maxSpeed
    const speedFrac = Math.max(0, this.v) / vmax
    const brakeAll = Math.max(this.brk, this.rbk)
    if (Math.abs(this.v) < 0.35 && this.brk > 0.5 && this.thr < 0.05) this.revT += dt
    else if (this.thr > 0.05 || this.brk < 0.2) this.revT = 0
    if (inp.reverse && Math.abs(this.v) < 0.6 && this.thr < 0.05) this.revT = Math.max(this.revT, 0.4)
    else if (inp.reverse && this.v < -0.05 && this.thr < 0.05) this.revT = Math.max(this.revT, 0.4)
    const reversing = this.revT > 0.35 && this.thr < 0.05
    const gSlope = G * Math.sin(this.slope) // + uphill: gravity pulls the bike back down the ground
    let a = 0
    if (reversing) {
      a = this.v > -s.reverse ? -4 * Math.max(this.brk, inp.reverse ? 1 : 0) : 0
      a -= gSlope * 0.6
    } else {
      let power = 1 - Math.pow(speedFrac, s.powerPow)
      if (s.gears > 0) {
        const gs = vmax / s.gears
        const g = Math.min(s.gears - 1, Math.floor(Math.max(0, this.v) / gs))
        this.gear = g + 1
        this.rpm = Math.min(1, (Math.max(0, this.v) - g * gs) / gs)
        power *= 0.8 + 0.2 * Math.sin(Math.min(1, this.rpm * 1.25) * Math.PI * 0.5) // a little less pull as a gear runs out
      } else {
        this.gear = 1
        this.rpm = Math.min(1, Math.max(0, this.v) / vmax)
      }
      // motor thrust, limited by what the rear tyre can hold (mu g)
      a = Math.min(s.accel * this.thr * power, mu * G * 1.05)
      const bite = frontDown ? 1 : 0.2
      // braking force is limited by what the tyres can hold: no more than mu g in total (a little over for the contact patch's extra bite)
      const decel = Math.min((s.brakeFront * this.brk * bite + s.brakeRear * Math.max(this.rbk, this.brk * 0.35)) * mu, mu * G * 1.02)
      const sgn = Math.sign(this.v)
      if (this.v > 0.02) a -= decel
      else if (this.v < -0.02) a += decel
      a -= sgn * s.rollRes
      a -= this.v * s.drag * (1 + Math.abs(this.v) * 0.04)
      if (this.thr < 0.04) a -= sgn * (0.2 + Math.abs(this.v) * 0.03) // motor / engine braking off the throttle
      a -= gSlope
      // with the front up the bike keeps moving at a walking pace (idle drive through the slipping clutch); any brake takes it away
      if (this.pitch > 0.12 && this.brk < 0.1 && this.rbk < 0.1 && this.v < 1.6) a += (1.6 - this.v) * 2.5
    }
    const v0 = this.v
    this.v += a * dt
    if (!reversing) {
      // resistances and brakes never push you backwards; a stopped bike is held by its brakes or by a gentle slope (under ~12 %), rolled only by a steep one
      if (v0 > 0 !== this.v > 0 && this.thr < 0.05 && Math.abs(gSlope) < G * 0.2 && v0 !== 0) this.v = 0
      if (Math.abs(this.v) < 0.12 && this.thr < 0.04) {
        if (brakeAll > 0.08 || Math.abs(gSlope) < G * 0.2) this.v = 0
      }
    }
    this.v = Math.max(-s.reverse, Math.min(vmax, this.v))
    this.accelNow = (this.v - v0) / dt

    // ── steering, grip, slide and lean ──
    const av = Math.abs(this.v)
    const fade = 1 / (1 + Math.pow(av / s.steerFade, 1.7))
    // with the front wheel in the air the bars still turn but the bike answers less: gentle corrections only
    const air = this.pitch > 0.1 ? Math.max(0.42, 1 - this.pitch * 1.1) : 1
    // the bars get lighter as the nose comes up: a wheelie is steered with small inputs
    const target = inp.steer * s.steerMax * fade * (this.pitch > 0.1 ? Math.max(0.35, 1 - this.pitch * 0.9) : 1)
    const maxStep = s.steerRate * dt * (Math.abs(inp.steer) < 0.02 ? 1.7 : 1)
    this.delta += Math.max(-maxStep, Math.min(maxStep, target - this.delta))
    let yawRate = (-this.v * Math.tan(this.delta)) / L // + = left
    yawRate *= air
    let latWanted = -yawRate * this.v // + right
    const limit = s.gripLat * mu
    if (Math.abs(latWanted) > limit && av > 0.5) {
      const over = Math.abs(latWanted) / limit
      yawRate *= 1 / over // out of grip: it runs wide, the turn tightens no further, speed scrubs
      this.v -= Math.sign(this.v) * (Math.abs(latWanted) - limit) * 0.05 * dt
      if (over > 1.25) this.vlat -= Math.sign(latWanted) * (over - 1.25) * 0.9 * dt * Math.min(1, av / 8) // far beyond the limit: it drifts wide (outward), a small slide
      latWanted = Math.sign(latWanted) * limit
    }
    // the rear brake locked while turning at speed lets the back end step out
    if (this.rbk > 0.55 && av > 6 && Math.abs(inp.steer) > 0.25 && this.pitch < 0.1) this.vlat -= Math.sign(inp.steer) * this.rbk * 7 * dt * Math.min(1, av / 12)
    this.vlat *= Math.exp(-dt * (4.5 * mu + 1.2)) // the tyres reel a slide back in
    this.vlat = Math.max(-2.6, Math.min(2.6, this.vlat))
    this.latNow = latWanted + this.vlat * 2
    this.roll += (Math.atan2(this.latNow, G) * s.leanGain - this.roll) * Math.min(1, dt * 7)

    // ── the wheelie: a rigid body pitching about the rear contact patch ──
    // Torque about the contact per unit mass (nose-up positive), body frame: COM at (x forward, h up) from the contact, pitched by th:
    //   gravity            g (h sin th - x cos th)           nose DOWN while the COM is ahead of the contact, nose UP once it is behind it (th > atan(x/h): the balance point)
    //   acceleration       a (h cos th + x sin th)           the contact accelerates forward by a, so the body feels -a at the COM: nose UP (and nose DOWN under braking, a < 0)
    // divided by gyr2 = k² + x² + h². The drive thrust enters ONLY through a (no second 'lift torque'), the rider's weight only through x. On level ground the front unloads when
    // a > g x / h (the threshold in the plan). Everything else below is dissipation or the rider's reaction.
    const th = this.pitch
    const sin = Math.sin(th)
    const cos = Math.cos(th)
    const xC = Math.max(0.02, xEff)
    let alpha = (G * (s.comH * sin - xC * cos) + this.accelNow * (s.comH * cos + xC * sin)) / s.gyr2
    alpha -= s.pitchDamp * this.pitchRate // dissipation: rider, tyre and frame flex (an estimate)
    // ── GAMEPLAY ASSISTANCE (deliberate, not physics): the wheelie mode is a pitch controller added ON TOP of the calculated torques above. It aims at a balance-region angle that
    //    the rider moves with the controls: Gas raises it (up to the rear-fender scrape), Brake lowers it (all the way to the ground), and it is a stiff-enough spring-damper (kp above the
    //    gravity slope g h / gyr2) that small corrections hold the wheelie, the angle cannot run away backwards, and the front never has to be 'caught'. Its strength fades in over 0.35 s
    //    so the lift is smooth, and fades out over 0.9 s when the mode ends so the front settles instead of dropping. It is limited (+-9 rad/s²): braking hard still wins.
    if (this.wm > 0.001) {
      const gasUp = Math.max(0, Math.min(1, (this.thr - 0.15) / 0.7))
      const target = this.wheelieOn ? Math.max(0, 0.6 + 0.45 * gasUp - 1.1 * Math.max(this.brk, this.rbk * 0.8)) : 0
      const kp = this.wheelieOn ? s.assistKp : s.assistKp * 0.3 // ending the mode lowers the front gently
      alpha += this.wm * Math.max(-9, Math.min(9, kp * (target - th) - s.assistKd * this.pitchRate))
    }
    // OPTIONAL assist (a setting): near the balance point it only DAMPS the pitch rate. It never pulls toward the balance point, so a wheelie can drift out of it and be lost.
    const A = this.assist * s.assistGain
    if (A > 0 && th > 0.1) {
      const thb = Math.atan2(xC, s.comH)
      const near = Math.max(0, 1 - Math.abs(th - thb) / 0.3)
      alpha -= A * near * 3.2 * this.pitchRate
    }
    if (th <= 0 && alpha <= 0) {
      this.pitch = 0
      this.pitchRate = 0
    } else {
      this.pitchRate += alpha * dt
      this.pitchRate = Math.max(-1.1, Math.min(1.8, this.pitchRate)) // never an abrupt rotation, up or down
      if (this.pitchRate < 0 && th < 0.24) this.pitchRate = Math.max(this.pitchRate, -(th + 0.012) * 6.5) // a soft touchdown
      this.pitch += this.pitchRate * dt
    }
    // ── THE REAR SCRAPE POINT (a discreet protective bar at the tail, estimated geometry): the contact is computed against the ground from the tail point's height as the body
    // pitches about the rear contact: height(th) = tailX sin(th) + tailH cos(th) reaches 0 at th = atan(tailH / -tailX). Past that the ground SUPPORTS the tail (a stiff spring and a
    // damper, so it cannot pass through and does not bounce), friction scrubs speed, and the rider stays on: a scrape is not a crash. Brake (or easing the Gas) brings it off again.
    const thS = Math.atan2(s.tailH, -s.tailX)
    this.tailPen = 0
    if (this.pitch > thS) {
      const pen = this.pitch - thS
      this.tailPen = pen
      this.pitchRate -= (700 * pen + 55 * Math.max(0, this.pitchRate)) * dt
      if (this.pitch > thS + 0.04) {
        this.pitch = thS + 0.04
        this.pitchRate = Math.min(this.pitchRate, 0)
      }
      this.v *= Math.exp(-dt * 0.55 * Math.min(1, 0.25 + pen * 25)) // friction on the tail bar
    }
    if (this.pitch <= 0) {
      if (this.pitchRate < -0.05) {
        this.touchdown = -this.pitchRate
        this.lastTouchdown = this.touchdown
        this.events.touchdown = Math.max(this.events.touchdown, this.touchdown)
        this.forkV += -this.pitchRate * 0.75 // the fork takes the landing
        this.v *= 1 - Math.min(0.03, -this.pitchRate * 0.008) // only a touch of drag: the forward momentum carries on
      }
      this.pitch = 0
      this.pitchRate = Math.max(0, this.pitchRate)
    }
    if (this.pitch > 0.06) {
      this.wheelieTime += dt
      this.wheelieDist += Math.max(0, this.v) * dt
      this.wheelieBest = Math.max(this.wheelieBest, this.pitch)
    } else if (this.wheelieTime > 0 && this.pitch <= 0.02) {
      this.wheelieTime = 0
      this.wheelieDist = 0
      this.wheelieBest = 0
    }
    if (this.pitch > s.maxPitch) this.crash('loop') // past the point of no return: it carries on over backwards (see the crashed branch), never snapped upright

    // ── suspension: independent front and rear springs, loaded by braking, power, the wheelie, landings and the ground's bumps ──
    const brakeLoad = Math.max(0, -this.accelNow)
    const powerLoad = Math.max(0, this.accelNow)
    this.yRearF += (ground.yRear - this.yRearF) * Math.min(1, dt * 7)
    this.yFrontF += (ground.yFront - this.yFrontF) * Math.min(1, dt * 7)
    const bumpR = Math.max(-1, Math.min(1, (ground.yRear - this.yRearF) * 6))
    const bumpF = Math.max(-1, Math.min(1, (ground.yFront - this.yFrontF) * 6))
    const fTarget = this.pitch > 0.05 ? 0 : Math.max(0, Math.min(s.forkTravel * 0.85, brakeLoad * 0.014 + this.brk * 0.012 + bumpF * s.forkTravel * 0.5 + Math.max(0, frontUp) * 0.02))
    const rTarget = Math.max(0, Math.min(s.shockTravel * 0.9, powerLoad * 0.011 + Math.sin(this.pitch) * s.shockTravel * 0.7 + 0.01 + bumpR * s.shockTravel * 0.5 + Math.max(0, rearUp) * 0.02))
    this.forkV += (-110 * (this.forkC - fTarget) - 13 * this.forkV) * dt
    this.forkC = Math.max(0, Math.min(s.forkTravel * 1.1, this.forkC + this.forkV * dt))
    this.shockV += (-132 * (this.shockC - rTarget) - 13 * this.shockV) * dt
    this.shockC = Math.max(0, Math.min(s.shockTravel * 1.1, this.shockC + this.shockV * dt))
    this.chassis = (this.forkC - this.shockC * 0.8) / L // the chassis pitches on the two springs: nose down when the fork is more compressed than the shock

    // ── what touches the ground: a peg on a hard lean, the tail on a big wheelie, the bash plate when the suspension bottoms out ──
    let part: Scrape['part'] = null
    let k = 0
    let side = 0
    const leanA = Math.abs(this.roll)
    if (leanA > s.pegLean && av > 2.5) {
      part = 'peg'
      k = Math.min(1, (leanA - s.pegLean) / 0.1)
      side = Math.sign(this.roll)
    } else if (this.tailPen > 0 || this.pitch > thS - 0.01) {
      part = 'tail'
      k = Math.min(1, 0.3 + this.tailPen * 20)
    } else if ((this.forkC > s.forkTravel * 1.02 || this.shockC > s.shockTravel * 1.02) && av > 3) {
      part = 'bash'
      k = 0.6
    }
    this.scrape = { part, side, k }
    if (part) this.events.scrape = Math.max(this.events.scrape, k)
    this.events.spin = Math.max(this.events.spin, this.spin)

    // ── the one-hand trick: a pose request, honoured only while the front wheel is already up. It never lifts the wheel or holds it ──
    const wantOne = !!inp.trick && this.pitch > 0.12 && !this.crashed
    this.oneHand += ((wantOne ? 1 : 0) - this.oneHand) * Math.min(1, dt * (wantOne ? 7 : 9))
    if (this.oneHand < 0.004) this.oneHand = 0
    if (wantOne) this.oneHandTime += dt
    else if (this.pitch <= 0.02) this.oneHandTime = 0

    // ── move, spin ──
    this.travel(dt, yawRate)
    this.rearSpin += ((this.v + this.spin * 9) / s.wheelR) * dt * (this.rbk > 0.9 && this.v > 1 ? 0.3 : 1) // a locked rear wheel barely turns; a spinning one turns faster than the road passes
    this.frontSpin += (this.v / s.wheelR) * dt // the front wheel turns with the road, raised or not
  }

  /** the rear contact patch travels along the heading (plus any slide); the heading turns; the mid-point follows */
  private travel(dt: number, yawRate: number) {
    const fx = Math.sin(this.h)
    const fz = Math.cos(this.h)
    const rx = -fz // + right (heading = (sin h, cos h); right = (−cos h… ) in this game's handedness the slide to the right is −(cos h, −sin h))
    const rz = fx
    this.rx += (fx * this.v + rx * this.vlat) * dt
    this.rz += (fz * this.v + rz * this.vlat) * dt
    this.h += yawRate * dt
    this.sync()
  }
}
