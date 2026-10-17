import * as THREE from 'three'
import { audio } from '../audio'
import type { Character } from '../character/character'
import type { Input } from '../input'
import { RideControls, releaseAllRideButtons, rideBtn, takeGetOff } from './controls'
import { BikeSim, NO_INPUT, type Ground } from './sim'
import { STREET, SURRON, type BikeSpec } from './spec'
import { buildPracticeRoute } from './practice'
import { ModelBikeVisual, type BikeKind, type BikeRig } from './visual'

/**
 * RIDING IN THE WORLD: parked bikes you can climb onto, the ride itself (sim + visual + rider + collisions + crash and recovery), and getting off.
 * The scene hands this class a small `host`; nothing here reaches into the scene's internals, and the bike's look (`BikeRig`) and handling (`BikeSpec`)
 * are both swappable. The simulation (`sim.ts`) runs on its own fixed step; this class only feeds it inputs and the ground, and draws its interpolated view.
 */
export type RideHost = {
  scene: THREE.Scene
  ground(x: number, z: number): number
  /** push a point out of walls, colliders and the map's closed areas (the same rule the walking player obeys) */
  resolve(p: THREE.Vector3, r: number, feetY: number): void
  input: Input
  /** the game is paused (a menu, a dialogue): the bike takes no input */
  paused(): boolean
}
export const SPECS: Record<BikeKind, BikeSpec> = { surron: SURRON, street: STREET }

type Parked = { id: string; kind: BikeKind; x: number; z: number; yaw: number; rig: BikeRig; label: string }
type Pose = { stand: number; lean: number; shiftZ: number; arm: number }
type Active = {
  parked: Parked
  sim: BikeSim
  rig: BikeRig
  spec: BikeSpec
  phase: 'mounting' | 'riding' | 'dismounting' | 'crashed'
  t: number
  from: THREE.Vector3
  gp: number
  yRear: number
  crashSide: number
  pose: Pose
  bestWheelie: { t: number; d: number }
  school: { step: number; t: number }
  odo: number
}

const R_BIKE = 0.55
const V3 = THREE.Vector3
const Y_UP = new V3(0, 1, 0)
const qAlign = new THREE.Quaternion().setFromAxisAngle(Y_UP, Math.PI / 2) // the rider faces +z, the bike +x

/** player settings for riding, kept in this browser only */
const KEY = 'pumpchad.ride.v1'
export type RideSettings = { assist: number; school: boolean }
export function loadRideSettings(): RideSettings {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return { assist: typeof j.assist === 'number' ? Math.max(0, Math.min(1, j.assist)) : 0.3, school: j.school !== false }
  } catch {
    return { assist: 0.3, school: true }
  }
}
export function saveRideSettings(s: RideSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable: the settings simply do not persist */
  }
}

/** the short optional lessons (see `RideSystem.schoolStep`): what to do, and how it is recognised from the actual riding */
const LESSONS = [
  { text: 'Accelerate: hold W (or the Gas button) up to 12 m/s', done: (a: Active) => Math.abs(a.sim.v) > 12 },
  { text: 'Brake: slow right down with S (the Brake button)', done: (a: Active) => a.school.t > 0.4 && Math.abs(a.sim.v) < 1.2 },
  { text: 'Turn: steer with A / D (the stick) through a quarter turn', done: (a: Active) => Math.abs(angleDiff(a.sim.h, a.school.t)) > 1.2 },
  { text: 'Front-wheel lift: hold W + Shift (Gas + Wheelie) and ease off as it rises', done: (a: Active) => a.sim.pitch > 0.17 },
  { text: 'Recover: bring it down with the rear brake (Space / Rear brake)', done: (a: Active) => a.school.t > 0.5 && a.sim.pitch < 0.02 },
]
const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b))

export class RideSystem {
  readonly parked: Parked[] = []
  active: Active | null = null
  private controls: RideControls
  private hudT = 0
  private note = ''
  private noteT = 0
  settings: RideSettings = loadRideSettings()
  /** set by the scene each frame while this is active: the camera should follow (heading, speed) */
  readonly cam = { heading: 0, speed: 0, wheelie: 0 }

