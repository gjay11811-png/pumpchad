import * as THREE from 'three'
import type { Character } from '../character/character'
import type { Input } from '../input'
import { RideControls, releaseAllRideButtons, rideBtn, takeGetOff } from './controls'
import { BikeSim } from './sim'
import { STREET, SURRON, type BikeSpec } from './spec'
import { ModelBikeVisual, type BikeKind, type BikeRig } from './visual'

/**
 * RIDING IN THE WORLD: parked bikes you can climb onto, the ride itself (sim + visual + rider + collisions + crash and recovery), and getting off.
 * The scene hands this class a small `host`; nothing here reaches into the scene's internals, and the bike's look (`BikeRig`) and handling (`BikeSpec`)
 * are both swappable.
 */
export type RideHost = {
  scene: THREE.Scene
  ground(x: number, z: number): number
  /** push a point out of walls, colliders and the map's closed areas (the same rule the walking player obeys) */
  resolve(p: THREE.Vector3, r: number, feetY: number): void
  input: Input
}
export const SPECS: Record<BikeKind, BikeSpec> = { surron: SURRON, street: STREET }

type Parked = { id: string; kind: BikeKind; x: number; z: number; yaw: number; rig: BikeRig; label: string }
type Active = { parked: Parked; sim: BikeSim; rig: BikeRig; spec: BikeSpec; phase: 'mounting' | 'riding' | 'dismounting' | 'crashed'; t: number; from: THREE.Vector3; gp: number; yRear: number; crashSide: number }

const R_BIKE = 0.55
const V3 = THREE.Vector3
const Y_UP = new V3(0, 1, 0)
const qAlign = new THREE.Quaternion().setFromAxisAngle(Y_UP, Math.PI / 2) // the rider faces +z, the bike +x

export class RideSystem {
  readonly parked: Parked[] = []
  active: Active | null = null
  private controls: RideControls
  private hudT = 0
  /** a one-line note for the HUD ("Bike recovered", "Press E to get off") */
  private note = ''
  private noteT = 0
  /** set by the scene each frame while this is active: the camera should follow (heading, speed) */
  readonly cam = { heading: 0, speed: 0, wheelie: 0 }
  private disposables: (THREE.Material | THREE.BufferGeometry)[] = []

  constructor(private host: RideHost) {
    this.controls = new RideControls(host.input)
  }

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

  /* ───────── getting on and off ───────── */

  mount(id: string, player: Character | null, from: THREE.Vector3) {
    if (this.active) return false
    const p = this.parked.find((b) => b.id === id)
    if (!p || !player) return false
    const spec = SPECS[p.kind]
    const sim = new BikeSim(spec)
    sim.reset(p.x, p.z, p.yaw)
    // the bike leaves its parking spot: its rig becomes the live one (the parked entry keeps the id, so it can be parked again on the spot you leave it)
    this.active = { parked: p, sim, rig: p.rig, spec, phase: 'mounting', t: 0, from: from.clone(), gp: 0, yRear: this.host.ground(p.x, p.z), crashSide: 1 }
    this.controls.start()
    releaseAllRideButtons()
    this.setNote('')
    return true
  }

  /** get off: only when nearly stopped; the bike is left where it stands */
  dismount(player: Character | null, out: THREE.Vector3) {
    const a = this.active
    if (!a || a.phase === 'dismounting') return false
    if (Math.abs(a.sim.v) > 2.6 || a.sim.wheelie) {
      this.setNote('Slow down to get off · press E at a standstill')
      return false
    }
    a.phase = 'dismounting'
    a.t = 0
    a.sim.v = 0
    // step off to the bike's left
    const left = new V3(-Math.cos(a.sim.h), 0, Math.sin(a.sim.h)).multiplyScalar(-1)
    out.set(a.sim.x + left.x * 0.95, 0, a.sim.z + left.z * 0.95)
    void player
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
    a.rig.root.rotation.y = sim.h - Math.PI / 2
    this.controls.stop()
    this.active = null
    this.emitHud(true)
  }

  private setNote(t: string) {
    this.note = t
    this.noteT = t ? 2.4 : 0
  }

  /* ───────── the ride ───────── */

