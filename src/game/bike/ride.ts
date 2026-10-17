import * as THREE from 'three'
import { audio } from '../audio'
import type { Character } from '../character/character'
import type { Input } from '../input'
import { RideControls, releaseAllRideButtons, rideBtn, takeGetOff } from './controls'
import { BikeSim, NO_INPUT, type Ground } from './sim'
import { STREET, SURRON, type BikeSpec } from './spec'
import { buildPracticeRoute } from './practice'
import { CHALLENGES, PracticeJudge } from './practiceJudge'
import { makeSparks } from './sparks'
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
  fit?: { handL: number; handR: number; headBars: number; lean: number }
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
export type RideSettings = { assist: number; school: boolean; view: 'chase' | 'side'; best: Record<string, number> }
export function loadRideSettings(): RideSettings {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    const best: Record<string, number> = {}
    if (j.best && typeof j.best === 'object') for (const c of CHALLENGES) if (typeof j.best[c.id] === 'number') best[c.id] = Math.max(0, Math.min(100, j.best[c.id]))
    return { assist: typeof j.assist === 'number' ? Math.max(0, Math.min(1, j.assist)) : 0.3, school: j.school !== false, view: j.view === 'side' ? 'side' : 'chase', best }
  } catch {
    return { assist: 0.3, school: true, view: 'chase', best: {} }
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
  { text: 'Accelerate: hold W (or Gas) up to about 45 km/h', done: (a: Active) => Math.abs(a.sim.v) > 12 },
  { text: 'Brake: slow right down with S (the Brake button)', done: (a: Active) => a.school.t > 0.4 && Math.abs(a.sim.v) < 1.2 },
  { text: 'Turn: steer with A / D (the stick) through a quarter turn', done: (a: Active) => Math.abs(angleDiff(a.sim.h, a.school.t)) > 1.2 },
  { text: 'Front-wheel lift: at about 20 km/h roll the Gas on hard; the front rises by itself. Ease off to lower it', done: (a: Active) => a.sim.pitch > 0.17 },
  { text: 'Recover: ease off the Gas and touch the Brake to bring the front down', done: (a: Active) => a.school.t > 0.5 && a.sim.pitch < 0.02 },
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
  readonly cam = { heading: 0, speed: 0, wheelie: 0, side: false, pitch: 0 }
  /** the practice strip's judge (scores only; never changes the riding) and the last result shown for a few seconds */
  private judge = new PracticeJudge(loadRideSettings().best)
  private last: { name: string; line: string; score: number; t: number } | null = null
  private sparks: { dispose: () => void; emit: (p: THREE.Vector3, n: THREE.Vector3, k: number) => void; update: (dt: number) => void } | null = null

  private practice: { dispose: () => void } | null = null
  constructor(private host: RideHost) {
    this.practice = buildPracticeRoute(host.scene, host.ground)
    this.sparks = makeSparks(host.scene)
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

  /** parked bikes: full detail within `near` metres of the viewer, the low-detail set beyond (a parked MX4 is 80 K triangles up close, 25 K far) */
  updateDetail(vx: number, vz: number, near = 16) {
    for (const p of this.parked) {
      if (this.active?.parked === p) continue
      p.rig.setNear?.(Math.hypot(p.x - vx, p.z - vz) < near)
    }
  }

  /** swap a parked bike's visual for another one (the scan finished loading); a bike being ridden keeps its current visual until it is put down */
  replaceRig(id: string, make: () => BikeRig) {
    const p = this.parked.find((q) => q.id === id)
    if (!p || this.active?.parked === p) return false
    const old = p.rig
    const rig = make()
    rig.park()
    rig.root.position.copy(old.root.position)
    rig.root.rotation.copy(old.root.rotation)
    this.host.scene.add(rig.root)
    old.dispose()
    p.rig = rig
    return true
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
      const inp = paused ? idle : this.controls.read(dt)
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
    this.cam.side = this.settings.view === 'side'
    this.cam.pitch = sim.pitch
    audio.rideTick({ kind: a.parked.kind, v: Math.abs(sim.v), vmax: a.spec.maxSpeed, thr: sim.thr, brake: Math.max(sim.brk, sim.rbk), rpm: sim.rpm, gear: sim.gear, wheelie: sim.pitch, touchdown: sim.events.touchdown, crashed: !!sim.crashed, scrape: sim.scrape.k, part: sim.scrape.part, spin: sim.spin })
    sim.events.touchdown = 0
    this.practiceStep(a, dt)
    this.sparksStep(a, dt)
    this.emitHud(false, dt)
    this.syncRig(dt)
  }

  /** the practice strip: the judge only reads the riding state; its results show as a brief note and are kept as local personal bests */
  private practiceStep(a: Active, dt: number) {
    const sim = a.sim
    if (a.phase !== 'riding' && a.phase !== 'crashed') return
    const done = this.judge.update(dt, { x: sim.x, z: sim.z, v: sim.v, pitch: sim.pitch, pitchRate: sim.pitchRate, roll: sim.roll, oneHand: sim.oneHand, scrapePart: sim.scrape.part, touchdown: sim.lastTouchdown, crashed: !!sim.crashed })
    if (done.length) {
      for (const r of done) {
        const c = CHALLENGES.find((x) => x.id === r.id)!
        this.last = { name: c.name, line: r.line, score: r.score, t: 4 }
      }
      this.settings = { ...this.settings, best: this.judge.bests() }
      saveRideSettings(this.settings)
    }
    if (this.last) {
      this.last.t -= dt
      if (this.last.t <= 0) this.last = null
    }
    sim.lastTouchdown = 0
  }

  /** sparks and the contact point of whatever part is touching the road */
  private sparksStep(a: Active, dt: number) {
    const sim = a.sim
    const sp = sim.scrape
    if (sp.part && !sim.crashed) {
      const rig = a.rig
      const p = new V3()
      if (sp.part === 'peg') (sp.side > 0 ? rig.pegR : rig.pegL).getWorldPosition(p)
      else rig.root.getWorldPosition(p)
      p.y = this.host.ground(p.x, p.z)
      const back = new V3(-Math.sin(sim.h), 0, -Math.cos(sim.h))
      if (Math.random() < 0.6 + sp.k * 0.4) this.sparks?.emit(p, back, sp.k)
    }
    this.sparks?.update(dt)
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
    // ONE HAND: only while the front wheel is up. The clutch (left) hand lifts off the grip and rises a little out to the side; the gas hand stays on the bar. Released, it settles back onto the grip.
    const one = THREE.MathUtils.clamp(sim.oneHand, 0, 1)
    if (one > 0.004) {
      const raised = gl.clone().addScaledVector(up, 0.62).addScaledVector(left, 0.22).addScaledVector(fwd, -0.12)
      gl.lerp(raised, one * one * (3 - 2 * one))
    }
    // pose, then fit the torso: hands must reach the grips (lean forward until they do) while the head (PumpChad's pumpkin is big) stays clear of the bars (lean back if not)
    let lean = lean0
    let slide = 0 // the rider scoots forward on the saddle when the bars are a long reach away
    const palmOf = (player as unknown as { palm?: (s: 'l' | 'r', o?: THREE.Vector3) => THREE.Vector3 }).palm
    for (let i = 0; i < 9; i++) {
      // ride() puts the pelvis 0.13 above the point it is given; `hip` already includes that, so hand it the saddle surface
      const seatPt = hip.clone().addScaledVector(up, -0.13).addScaledVector(fwd, slide)
      player.ride?.(seatPt, pegL, pegR, lean, 0.3 + pz.stand * 0.25)
      player.grip?.(gl, gr)
      player.grip?.(gl, gr) // a second pass: the palm offset follows the forearm, which the first pass just moved
      const head = player.headCenter?.(new V3())
      if (!head) break
      const barMid = gl.clone().add(gr).multiplyScalar(0.5)
      const clear = head.distanceTo(barMid)
      const need = 0.5
      const reach = palmOf ? Math.max(one > 0.5 ? 0 : palmOf.call(player, 'l', new V3()).distanceTo(gl), palmOf.call(player, 'r', new V3()).distanceTo(gr)) : 0
      let next = lean
      if (clear < need) next -= (need - clear) * 1.1
      else if (reach > 0.03 && lean < 0.9) next += Math.min(0.25, reach * 1.2)
      else if (reach > 0.03 && slide < 0.14) {
        slide += Math.min(0.07, reach)
        next = lean + 0.0001
      } else break
      if (i === 8) break
      lean = THREE.MathUtils.clamp(next, -0.3, 0.95)
      player.update(0) // re-pose from the animation so the lean is not applied twice
      root.position.copy(rootPos)
      root.quaternion.copy(seatQ).multiply(qAlign)
      root.updateMatrixWorld(true)
    }
    // QA: how well the body meets the bike (metres)
    const pl = (player as unknown as { palm?: (s: 'l' | 'r', o?: THREE.Vector3) => THREE.Vector3 }).palm
    if (pl) {
      const head = player.headCenter?.(new V3())
      const barMid = gl.clone().add(gr).multiplyScalar(0.5)
      a.fit = { handL: +pl.call(player, 'l', new V3()).distanceTo(gl).toFixed(3), handR: +pl.call(player, 'r', new V3()).distanceTo(gr).toFixed(3), headBars: head ? +head.distanceTo(barMid).toFixed(3) : -1, lean: +lean.toFixed(3) }
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
          slow: Math.abs(a.sim.v) < 0.8 && !a.sim.wheelie,
          view: this.settings.view,
          practice: this.last ? { name: this.last.name, line: this.last.line, score: this.last.score, best: this.judge.best(CHALLENGES.find((c) => c.name === this.last!.name)!.id) } : this.judge.card(),
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
      spin: +s.spin.toFixed(2),
      oneHand: +s.oneHand.toFixed(2),
      scrape: { ...s.scrape },
      autoLean: +s.autoLean.toFixed(2),
      judge: { active: this.judge.active, results: this.judge.results.slice(-6), bests: this.judge.bests() },
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
      fit: a.fit ?? null,
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
    this.sparks?.dispose()
    for (const p of this.parked) p.rig.dispose()
    this.parked.length = 0
    this.active = null
  }
}
