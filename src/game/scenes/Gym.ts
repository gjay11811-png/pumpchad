import * as THREE from 'three'
import { createCharacter, disposeCharacter, type Character } from '../character/character'
import type { Appearance } from '../character/types'
import { disposeObject, type Engine, type GameScene } from '../engine/Engine'
import type { Input } from '../input'
import { audio } from '../audio'
import { STATIONS, TREADMILL, nextPace, type RepGrade, type StationId } from '../workout'
import { StaticBatch } from './world/kit'
import type { Quality } from '../save'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { barbellParts, consoleTexture, kettlebellGeo, knurlTexture, leatherTexture, roundedPad, uprightTexture, woodTexture } from './gym/gymArt'
import { Place, turfLane, adjustableBench, benchStation, cableStation, dumbbell, dumbbellRack, kettlebellShelf, lockers, receptionDesk, squatRack, storedPlate, treadmill, waterStation, type GymMats, type RackSlot } from './gym/gymKit'
import { HALL, brandPanelTex, buildHall, screenTex } from './gym/gymRoom'
import type { Interactable } from './World'
import { Emoter, type EmoteId } from '../emotes'
import { INDOOR, Jumper, SPEED_UNIT, leanFor, targetSpeed, turnRate, velocityRate } from '../movement'

export type GymEvents = {
  onPrompt(p: Interactable | null): void
  onInteract(id: string): void
}
export type GymMode = 'free' | 'press' | StationId

const PLAYER_R = 0.38
/** walkable interior (the walls sit just outside) */
const ROOM = { x0: -8.4, x1: 8.4, z0: -5.4, z1: 7.0 }
const PRESS = new THREE.Vector3(0, 0, -2.2)

type Spot = { stand: [number, number]; yaw: number; use: [number, number]; useRadius: number; label: string; cam: [number, number, number]; look: [number, number, number] }
/** where the player stands to use each station, where the prompt triggers, and the framed exercise camera (station-local) */
/**
 * Zones (v2 layout): strength along the west + back-left (squat rack, bench press, pull-up, deadlift platform),
 * the Chad Press platform centred under the PUMP GYM sign, free weights on the east mirror wall (rack + curl spot),
 * the cable station on the back wall, cardio on the west wall, reception / lockers / water by the door.
 * A clear aisle runs from the door straight to the platform.
 */
const SPOTS: Record<'press' | StationId, Spot> = {
  press: { stand: [PRESS.x, PRESS.z], yaw: 0, use: [0, -0.3], useRadius: 1.5, label: 'Chad Press — timing challenge', cam: [0, 0, 0], look: [0, 0, 0] },
  bench: { stand: [-6.6, 0.4], yaw: 0, use: [-5.3, 0.4], useRadius: 1.2, label: 'Bench press', cam: [0.75, 2.15, 2.5], look: [0, 0.8, -0.5] },
  curl: { stand: [7.05, -2.6], yaw: -Math.PI / 2, use: [5.75, -2.6], useRadius: 1.2, label: 'Dumbbell curls', cam: [1.4, 1.5, 3.0], look: [0, 1.1, 0] },
  squat: { stand: [-6.6, -3.7], yaw: 0, use: [-6.6, -2.3], useRadius: 1.2, label: 'Squat rack', cam: [1.15, 1.4, 3.3], look: [0, 1.0, 0] },
  bag: { stand: [5.2, 4.15], yaw: Math.PI, use: [5.2, 5.2], useRadius: 1.2, label: 'Heavy bag', cam: [-2.6, 1.5, 0.35], look: [0, 1.2, 0.45] },
  deadlift: { stand: [-3.4, 2.4], yaw: 0, use: [-3.4, 3.75], useRadius: 1.1, label: 'Deadlift platform', cam: [2.2, 1.75, 3.2], look: [0, 0.15, 0] },
  pullup: { stand: [-3.7, -4.6], yaw: 0, use: [-3.7, -3.25], useRadius: 1.1, label: 'Pull-up bar', cam: [1.5, 1.7, 3.6], look: [0, 1.75, 0] },
  treadmill: { stand: [-7.3, 3.5], yaw: Math.PI / 2, use: [-5.6, 3.5], useRadius: 1.0, label: 'Treadmill', cam: [2.9, 1.9, 1.5], look: [0, 1.0, 0.3] },
}
/** dumbbell rack centre (its back stands just off the mirror wall, front faces west into the room) */
const RACK_AT = { x: HALL.x1 - 0.14 - 0.5, z: -2.6 }
/** treadmills along the west wall (z of each); the runner stands this far behind the deck centre */
const TREADMILL_ROW = [2.3, 3.5, 4.7]
const TREAD_BACK = 0.25
/** background NPCs (high / medium quality only): a runner on the back treadmill, a curler at the rack's north end */
const NPC_RUNNER = { x: -7.3, z: 2.3 }
const NPC_CURLER = { x: 7.95, z: 0.15, yaw: -Math.PI / 2 - 0.35 } // past the rack's north end, out of the aisle
/** pull-up bar height (m): the body hangs from it, hands locked to it */
const PULL_BAR_Y = 2.42
/** deadlift bar centre height when resting on the floor (big plates are 0.3 m radius) */
const DL_FLOOR_Y = 0.3
/** the pull-up bar sits this far in front of the hanging body, so the head clears it at the top */
const PULL_BAR_FWD = 0.24
/** half the grip width (m) on each barbell: hands go exactly this far either side of the bar centre */
const GRIP = { press: 0.3, bench: 0.36, squat: 0.4, deadlift: 0.24, pullup: 0.33 } as const
const BAG = new THREE.Vector3(5.2, 0, 3.35)