  private practice: { dispose: () => void } | null = null
  constructor(private host: RideHost) {
    this.practice = buildPracticeRoute(host.scene, host.ground)
    this.controls = new RideControls(host.input)
    window.addEventListener('chad-ride-set', this.onSet)
  }
  private onSet = (e: Event) => this.setSettings((e as CustomEvent<Partial<RideSettings>>).detail)

  /** put a bike on the ground, parked on its kickstand */
  addParked(id: string, kind: BikeKind, x: number, z: number, yaw: number, paint: THREE.Material, label: string, D: (THREE.Material | THREE.Texture | THREE.BufferGeometry)[]) {
    const rig = new ModelBikeVisual(kind, paint, D)
    rig.park()
    rig.root.position.set(x, this.host.ground(x, z), z)
    rig.root.rotation.y = yaw - Math.PI / 2
    this.host.scene.add(rig.root)
    const p: Parked = { id, kind, x, z, yaw, rig, label }
    this.parked.push(p)
    return p
  }

  /** the nearest parked bike within reach (for the scene's interaction prompt) */
  near(x: number, z: number, reach = 1.9) {
    let best: Parked | null = null
    let bd = reach
    for (const p of this.parked) {
      if (this.active?.parked === p) continue
      const d = Math.hypot(p.x - x, p.z - z)
      if (d < bd) {
        bd = d
        best = p
      }
    }
    return best
  }

  get riding() {
    return !!this.active
  }

  setSettings(s: Partial<RideSettings>) {
    this.settings = { ...this.settings, ...s }
    saveRideSettings(this.settings)
    if (this.active) this.active.sim.assist = this.settings.assist
  }

  /* ───────── getting on and off ───────── */

  mount(id: string, player: Character | null, from: THREE.Vector3) {
    if (this.active) return false
    const p = this.parked.find((b) => b.id === id)
    if (!p || !player) return false
    const spec = SPECS[p.kind]
    const sim = new BikeSim(spec)
    sim.reset(p.x, p.z, p.yaw)
    sim.assist = this.settings.assist
    this.active = {
      parked: p,
      sim,
      rig: p.rig,
      spec,
      phase: 'mounting',
      t: 0,
      from: from.clone(),
      gp: 0,
      yRear: this.host.ground(p.x, p.z),
      crashSide: 1,
      pose: { stand: 0, lean: 0.1, shiftZ: 0, arm: 0 },
      bestWheelie: { t: 0, d: 0 },
      school: { step: 0, t: 0 },
      odo: 0,
    }
    this.controls.start()
    releaseAllRideButtons()
    this.setNote('')
    audio.rideStart(p.kind)
    return true
  }

  /** get off: only when nearly stopped; the bike is left where it stands */
  dismount(out: THREE.Vector3) {
    const a = this.active
    if (!a || a.phase === 'dismounting') return false
    if (Math.abs(a.sim.v) > 2.6 || a.sim.wheelie) {
      this.setNote('Slow down to get off · press E at a standstill')
      return false
    }
    a.phase = 'dismounting'
    a.t = 0
    a.sim.v = 0
    const left = new V3(Math.cos(a.sim.h), 0, -Math.sin(a.sim.h)) // the bike's left-hand side
    out.set(a.sim.x + left.x * 0.95, 0, a.sim.z + left.z * 0.95)
    return true
  }

  private finishDismount() {
    const a = this.active
    if (!a) return
    const { sim, parked } = a
    parked.x = sim.x
    parked.z = sim.z
    parked.yaw = sim.h
    a.rig.park()
    a.rig.root.position.set(sim.x, this.host.ground(sim.x, sim.z), sim.z)
    a.rig.root.rotation.set(0, sim.h - Math.PI / 2, 0)
    this.controls.stop()
    audio.rideStop()
    this.active = null
    this.emitHud(true)
  }

  /** drop everything held and stop the engine (the scene was paused, the page lost focus, the world is being torn down) */
  releaseInputs() {
    releaseAllRideButtons()
  }

