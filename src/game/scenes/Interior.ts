import * as THREE from 'three'
import { createCharacter, disposeCharacter, type Character } from '../character/character'
import type { Appearance } from '../character/types'
import { disposeObject, type Engine, type GameScene } from '../engine/Engine'
import type { Input } from '../input'
import { audio } from '../audio'
import { StaticBatch } from './world/kit'
import { Fire } from './world/fx'
import type { Quality } from '../save'
import type { Interactable } from './World'
import { Emoter, type EmoteId } from '../emotes'
import { INDOOR, Jumper, SPEED_UNIT, leanFor, targetSpeed, turnRate, velocityRate } from '../movement'
import { interiorMats, type Kit } from './interiors/furniture'
import { HOUSE, shell, type HouseSpec } from './interiors/houses'

export type InteriorEvents = {
  onPrompt(p: Interactable | null): void
  onInteract(id: string): void
}

const PLAYER_R = 0.36
type Box = { x0: number; x1: number; z0: number; z1: number; level?: 0 | 1 }
type Spot = { x: number; y: number; z: number; color: string; intensity: number; dist: number; flicker: boolean }

/**
 * A house interior: one of the village homes / shops (see interiors/houses.ts), entered through its front door.
 * Free roam like the gym (same movement feel, indoor gaits), plus floors: a staircase up to a loft, with colliders
 * per floor. The camera always stays inside the room (and under the loft when you're beneath it), so walls never
 * block the view. Lighting is the house's own: a mood ambience plus its fire / lamps / candles, the strongest few
 * as real point lights (quality-capped) that flicker where they're flames.
 */
export class Interior implements GameScene {
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(55, 1, 0.05, 60)
  bloom = 0.5
  player: Character | null = null
  paused = false
  cameraSensitivity = 1
  interactables: Interactable[] = []
  readonly house: HouseSpec
  emoter = new Emoter()
  private boxes: Box[] = []
  private fires: Fire[] = []
  private anims: ((t: number) => void)[] = []
  private flickers: { light: THREE.PointLight; base: number; ph: number }[] = []
  private pos = new THREE.Vector3()
  private vel = new THREE.Vector3()
  private yaw = Math.PI
  private camYaw = 0
  private camPitch = 0.2
  private camPos = new THREE.Vector3()
  private camLook = new THREE.Vector3()
  private level: 0 | 1 = 0
  private t = 0
  private portrait = false
  private prompt: Interactable | null = null
  private jumper = new Jumper()
  private lastSpeed = 0
  private lastLookT = -10
  private disposed = false
  private quality: Quality

  constructor(engine: Engine, houseId: string, private input: Input | null = null, private events: InteriorEvents | null = null) {
    const H = HOUSE(houseId)
    if (!H) throw new Error(`unknown house ${houseId}`)
    this.house = H
    this.quality = engine.quality
    const s = this.scene
    const mood = H.mood ?? 'warm'
    s.background = new THREE.Color(mood === 'cold' ? '#07080c' : '#0b0806')
    s.environment = engine.env
    s.environmentIntensity = mood === 'bright' ? 0.45 : mood === 'cold' ? 0.12 : 0.25
    const hemi = mood === 'bright' ? new THREE.HemisphereLight('#fff2dc', '#5a4a3a', 1.1) : mood === 'cold' ? new THREE.HemisphereLight('#8aa0d0', '#1a1824', 0.42) : new THREE.HemisphereLight('#ffd8b0', '#3a2a20', 0.62)
    s.add(hemi)
    // moonlight through the windows: a faint cool key from the front
    const moon = new THREE.DirectionalLight('#9fb0ff', mood === 'cold' ? 0.35 : 0.22)
    moon.position.set(2, 6, 8)
    s.add(moon)

    const B = new StaticBatch()
    const D: (THREE.Material | THREE.Texture | THREE.BufferGeometry)[] = []
    this.disposables = D
    const M = interiorMats(D)
    const spots: Spot[] = []
    const K: Kit = {
      B,
      M,
      scene: s,
      block: (x0, x1, z0, z1, level) => this.boxes.push({ x0, x1, z0, z1, level }),
      light: (x, y, z, color, intensity, dist, flicker = false) => spots.push({ x, y, z, color, intensity, dist, flicker }),
      fire: (x, y, z, scale) => {
        const f = new Fire(x, y, z, scale)
        this.fires.push(f)
        s.add(f.group)
      },
      inspect: (id, label, x, z, r, y = 0) => this.interactables.push({ id, label, pos: new THREE.Vector3(x, y, z), radius: r, kind: 'info' }),
      anim: (fn) => this.anims.push(fn),
    }
    const S = shell(K, H)
    H.build(K, S)
    B.build(s, false)

    // the brightest spots become real lights (flames flicker); the rest stay as glowing props
    const cap = this.quality === 'high' ? 5 : this.quality === 'medium' ? 3 : 2
    spots
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, cap)
      .forEach((L, i) => {
        const pl = new THREE.PointLight(L.color, L.intensity, L.dist, 1.6)
        pl.position.set(L.x, L.y, L.z)
        s.add(pl)
        if (L.flicker) this.flickers.push({ light: pl, base: L.intensity, ph: i * 2.3 })
      })