  /** advance one frame; `pos` is the scene's player position (kept in step with the bike), returns the heading */
  step(dt: number, pos: THREE.Vector3, takeAction: () => boolean, player: Character | null) {
    const a = this.active
    if (!a) return
    const { sim } = a
    a.t += dt
    this.noteT = Math.max(0, this.noteT - dt)
    if (this.noteT === 0) this.note = ''

    if (a.phase === 'mounting') {
      // the rider swings on over ~0.5 s with the bike still; the bars are straight
      sim.step(dt, { throttle: 0, brake: 1, rear: 0, steer: 0, lean: 0 })
      if (a.t >= 0.5) a.phase = 'riding'
    } else if (a.phase === 'riding') {
      const inp = this.controls.read()
      if (takeAction() || takeGetOff()) {
        const out = new V3()
        this.dismount(player, out)
        a.from.copy(out) // where the rider will stand
      }
      if (a.phase === 'riding') {
        const before = new V3(sim.x, 0, sim.z)
        sim.step(dt, inp)
        // collisions: let the world push the bike out of whatever it ran into, and take the speed out of the hit
        const want = new V3(sim.x, 0, sim.z)
        const after = want.clone()
        this.host.resolve(after, R_BIKE, a.yRear)
        const push = new V3(after.x - want.x, 0, after.z - want.z)
        const pm = push.length()
        if (pm > 0.004) {
          const n = push.clone().divideScalar(pm)
          const vx = Math.sin(sim.h) * sim.v
          const vz = Math.cos(sim.h) * sim.v
          const into = Math.max(0, -(vx * n.x + vz * n.z)) // speed into the surface
          sim.x = after.x
          sim.z = after.z
          if (into > 9.5) {
            sim.hit(0.9)
            sim.crash('collision')
          } else if (into > 0.2) {
            sim.hit(Math.min(0.85, into * 0.09))
            // a glancing blow turns the bike along the wall a little rather than stopping it dead
            const along = Math.atan2(vx - (-n.x * into), vz - (-n.z * into))
            if (Math.abs(sim.v) > 1) {
              let dh = along - sim.h
              dh = Math.atan2(Math.sin(dh), Math.cos(dh))
              sim.h += Math.max(-0.5, Math.min(0.5, dh)) * Math.min(1, dt * 6)
            }
          }
          void before
        }
        if (sim.crashed) {
          a.phase = 'crashed'
          a.t = 0
          a.crashSide = sim.roll >= 0 ? 1 : -1
          this.setNote(sim.crashed === 'loop' ? 'Looped out!' : 'Crashed!')
        }
      }
    } else if (a.phase === 'crashed') {
      sim.step(dt, { throttle: 0, brake: 0, rear: 0, steer: 0, lean: 0 })
      if (a.t > 2.1) {
        // recovery: the bike is stood back up where it fell, and the rider is back on it
        const keepX = sim.x
        const keepZ = sim.z
        const keepH = sim.h
        sim.reset(keepX, keepZ, keepH)
        a.phase = 'mounting'
        a.t = 0
        this.setNote('Bike recovered')
      }
    } else if (a.phase === 'dismounting') {
      sim.step(dt, { throttle: 0, brake: 1, rear: 0, steer: 0, lean: 0 })
      if (a.t >= 0.5) {
        this.finishDismount()
        return
      }
    }
    pos.set(sim.x, 0, sim.z)
    this.cam.heading = sim.h
    this.cam.speed = Math.abs(sim.v)
    this.cam.wheelie = sim.pitch
    this.emitHud(false, dt)
    this.syncRig()
  }

  /** place the bike's visual from the model and the ground under its wheels */
  private syncRig() {
    const a = this.active
    if (!a) return
    const { sim, spec, rig } = a
    const L = spec.wheelbase
    const fx = Math.sin(sim.h)
    const fz = Math.cos(sim.h)
    const rearX = sim.x - fx * L * 0.5
    const rearZ = sim.z - fz * L * 0.5
    const frontX = sim.x + fx * L * 0.5
    const frontZ = sim.z + fz * L * 0.5
    const yR = this.host.ground(rearX, rearZ)
    const yF = this.host.ground(frontX, frontZ)
    const gp = Math.atan2(yF - yR, L)
    a.gp += (gp - a.gp) * 0.35
    a.yRear += (yR - a.yRear) * 0.5
    rig.root.position.set(sim.x, a.yRear, sim.z)
    rig.root.rotation.set(0, sim.h - Math.PI / 2, 0)
    if (a.phase === 'crashed') {
      // the fallen bike: over backwards after a loop-out, onto its side otherwise
      const k = Math.min(1, a.t / 0.45)
      const e = k * k * (3 - 2 * k)
      rig.apply(sim, a.gp)
      if (sim.crashed === 'loop') rig.root.rotation.z = -e * 0.35
      else rig.root.rotation.x = a.crashSide * -1.45 * e // lying on its side
      rig.root.position.y = a.yRear + e * 0.22
      rig.root.updateMatrixWorld(true)
      return
    }
    rig.apply(sim, a.gp)
    rig.root.updateMatrixWorld(true)
  }