  private setNote(t: string) {
    this.note = t
    this.noteT = t ? 2.4 : 0
  }

  /* ───────── the ride ───────── */

  /** the height of the ground under each wheel, from the bike's mid-point and heading */
  private groundFor(sim: BikeSim): Ground {
    const L = sim.spec.wheelbase * 0.5
    const fx = Math.sin(sim.h)
    const fz = Math.cos(sim.h)
    return { yRear: this.host.ground(sim.x - fx * L, sim.z - fz * L), yFront: this.host.ground(sim.x + fx * L, sim.z + fz * L) }
  }

  /** advance one frame; `pos` is the scene's player position (kept in step with the bike) */
  step(dt: number, pos: THREE.Vector3, takeAction: () => boolean, _player: Character | null) {
    const a = this.active
    if (!a) return
    const { sim } = a
    a.t += dt
    this.noteT = Math.max(0, this.noteT - dt)
    if (this.noteT === 0) this.note = ''
    const paused = this.host.paused()
    if (paused) this.releaseInputs()
    const idle = NO_INPUT

    if (a.phase === 'mounting') {
      // the rider swings on over ~0.5 s with the bike held still; the bars are straight
      sim.advance(dt, { ...idle, brake: 1 }, this.groundFor(sim))
      if (a.t >= 0.5) a.phase = 'riding'
    } else if (a.phase === 'riding') {
      const inp = paused ? idle : this.controls.read()
      const act = !paused && (takeAction() || takeGetOff())
      if (act) {
        const out = new V3()
        if (this.dismount(out)) a.from.copy(out)
      }
      if (a.phase === 'riding') {
        sim.advance(dt, inp, this.groundFor(sim))
        this.collide(a, dt)
        this.school(a)
        if (sim.crashed) {
          a.phase = 'crashed'
          a.t = 0
          a.crashSide = sim.roll >= 0 ? 1 : -1
          this.setNote(sim.crashed === 'loop' ? 'Looped out!' : 'Crashed!')
        }
      }
    } else if (a.phase === 'crashed') {
      sim.advance(dt, idle, this.groundFor(sim))
      if (a.t > 2.1) {
        // recovery: the bike is stood back up where it fell, and the rider is back on it
        sim.reset(sim.x, sim.z, sim.h)
        sim.assist = this.settings.assist
        a.phase = 'mounting'
        a.t = 0
        this.setNote('Bike recovered')
      }
    } else if (a.phase === 'dismounting') {
      sim.advance(dt, { ...idle, brake: 1 }, this.groundFor(sim))
      if (a.t >= 0.5) {
        this.finishDismount()
        return
      }
    }
    // the best wheelie of the session (a readout; it never feeds back into the riding)
    if (sim.wheelieTime > a.bestWheelie.t) a.bestWheelie = { t: sim.wheelieTime, d: sim.wheelieDist }
    a.odo += Math.abs(sim.v) * dt
    pos.set(sim.x, 0, sim.z)
    this.cam.heading = sim.h
    this.cam.speed = Math.abs(sim.v)
    this.cam.wheelie = sim.pitch
    audio.rideTick({ kind: a.parked.kind, v: Math.abs(sim.v), vmax: a.spec.maxSpeed, thr: sim.thr, brake: Math.max(sim.brk, sim.rbk), rpm: sim.rpm, gear: sim.gear, wheelie: sim.pitch, touchdown: sim.events.touchdown, crashed: !!sim.crashed })
    sim.events.touchdown = 0
    this.emitHud(false, dt)
    this.syncRig(dt)
  }