type Box = { x0: number; x1: number; z0: number; z1: number }
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

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
  /** background regulars (quality-gated): they train on their own kit and never block the player */
  private npcs: { c: Character; kind: 'run' | 'curl'; t: number; bells: THREE.Group[] }[] = []
  private npcMats: Pick<GymMats, 'rubber' | 'knurl' | 'chrome' | 'steel'> | null = null
  /** the coach trains too: push-up sets between greetings (only while he isn't waving / cheering) */
  private coachT = 6
  private bar = new THREE.Group() // Chad Press barbell
  private benchBar = new THREE.Group()
  private squatBar = new THREE.Group()
  private bells: THREE.Group[] = []
  private rackBells: THREE.Object3D[] = []
  private bag = new THREE.Group()
  private deadBar = new THREE.Group()
  private belt: THREE.Texture | null = null
  private npcBelt: THREE.Texture | null = null
  private beltLen = 1.7
  private quality: Quality = 'medium'
  /** head radius of the pair that leaves the rack for curls, and of the NPC curler's pair */
  private bellR = 0.066
  private npcBellR = 0.075
  /** treadmill belt speed (m/s), driven by the tempo strides */
  pace = 0
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
  private jumper = new Jumper()
  private lastSpeed = 0
  private lastLookT = -10
  emoter = new Emoter()

  constructor(engine: Engine, private input: Input | null = null, private events: GymEvents | null = null) {
    const s = this.scene
    s.background = new THREE.Color('#09070b')
    s.fog = new THREE.Fog('#09070b', 16, 34)
    s.environment = engine.env
    s.environmentIntensity = 0.3
    this.quality = engine.quality

    const B = new StaticBatch()
    const D: (THREE.Material | THREE.BufferGeometry | THREE.Texture)[] = []
    const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p)
    // one shared material set for every piece of kit: painted steel, bare steel, chrome, rubber, upholstery, brand paint
    const M: GymMats = {
      frame: std({ color: '#1e1d22', metalness: 0.55, roughness: 0.46 }),
      steel: std({ color: '#8f8e95', metalness: 0.9, roughness: 0.32 }),
      chrome: std({ color: '#e2ddd3', metalness: 1, roughness: 0.18 }),
      knurl: std({ map: knurlTexture(D), color: '#d6d2c8', metalness: 1, roughness: 0.42 }),
      rubber: std({ color: '#141316', roughness: 0.8 }),
      orange: std({ color: '#ff7a1a', roughness: 0.5, metalness: 0.15 }),
      purple: std({ color: '#5b2a86', roughness: 0.55, metalness: 0.1 }),
      pad: std({ map: leatherTexture('#231d24', D), roughness: 0.5, metalness: 0.05 }),
      plateSteel: std({ color: '#b8b4ac', metalness: 1, roughness: 0.3 }),
      upright: std({ map: uprightTexture(D), metalness: 0.7, roughness: 0.42 }),
    }
    const MAT = { chrome: M.chrome, knurl: M.knurl, rubber: M.rubber, orange: M.orange, steel: M.plateSteel }
    this.npcMats = M
    const glowOrange = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff8a30').multiplyScalar(2.2), toneMapped: false })
    const glowPurple = new THREE.MeshBasicMaterial({ color: new THREE.Color('#a66bff').multiplyScalar(2.4), toneMapped: false })
    const glowBlue = new THREE.MeshBasicMaterial({ color: new THREE.Color('#7fd6ff').multiplyScalar(2), toneMapped: false })

    // ═════════ 1. the hall: floors, walls, windows, door, ceiling, fixtures, mirror wall, PUMP GYM sign ═════════
    this.strip = buildHall(B, s, D, M, engine.env).strip
    const cast = <T extends THREE.Object3D>(o: T) => {
      o.traverse((c) => (c.castShadow = true))
      return o
    }
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
      const o = new THREE.Mesh(g, m)
      o.position.set(x, y, z)
      return o
    }
    const box = (x0: number, x1: number, z0: number, z1: number) => this.boxes.push({ x0, x1, z0, z1 })
    const barbell = (g: THREE.Group, len = 2.1, plates: { r: number; w: number; color: 'black' | 'orange' }[] = [{ r: 0.25, w: 0.07, color: 'orange' }, { r: 0.21, w: 0.05, color: 'black' }]) => {
      for (const part of barbellParts(len, plates)) {
        const m = new THREE.Mesh(part.geo, MAT[part.mat])
        m.position.x = part.x
        g.add(m)
      }
      return cast(g)
    }

    // ═════════ 2. equipment, zone by zone ═════════
    // ── centre: the Chad Press platform under the sign ──
    {
      const woodTex = woodTexture(D)
      woodTex.repeat.set(2, 1)
      const platform = new THREE.Mesh(new RoundedBoxGeometry(3.6, 0.12, 3.6, 2, 0.03), std({ map: woodTex, roughness: 0.55 }))
      platform.position.set(PRESS.x, 0.06, PRESS.z)
      platform.receiveShadow = true
      s.add(platform)
      // orange edge inlay around the platform
      for (const [w, d, x, z] of [[3.64, 0.04, 0, -1.8], [3.64, 0.04, 0, 1.8], [0.04, 3.64, -1.8, 0], [0.04, 3.64, 1.8, 0]] as const)
        B.put(new THREE.BoxGeometry(w, 0.125, d), M.orange, PRESS.x + x, 0.0625, PRESS.z + z, 0, 1, 1, 1, { cast: false })
      barbell(this.bar)
      s.add(this.bar)
      // plate trees flanking the platform
      for (const x of [-2.4, 2.4]) {
        const P = Place.at(B, x, -5.15)
        P.rbox(0.9, 0.06, 0.6, 0.01, M.frame, 0, 0.03, 0)
        P.put(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 10), M.frame, 0, 0.68, 0)
        for (const [y, side, r] of [[0.32, -1, 0.25], [0.32, 1, 0.25], [0.72, -1, 0.2], [0.72, 1, 0.2], [1.08, -1, 0.15], [1.08, 1, 0.15]] as const) {
          P.put(new THREE.CylinderGeometry(0.022, 0.022, 0.22, 8).rotateX(Math.PI / 2), M.steel, 0, y, side * 0.1)
          storedPlate(P, M, 0, y, side * 0.2, r, 0.055, r > 0.22, Math.PI / 2)
        }
        box(x - 0.45, x + 0.45, -5.45, -4.85)
      }
    }

    // ── free weights (east): three-tier dumbbell rack against the mirror, two adjustable benches in front ──
    {
      const R = Place.at(B, RACK_AT.x, RACK_AT.z, -Math.PI / 2)
      const slots = dumbbellRack(R, M)
      // the pair right behind the curl spot leaves the rack while you train; another pair lives with the NPC curler
      const live = (sl: RackSlot) => sl.tier === 1 && sl.pair === 2
      const npcPair = (sl: RackSlot) => sl.tier === 1 && sl.pair === 5
      for (const sl of slots) {
        const g = dumbbell(sl.r, M)
        sl.matrix.decompose(g.position, g.quaternion, g.scale)
        if (live(sl)) {
          s.add(cast(g))
          this.rackBells.push(g)
        } else if (npcPair(sl)) {
          this.npcBellR = sl.r
        } else B.absorb(g)
      }
      this.bellR = slots.find(live)!.r
      for (let i = 0; i < 2; i++) {
        const g = dumbbell(this.bellR, M)
        g.visible = false
        s.add(cast(g))
        this.bells.push(g)
      }
      box(RACK_AT.x - 0.48, RACK_AT.x + 0.52, RACK_AT.z - 1.75, RACK_AT.z + 1.75)
      for (const z of [-4.3, -0.9]) {
        adjustableBench(Place.at(B, 5.7, z, Math.PI), M) // seat end toward the mirror
        box(5.0, 6.4, z - 0.3, z + 0.3)
      }
    }

    // ── strength (west + back): squat rack, bench-press station, pull-up frame, kettlebells, deadlift platform ──
    {
      const [x, z] = SPOTS.squat.stand
      squatRack(Place.at(B, x, z), M)
      barbell(this.squatBar, 1.9, [{ r: 0.25, w: 0.07, color: 'orange' }, { r: 0.21, w: 0.05, color: 'black' }])
      this.squatBar.position.set(x, 1.48, z + 0.5)
      s.add(this.squatBar)
      for (const sx of [-0.7, 0.7]) for (const dz of [-0.55, 0.55]) box(x + sx - 0.1, x + sx + 0.1, z + dz - 0.1, z + dz + 0.1)
      for (const sx of [-1, 1]) box(x + sx * 0.75, x + sx * 1.08, z - 0.85, z - 0.25) // stored plates
    }
    {
      const [x, z] = SPOTS.bench.stand
      benchStation(Place.at(B, x, z), M)
      barbell(this.benchBar, 1.8, [{ r: 0.225, w: 0.06, color: 'orange' }])
      this.benchBar.position.set(x, 1.1, z - 0.66)
      s.add(this.benchBar)
      box(x - 0.62, x + 0.62, z - 1.1, z + 0.72)
    }
    {
      const [x, z0] = SPOTS.pullup.stand
      const z = z0 + PULL_BAR_FWD
      const V = (a: number, b: number, c: number) => new THREE.Vector3(a, b, c)
      const P = Place.at(B, 0, 0)
      for (const sx of [-0.66, 0.66]) {
        P.tube(V(x + sx, 0.02, z), V(x + sx, PULL_BAR_Y + 0.12, z), 0.045, M.frame, 10)
        P.tube(V(x + sx, 0.04, z - 0.55), V(x + sx, 0.04, z + 0.55), 0.04, M.frame, 8)
        P.tube(V(x + sx, 0.04, z - 0.5), V(x + sx, 1.3, z), 0.03, M.frame, 8)
        P.tube(V(x + sx, 0.04, z + 0.5), V(x + sx, 1.3, z), 0.03, M.frame, 8)
        for (const dz of [-0.55, 0.55]) P.rbox(0.14, 0.04, 0.14, 0.015, M.rubber, x + sx, 0.02, z + dz)
      }
      P.tube(V(x - 0.7, PULL_BAR_Y, z), V(x + 0.7, PULL_BAR_Y, z), 0.019, M.knurl, 14)
      P.tube(V(x - 0.7, PULL_BAR_Y + 0.12, z), V(x + 0.7, PULL_BAR_Y + 0.12, z), 0.035, M.orange, 10)
      for (const sx of [-0.66, 0.66]) box(x + sx - 0.08, x + sx + 0.08, z - 0.55, z + 0.55)
    }
    {
      kettlebellShelf(Place.at(B, -6.6, -5.55), M, kettlebellGeo())
      box(-7.75, -5.45, -5.9, -5.25)
    }
    {
      const [x, z] = SPOTS.deadlift.stand
      const g = new THREE.Group()
      const oak = std({ map: woodTexture(D), roughness: 0.55 })
      g.add(mesh(new RoundedBoxGeometry(1.0, 0.045, 2.4, 1, 0.01), oak, 0, 0.022, 0.1))
      for (const sx of [-0.9, 0.9]) g.add(mesh(new RoundedBoxGeometry(0.8, 0.045, 2.4, 1, 0.01), M.rubber, sx, 0.022, 0.1))
      g.add(mesh(new THREE.BoxGeometry(2.62, 0.05, 0.05), M.frame, 0, 0.025, -1.12), mesh(new THREE.BoxGeometry(2.62, 0.05, 0.05), M.frame, 0, 0.025, 1.32))
      g.position.set(x, 0, z)
      g.traverse((o) => (o.receiveShadow = true))
      s.add(g)
      barbell(this.deadBar, 2.0)
      this.deadBar.position.set(x, DL_FLOOR_Y, z + 0.28)
      s.add(this.deadBar)
    }

    // ── conditioning: turf sled lane between the benches and the heavy bag ──
    {
      const turfTex = (() => {
        const c = document.createElement('canvas')
        c.width = c.height = 128
        const g = c.getContext('2d')!
        g.fillStyle = '#20381f'
        g.fillRect(0, 0, 128, 128)
        for (let i = 0; i < 2600; i++) {
          g.fillStyle = Math.random() < 0.5 ? '#2c4a29' : '#172a16'
          g.fillRect(Math.random() * 128, Math.random() * 128, 1, 2)
        }
        const t = new THREE.CanvasTexture(c)
        t.wrapS = t.wrapT = THREE.RepeatWrapping
        t.repeat.set(6, 1.5)
        t.colorSpace = THREE.SRGBColorSpace
        return t
      })()
      turfLane(Place.at(B, 5.6, 1.35), M, std({ map: turfTex, roughness: 0.95 }), 5.6)
      box(6.85, 7.95, 0.95, 1.75) // the sled
    }

    // ── machines (back wall): dual-stack cable station ──
    cableStation(Place.at(B, 4.4, -5.35), M)
    box(3.05, 5.75, -5.9, -4.85)

    // ── cardio (west wall): three treadmills, the middle one is yours, the back one has a runner ──
    {
      const consoleMat = new THREE.MeshBasicMaterial({ map: consoleTexture(D), toneMapped: false, color: new THREE.Color(1.8, 1.8, 1.8) })
      const beltTex = () => {
        const c = document.createElement('canvas')
        c.width = 128
        c.height = 32
        const cx = c.getContext('2d')!
        cx.fillStyle = '#1c1b1e'
        cx.fillRect(0, 0, 128, 32)
        cx.fillStyle = '#2c2a30'
        for (let i = 0; i < 128; i += 16) cx.fillRect(i, 0, 5, 32)
        const t = new THREE.CanvasTexture(c)
        t.wrapS = t.wrapT = THREE.RepeatWrapping
        t.repeat.set(6, 1)
        t.colorSpace = THREE.SRGBColorSpace
        return t
      }
      for (const z of TREADMILL_ROW) {
        const tex = beltTex()
        const belt = std({ map: tex, roughness: 0.9 })
        if (z === SPOTS.treadmill.stand[1]) this.belt = tex
        if (z === NPC_RUNNER.z) this.npcBelt = tex
        const tx = SPOTS.treadmill.stand[0] + TREAD_BACK
        treadmill(Place.at(B, tx, z), { ...M, console: consoleMat, belt })
        box(tx - 1.02, tx + 1.02, z - 0.45, z + 0.45)
      }
    }

    // ── heavy bag: stitched leather, caps, swivel and chain, hung from a ceiling bracket ──
    {
      const P = Place.at(B, BAG.x, BAG.z)
      P.rbox(0.36, 0.03, 0.36, 0.008, M.frame, 0, HALL.H - 0.015, 0)
      P.put(new THREE.CylinderGeometry(0.03, 0.03, HALL.H - 4.24, 10), M.frame, 0, (HALL.H + 4.24) / 2, 0)
      P.put(new THREE.TorusGeometry(0.035, 0.009, 6, 12), M.steel, 0, 4.2, 0)
      const leather = std({ map: leatherTexture('#6e1a12', D), roughness: 0.5, metalness: 0.05 })
      const link = new THREE.TorusGeometry(0.03, 0.007, 6, 12)
      const body = mesh(new THREE.CylinderGeometry(0.27, 0.25, 1.15, 28), leather, 0, -2.8, 0)
      const capTop = mesh(new THREE.CylinderGeometry(0.2, 0.27, 0.08, 28), M.rubber, 0, -2.2, 0)
      const capBot = mesh(new THREE.SphereGeometry(0.25, 24, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), leather, 0, -3.37, 0)
      const band = mesh(new THREE.CylinderGeometry(0.275, 0.275, 0.12, 28), M.orange, 0, -2.55, 0)
      const band2 = mesh(new THREE.CylinderGeometry(0.262, 0.262, 0.05, 28), M.orange, 0, -3.25, 0)
      const swivel = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 10), M.chrome, 0, -2.1, 0)
      const ch = new THREE.Group()
      for (let i = 0; i < 40; i++) {
        const l = new THREE.Mesh(link, M.chrome)
        l.position.y = -0.04 - i * 0.05
        l.rotation.y = i % 2 ? Math.PI / 2 : 0
        l.scale.set(1, 1.4, 1)
        ch.add(l)
      }
      this.bag.add(ch, swivel, body, capTop, capBot, band, band2)
      this.bag.position.set(BAG.x, 4.15, BAG.z)
      s.add(cast(this.bag))
      box(BAG.x - 0.32, BAG.x + 0.32, BAG.z - 0.32, BAG.z + 0.32)
      // a floor mat under the bag
      B.put(new RoundedBoxGeometry(2.2, 0.022, 2.6, 1, 0.008), M.rubber, BAG.x, 0.011, BAG.z + 0.4, 0, 1, 1, 1, { cast: false })
    }

    // ── entrance: reception desk, lockers + bench, water station ──
    {
      const brand = new THREE.MeshBasicMaterial({ map: brandPanelTex(D), toneMapped: false, color: new THREE.Color(1.3, 1.3, 1.3) })
      const screen = new THREE.MeshBasicMaterial({ map: screenTex(D), toneMapped: false, color: new THREE.Color(1.4, 1.4, 1.4) })
      const top = std({ color: '#3a3438', roughness: 0.3, metalness: 0.2 })
      receptionDesk(Place.at(B, -3.4, 6.1, Math.PI / 2), { ...M, top, brand, glowPurple, screen })
      box(-4.2, -3.05, 4.85, 7.35)
      const locker = std({ color: '#26222c', metalness: 0.55, roughness: 0.45 })
      lockers(Place.at(B, -7.2, 7.32, Math.PI), { ...M, locker, glowOrange }, 7)
      box(-8.95, -5.5, 6.95, 7.6)
      const LB = Place.at(B, -7.0, 6.5)
      LB.put(roundedPad(1.6, 0.06, 0.34), M.pad, 0, 0.45, 0)
      for (const x of [-0.65, 0.65]) LB.rbox(0.05, 0.42, 0.28, 0.008, M.frame, x, 0.21, 0)
      box(-7.85, -6.15, 6.3, 6.7)
      const glass = std({ color: '#7fc4ff', transparent: true, opacity: 0.5, roughness: 0.1 })
      waterStation(Place.at(B, 3.2, 7.32, Math.PI), { ...M, glass, glowBlue })
      box(2.85, 3.55, 7.0, 7.6)
    }
    B.build(s, true)

    // rep feedback ring under the active lifter
    this.ringMat = new THREE.MeshBasicMaterial({ color: '#ff7a1a', transparent: true, opacity: 0, toneMapped: false, depthWrite: false })
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.66, 40), this.ringMat)
    this.ring.rotation.x = -Math.PI / 2
    this.ring.position.y = 0.03
    s.add(this.ring)

    // ═════════ 3. lighting: soft overhead key (the one shadow caster), warm zone fills, purple cardio wash ═════════
    s.add(new THREE.HemisphereLight('#5a4a62', '#1a100a', 0.8))
    const key = new THREE.SpotLight('#fff0dc', 80, 24, 1.05, 0.6, 1.3)
    key.position.set(0, HALL.H - 0.2, 1.2)
    key.castShadow = this.quality !== 'low'
    key.shadow.mapSize.set(this.quality === 'high' ? 1024 : 512, this.quality === 'high' ? 1024 : 512)
    key.shadow.bias = -0.0004
    key.target.position.set(0, 0, -0.6)
    s.add(key, key.target)
    const rim = new THREE.PointLight('#ff7a1a', 16, 9, 1.6)
    rim.position.set(0, 2.4, -4.6)
    s.add(rim)
    for (const [x, y, z, c, i] of [[6.4, 3.4, -2.4, '#ffe2c0', 12], [-6.4, 3.4, -1.8, '#ffe2c0', 11], [-6.2, 3.0, 3.6, '#b58cff', 7], [-1.6, 3.0, 6.0, '#ffd8b0', 6]] as const) {
      const l = new THREE.PointLight(c, i, 9, 1.4)
      l.position.set(x, y, z)
      s.add(l)
    }

    // stations + exit
    for (const id of ['press', 'bench', 'curl', 'squat', 'bag', 'deadlift', 'pullup', 'treadmill'] as const) {
      const sp = SPOTS[id]
      this.interactables.push({ id, label: sp.label, pos: new THREE.Vector3(sp.use[0], 0, sp.use[1]), radius: sp.useRadius, kind: 'activity' })
    }
    this.interactables.push({ id: 'exit', label: 'Back to Chad Square', pos: new THREE.Vector3(0, 0, 6.9), radius: 1.3, kind: 'activity' })
  }

  async populate(a: Appearance) {
    // phones on low quality get the coach only; medium adds a treadmill runner; high adds a dumbbell curler too
    const kinds: ('run' | 'curl')[] = this.quality === 'low' ? [] : this.quality === 'high' ? ['run', 'curl'] : ['run']
    const looks: Record<'run' | 'curl', Appearance> = {
      run: { species: 'demon', skin: '#5b2a86', outfit: '#141216', glow: '#ffb347', top: 'shirtless', headwear: 'none', eyewear: 'none', chain: false },
      curl: { species: 'pumpkin', skin: '#c9581a', outfit: '#2a262c', glow: '#ff7a1a', top: 'shirtless', headwear: 'none', eyewear: 'shades', chain: true },
    }
    const [p, coach, ...extra] = await Promise.all([
      createCharacter(a),
      createCharacter({ species: 'skeleton', skin: '#e9e2d0', outfit: '#141216', glow: '#19f19a', top: 'armor', headwear: 'none', eyewear: 'none', chain: true }),
      ...kinds.map((k) => createCharacter(looks[k])),
    ])
    if (this.disposed) return [p, coach, ...extra].forEach(disposeCharacter)
    kinds.forEach((kind, i) => {
      const c = extra[i]
      this.scene.add(c.root)
      const bells: THREE.Group[] = []
      if (kind === 'run') {
        c.root.position.set(NPC_RUNNER.x, 0.165, NPC_RUNNER.z)
        c.root.rotation.y = Math.PI / 2
        c.pose = 'walk'
      } else {
        c.root.position.set(NPC_CURLER.x, 0, NPC_CURLER.z)
        c.root.rotation.y = NPC_CURLER.yaw
        c.pose = 'curl'
        c.pressAmount = 0
        for (let k = 0; k < 2; k++) {
          const g = dumbbell(this.npcBellR, this.npcMats!)
          g.traverse((o) => (o.castShadow = true))
          this.scene.add(g)
          bells.push(g)
        }
        this.boxes.push({ x0: NPC_CURLER.x - 0.35, x1: NPC_CURLER.x + 0.35, z0: NPC_CURLER.z - 0.35, z1: NPC_CURLER.z + 0.35 })
      }
      this.npcs.push({ c, kind, t: Math.random() * 4, bells })
    })
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

  /** QA */
  animState() {
    return { emote: this.emoter.active, busy: this.emoter.busy, airborne: this.jumper.airborne, jumpY: +this.jumper.y.toFixed(3), mode: this.mode }
  }

  /** play an emote from the wheel (free roam only, not mid-air) */
  emote(id: EmoteId) {
    if (this.mode !== 'free' || this.jumper.airborne || this.paused) return null
    return this.emoter.start(this.player, id)
  }

  startStation(id: 'press' | StationId) {
    const p = this.player
    if (!p) return
    this.emoter.cancel(p)
    this.jumper.reset()
    p.setGrounded?.(true, true)
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
    if (id === 'treadmill') {
      this.pos.y = 0.165 // stand on the belt
      this.pace = TREADMILL.start
    }
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
    this.pace = 0
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
    if (this.mode === 'treadmill') {
      // every stride on the beat speeds the belt up; the runner's real jog / sprint clip follows the belt speed
      this.pace = nextPace(this.pace, grade)
      if (grade === 'clean') this.camKick = 0.5
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
    if (this.coach) this.coach.pose = 'wave' // breaks off a push-up set to cheer you on
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

  /** QA: stand anywhere on the floor facing `yaw` (camera behind), in free mode */
  teleport(x: number, z: number, yaw?: number) {
    if (this.mode !== 'free') return
    this.pos.set(x, 0, z)
    this.collide(this.pos)
    this.vel.set(0, 0, 0)
    if (yaw !== undefined) {
      this.yaw = yaw
      this.camYaw = yaw + Math.PI
    }
    this.placeFreeCamera(1)
  }
  /** QA: what's in the hall */
  info() {
    return { npcs: this.npcs.map((n) => n.kind), quality: this.quality, rackBellsVisible: this.rackBells.map((b) => b.visible), heldVisible: this.bells.map((b) => b.visible), pos: [+this.pos.x.toFixed(2), +this.pos.z.toFixed(2)] }
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
    v.y = THREE.MathUtils.clamp(v.y, 0.4, HALL.H - 0.35)
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
    const mv = this.paused || !this.input ? { x: 0, z: 0, run: false, analog: false } : this.input.move()
    if (look.x || look.y) this.lastLookT = this.t
    const fwd = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw))
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x)
    const wish = fwd.multiplyScalar(mv.z).add(right.multiplyScalar(mv.x))
    const mag = Math.min(1, wish.length())
    const targetVel = mag > 0.01 ? wish.normalize().multiplyScalar(targetSpeed(mag, mv.run, mv.analog, INDOOR)) : new THREE.Vector3()
    const p0 = this.player
    if (this.input?.takeJump() && !this.paused && this.jumper.tryJump(p0)) this.emoter.cancel(p0)
    if (mag > 0.05 && this.emoter.busy) this.emoter.cancel(p0)
    this.jumper.update(dt, p0)
    this.emoter.update(dt)
    this.vel.lerp(targetVel, 1 - Math.exp(-dt * velocityRate(mag > 0.01, Math.hypot(this.vel.x, this.vel.z), this.jumper.airborne)))
    const px = this.pos.x
    const pz = this.pos.z
    this.pos.addScaledVector(this.vel, dt)
    this.collide(this.pos)
    if (dt > 0) {
      const ax = (this.pos.x - px) / dt
      const az = (this.pos.z - pz) / dt
      if (Math.hypot(ax, az) < Math.hypot(this.vel.x, this.vel.z) - 0.05) this.vel.set(ax, this.vel.y, az)
    }
    const onPlatform = Math.abs(this.pos.x - PRESS.x) < 1.8 && Math.abs(this.pos.z - PRESS.z) < 1.8
    this.pos.y += ((onPlatform ? 0.12 : 0) - this.pos.y) * (1 - Math.exp(-dt * 18))
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
    const p = this.player
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
    }
    this.lastSpeed = speed

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
      this.input?.takeJump()
      this.input?.takeLook()
      if (p?.lean) p.lean.turn = p.lean.accel = 0
      if (this.prompt) {
        this.prompt = null
        this.events?.onPrompt(null)
      }
      if (p) p.speed = 0
      if (this.mode === 'treadmill') {
        this.pace = Math.max(TREADMILL.min, this.pace - TREADMILL.decay * dt)
        if (p) p.speed = this.pace / 3.4 // the rig plays walk / jog / sprint matched to this ground speed
      }
    }
    if (this.belt) this.belt.offset.x += ((this.mode === 'treadmill' ? this.pace : 0) * dt * this.belt.repeat.x) / this.beltLen

    if (p) {
      p.root.position.copy(this.pos)
      if (this.mode === 'free') p.root.position.y += this.jumper.y
      p.root.rotation.y = this.yaw
      if (this.mode === 'press') p.pressAmount += (this.target - p.pressAmount) * (1 - Math.exp(-dt * 12))
      else if (this.mode !== 'free' && this.mode !== 'bag' && this.mode !== 'treadmill') {
        const spec = STATIONS[this.mode]
        let amt = spec.rest
        if (this.repT >= 0) {
          this.repT += dt
          const u = Math.min(1, this.repT / this.repDur)
          // real lifts aren't symmetric: bench lowers slowly then drives up, curls snap up then lower under control,
          // squats sink controlled then drive up — eased so each phase accelerates and settles
          // deadlift: pull from the floor then a controlled lower; pull-up: up, then a slower negative
          const share = this.mode === 'bench' ? 0.58 : this.mode === 'curl' ? 0.38 : this.mode === 'deadlift' ? 0.45 : this.mode === 'pullup' ? 0.42 : 0.55
          const f = u < share ? easeInOut(u / share) : 1 - easeInOut((u - share) / (1 - share))
          amt = spec.rest + (1 - 2 * spec.rest) * f // rest → far end → rest
          if (u >= 1) {
            this.repT = -1
            if (this.mode !== 'curl') audio.play('clank')
          }
        }
        p.pressAmount += (amt - p.pressAmount) * (1 - Math.exp(-dt * 20))
      }
      p.update(dt)
      p.root.updateMatrixWorld(true)
      const hasGrip = !!(p.grip && p.palmCenter && p.palm)
      if (this.mode === 'pullup') {
        // hang from the bar: lift the whole body so the palms reach the bar (the arm pose sets the body height)
        const c = hasGrip ? p.palmCenter!() : p.fistL.getWorldPosition(new THREE.Vector3()).add(p.fistR.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5)
        let lift = PULL_BAR_Y - c.y
        if (hasGrip && p.shoulderCenter) {
          // the bar is a little in front of the body: raise the shoulders until the arms' current reach meets it
          const sh = p.shoulderCenter()
          const reach = sh.distanceTo(c)
          const h = Math.hypot(SPOTS.pullup.stand[0] - sh.x, SPOTS.pullup.stand[1] + PULL_BAR_FWD - sh.z)
          lift = PULL_BAR_Y - sh.y - Math.sqrt(Math.max(0, reach * reach - h * h))
        }
        p.root.position.y += Math.max(0, lift)
        p.root.updateMatrixWorld(true)
      }
      // ── grips: both palms locked onto the bar, level and symmetric about the body (arm IK) ──
      const grip = GRIP[this.mode as keyof typeof GRIP]
      let mid: THREE.Vector3
      if (grip && hasGrip && p.pose !== 'flex') {
        mid = this.mode === 'pullup' ? new THREE.Vector3(SPOTS.pullup.stand[0], PULL_BAR_Y, SPOTS.pullup.stand[1] + PULL_BAR_FWD) : p.palmCenter!()
        if (this.mode === 'deadlift') mid.y = Math.max(DL_FLOOR_Y, mid.y) // the bar never sinks into the floor
        const axis = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)) // the body's left-right line
        const lSide = Math.sign(p.palm!('l').sub(mid).dot(axis)) || 1
        p.grip!(mid.clone().addScaledVector(axis, lSide * grip), mid.clone().addScaledVector(axis, -lSide * grip))
      } else if (this.mode === 'curl' && hasGrip) {
        // dumbbells: mirror the two hands so they rise level together
        const L = p.palm!('l')
        const R = p.palm!('r')
        const c = L.clone().add(R).multiplyScalar(0.5)
        const axis = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw))
        const half = Math.abs(L.clone().sub(R).dot(axis)) / 2
        const lSide = Math.sign(L.clone().sub(c).dot(axis)) || 1
        p.grip!(c.clone().addScaledVector(axis, lSide * half), c.clone().addScaledVector(axis, -lSide * half))
        mid = c
      } else {
        mid = hasGrip ? p.palmCenter!() : p.fistL.getWorldPosition(new THREE.Vector3()).add(p.fistR.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5)
      }
      const a = hasGrip ? p.palm!('l') : p.fistL.getWorldPosition(new THREE.Vector3())
      const b = hasGrip ? p.palm!('r') : p.fistR.getWorldPosition(new THREE.Vector3())
      // Chad Press bar rides in the palms only during the press
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
      // deadlift bar: in the hands during the set, loaded on the platform otherwise
      if (this.mode === 'deadlift') {
        this.deadBar.position.copy(mid)
        this.deadBar.rotation.y = this.yaw
      } else {
        this.deadBar.position.set(SPOTS.deadlift.stand[0], DL_FLOOR_Y, SPOTS.deadlift.stand[1] + 0.28)
        this.deadBar.rotation.y = 0
      }
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
      this.bagVel -= 0.42 * this.bagHit // a heavy bag sways ~20–30 cm per hit, it does not fly
      audio.play('thud')
      if (this.bagHit > 0.9) this.camKick = 1
    }
    this.bagVel += (-this.bagAngle * 18 - this.bagVel * 2.2) * dt
    this.bagAngle += this.bagVel * dt
    this.bag.rotation.x = this.bagAngle

    if (this.mode === 'free') this.placeFreeCamera(1 - Math.exp(-dt * 9))
    else if (this.mode !== 'press') this.placeStationCamera(1 - Math.exp(-dt * 5))
    this.camKick = Math.max(0, this.camKick - dt * 6)

    this.updateNpcs(dt)
    const c = this.coach
    if (c) {
      if (c.pose === 'idle' || c.pose === 'pushup') {
        this.coachT -= dt
        if (this.coachT <= 0) {
          const training = c.pose === 'pushup'
          c.pose = training ? 'idle' : 'pushup'
          this.coachT = training ? 14 + Math.random() * 8 : 7 // rest, then a 7 s set
        }
      }
      c.update(dt)
    }
    this.flash = Math.max(0, this.flash - dt * 2.5)
    this.strip.color.set('#ff7a1a').lerp(this.flashColor, this.flash).multiplyScalar(3.4 + this.flash * 4)
    this.ringMat.opacity = this.mode !== 'free' && this.mode !== 'press' ? 0.25 + this.flash * 0.7 : 0
    this.ringMat.color.set('#ff7a1a').lerp(this.flashColor, this.flash).multiplyScalar(1 + this.flash * 2)
    this.ring.scale.setScalar(1 + this.flash * 0.35)
  }

  /** the regulars: a steady jog on the back treadmill; curl sets with rests at the rack (dumbbells follow the palms) */
  private updateNpcs(dt: number) {
    for (const n of this.npcs) {
      n.t += dt
      const c = n.c
      if (n.kind === 'run') {
        const pace = 2.9 + Math.sin(n.t * 0.05) * 0.4 // drifts between an easy and a steady jog
        c.speed = pace / 3.4
        if (this.npcBelt) this.npcBelt.offset.x += (pace * dt * this.npcBelt.repeat.x) / this.beltLen
        c.update(dt)
        continue
      }
      // 10 reps (~1.3 s each), then ~6 s rest with the bells at the sides
      const cycle = 19
      const k = n.t % cycle
      const amt = k < 13 ? 0.5 - 0.5 * Math.cos(((k % 1.3) / 1.3) * Math.PI * 2) : 0
      c.pressAmount += (amt - c.pressAmount) * (1 - Math.exp(-dt * 14))
      c.update(dt)
      c.root.updateMatrixWorld(true)
      if (c.palm && c.grip) {
        const L = c.palm('l')
        const R = c.palm('r')
        const mid = L.clone().add(R).multiplyScalar(0.5)
        const axis = new THREE.Vector3(Math.cos(NPC_CURLER.yaw), 0, -Math.sin(NPC_CURLER.yaw))
        const half = Math.abs(L.clone().sub(R).dot(axis)) / 2
        const lSide = Math.sign(L.clone().sub(mid).dot(axis)) || 1
        c.grip(mid.clone().addScaledVector(axis, lSide * half), mid.clone().addScaledVector(axis, -lSide * half))
        n.bells.forEach((b, i) => {
          b.position.copy(c.palm!(i ? 'r' : 'l'))
          b.rotation.set(0, NPC_CURLER.yaw, 0)
        })
      }
    }
  }

  dispose() {
    this.disposed = true
    this.npcs.forEach((n) => disposeCharacter(n.c))
    this.events?.onPrompt(null)
    if (this.player) disposeCharacter(this.player)
    if (this.coach) disposeCharacter(this.coach)
    disposeObject(this.scene)
  }
}