    // interactions: the way out + this house's things to look at
    const { d: Dd } = H.room
    this.interactables.push({ id: 'exit', label: `Leave ${H.name}`, pos: new THREE.Vector3(0, 0, Dd / 2 - 0.45), radius: 0.95, kind: 'activity' })
    for (const [id, L] of Object.entries(H.looks ?? {})) {
      const y = L.level ? H.room.loft!.y : 0
      this.interactables.push({ id: `look:${id}`, label: L.label, pos: new THREE.Vector3(L.at[0], y, L.at[1]), radius: L.r ?? 1.0, kind: 'info' })
    }
  }
  private disposables: (THREE.Material | THREE.Texture | THREE.BufferGeometry)[]

  async populate(a: Appearance) {
    const p = await createCharacter(a)
    if (this.disposed) return disposeCharacter(p)
    this.player = p
    p.onStep = () => audio.play('step')
    this.scene.add(p.root)
    this.spawn()
  }

  /** just inside the front door, facing into the room */
  spawn() {
    this.pos.set(0, 0, this.house.room.d / 2 - 2.0)
    this.yaw = Math.PI
    this.camYaw = 0
    this.level = 0
    this.vel.set(0, 0, 0)
    this.placeCamera(1)
  }

  emote(id: EmoteId) {
    if (this.jumper.airborne || this.paused) return null
    return this.emoter.start(this.player, id)
  }

  /** QA */
  teleport(x: number, z: number, yaw?: number, level: 0 | 1 = 0) {
    this.level = level
    this.pos.set(x, this.heightAt(x, z), z)
    this.collide(this.pos)
    this.vel.set(0, 0, 0)
    if (yaw !== undefined) {
      this.yaw = yaw
      this.camYaw = yaw + Math.PI
    }
    this.placeCamera(1)
  }
  info() {
    return { id: this.house.id, name: this.house.name, x: +this.pos.x.toFixed(2), y: +this.pos.y.toFixed(2), z: +this.pos.z.toFixed(2), level: this.level, prompt: this.prompt?.label ?? null, looks: Object.keys(this.house.looks ?? {}) }
  }

  /* ───────── floors ───────── */

  private onStair(x: number, z: number) {
    const L = this.house.room.loft
    if (!L) return -1
    const { x0, x1, zb } = L.stair
    if (x < x0 || x > x1 || z < L.zl - 0.05 || z > zb) return -1
    return THREE.MathUtils.clamp((zb - z) / (zb - L.zl), 0, 1)
  }
  private heightAt(x: number, z: number) {
    const L = this.house.room.loft
    if (!L) return 0
    const s = this.onStair(x, z)
    if (s >= 0) return s * L.y
    if (this.level === 1 && z <= L.zl + 0.05) return L.y
    return 0
  }

  private collide(p: THREE.Vector3) {
    const stair = this.onStair(p.x, p.z) >= 0
    for (const b of this.boxes) {
      // per-floor colliders: ground-floor pieces don't block the loft and vice versa (the stair is in between)
      if (b.level !== undefined && (stair || b.level !== this.level)) continue
      const cx = THREE.MathUtils.clamp(p.x, b.x0, b.x1)
      const cz = THREE.MathUtils.clamp(p.z, b.z0, b.z1)
      const dx = p.x - cx
      const dz = p.z - cz
      const d = Math.hypot(dx, dz)
      if (d < PLAYER_R) {
        if (d > 1e-5) {
          p.x = cx + (dx / d) * PLAYER_R
          p.z = cz + (dz / d) * PLAYER_R
        } else p.z = b.z1 + PLAYER_R
      }
    }
    // on the loft you stay on the loft (the railing + the stair top are the only edges)
    const L = this.house.room.loft
    if (L && this.level === 1 && this.onStair(p.x, p.z) < 0) p.z = Math.min(p.z, L.zl - 0.02)
  }

  /* ───────── camera ───────── */

  resize(w: number, h: number) {
    this.portrait = h > w
    this.camera.fov = this.portrait ? 70 : 62
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private clampCam(v: THREE.Vector3) {
    const { w: W, d: D, h: Ht, loft } = this.house.room
    v.x = THREE.MathUtils.clamp(v.x, -W / 2 + 0.25, W / 2 - 0.25)
    v.z = THREE.MathUtils.clamp(v.z, -D / 2 + 0.25, D / 2 - 0.25)
    v.y = THREE.MathUtils.clamp(v.y, 0.45, Ht - 0.3)
    if (loft) {
      const under = this.level === 0 && this.pos.z < loft.zl + 0.6 && this.onStair(this.pos.x, this.pos.z) < 0.4
      if (this.level === 1 || this.onStair(this.pos.x, this.pos.z) >= 0.4) v.y = Math.max(v.y, loft.y + 0.6)
      else if (under || v.z < loft.zl + 0.2) v.y = Math.min(v.y, loft.y - 0.45)
    }
    return v
  }

  private placeCamera(k: number) {
    const dist = this.portrait ? 4.0 : 3.5
    const want = new THREE.Vector3(Math.sin(this.camYaw) * Math.cos(this.camPitch) * dist, 1.25 + Math.sin(this.camPitch) * dist, Math.cos(this.camYaw) * Math.cos(this.camPitch) * dist).add(this.pos)
    // squeezed by a wall: trade the lost distance for height, so you look over your shoulder, not into your head
    const wantH = Math.hypot(want.x - this.pos.x, want.z - this.pos.z)
    this.clampCam(want)
    const gotH = Math.hypot(want.x - this.pos.x, want.z - this.pos.z)
    if (gotH < wantH - 0.05) {
      want.y += (wantH - gotH) * 0.3
      this.clampCam(want)
    }
    this.camPos.lerp(want, k)
    // aim a little ahead of the player so the room in front fills the frame, not the floor at your feet
    const ahead = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw)).multiplyScalar(1.1)
    this.camLook.lerp(new THREE.Vector3(this.pos.x + ahead.x, this.pos.y + 1.35, this.pos.z + ahead.z), k)
    this.camera.position.copy(this.camPos)
    this.camera.lookAt(this.camLook)
  }

  /* ───────── update ───────── */

  update(dt: number) {
    this.t += dt
    const look = this.input?.takeLook() ?? { x: 0, y: 0 }
    this.camYaw -= look.x * 0.006 * this.cameraSensitivity
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + look.y * 0.004 * this.cameraSensitivity, 0.05, 0.9)
    if (look.x || look.y) this.lastLookT = this.t
    const mv = this.paused || !this.input ? { x: 0, z: 0, run: false, analog: false } : this.input.move()
    const fwd = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw))
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x)
    const wish = fwd.multiplyScalar(mv.z).add(right.multiplyScalar(mv.x))
    const mag = Math.min(1, wish.length())
    const targetVel = mag > 0.01 ? wish.normalize().multiplyScalar(targetSpeed(mag, mv.run, mv.analog, INDOOR) * 0.9) : new THREE.Vector3()
    const p = this.player
    if (this.input?.takeJump() && !this.paused && this.jumper.tryJump(p)) this.emoter.cancel(p)
    if (mag > 0.05 && this.emoter.busy) this.emoter.cancel(p)
    this.jumper.update(dt, p)
    this.emoter.update(dt)
    this.vel.lerp(targetVel, 1 - Math.exp(-dt * velocityRate(mag > 0.01, Math.hypot(this.vel.x, this.vel.z), this.jumper.airborne)))
    const px = this.pos.x
    const pz = this.pos.z
    this.pos.x += this.vel.x * dt
    this.pos.z += this.vel.z * dt
    this.collide(this.pos)
    // floors: on the stair you climb; reaching the top puts you on the loft, the bottom back on the ground floor
    const L = this.house.room.loft
    const st = this.onStair(this.pos.x, this.pos.z)
    if (L && st >= 0) this.level = st > 0.5 ? 1 : 0
    const gy = this.heightAt(this.pos.x, this.pos.z)
    this.pos.y += (gy - this.pos.y) * (1 - Math.exp(-dt * 20))
    if (dt > 0) {
      const ax = (this.pos.x - px) / dt
      const az = (this.pos.z - pz) / dt
      if (Math.hypot(ax, az) < Math.hypot(this.vel.x, this.vel.z) - 0.05) this.vel.set(ax, this.vel.y, az)
    }
    const speed = Math.hypot(this.vel.x, this.vel.z)
    const yaw0 = this.yaw
    if (speed > 0.15) {
      let d = Math.atan2(this.vel.x, this.vel.z) - this.yaw
      d = Math.atan2(Math.sin(d), Math.cos(d))
      this.yaw += d * (1 - Math.exp(-dt * turnRate(speed)))
      if (!look.x && mv.z > 0.2 && Math.abs(mv.x) < 0.25 && this.t - this.lastLookT > 1.2 && !this.input?.mouseLooked) {
        let cd = this.yaw + Math.PI - this.camYaw
        cd = Math.atan2(Math.sin(cd), Math.cos(cd))
        this.camYaw += cd * (1 - Math.exp(-dt * 0.9))
      }
    }
    if (p) {
      p.speed = speed / SPEED_UNIT
      p.pose = this.emoter.pose() ?? (speed > 0.1 ? 'walk' : 'idle')
      if (p.lean) {
        let dy = this.yaw - yaw0
        dy = Math.atan2(Math.sin(dy), Math.cos(dy))
        const l = leanFor(dy / Math.max(dt, 1e-3), (speed - this.lastSpeed) / Math.max(dt, 1e-3), speed)
        p.lean.turn = l.turn
        p.lean.accel = l.accel
      }
      p.root.position.copy(this.pos)
      p.root.position.y += this.jumper.y
      p.root.rotation.y = this.yaw
      p.update(dt)
    }
    this.lastSpeed = speed

    // prompts (only for things on the floor you're on)
    let best: Interactable | null = null
    let bestD = Infinity
    if (!this.paused)
      for (const it of this.interactables) {
        if (Math.abs(it.pos.y - this.pos.y) > 1.2) continue
        const d = Math.hypot(it.pos.x - this.pos.x, it.pos.z - this.pos.z)
        if (d < it.radius + PLAYER_R && d < bestD) {
          best = it
          bestD = d
        }
      }
    if (best !== this.prompt) {
      this.prompt = best
      this.events?.onPrompt(best)
    }
    if (this.input?.takeAction() && this.prompt && !this.paused) {
      audio.play('interact')
      this.events?.onInteract(this.prompt.id)
    }

    this.placeCamera(1 - Math.exp(-dt * 8))
    for (const f of this.fires) f.update(this.t)
    for (const fl of this.flickers) fl.light.intensity = fl.base * (0.86 + Math.sin(this.t * 9 + fl.ph) * 0.07 + Math.sin(this.t * 23 + fl.ph * 3) * 0.05)
    for (const a of this.anims) a(this.t)
  }

  dispose() {
    this.disposed = true
    this.events?.onPrompt(null)
    if (this.player) disposeCharacter(this.player)
    disposeObject(this.scene)
    this.disposables.forEach((d) => d.dispose())
  }
}