  /** collisions: let the world push the bike out of whatever it ran into, and take the speed out of the hit */
  private collide(a: Active, dt: number) {
    const sim = a.sim
    const want = new V3(sim.x, 0, sim.z)
    const after = want.clone()
    this.host.resolve(after, R_BIKE, a.yRear)
    const push = new V3(after.x - want.x, 0, after.z - want.z)
    const pm = push.length()
    if (pm <= 0.004) return
    const n = push.clone().divideScalar(pm)
    const vx = Math.sin(sim.h) * sim.v
    const vz = Math.cos(sim.h) * sim.v
    const into = Math.max(0, -(vx * n.x + vz * n.z)) // speed into the surface
    if (into > 9.5) {
      sim.hit(0.9)
      sim.crash('collision')
    } else if (into > 0.2) {
      sim.hit(Math.min(0.85, into * 0.09))
      // a glancing blow turns the bike along the wall a little rather than stopping it dead
      if (Math.abs(sim.v) > 1) {
        const along = Math.atan2(vx + n.x * into, vz + n.z * into)
        const dh = angleDiff(along, sim.h)
        sim.h += Math.max(-0.5, Math.min(0.5, dh)) * Math.min(1, dt * 6)
      }
    }
    sim.setMid(after.x, after.z)
  }

  /** the optional lessons: a lesson is done when the actual riding does it */
  private school(a: Active) {
    if (!this.settings.school || a.school.step >= LESSONS.length) return
    const L = LESSONS[a.school.step]
    if (a.school.step === 2 && a.school.t === 0) a.school.t = a.sim.h // the turn lesson measures heading from where it began
    if (a.school.step === 1 || a.school.step === 4) a.school.t += 1 / 60
    if (L.done(a)) {
      a.school.step++
      a.school.t = a.school.step === 2 ? a.sim.h : 0
      if (a.school.step === 2) a.school.t = a.sim.h || 1e-6
    }
  }

  /** place the bike's visual from the (interpolated) model state and the ground under its wheels */
  private syncRig(dt: number) {
    const a = this.active
    if (!a) return
    const { sim, spec, rig } = a
    const v = sim.view()
    const L = spec.wheelbase
    const fx = Math.sin(v.h)
    const fz = Math.cos(v.h)
    const yR = this.host.ground(v.x - fx * L * 0.5, v.z - fz * L * 0.5)
    const yF = this.host.ground(v.x + fx * L * 0.5, v.z + fz * L * 0.5)
    const gp = Math.atan2(yF - yR, L)
    const k = 1 - Math.exp(-dt * 18)
    a.gp += (gp - a.gp) * k
    a.yRear += (yR - a.yRear) * (1 - Math.exp(-dt * 30))
    rig.root.position.set(v.x, a.yRear, v.z)
    rig.root.rotation.set(0, v.h - Math.PI / 2, 0)
    rig.apply(v, a.gp)
    if (a.phase === 'crashed') {
      // the fallen bike: over backwards after a loop-out, onto its side otherwise
      const kk = Math.min(1, a.t / 0.45)
      const e = kk * kk * (3 - 2 * kk)
      if (sim.crashed === 'loop') rig.root.rotation.z = -e * 0.35
      else rig.root.rotation.x = a.crashSide * -1.45 * e
      rig.root.position.y = a.yRear + e * 0.22
    }
    rig.root.updateMatrixWorld(true)
  }

