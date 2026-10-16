import type { BikeSpec } from './spec'

/**
 * THE RIDING MODEL. Pure numbers (no meshes, no THREE): position, heading, speed, steering, lean, a wheelie (pitch) model with a real balance point,
 * suspension and a simple state machine for a crash and its recovery. The scene feeds it rider inputs and the ground, and reads back what to draw.
 *
 * The model, in short:
 *  - heading: a bicycle model (yaw rate = speed · tan(steer) / wheelbase), with the steering angle fading with speed;
 *  - grip: the tyres can only give `gripLat` of lateral acceleration. Ask for more and the bike runs WIDE (understeer) and scrubs a little speed:
 *    it never slides out sideways, which is what makes it easy to ride on a keyboard or a phone;
 *  - lean: the bike leans by atan(lateral accel / g), smoothed;
 *  - wheelie: the bike pivots about the rear contact patch. Gravity pulls the nose down while the centre of mass is ahead of the pivot, and flips
 *    the other way once it is behind it: the BALANCE POINT is tan(θb) = d / h. Drive torque (throttle), the rider heaving back (and shifting the
 *    centre of mass), the rear brake and leaning forward all push on it. So a wheelie is a small, continuous balancing act: too little and it drops,
 *    too much and it loops out;
 *  - the front touches down softly (the pitch rate is eased near the ground) and the impact compresses the fork.
 */
export type RideInput = {
  throttle: number // 0..1
  brake: number // 0..1  both brakes (front-biased)
  rear: number // 0..1  rear brake only
  steer: number // −1 (left) .. 1 (right)
  lean: number // −1 (weight forward) .. 1 (heave back / pull a wheelie)
}
export const NO_INPUT: RideInput = { throttle: 0, brake: 0, rear: 0, steer: 0, lean: 0 }

export type CrashKind = 'loop' | 'highside' | 'collision'
const G = 9.81

export class BikeSim {
  x = 0
  z = 0
  /** heading: forward = (sin h, cos h) */
  h = 0
  /** forward speed (m/s; negative = reversing) */
  v = 0
  /** steering angle (rad, + = right) */
  delta = 0
  /** roll (rad, + = leaning right) */
  roll = 0
  /** wheelie angle (rad, 0 = front wheel down) and rate */
  pitch = 0
  pitchRate = 0
  /** suspension compression (m): 0 = fully extended */
  forkC = 0
  forkV = 0
  shockC = 0
  shockV = 0
  /** wheel spin angles (rad) */
  rearSpin = 0
  frontSpin = 0
  /** smoothed rider inputs, for the visual */
  thr = 0
  brk = 0
  rbk = 0
  lean = 0
  /** longitudinal acceleration this step (m/s²) and the lateral one (m/s², + right) */
  accelNow = 0
  latNow = 0
  /** time the front wheel has been continuously up, and the best pitch of the current wheelie (for the HUD) */
  wheelieTime = 0
  wheelieBest = 0
  /** the front wheel has just touched down: size of the impact (rad/s), for a one-frame sound / dust cue */
  touchdown = 0
  /** crash state */
  crashed: CrashKind | null = null
  crashT = 0
  /** brake held at a standstill for this long → reverse */
  private revT = 0

  spec: BikeSpec
  constructor(spec: BikeSpec) {
    this.spec = spec
  }

  reset(x: number, z: number, h: number) {
    this.x = x
    this.z = z
    this.h = h
    this.v = 0
    this.delta = 0
    this.roll = 0
    this.pitch = 0
    this.pitchRate = 0
    this.forkC = this.forkV = this.shockC = this.shockV = 0
    this.thr = this.brk = this.rbk = this.lean = 0
    this.wheelieTime = this.wheelieBest = 0
    this.crashed = null
    this.crashT = 0
    this.revT = 0
  }

  /** the bike's front wheel is off the ground */
  get wheelie() {
    return this.pitch > 0.06
  }
  /** the pitch at which the centre of mass is over the pivot (for the HUD balance marker), given the rider's current weight shift */
  get balance() {
    const s = this.spec
    return Math.atan2(s.comD - s.shift * this.lean, s.comH)
  }

  /** a hit: scrub speed; a hard one at speed throws the rider (a crash) */
  hit(severity: number) {
    this.v *= Math.max(0, 1 - severity)
    if (Math.abs(this.v) < 0.1) this.v = 0
  }
  crash(kind: CrashKind) {
    if (this.crashed) return
    this.crashed = kind
    this.crashT = 0
  }

