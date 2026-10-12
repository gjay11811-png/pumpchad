import * as THREE from 'three'
import { createCharacter, disposeCharacter, type Character } from '../character/character'
import type { Appearance } from '../character/types'
import { disposeObject, type Engine, type GameScene } from '../engine/Engine'
import type { Input } from '../input'
import { audio } from '../audio'
import { STATIONS, type RepGrade, type StationId } from '../workout'
import { signTexture } from './textures'
import type { Interactable } from './World'

export type GymEvents = {
  onPrompt(p: Interactable | null): void
  onInteract(id: string): void
}
export type GymMode = 'free' | 'press' | StationId

const WALK = 3.0
const RUN = 5.0
const PLAYER_R = 0.38
/** walkable interior (the walls sit just outside) */
const ROOM = { x0: -8.4, x1: 8.4, z0: -5.4, z1: 7.0 }
const PRESS = new THREE.Vector3(0, 0, -2.2)

type Spot = { stand: [number, number]; yaw: number; use: [number, number]; useRadius: number; label: string; cam: [number, number, number]; look: [number, number, number] }
/** where the player stands to use each station, where the prompt triggers, and the framed exercise camera (station-local) */
const SPOTS: Record<'press' | StationId, Spot> = {
  press: { stand: [PRESS.x, PRESS.z], yaw: 0, use: [0, -0.3], useRadius: 1.5, label: 'Chad Press — timing challenge', cam: [0, 0, 0], look: [0, 0, 0] },
  bench: { stand: [-5.2, -2.6], yaw: 0, use: [-3.9, -2.6], useRadius: 1.25, label: 'Bench press', cam: [0.75, 2.15, 2.5], look: [0, 0.8, -0.5] },
  curl: { stand: [5.2, -3.0], yaw: 0, use: [5.2, -1.7], useRadius: 1.25, label: 'Dumbbell curls', cam: [1.5, 1.5, 3.0], look: [0, 1.1, 0] },
  squat: { stand: [-5.2, 3.0], yaw: 0, use: [-5.2, 4.4], useRadius: 1.25, label: 'Squat rack', cam: [1.15, 1.4, 3.3], look: [0, 1.0, 0] },
  bag: { stand: [5.2, 4.15], yaw: Math.PI, use: [5.2, 5.2], useRadius: 1.25, label: 'Heavy bag', cam: [-2.6, 1.5, 0.35], look: [0, 1.2, 0.45] },
}
const BAG = new THREE.Vector3(5.2, 0, 3.35)

type Box = { x0: number; x1: number; z0: number; z1: number }