  /** pose the rider on the bike (after the character's own update) */
  pose(player: Character | null, standAt: THREE.Vector3 | null, dt: number) {
    const a = this.active
    if (!a || !player) return
    const { sim, rig } = a
    const root = player.root
    if (a.phase === 'crashed') {
      // thrown off: lies in the dust beside the bike, then gets back up as the bike is righted
      const k = Math.min(1, a.t / 0.3)
      const get = a.t > 1.6 ? Math.max(0, 1 - (a.t - 1.6) / 0.4) : 1
      const side = new V3(-Math.cos(sim.h), 0, Math.sin(sim.h)).multiplyScalar(a.crashSide * 1.1)
      root.position.set(sim.x + side.x - Math.sin(sim.h) * 0.6, this.host.ground(sim.x, sim.z), sim.z + side.z - Math.cos(sim.h) * 0.6)
      root.rotation.order = 'YXZ'
      root.rotation.set(-1.45 * k * get, sim.h, 0)
      player.pose = 'idle'
      return
    }
    if (a.phase === 'dismounting' && standAt) {
      const u = Math.min(1, a.t / 0.5)
      const e = u * u * (3 - 2 * u)
      const seat = rig.seat.getWorldPosition(new V3())
      root.position.lerpVectors(new V3(seat.x, seat.y - 0.95, seat.z), new V3(standAt.x, this.host.ground(standAt.x, standAt.z), standAt.z), e)
      root.rotation.set(0, sim.h, 0)
      player.pose = 'idle'
      return
    }
    // mounting: the rider comes in from where they stood, onto the seat
    const mounting = a.phase === 'mounting'
    const u = mounting ? Math.min(1, a.t / 0.5) : 1
    const blend = u * u * (3 - 2 * u)

    // ── the posture, from the bike's actual state, eased so the body moves like a body ──
    const kind = a.parked.kind
    const target: Pose = { stand: 0, lean: 0.34, shiftZ: 0, arm: 0 }
    const sp = Math.abs(sim.v)
    const bumpy = Math.min(1, Math.abs(sim.shockV) * 2 + Math.abs(sim.forkV) * 1.5)
    if (kind === 'surron') target.stand = THREE.MathUtils.clamp((sp - 3.5) / 4, 0, 1) * (sim.wheelie ? 0.35 : 1)
    else target.stand = Math.min(0.35, bumpy * 0.5) * (sim.wheelie ? 0 : 1)
    target.lean = 0.34 + target.stand * 0.2 - sim.accelNow * 0.011 + Math.max(0, -sim.accelNow) * 0.022 - sim.pitch * 0.55 - sim.lean * 0.22
    target.lean = THREE.MathUtils.clamp(target.lean, -0.3, 0.72)
    target.shiftZ = -sim.roll * 0.2 // the rider's weight goes to the inside of the turn
    const kp = 1 - Math.exp(-dt * 9)
    const pz = a.pose
    pz.stand += (target.stand - pz.stand) * kp
    pz.lean += (target.lean - pz.lean) * kp
    pz.shiftZ += (target.shiftZ - pz.shiftZ) * kp

    const seatW = rig.seat.getWorldPosition(new V3())
    const seatQ = rig.seat.getWorldQuaternion(new THREE.Quaternion())
    const fwd = new V3(1, 0, 0).applyQuaternion(seatQ)
    const up = new V3(0, 1, 0).applyQuaternion(seatQ)
    const left = new V3(0, 0, 1).applyQuaternion(seatQ)
    const pegL = rig.pegL.getWorldPosition(new V3())
    const pegR = rig.pegR.getWorldPosition(new V3())
    const pegMid = pegL.clone().add(pegR).multiplyScalar(0.5)
    // the hips: on the seat when seated, above the pegs (knees bent, slightly behind them) when standing; weight shifted inside a turn
    const sat = seatW.clone().addScaledVector(up, 0.13)
    const stood = pegMid.clone().addScaledVector(up, 0.8).addScaledVector(fwd, -0.06)
    const hip = sat.lerp(stood, pz.stand).addScaledVector(left, pz.shiftZ)
    const rootPos = new V3(hip.x, hip.y - 0.95, hip.z)
    if (blend < 1) rootPos.lerpVectors(new V3(a.from.x, this.host.ground(a.from.x, a.from.z), a.from.z), rootPos, blend)
    root.position.copy(rootPos)
    root.quaternion.copy(seatQ).multiply(qAlign)
    root.updateMatrixWorld(true)
    player.pose = 'idle'
    const lean0 = pz.lean * blend + (1 - blend) * 0.1
    const gl = rig.gripL.getWorldPosition(new V3())
    const gr = rig.gripR.getWorldPosition(new V3())
    // pose, then check the head is clear of the bars (PumpChad's pumpkin is big) and lean back a little if it is not
    let lean = lean0
    for (let i = 0; i < 3; i++) {
      player.ride?.(hip, pegL, pegR, lean, 0.3 + pz.stand * 0.25)
      player.grip?.(gl, gr)
      const head = player.headCenter?.(new V3())
      if (!head) break
      const barMid = gl.clone().add(gr).multiplyScalar(0.5)
      const clear = head.distanceTo(barMid)
      const need = 0.52
      if (clear >= need || i === 2) break
      lean -= (need - clear) * 1.1
      player.update(0) // re-pose from the animation so the lean is not applied twice
      root.position.copy(rootPos)
      root.quaternion.copy(seatQ).multiply(qAlign)
      root.updateMatrixWorld(true)
    }
  }