  step(dt: number, inp: RideInput) {
    const s = this.spec
    dt = Math.min(dt, 1 / 20)
    this.touchdown = 0
    if (this.crashed) {
      // a fallen bike slides to a stop; nothing steers it
      this.crashT += dt
      this.v *= Math.exp(-dt * 2.6)
      this.pitchRate *= Math.exp(-dt * 3)
      this.x += Math.sin(this.h) * this.v * dt
      this.z += Math.cos(this.h) * this.v * dt
      this.thr = this.brk = this.rbk = 0
      return
    }

    // ── rider inputs, smoothed so nothing jerks (a phone button is on/off; a key too) ──
    const ease = (cur: number, tgt: number, up: number, down: number) => cur + (tgt - cur) * Math.min(1, dt * (tgt > cur ? up : down))
    this.thr = ease(this.thr, inp.throttle, 4.5, 8)
    this.brk = ease(this.brk, inp.brake, 9, 10)
    this.rbk = ease(this.rbk, inp.rear, 9, 10)
    this.lean = ease(this.lean, inp.lean, 6, 5)

    // ── longitudinal ──
    const frontDown = this.pitch < 0.05
    let a = 0
    const vmax = s.maxSpeed
    const speedFrac = Math.max(0, this.v) / vmax
    // reverse: brake held at a standstill
    const brakeAll = Math.max(this.brk, this.rbk)
    if (Math.abs(this.v) < 0.35 && this.brk > 0.5 && this.thr < 0.05) this.revT += dt
    else if (this.thr > 0.05 || this.brk < 0.2) this.revT = 0
    const reversing = this.revT > 0.35 && this.thr < 0.05
    if (reversing) {
      a = -4 * this.brk
      if (this.v < -s.reverse) a = 0
    } else {
      // drive: strong off the line, tapering to nothing at top speed; a rear wheel in the dirt only gives so much
      a = s.accel * this.thr * (1 - Math.pow(speedFrac, 1.6))
      // brakes oppose the motion; the front only bites with the wheel down
      const decel = (frontDown ? s.brakeFront * this.brk : s.brakeFront * this.brk * 0.2) + s.brakeRear * Math.max(this.rbk, this.brk * 0.35)
      if (this.v > 0.02) a -= decel
      else if (this.v < -0.02) a += decel
      a -= this.v * s.drag * (1 + Math.abs(this.v) * 0.04) // rolling + air drag
      if (this.thr < 0.02 && Math.abs(this.v) < 0.4 && brakeAll < 0.05) a -= this.v * 4 // coasts to a stop rather than creeping
    }
    const v0 = this.v
    this.v += a * dt
    // brakes don't push you backwards
    if (!reversing && v0 > 0 && this.v < 0 && this.thr < 0.05) this.v = 0
    if (!reversing && v0 < 0 && this.v > 0) this.v = 0
    this.v = Math.max(-s.reverse, Math.min(vmax, this.v))
    this.accelNow = (this.v - v0) / Math.max(dt, 1e-4)

    // ── steering, grip and lean ──
    const av = Math.abs(this.v)
    const fade = 1 / (1 + Math.pow(av / s.steerFade, 1.7))
    // a wheelie can't be steered much (the front wheel is in the air): the bars still move but the bike barely turns
    const air = this.pitch > 0.12 ? Math.max(0.25, 1 - this.pitch * 1.4) : 1
    const target = inp.steer * s.steerMax * fade
    const dd = target - this.delta
    const maxStep = s.steerRate * dt * (Math.abs(inp.steer) < 0.02 ? 1.6 : 1) // bars return a bit faster than they go in
    this.delta += Math.max(-maxStep, Math.min(maxStep, dd))
    let yawRate = (-this.v * Math.tan(this.delta)) / s.wheelbase // + = left
    yawRate *= air
    const latWanted = -yawRate * this.v // + right
    const limit = s.gripLat
    if (Math.abs(latWanted) > limit && av > 0.5) {
      // out of grip: the bike runs wide — the turn tightens no further, and a little speed scrubs off
      const k = limit / Math.abs(latWanted)
      yawRate *= k
      this.v -= Math.sign(this.v) * (Math.abs(latWanted) - limit) * 0.05 * dt
    }
    this.h += yawRate * dt
    this.latNow = -yawRate * this.v
    const rollT = Math.atan2(this.latNow, G) * s.leanGain
    this.roll += (rollT - this.roll) * Math.min(1, dt * 7)

    // ── the wheelie: pitch about the rear contact patch ──
    const dEff = s.comD - s.shift * this.lean // rider heaving back moves the centre of mass back (and the balance point lower)
    const th = this.pitch
    const sin = Math.sin(th)
    const cos = Math.cos(th)
    let alpha = (G * (s.comH * sin - dEff * cos)) / s.gyr2 // gravity: nose down while the COM is ahead of the pivot, flips past the balance point
    alpha += (this.accelNow * (s.comH * cos + dEff * sin)) / s.gyr2 // drive torque (acceleration puts the weight back)
    const heave = Math.max(0, this.lean)
    if (heave > 0) alpha += s.pullTorque * heave * Math.max(0, 1 - th / 0.95) * Math.min(1, 0.4 + av / 3) // the pull dies away as the bike gets high
    const push = Math.max(0, -this.lean)
    if (th > 0.015) alpha -= s.pullTorque * 0.55 * push // weight forward
    if (th > 0.015) alpha -= s.rearBrakeTorque * this.rbk * (0.45 + 0.55 * Math.min(1, av / 5)) // rear brake: the nose comes down
    if (th > 0.015) alpha -= s.rearBrakeTorque * 0.25 * this.brk * (frontDown ? 0 : 1) // front brake with the wheel in the air also lowers it
    alpha -= s.pitchDamp * this.pitchRate
    // balance assist: inside a band around the balance point the rider steadies the bike (a gentle pull toward it and extra damping): that makes the
    // sweet spot HOLDABLE with small corrections, while leaving the band, or over-holding the controls, still ends in a drop or a loop-out
    if (s.assist > 0 && th > 0.1) {
      const thb = Math.atan2(dEff, s.comH)
      const band = Math.max(0, 1 - Math.abs(th - thb) / 0.2)
      alpha += s.assist * band * (6 * (thb - th) - 2.6 * this.pitchRate)
    }
    if (th <= 0 && alpha <= 0) {
      this.pitch = 0
      this.pitchRate = 0
    } else {
      this.pitchRate += alpha * dt
      this.pitchRate = Math.max(-2.2, Math.min(3.2, this.pitchRate)) // never an abrupt rotation, up or down
      // a soft touchdown: the closer to the ground, the slower the nose may descend (the fork absorbs the rest)
      if (this.pitchRate < 0 && th < 0.24) this.pitchRate = Math.max(this.pitchRate, -(th + 0.012) * 6.5)
      this.pitch += this.pitchRate * dt
    }
    if (this.pitch <= 0) {
      if (this.pitchRate < -0.05) {
        this.touchdown = -this.pitchRate
        this.forkV += -this.pitchRate * 0.55 // the fork takes the landing
      }
      this.pitch = 0
      this.pitchRate = Math.max(0, this.pitchRate)
    }
    if (this.pitch > 0.06) {
      this.wheelieTime += dt
      this.wheelieBest = Math.max(this.wheelieBest, this.pitch)
    } else if (this.wheelieTime > 0 && this.pitch <= 0.02) {
      this.wheelieTime = 0
      this.wheelieBest = 0
    }
    if (this.pitch > s.maxPitch) {
      this.crash('loop')
      this.pitchRate = 1.2
    }

    // ── suspension: springs with damping; braking dives the fork, acceleration squats the shock, a high wheelie loads the rear ──
    const fTarget = this.pitch > 0.05 ? 0 : Math.max(0, Math.min(s.forkTravel, (this.accelNow < 0 ? -this.accelNow : 0) * 0.011 + this.brk * 0.012))
    const rTarget = Math.max(0, Math.min(s.shockTravel, this.accelNow * 0.009 + Math.sin(this.pitch) * 0.07 + 0.012))
    const kF = 120
    const cF = 14
    this.forkV += (-kF * (this.forkC - fTarget) - cF * this.forkV) * dt
    this.forkC += this.forkV * dt
    this.forkC = Math.max(0, Math.min(s.forkTravel * 1.15, this.forkC))
    this.shockV += (-kF * 1.2 * (this.shockC - rTarget) - cF * this.shockV) * dt
    this.shockC += this.shockV * dt
    this.shockC = Math.max(0, Math.min(s.shockTravel * 1.15, this.shockC))

    // ── move, spin ──
    this.x += Math.sin(this.h) * this.v * dt
    this.z += Math.cos(this.h) * this.v * dt
    this.rearSpin += (this.v / s.wheelR) * dt * (this.rbk > 0.9 && this.v > 1 ? 0.3 : 1) // a locked rear wheel barely turns
    this.frontSpin += (this.v / s.wheelR) * dt
  }
}