/** Chad Gym interior: a walkable hall with working stations, plus the Chad Press platform. */
export class Gym implements GameScene {
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80)
  bloom = 0.55
  player: Character | null = null
  mode: GymMode = 'free'
  paused = false
  cameraSensitivity = 1
  interactables: Interactable[] = []
  private coach: Character | null = null
  private bar = new THREE.Group() // Chad Press barbell
  private benchBar = new THREE.Group()
  private squatBar = new THREE.Group()
  private bells: THREE.Group[] = []
  private rackBells: THREE.Object3D[] = []
  private bag = new THREE.Group()
  private bagAngle = 0
  private bagVel = 0
  private ring: THREE.Mesh
  private ringMat: THREE.MeshBasicMaterial
  private target = 0
  private shake = 0
  private camKick = 0
  private flash = 0
  private flashColor = new THREE.Color('#ff7a1a')
  private strip: THREE.MeshBasicMaterial
  private t = 0
  private disposed = false
  private portrait = false
  private w = 1
  private h = 1
  private prompt: Interactable | null = null
  private boxes: Box[] = []
  private pos = new THREE.Vector3(0, 0, 4.7)
  private vel = new THREE.Vector3()
  private yaw = Math.PI
  private camYaw = 0
  private camPitch = 0.42
  private camPos = new THREE.Vector3()
  private camLook = new THREE.Vector3()
  private repT = -1
  private repDur = 0.8
  private punch = 0
  private pendingHit = -1

  constructor(engine: Engine, private input: Input | null = null, private events: GymEvents | null = null) {
    const s = this.scene
    s.background = new THREE.Color('#09070b')
    s.fog = new THREE.Fog('#09070b', 14, 30)
    s.environment = engine.env
    s.environmentIntensity = 0.25

    const floorMat = new THREE.MeshStandardMaterial({ color: '#141116', roughness: 0.92 })
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 15), floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.position.z = 0.9
    floor.receiveShadow = true
    s.add(floor)
    const platform = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 3.6), new THREE.MeshStandardMaterial({ color: '#3b2a1c', roughness: 0.55 }))
    platform.position.set(PRESS.x, 0.06, PRESS.z)
    platform.receiveShadow = true
    s.add(platform)
    const wallMat = new THREE.MeshStandardMaterial({ color: '#16121a', roughness: 0.75, metalness: 0.2 })
    const back = new THREE.Mesh(new THREE.PlaneGeometry(18, 8), wallMat)
    back.position.set(0, 4, -6)
    back.receiveShadow = true
    s.add(back)
    for (const x of [-9, 9]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(15, 8), wallMat)
      side.position.set(x, 4, 1.5)
      side.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2
      side.receiveShadow = true
      s.add(side)
    }
    // front wall with the doorway back to the square
    for (const [x, w] of [[-5.25, 7.5], [5.25, 7.5]] as const) {
      const seg = new THREE.Mesh(new THREE.PlaneGeometry(w, 8), wallMat)
      seg.position.set(x, 4, 7.6)
      seg.rotation.y = Math.PI
      s.add(seg)
    }
    const lintel = new THREE.Mesh(new THREE.PlaneGeometry(3, 5), wallMat)
    lintel.position.set(0, 5.5, 7.6)
    lintel.rotation.y = Math.PI
    s.add(lintel)
    const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.9), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb36b').multiplyScalar(1.6), toneMapped: false }))
    doorGlow.position.set(0, 1.45, 7.7)
    doorGlow.rotation.y = Math.PI
    s.add(doorGlow)
    const exitSign = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.42), new THREE.MeshBasicMaterial({ map: signTexture('EXIT', { sub: 'CHAD SQUARE' }), toneMapped: false, color: new THREE.Color(2.2, 2.2, 2.2) }))
    exitSign.position.set(0, 3.25, 7.55)
    exitSign.rotation.y = Math.PI
    s.add(exitSign)

    // neon strips + sign
    this.strip = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7a1a').multiplyScalar(3.6), toneMapped: false })
    for (const y of [0.4, 5.6]) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(18, 0.05, 0.05), this.strip)
      st.position.set(0, y, -5.95)
      s.add(st)
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), new THREE.MeshBasicMaterial({ map: signTexture('CHAD GYM', { sub: 'NO PAIN · NO PUMP' }), toneMapped: false, color: new THREE.Color(2.7, 2.7, 2.7) }))
    sign.position.set(0, 4.9, -5.93)
    s.add(sign)

    const iron = new THREE.MeshStandardMaterial({ color: '#2a262c', metalness: 0.9, roughness: 0.35 })
    const rubber = new THREE.MeshStandardMaterial({ color: '#1a1a1c', roughness: 0.8 })
    const chrome = new THREE.MeshStandardMaterial({ color: '#d8d4cc', metalness: 1, roughness: 0.25 })
    const orange = new THREE.MeshStandardMaterial({ color: '#ff7a1a', roughness: 0.5 })
    const pad = new THREE.MeshStandardMaterial({ color: '#211a1f', roughness: 0.62 })
    const mat = new THREE.MeshStandardMaterial({ color: '#1d191e', roughness: 0.95 })
    const cast = <T extends THREE.Object3D>(o: T) => {
      o.traverse((c) => (c.castShadow = true))
      return o
    }
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
      const o = new THREE.Mesh(g, m)
      o.position.set(x, y, z)
      return o
    }

    // plate stacks behind the platform (props)
    for (const x of [-2.6, 2.6]) {
      for (let i = 0; i < 4; i++) {
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.42 - i * 0.05, 0.42 - i * 0.05, 0.08, 24), rubber)
        plate.rotation.x = Math.PI / 2
        plate.position.set(x, 0.42 - i * 0.05, -4.9 + i * 0.1)
        s.add(cast(plate))
      }
    }
    // rubber mats under each station
    for (const k of ['bench', 'curl', 'squat', 'bag'] as const) {
      const [x, z] = SPOTS[k].stand
      const m = mesh(new THREE.BoxGeometry(2.6, 0.02, 3), mat, x, 0.01, z)
      m.receiveShadow = true
      s.add(m)
    }

    // barbell builder (shared look for press / bench / squat)
    const barbell = (g: THREE.Group, len = 2.1) => {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 10), chrome)
      shaft.rotation.z = Math.PI / 2
      g.add(shaft)
      for (const sx of [-0.85, -0.75, 0.75, 0.85]) {
        const big = Math.abs(sx) > 0.8
        const pl = new THREE.Mesh(new THREE.CylinderGeometry(big ? 0.3 : 0.24, big ? 0.3 : 0.24, 0.07, 24), big ? orange : rubber)
        pl.rotation.z = Math.PI / 2
        pl.position.x = sx * (len / 2.1)
        g.add(pl)
      }
      return cast(g)
    }
    barbell(this.bar)
    s.add(this.bar)

    // ── bench press: pad + legs + uprights with J-hooks; bar racked above the head end ──
    {
      const [x, z] = SPOTS.bench.stand
      const g = new THREE.Group()
      g.add(mesh(new THREE.BoxGeometry(0.34, 0.1, 1.3), pad, 0, 0.47, 0.05))
      for (const dz of [-0.5, 0.55]) g.add(mesh(new THREE.BoxGeometry(0.08, 0.42, 0.08), iron, 0, 0.21, dz))
      g.add(mesh(new THREE.BoxGeometry(0.5, 0.05, 0.08), iron, 0, 0.03, -0.5), mesh(new THREE.BoxGeometry(0.5, 0.05, 0.08), iron, 0, 0.03, 0.55))
      for (const sx of [-0.55, 0.55]) {
        g.add(mesh(new THREE.BoxGeometry(0.07, 1.25, 0.07), iron, sx, 0.62, -0.72))
        g.add(mesh(new THREE.BoxGeometry(0.07, 0.07, 0.12), iron, sx, 1.05, -0.66))
      }
      g.position.set(x, 0, z)
      s.add(cast(g))
      barbell(this.benchBar, 1.8)
      this.benchBar.position.set(x, 1.1, z - 0.66)
      s.add(this.benchBar)
      this.boxes.push({ x0: x - 0.62, x1: x + 0.62, z0: z - 0.8, z1: z + 0.65 })
    }
    // ── dumbbell rack (three pairs) behind the curl spot ──
    {
      const [x, z] = SPOTS.curl.stand
      const g = new THREE.Group()
      g.add(mesh(new THREE.BoxGeometry(1.7, 0.06, 0.42), iron, 0, 0.62, 0))
      g.add(mesh(new THREE.BoxGeometry(1.7, 0.06, 0.42), iron, 0, 0.32, 0.04))
      for (const sx of [-0.8, 0.8]) g.add(mesh(new THREE.BoxGeometry(0.06, 0.66, 0.42), iron, sx, 0.33, 0))
      g.position.set(x, 0, z - 1.25)
      s.add(cast(g))
      const bell = (size: number) => {
        const b = new THREE.Group()
        const h = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.2, 8), chrome)
        h.rotation.z = Math.PI / 2
        b.add(h)
        for (const sx of [-0.12, 0.12]) {
          const p = new THREE.Mesh(new THREE.CylinderGeometry(size, size, 0.07, 14), rubber)
          p.rotation.z = Math.PI / 2
          p.position.x = sx
          b.add(p)
        }
        return cast(b)
      }
      ;[0.05, 0.06, 0.07].forEach((sz, i) => {
        for (const side of [-1, 1]) {
          const b = bell(sz)
          b.position.set(x + (i - 1) * 0.55 + side * 0.13, 0.7, z - 1.25)
          b.rotation.y = Math.PI / 2
          s.add(b)
          if (i === 1) this.rackBells.push(b)
        }
      })
      for (let i = 0; i < 2; i++) {
        const b = bell(0.06)
        b.visible = false
        s.add(b)
        this.bells.push(b)
      }
      this.boxes.push({ x0: x - 0.9, x1: x + 0.9, z0: z - 1.5, z1: z - 1.0 })
    }
    // ── squat rack: four posts, safeties, bar racked at shoulder height ──
    {
      const [x, z] = SPOTS.squat.stand
      const g = new THREE.Group()
      for (const sx of [-0.7, 0.7]) for (const dz of [-0.55, 0.55]) g.add(mesh(new THREE.BoxGeometry(0.08, 2.3, 0.08), iron, sx, 1.15, dz))
      for (const sx of [-0.7, 0.7]) {
        g.add(mesh(new THREE.BoxGeometry(0.08, 0.08, 1.18), iron, sx, 2.3, 0))
        g.add(mesh(new THREE.BoxGeometry(0.06, 0.05, 1.1), iron, sx, 0.62, 0)) // safeties
        g.add(mesh(new THREE.BoxGeometry(0.1, 0.06, 0.14), orange, sx, 1.42, 0.5)) // J-hooks
      }
      g.add(mesh(new THREE.BoxGeometry(1.48, 0.08, 0.08), iron, 0, 2.3, -0.55))
      g.position.set(x, 0, z)
      s.add(cast(g))
      barbell(this.squatBar, 1.9)
      this.squatBar.position.set(x, 1.48, z + 0.5)
      s.add(this.squatBar)
      for (const sx of [-0.7, 0.7]) for (const dz of [-0.55, 0.55]) this.boxes.push({ x0: x + sx - 0.1, x1: x + sx + 0.1, z0: z + dz - 0.1, z1: z + dz + 0.1 })
    }
    // ── heavy bag on a chain from a ceiling beam ──
    {
      const beam = mesh(new THREE.BoxGeometry(0.14, 0.14, 2.4), iron, BAG.x, 4.2, BAG.z)
      s.add(beam)
      const leather = new THREE.MeshStandardMaterial({ color: '#7a1f12', roughness: 0.55, metalness: 0.05 })
      // bag body spans ~0.8–1.95 m off the floor (head-to-hip height for punching)
      const chain = mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.2, 6), chrome, 0, -1.1, 0)
      const body = mesh(new THREE.CylinderGeometry(0.27, 0.25, 1.15, 24), leather, 0, -2.8, 0)
      const capTop = mesh(new THREE.CylinderGeometry(0.2, 0.27, 0.08, 24), rubber, 0, -2.2, 0)
      const capBot = mesh(new THREE.SphereGeometry(0.25, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), leather, 0, -3.37, 0)
      const band = mesh(new THREE.CylinderGeometry(0.275, 0.275, 0.12, 24), orange, 0, -2.55, 0)
      this.bag.add(chain, body, capTop, capBot, band)
      this.bag.position.set(BAG.x, 4.15, BAG.z)
      s.add(cast(this.bag))
      this.boxes.push({ x0: BAG.x - 0.32, x1: BAG.x + 0.32, z0: BAG.z - 0.32, z1: BAG.z + 0.32 })
    }

    // rep feedback ring under the active lifter
    this.ringMat = new THREE.MeshBasicMaterial({ color: '#ff7a1a', transparent: true, opacity: 0, toneMapped: false, depthWrite: false })
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.66, 40), this.ringMat)
    this.ring.rotation.x = -Math.PI / 2
    this.ring.position.y = 0.03
    s.add(this.ring)

    // lighting: overhead key + orange rim + fill over the stations
    s.add(new THREE.HemisphereLight('#4a3a52', '#120a06', 0.6))
    const key = new THREE.SpotLight('#fff0dc', 70, 22, 0.95, 0.55, 1.3)
    key.position.set(0, 8, 1.5)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.target.position.set(0, 0, 0)
    s.add(key, key.target)
    const rim = new THREE.PointLight('#ff7a1a', 18, 10, 1.6)
    rim.position.set(-2.5, 2.5, -4.5)
    s.add(rim)
    for (const [x, z] of [[-5.2, 0.2], [5.2, 0.6]]) {
      const fill = new THREE.PointLight('#ffe2c0', 10, 9, 1.4)
      fill.position.set(x, 3.6, z)
      s.add(fill)
    }

    // stations + exit
    for (const id of ['press', 'bench', 'curl', 'squat', 'bag'] as const) {
      const sp = SPOTS[id]
      this.interactables.push({ id, label: sp.label, pos: new THREE.Vector3(sp.use[0], 0, sp.use[1]), radius: sp.useRadius, kind: 'activity' })
    }
    this.interactables.push({ id: 'exit', label: 'Back to Chad Square', pos: new THREE.Vector3(0, 0, 6.9), radius: 1.3, kind: 'activity' })
  }

  async populate(a: Appearance) {
    const [p, coach] = await Promise.all([
      createCharacter(a),
      createCharacter({ species: 'skeleton', skin: '#e9e2d0', outfit: '#141216', glow: '#19f19a', top: 'armor', headwear: 'none', eyewear: 'none', chain: true }),
    ])
    if (this.disposed) return [p, coach].forEach(disposeCharacter)
    this.player = p
    p.onStep = () => audio.play('step')
    this.scene.add(p.root)
    this.coach = coach
    coach.root.position.set(2.7, 0, -1.0)
    coach.root.rotation.y = -0.9
    this.scene.add(coach.root)
    this.spawn()
  }

  /** walk in through the door, facing the hall */
  spawn() {
    this.pos.set(0, 0, 4.7)
    this.yaw = Math.PI
    this.camYaw = 0
    this.vel.set(0, 0, 0)
    this.mode = 'free'
    this.placeFreeCamera(1)
  }

  /* ───────── stations ───────── */

  startStation(id: 'press' | StationId) {
    const p = this.player
    if (!p) return
    this.mode = id
    const sp = SPOTS[id]
    this.pos.set(sp.stand[0], id === 'press' ? 0.12 : 0, sp.stand[1])
    this.yaw = sp.yaw
    this.vel.set(0, 0, 0)
    this.repT = -1
    this.target = 0
    p.cancelOneShot?.()
    if (id === 'press') {
      p.pose = 'press'
      this.resize(this.w, this.h)
      return
    }
    const spec = STATIONS[id]
    p.pose = spec.pose
    p.pressAmount = spec.rest
    if (id === 'curl') this.rackBells.forEach((b) => (b.visible = false))
    audio.play('clank')
    this.resize(this.w, this.h)
  }

  stopStation() {
    if (this.mode === 'free') return
    const id = this.mode
    const p = this.player
    if (p) {
      p.cancelOneShot?.() // e.g. stepping away mid-celebration
      p.pose = 'idle'
      p.pressAmount = 0
    }
    const sp = SPOTS[id]
    this.pos.set(sp.use[0], 0, sp.use[1])
    this.yaw = Math.atan2(sp.stand[0] - sp.use[0], sp.stand[1] - sp.use[1])
    this.camYaw = this.yaw + Math.PI
    this.mode = 'free'
    this.repT = -1
    if (id === 'curl') this.rackBells.forEach((b) => (b.visible = true))
    if (id !== 'press') audio.play('clank')
    this.resize(this.w, this.h)
    this.placeFreeCamera(1)
  }

  /** one rep at the active station (timing grade from the UI) */
  rep(grade: RepGrade) {
    const p = this.player
    if (!p || this.mode === 'free' || this.mode === 'press') return
    const spec = STATIONS[this.mode]
    this.flash = 1
    this.flashColor.set(grade === 'clean' ? '#f6c870' : '#ff4d3d')
    if (this.mode === 'bag') {
      // jab-jab-cross: both library punches stay upright (the UAL2 melee hook lunges to the floor, wrong for a bag)
      const moves = ['jab', 'jab', 'cross'] as const
      const mv = moves[this.punch++ % 3]
      p.playOnce?.(mv)
      this.pendingHit = this.t + 0.26
      this.bagHit = grade === 'clean' ? 1 : 0.55
      return
    }
    this.repDur = Math.min(spec.beat * 0.85, 1.05)
    this.repT = 0
    if (grade === 'clean') this.camKick = 1
  }
  private bagHit = 1

  /** a new set starts: cut any celebration still playing so the first rep reads cleanly */
  beginSet() {
    this.player?.cancelOneShot?.()
    this.repT = -1
  }

  /** set finished: a short celebration */
  setDone() {
    const p = this.player
    if (!p) return
    p.playOnce?.('yes')
    if (this.coach) this.coach.pose = 'wave'
    setTimeout(() => {
      if (this.coach && !this.disposed) this.coach.pose = 'idle'
    }, 1800)
  }

  /* ── Chad Press hooks (unchanged API used by the ChadPress UI) ── */
  /** 0..1 target bar height; animated toward smoothly. */
  setPress(v: number) {
    this.target = v
  }
  missShake() {
    this.shake = 0.5
  }
  perfectFlash() {
    this.flash = 1
    this.flashColor.set('#ff7a1a')
  }
  celebrate() {
    if (this.player) this.player.pose = 'flex'
    if (this.coach) this.coach.pose = 'wave'
  }
  reset() {
    if (this.player) this.player.pose = 'press'
    if (this.coach) this.coach.pose = 'idle'
    this.target = 0
  }

  /** QA: put the player at a station's prompt */
  goto(id: string) {
    const it = this.interactables.find((i) => i.id === id)
    if (!it) return
    this.pos.set(it.pos.x, 0, it.pos.z)
    this.vel.set(0, 0, 0)
    this.placeFreeCamera(1)
  }

  /* ───────── camera ───────── */

  resize(w: number, h: number) {
    this.w = w
    this.h = h
    this.portrait = h > w
    if (this.mode === 'press') {
      if (this.portrait) {
        this.camera.fov = 50
        this.camera.position.set(PRESS.x + 1.4, 1.9, PRESS.z + 6.4)
        this.camera.setViewOffset(w, h, 0, h * 0.18, w, h) // character in the top half; mini-game UI sits below
      } else {
        this.camera.clearViewOffset()
        this.camera.fov = 40
        this.camera.position.set(PRESS.x + 2.2, 1.7, PRESS.z + 6)
      }
      this.camera.lookAt(PRESS.x, 1.45, PRESS.z)
    } else if (this.mode === 'free') {
      this.camera.clearViewOffset()
      this.camera.fov = this.portrait ? 64 : 52
    } else {
      this.camera.fov = this.portrait ? 58 : 46
      if (this.portrait) this.camera.setViewOffset(w, h, 0, h * 0.16, w, h)
      else this.camera.clearViewOffset()
    }
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private clampCam(v: THREE.Vector3) {
    v.x = THREE.MathUtils.clamp(v.x, -8.6, 8.6)
    v.z = THREE.MathUtils.clamp(v.z, -5.7, 7.35)
    v.y = THREE.MathUtils.clamp(v.y, 0.4, 6.5)
    return v
  }

  private placeFreeCamera(k: number) {
    const dist = this.portrait ? 4.9 : 4.4
    const want = new THREE.Vector3(Math.sin(this.camYaw) * Math.cos(this.camPitch) * dist, 1.2 + Math.sin(this.camPitch) * dist, Math.cos(this.camYaw) * Math.cos(this.camPitch) * dist).add(this.pos)
    this.clampCam(want)
    this.camPos.lerp(want, k)
    this.camLook.lerp(new THREE.Vector3(this.pos.x, this.pos.y + 1.25, this.pos.z), k)
    this.camera.position.copy(this.camPos)
    this.camera.lookAt(this.camLook)
  }

  private placeStationCamera(k: number) {
    if (this.mode === 'free' || this.mode === 'press') return
    const sp = SPOTS[this.mode]
    const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sp.yaw)
    const base = new THREE.Vector3(sp.stand[0], 0, sp.stand[1])
    const far = this.portrait ? 1.22 : 1
    const off = new THREE.Vector3(sp.cam[0] * far, sp.cam[1], sp.cam[2] * far).applyQuaternion(rot)
    const want = this.clampCam(base.clone().add(off))
    const look = base.clone().add(new THREE.Vector3(...sp.look).applyQuaternion(rot))
    this.camPos.lerp(want, k)
    this.camLook.lerp(look, k)
    const kick = this.camKick * 0.035
    this.camera.position.copy(this.camPos).add(new THREE.Vector3(0, -kick, 0))
    this.camera.lookAt(this.camLook)
  }

  /* ───────── movement ───────── */

  private collide(p: THREE.Vector3) {
    p.x = THREE.MathUtils.clamp(p.x, ROOM.x0, ROOM.x1)
    p.z = THREE.MathUtils.clamp(p.z, ROOM.z0, ROOM.z1)
    for (const b of this.boxes) {
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
  }

  private updateFree(dt: number) {
    const look = this.input?.takeLook() ?? { x: 0, y: 0 }
    this.camYaw -= look.x * 0.006 * this.cameraSensitivity
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + look.y * 0.004 * this.cameraSensitivity, 0.12, 0.95)
    const mv = this.paused || !this.input ? { x: 0, z: 0, run: false } : this.input.move()
    const fwd = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw))
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x)
    const wish = fwd.multiplyScalar(mv.z).add(right.multiplyScalar(mv.x))
    const mag = Math.min(1, wish.length())
    const targetVel = mag > 0.01 ? wish.normalize().multiplyScalar((mv.run ? RUN : WALK) * mag) : new THREE.Vector3()
    this.vel.lerp(targetVel, 1 - Math.exp(-dt * (mag > 0.01 ? 10 : 14)))
    this.pos.addScaledVector(this.vel, dt)
    this.collide(this.pos)
    const onPlatform = Math.abs(this.pos.x - PRESS.x) < 1.8 && Math.abs(this.pos.z - PRESS.z) < 1.8
    this.pos.y += ((onPlatform ? 0.12 : 0) - this.pos.y) * (1 - Math.exp(-dt * 18))
    const speed = Math.hypot(this.vel.x, this.vel.z)
    if (speed > 0.15) {
      let d = Math.atan2(this.vel.x, this.vel.z) - this.yaw
      d = Math.atan2(Math.sin(d), Math.cos(d))
      this.yaw += d * (1 - Math.exp(-dt * 12))
      if (!look.x && mv.z > 0.2) {
        let cd = this.yaw + Math.PI - this.camYaw
        cd = Math.atan2(Math.sin(cd), Math.cos(cd))
        this.camYaw += cd * (1 - Math.exp(-dt * 0.9))
      }
    }
    const p = this.player
    if (p) {
      p.speed = speed / 3.4
      if (p.pose !== 'flex') p.pose = speed > 0.1 ? 'walk' : 'idle'
    }

    // interaction prompt
    let best: Interactable | null = null
    let bestD = Infinity
    if (!this.paused)
      for (const it of this.interactables) {
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
  }

  update(dt: number) {
    this.t += dt
    const p = this.player
    if (this.mode === 'free') this.updateFree(dt)
    else {
      this.input?.takeAction() // the station UI owns E / space / tap; don't let a queued press leak out later
      this.input?.takeLook()
      if (this.prompt) {
        this.prompt = null
        this.events?.onPrompt(null)
      }
      if (p) p.speed = 0
    }

    if (p) {
      p.root.position.copy(this.pos)
      p.root.rotation.y = this.yaw
      if (this.mode === 'press') p.pressAmount += (this.target - p.pressAmount) * (1 - Math.exp(-dt * 12))
      else if (this.mode !== 'free' && this.mode !== 'bag') {
        const spec = STATIONS[this.mode]
        let amt = spec.rest
        if (this.repT >= 0) {
          this.repT += dt
          const u = Math.min(1, this.repT / this.repDur)
          amt = spec.rest + (1 - 2 * spec.rest) * Math.sin(Math.PI * u) // rest → far end → rest
          if (u >= 1) {
            this.repT = -1
            if (this.mode !== 'curl') audio.play('clank')
          }
        }
        p.pressAmount += (amt - p.pressAmount) * (1 - Math.exp(-dt * 20))
      }
      p.update(dt)
      p.root.updateMatrixWorld(true)
      const a = p.fistL.getWorldPosition(new THREE.Vector3())
      const b = p.fistR.getWorldPosition(new THREE.Vector3())
      const mid = a.clone().add(b).multiplyScalar(0.5)
      // Chad Press bar rides in the fists only during the press
      this.bar.visible = this.mode === 'press' && p.pose === 'press'
      if (this.bar.visible) {
        this.bar.position.copy(mid)
        this.bar.rotation.y = this.yaw
      }
      if (this.shake > 0) {
        this.shake = Math.max(0, this.shake - dt)
        this.bar.rotation.z = Math.sin(this.t * 40) * this.shake * 0.3
      } else this.bar.rotation.z = 0
      // bench / squat bars: in the hands while lifting, back on the rack otherwise
      if (this.mode === 'bench') {
        this.benchBar.position.copy(mid)
        this.benchBar.rotation.y = this.yaw
      } else this.benchBar.position.set(SPOTS.bench.stand[0], 1.1, SPOTS.bench.stand[1] - 0.66)
      if (this.mode === 'squat') {
        this.squatBar.position.copy(mid)
        this.squatBar.rotation.y = this.yaw
      } else this.squatBar.position.set(SPOTS.squat.stand[0], 1.48, SPOTS.squat.stand[1] + 0.5)
      const curling = this.mode === 'curl'
      this.bells.forEach((bell, i) => {
        bell.visible = curling
        if (curling) {
          bell.position.copy(i ? b : a)
          bell.rotation.set(0, this.yaw, 0)
        }
      })
      this.ring.position.set(this.pos.x, 0.03, this.pos.z)
    }

    // heavy bag: damped pendulum, kicked by punches
    if (this.pendingHit >= 0 && this.t >= this.pendingHit) {
      this.pendingHit = -1
      this.bagVel -= 2.6 * this.bagHit
      audio.play('thud')
      if (this.bagHit > 0.9) this.camKick = 1
    }
    this.bagVel += (-this.bagAngle * 18 - this.bagVel * 2.2) * dt
    this.bagAngle += this.bagVel * dt
    this.bag.rotation.x = this.bagAngle

    if (this.mode === 'free') this.placeFreeCamera(1 - Math.exp(-dt * 9))
    else if (this.mode !== 'press') this.placeStationCamera(1 - Math.exp(-dt * 5))
    this.camKick = Math.max(0, this.camKick - dt * 6)

    this.coach?.update(dt)
    this.flash = Math.max(0, this.flash - dt * 2.5)
    this.strip.color.set('#ff7a1a').lerp(this.flashColor, this.flash).multiplyScalar(3.4 + this.flash * 4)
    this.ringMat.opacity = this.mode !== 'free' && this.mode !== 'press' ? 0.25 + this.flash * 0.7 : 0
    this.ringMat.color.set('#ff7a1a').lerp(this.flashColor, this.flash).multiplyScalar(1 + this.flash * 2)
    this.ring.scale.setScalar(1 + this.flash * 0.35)
  }

  dispose() {
    this.disposed = true
    this.events?.onPrompt(null)
    if (this.player) disposeCharacter(this.player)
    if (this.coach) disposeCharacter(this.coach)
    disposeObject(this.scene)
  }
}