  /* ───────── HUD ───────── */

  private emitHud(force: boolean, dt = 0) {
    this.hudT -= dt
    if (!force && this.hudT > 0) return
    this.hudT = 0.1
    const a = this.active
    const detail = a
      ? {
          riding: true,
          name: a.spec.name,
          kmh: Math.round(Math.abs(a.sim.v) * 3.6),
          up: a.sim.wheelie,
          wheelieTime: +a.sim.wheelieTime.toFixed(1),
          wheelieDist: Math.round(a.sim.wheelieDist),
          best: { t: +a.bestWheelie.t.toFixed(1), d: Math.round(a.bestWheelie.d) },
          phase: a.phase,
          note: this.note,
          assist: this.settings.assist,
          school: this.settings.school ? { step: a.school.step, total: LESSONS.length, text: LESSONS[Math.min(a.school.step, LESSONS.length - 1)].text, done: a.school.step >= LESSONS.length } : null,
        }
      : { riding: false }
    window.dispatchEvent(new CustomEvent('chad-ride-hud', { detail }))
  }

  /** QA */
  state() {
    const a = this.active
    if (!a) return { riding: false, parked: this.parked.map((p) => ({ id: p.id, kind: p.kind, x: +p.x.toFixed(2), z: +p.z.toFixed(2) })) }
    const s = a.sim
    return {
      riding: true,
      phase: a.phase,
      kind: a.parked.kind,
      x: +s.x.toFixed(2),
      z: +s.z.toFixed(2),
      heading: +s.h.toFixed(3),
      v: +s.v.toFixed(2),
      vlat: +s.vlat.toFixed(2),
      delta: +s.delta.toFixed(3),
      roll: +s.roll.toFixed(3),
      pitch: +s.pitch.toFixed(3),
      balance: +s.balance.toFixed(3), // (QA only; never shown to the player)
      pitchRate: +s.pitchRate.toFixed(3),
      forkC: +s.forkC.toFixed(3),
      shockC: +s.shockC.toFixed(3),
      crashed: s.crashed,
      latAccel: +s.latNow.toFixed(2),
      wheelieTime: +s.wheelieTime.toFixed(2),
      wheelieDist: +s.wheelieDist.toFixed(1),
      touchdown: +s.touchdown.toFixed(2),
      slope: +s.slope.toFixed(3),
      inputs: { thr: +s.thr.toFixed(2), brk: +s.brk.toFixed(2), rbk: +s.rbk.toFixed(2), lean: +s.lean.toFixed(2) },
      gear: s.gear,
      rpm: +s.rpm.toFixed(2),
      pose: { ...a.pose },
      school: a.school.step,
      assist: this.settings.assist,
      buttons: { ...rideBtn },
      cam: { ...this.cam },
    }
  }
  /** QA: put the active bike at a place, speed and heading */
  qaSet(o: { x?: number; z?: number; h?: number; v?: number; assist?: number; surface?: number }) {
    const s = this.active?.sim
    if (!s) return
    if (o.h !== undefined) s.h = o.h
    if (o.x !== undefined || o.z !== undefined) s.setMid(o.x ?? s.x, o.z ?? s.z)
    else if (o.h !== undefined) s.setMid(s.x, s.z)
    if (o.v !== undefined) s.v = o.v
    if (o.assist !== undefined) s.assist = o.assist
    if (o.surface !== undefined) s.surface = o.surface
  }

  dispose() {
    window.removeEventListener('chad-ride-set', this.onSet)
    this.controls.stop()
    audio.rideStop()
    this.practice?.dispose()
    for (const p of this.parked) p.rig.dispose()
    this.parked.length = 0
    this.active = null
  }
}