  /** pose the rider on the bike (after the character's own update); returns false when the rider is not on it (crashed / off) */
  pose(player: Character | null, standAt: THREE.Vector3 | null) {
    const a = this.active
    if (!a || !player) return
    const { sim, rig } = a
    const root = player.root
    if (a.phase === 'crashed') {
      // thrown off: lies in the dust behind-to-the-side of the bike, then gets back up as the bike is righted
      const k = Math.min(1, a.t / 0.3)
      const get = a.t > 1.6 ? Math.max(0, 1 - (a.t - 1.6) / 0.4) : 1
      const side = new V3(Math.cos(sim.h), 0, -Math.sin(sim.h)).multiplyScalar(a.crashSide * 1.1)
      root.position.set(sim.x + side.x - Math.sin(sim.h) * 0.6, this.host.ground(sim.x, sim.z), sim.z + side.z - Math.cos(sim.h) * 0.6)
      root.rotation.order = 'YXZ'
      root.rotation.set(-1.45 * k * get, sim.h, 0)
      player.pose = 'idle'
      return
    }
    if (a.phase === 'dismounting' && standAt) {
      // step off: slide from the seat to the ground beside the bike
      const u = Math.min(1, a.t / 0.5)
      const e = u * u * (3 - 2 * u)
      const seat = rig.seat.getWorldPosition(new V3())
      root.position.lerpVectors(new V3(seat.x, seat.y - 0.95, seat.z), new V3(standAt.x, this.host.ground(standAt.x, standAt.z), standAt.z), e)
      root.rotation.set(0, sim.h, 0)
      player.pose = 'idle'
      return
    }
    // mounting: the rider comes in from where they stood, onto the seat
    const seatW = rig.seat.getWorldPosition(new V3())
    const seatQ = rig.seat.getWorldQuaternion(new THREE.Quaternion())
    let blend = 1
    if (a.phase === 'mounting') {
      const u = Math.min(1, a.t / 0.5)
      blend = u * u * (3 - 2 * u)
    }
    const rootPos = new V3(seatW.x, seatW.y - 0.95, seatW.z)
    if (blend < 1) rootPos.lerpVectors(new V3(a.from.x, this.host.ground(a.from.x, a.from.z), a.from.z), rootPos, blend)
    root.position.copy(rootPos)
    root.quaternion.copy(seatQ).multiply(qAlign)
    root.updateMatrixWorld(true)
    player.pose = 'idle'
    // torso: forward over the bars; weight back when heaving, forward under braking
    const lean = THREE.MathUtils.clamp(0.42 + sim.accelNow * 0.012 - sim.lean * 0.32 + Math.min(0.2, Math.abs(sim.v) * 0.012), 0.05, 0.85) * blend + (1 - blend) * 0.1
    const pegL = rig.pegL.getWorldPosition(new V3())
    const pegR = rig.pegR.getWorldPosition(new V3())
    player.ride?.(seatW, pegL, pegR, lean)
    const gl = rig.gripL.getWorldPosition(new V3())
    const gr = rig.gripR.getWorldPosition(new V3())
    player.grip?.(gl, gr)
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
          pitch: +a.sim.pitch.toFixed(3),
          balance: +a.sim.balance.toFixed(3),
          maxPitch: a.spec.maxPitch,
          phase: a.phase,
          note: this.note,
          wheelieTime: +a.sim.wheelieTime.toFixed(1),
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
      delta: +s.delta.toFixed(3),
      roll: +s.roll.toFixed(3),
      pitch: +s.pitch.toFixed(3),
      balance: +s.balance.toFixed(3),
      forkC: +s.forkC.toFixed(3),
      shockC: +s.shockC.toFixed(3),
      crashed: s.crashed,
      latAccel: +s.latNow.toFixed(2),
      wheelieTime: +s.wheelieTime.toFixed(2),
      touchdown: +s.touchdown.toFixed(2),
      buttons: { ...rideBtn },
      cam: { ...this.cam },
    }
  }
  /** QA: put the active bike at a place, speed and heading */
  qaSet(o: { x?: number; z?: number; h?: number; v?: number }) {
    const s = this.active?.sim
    if (!s) return
    if (o.x !== undefined) s.x = o.x
    if (o.z !== undefined) s.z = o.z
    if (o.h !== undefined) s.h = o.h
    if (o.v !== undefined) s.v = o.v
  }

  dispose() {
    this.controls.stop()
    for (const p of this.parked) p.rig.dispose()
    this.parked.length = 0
    this.active = null
    void this.disposables
  }
}
