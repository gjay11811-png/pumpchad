import * as THREE from 'three'
import { createCharacter, disposeCharacter, type Character } from '../character/character'
import type { Appearance } from '../character/types'
import { disposeObject, type Engine, type GameScene } from '../engine/Engine'
import type { Input } from '../input'
import { audio } from '../audio'
import { STATIONS, TREADMILL, nextPace, type RepGrade, type StationId } from '../workout'
import { signTexture } from './textures'
import { StaticBatch, boxUV } from './world/kit'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { barbellParts, brickTexture, bumperGeo, consoleTexture, hexDumbbellParts, hubGeo, kettlebellGeo, knurlTexture, leatherTexture, panelTexture, poster, roundedPad, rubberFloorTexture, tube, uprightTexture, woodTexture } from './gym/gymArt'
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
const SPOTS: Record<'press' | StationId, Spot> = {
  press: { stand: [PRESS.x, PRESS.z], yaw: 0, use: [0, -0.3], useRadius: 1.5, label: 'Chad Press — timing challenge', cam: [0, 0, 0], look: [0, 0, 0] },
  bench: { stand: [-5.2, -2.6], yaw: 0, use: [-3.9, -2.6], useRadius: 1.25, label: 'Bench press', cam: [0.75, 2.15, 2.5], look: [0, 0.8, -0.5] },
  curl: { stand: [5.2, -3.0], yaw: 0, use: [5.2, -1.7], useRadius: 1.25, label: 'Dumbbell curls', cam: [1.5, 1.5, 3.0], look: [0, 1.1, 0] },
  squat: { stand: [-5.2, 3.0], yaw: 0, use: [-5.2, 4.4], useRadius: 1.25, label: 'Squat rack', cam: [1.15, 1.4, 3.3], look: [0, 1.0, 0] },
  bag: { stand: [5.2, 4.15], yaw: Math.PI, use: [5.2, 5.2], useRadius: 1.25, label: 'Heavy bag', cam: [-2.6, 1.5, 0.35], look: [0, 1.2, 0.45] },
  deadlift: { stand: [-2.5, 2.3], yaw: 0, use: [-2.5, 3.65], useRadius: 1.15, label: 'Deadlift platform', cam: [2.2, 1.75, 3.2], look: [0, 0.15, 0] },
  pullup: { stand: [2.5, 2.3], yaw: 0, use: [2.5, 3.65], useRadius: 1.15, label: 'Pull-up bar', cam: [1.5, 1.7, 3.6], look: [0, 1.75, 0] },
  treadmill: { stand: [-7.3, 0.2], yaw: Math.PI / 2, use: [-5.75, 0.2], useRadius: 1.0, label: 'Treadmill', cam: [2.9, 1.9, 1.5], look: [0, 1.0, 0.3] },
}
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
  private beltLen = 1.7
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
    s.fog = new THREE.Fog('#09070b', 14, 30)
    s.environment = engine.env
    s.environmentIntensity = 0.25

    // ═════════ the hall: rubber floor, panelled + brick walls, steel trusses, LED ceiling, mirrors, posters ═════════
    const B = new StaticBatch()
    const D: (THREE.Material | THREE.BufferGeometry | THREE.Texture)[] = []
    const floorTex = rubberFloorTexture(D)
    floorTex.repeat.set(9, 7.5)
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.86, metalness: 0 })
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 15), floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.position.z = 0.9
    floor.receiveShadow = true
    s.add(floor)
    // painted zone lines (orange, slightly worn)
    const lineMat = new THREE.MeshStandardMaterial({ color: '#c9561a', roughness: 0.7 })
    const line = (x: number, z: number, w: number, d: number) => B.put(new THREE.BoxGeometry(w, 0.004, d), lineMat, x, 0.003, z, 0, 1, 1, 1, { cast: false })
    for (const [x0, x1, z0, z1] of [[-1.95, 1.95, -4.15, -0.25], [-7.9, 7.9, -5.6, 5.6]] as const) {
      line((x0 + x1) / 2, z0, x1 - x0, 0.06)
      line((x0 + x1) / 2, z1, x1 - x0, 0.06)
      line(x0, (z0 + z1) / 2, 0.06, z1 - z0)
      line(x1, (z0 + z1) / 2, 0.06, z1 - z0)
    }
    // platform for the Chad Press
    const woodTex = woodTexture(D)
    woodTex.repeat.set(2, 1)
    const platformMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.55 })
    const platform = new THREE.Mesh(new RoundedBoxGeometry(3.6, 0.12, 3.6, 2, 0.03), platformMat)
    platform.position.set(PRESS.x, 0.06, PRESS.z)
    platform.receiveShadow = true
    s.add(platform)

    const H = 6.6 // ceiling height
    const brickTex = brickTexture(D)
    const panelTex = panelTexture(D)
    const wallMat = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.92, metalness: 0 })
    const wainscotMat = new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.6, metalness: 0.3 })
    const trimMat = new THREE.MeshStandardMaterial({ color: '#ff7a1a', emissive: '#ff6a10', emissiveIntensity: 0.35, roughness: 0.4 })
    const steelMat = new THREE.MeshStandardMaterial({ color: '#2b2930', metalness: 0.85, roughness: 0.38 })
    // brick upper walls: UVs scaled so 1 texture = 2 m
    const wall = (w: number, h: number, x: number, y: number, z: number, ry: number) => {
      const g = new THREE.PlaneGeometry(w, h)
      const uv = g.attributes.uv as THREE.BufferAttribute
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 2, (uv.getY(i) * h) / 2)
      B.put(g, wallMat, x, y, z, ry, 1, 1, 1, { cast: false })
    }
    wall(18, H, 0, H / 2, -6, 0)
    wall(15, H, -9, H / 2, 1.5, Math.PI / 2)
    wall(15, H, 9, H / 2, 1.5, -Math.PI / 2)
    wall(7.5, H, -5.25, H / 2, 7.6, Math.PI)
    wall(7.5, H, 5.25, H / 2, 7.6, Math.PI)
    wall(3, H - 3, 0, 3 + (H - 3) / 2, 7.6, Math.PI)
    // panelled dado (lower 1.2 m) + glowing orange trim rail
    const dado = (w: number, x: number, z: number, ry: number) => {
      const g = boxUV(w, 1.2, 0.06, 1)
      B.put(g, wainscotMat, x, 0.6, z, ry, 1, 1, 1, { cast: false })
      B.put(new THREE.BoxGeometry(w, 0.05, 0.08), trimMat, x, 1.22, z, ry, 1, 1, 1, { cast: false })
    }
    dado(18, 0, -5.97, 0)
    dado(15, -8.97, 1.5, Math.PI / 2)
    dado(15, 8.97, 1.5, Math.PI / 2)
    dado(7.5, -5.25, 7.57, 0)
    dado(7.5, 5.25, 7.57, 0)
    // steel pilasters with bolt plates
    const pilaster = (x: number, z: number, ry: number) => {
      B.put(new THREE.BoxGeometry(0.34, H, 0.2), steelMat, x, H / 2, z, ry)
      for (const y of [1.25, H - 0.4]) B.put(new THREE.BoxGeometry(0.46, 0.08, 0.24), steelMat, x, y, z, ry)
    }
    for (const x of [-7.2, -3.8, 3.8, 7.2]) pilaster(x, -5.9, 0)
    for (const z of [-3, 0.5, 4]) {
      pilaster(-8.9, z, Math.PI / 2)
      pilaster(8.9, z, Math.PI / 2)
    }
    // ceiling + trusses + LED panels (emissive, so bloom gives them a soft glow)
    const ceilMat = new THREE.MeshStandardMaterial({ color: '#0e0d11', roughness: 1 })
    B.put(new THREE.PlaneGeometry(18, 15).rotateX(Math.PI / 2), ceilMat, 0, H, 0.9, 0, 1, 1, 1, { cast: false })
    const ledMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff1dc').multiplyScalar(2.4), toneMapped: false })
    for (const z of [-4.2, -0.8, 2.6, 6]) {
      B.put(new THREE.BoxGeometry(18, 0.32, 0.14), steelMat, 0, H - 0.2, z, 0, 1, 1, 1, { cast: false })
      for (let k = 0; k < 9; k++) B.put(new THREE.BoxGeometry(0.06, 0.06, 0.14), steelMat, -8 + k * 2, H - 0.42, z, 0.6, 1, 1, 1, { cast: false })
    }
    for (const z of [-2.5, 0.9, 4.3])
      for (const x of [-5.5, 0, 5.5]) {
        B.put(new THREE.BoxGeometry(2.6, 0.08, 0.5), steelMat, x, H - 0.55, z, 0, 1, 1, 1, { cast: false })
        B.put(new THREE.BoxGeometry(2.5, 0.02, 0.4), ledMat, x, H - 0.6, z, 0, 1, 1, 1, { cast: false })
        for (const dx of [-1, 1]) B.put(new THREE.CylinderGeometry(0.006, 0.006, 0.5, 4), steelMat, x + dx, H - 0.28, z, 0, 1, 1, 1, { cast: false })
      }
    // mirrors behind the bench and the dumbbells (the PMREM environment gives them a believable sheen)
    // own envMap (the hall's global environment is dimmed to 0.25), so the glass actually catches the light
    const mirrorMat = new THREE.MeshStandardMaterial({ color: '#8d97a2', metalness: 1, roughness: 0.05, envMap: engine.env, envMapIntensity: 1.0 })
    const mirror = (w: number, x: number, z: number, ry: number) => {
      B.put(new THREE.BoxGeometry(w + 0.1, 2.3, 0.04), steelMat, x, 1.55, z, ry, 1, 1, 1, { cast: false })
      B.put(new THREE.PlaneGeometry(w, 2.2), mirrorMat, x + Math.sin(ry) * 0.025, 1.55, z + Math.cos(ry) * 0.025, ry, 1, 1, 1, { cast: false })
    }
    mirror(3.6, -8.92, -3.0, Math.PI / 2)
    mirror(3.2, 8.92, -3.1, -Math.PI / 2)
    // PumpChad art on the walls
    const posters: [string, number, number, number, number, number, number][] = [
      ['art/chadverse/01-pumpchad-throne.webp', 1.15, 1.45, 8.93, 2.9, 2.2, -Math.PI / 2],
      ['art/chadverse/05-pumpchad-army.webp', 1.6, 1.15, 8.93, 3.1, 5.6, -Math.PI / 2],
      ['art/chadverse/04-pumpchad-charts-to-cars.webp', 1.6, 1.15, -8.93, 3.1, 3.2, Math.PI / 2],
      ['art/chadverse/02-pumpchad-trading-room.webp', 1.5, 1.05, -6.2, 3.3, -5.93, 0],
      ['art/chadverse/03-pumpchad-bears-buried.webp', 1.5, 1.05, 6.2, 3.3, -5.93, 0],
    ]
    for (const [url, w, h, x, y, z, ry] of posters) {
      const pst = poster(url, w, h, D)
      pst.position.set(x, y, z)
      pst.rotation.y = ry
      s.add(pst)
    }
    // the brand mark over the door (seen when you turn to leave)
    {
      const logoMat = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, color: new THREE.Color(1.3, 1.3, 1.3) })
      const logo = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), logoMat)
      logo.position.set(0, 4.65, 7.55)
      logo.rotation.y = Math.PI
      s.add(logo)
      new THREE.TextureLoader().load(import.meta.env.BASE_URL + 'art/pumpchad-logo.webp', (t) => {
        t.colorSpace = THREE.SRGBColorSpace
        logoMat.map = t
        logoMat.needsUpdate = true
      })
    }
    // door glow + exit sign
    const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.9), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb36b').multiplyScalar(1.6), toneMapped: false }))
    doorGlow.position.set(0, 1.45, 7.7)
    doorGlow.rotation.y = Math.PI
    s.add(doorGlow)
    B.put(new THREE.BoxGeometry(3.2, 0.16, 0.2), steelMat, 0, 3.0, 7.55)
    for (const x of [-1.55, 1.55]) B.put(new THREE.BoxGeometry(0.16, 3.0, 0.2), steelMat, x, 1.5, 7.55)
    const exitSign = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.42), new THREE.MeshBasicMaterial({ map: signTexture('EXIT', { sub: 'CHAD SQUARE' }), toneMapped: false, color: new THREE.Color(2.2, 2.2, 2.2) }))
    exitSign.position.set(0, 3.4, 7.42)
    exitSign.rotation.y = Math.PI
    s.add(exitSign)

    // neon strips + the big sign
    this.strip = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7a1a').multiplyScalar(3.6), toneMapped: false })
    for (const y of [0.4, 5.6]) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(18, 0.05, 0.05), this.strip)
      st.position.set(0, y, -5.92)
      s.add(st)
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), new THREE.MeshBasicMaterial({ map: signTexture('CHAD GYM', { sub: 'NO PAIN · NO PUMP' }), toneMapped: false, color: new THREE.Color(2.7, 2.7, 2.7) }))
    sign.position.set(0, 4.5, -5.93)
    s.add(sign)

    // ═════════ materials for the kit ═════════
    const iron = steelMat
    const rubber = new THREE.MeshStandardMaterial({ color: '#141316', roughness: 0.78 })
    const chrome = new THREE.MeshStandardMaterial({ color: '#e2ddd3', metalness: 1, roughness: 0.18 })
    const knurlMat = new THREE.MeshStandardMaterial({ map: knurlTexture(D), color: '#d6d2c8', metalness: 1, roughness: 0.42 })
    const orange = new THREE.MeshStandardMaterial({ color: '#ff7a1a', roughness: 0.55 })
    const plateSteel = new THREE.MeshStandardMaterial({ color: '#b8b4ac', metalness: 1, roughness: 0.3 })
    const padMat = new THREE.MeshStandardMaterial({ map: leatherTexture('#2a1d22', D), roughness: 0.48, metalness: 0.05 })
    const mat = new THREE.MeshStandardMaterial({ color: '#141317', roughness: 0.95 })
    const uprightMat = new THREE.MeshStandardMaterial({ map: uprightTexture(D), metalness: 0.75, roughness: 0.4 })
    const MAT = { chrome, knurl: knurlMat, rubber, orange, steel: plateSteel }
    const cast = <T extends THREE.Object3D>(o: T) => {
      o.traverse((c) => (c.castShadow = true))
      return o
    }
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
      const o = new THREE.Mesh(g, m)
      o.position.set(x, y, z)
      return o
    }

    // plate trees (replace the old plate stacks): base, post, pegs, bumpers hung on edge
    for (const x of [-2.6, 2.6]) {
      const z = -5.15
      B.put(new THREE.BoxGeometry(0.9, 0.06, 0.6), iron, x, 0.03, z)
      B.put(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 10), iron, x, 0.68, z)
      for (const [y, side, r] of [[0.32, -1, 0.25], [0.32, 1, 0.25], [0.72, -1, 0.2], [0.72, 1, 0.2], [1.08, -1, 0.15], [1.08, 1, 0.15]] as const) {
        B.put(new THREE.CylinderGeometry(0.022, 0.022, 0.22, 8).rotateX(Math.PI / 2), iron, x, y, z + side * 0.1)
        B.put(bumperGeo(r, 0.055).rotateY(Math.PI / 2), r > 0.22 ? orange : rubber, x, y, z + side * 0.2)
        B.put(hubGeo(0.055).rotateY(Math.PI / 2), plateSteel, x, y, z + side * 0.2)
      }
    }
    // kettlebells along the back wall
    {
      const [kb, kh] = kettlebellGeo()
      for (let i = 0; i < 6; i++) {
        const sc = 0.8 + i * 0.07
        B.put(kb, rubber, -6.8 + i * 0.42, 0, -5.55, 0, sc, sc, sc)
        B.put(kh, iron, -6.8 + i * 0.42, 0, -5.55, 0, sc, sc, sc)
      }
      B.put(new THREE.BoxGeometry(2.7, 0.04, 0.5), iron, -5.75, 0.02, -5.55)
    }
    // lockers + water cooler by the door, speakers on the pilasters
    {
      const lockerMat = new THREE.MeshStandardMaterial({ color: '#232029', metalness: 0.6, roughness: 0.45 })
      for (let i = 0; i < 6; i++) {
        B.put(new RoundedBoxGeometry(0.5, 1.9, 0.5, 1, 0.02), lockerMat, -8.4 + i * 0.52, 0.95, 7.25)
        B.put(new THREE.BoxGeometry(0.3, 0.02, 0.01), trimMat, -8.4 + i * 0.52, 1.72, 6.995)
        B.put(new THREE.BoxGeometry(0.04, 0.12, 0.02), chrome, -8.4 + i * 0.52 + 0.17, 1.05, 6.995)
      }
      B.put(new RoundedBoxGeometry(0.42, 1.1, 0.42, 2, 0.05), new THREE.MeshStandardMaterial({ color: '#e8e4dc', roughness: 0.4 }), 7.6, 0.55, 7.15)
      B.put(new THREE.CylinderGeometry(0.15, 0.15, 0.42, 16), new THREE.MeshStandardMaterial({ color: '#7fc4ff', transparent: true, opacity: 0.55, roughness: 0.1 }), 7.6, 1.32, 7.15)
      for (const x of [-7.2, 7.2]) B.put(new RoundedBoxGeometry(0.4, 0.62, 0.3, 2, 0.04), rubber, x, 5.0, -5.68)
      this.boxes.push({ x0: -8.7, x1: -5.4, z0: 6.9, z1: 7.6 }, { x0: 7.3, x1: 7.9, z0: 6.85, z1: 7.45 })
    }

    // rubber mats under each station
    for (const k of ['bench', 'curl', 'squat', 'bag', 'deadlift'] as const) {
      const [x, z] = SPOTS[k].stand
      const m = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.03, 3, 1, 0.012), mat)
      m.position.set(x, 0.015, z)
      m.receiveShadow = true
      s.add(m)
    }

    // barbell builder: knurled shaft, sleeves, flanges, bevelled bumpers with steel hubs, spring collars
    const barbell = (g: THREE.Group, len = 2.1, plates: { r: number; w: number; color: 'black' | 'orange' }[] = [{ r: 0.25, w: 0.07, color: 'orange' }, { r: 0.21, w: 0.05, color: 'black' }]) => {
      for (const part of barbellParts(len, plates)) {
        const m = new THREE.Mesh(part.geo, MAT[part.mat])
        m.position.x = part.x
        g.add(m)
      }
      return cast(g)
    }
    barbell(this.bar)
    s.add(this.bar)

    // ── bench press: tube frame, rounded leather pad, uprights with J-hooks; bar racked above the head end ──
    {
      const [x, z] = SPOTS.bench.stand
      const g = new THREE.Group()
      const pad = new THREE.Mesh(roundedPad(0.34, 0.11, 1.3), padMat)
      pad.position.set(0, 0.47, 0.05)
      g.add(pad)
      const V = (a: number, b: number, c: number) => new THREE.Vector3(a, b, c)
      for (const [a, b] of [
        [V(0, 0.04, -0.5), V(0, 0.41, -0.5)],
        [V(0, 0.04, 0.55), V(0, 0.41, 0.55)],
        [V(0, 0.41, -0.55), V(0, 0.41, 0.6)],
        [V(-0.26, 0.03, -0.5), V(0.26, 0.03, -0.5)],
        [V(-0.26, 0.03, 0.55), V(0.26, 0.03, 0.55)],
      ] as const)
        g.add(new THREE.Mesh(tube(a, b, 0.032), iron))
      for (const sx of [-0.55, 0.55]) {
        g.add(new THREE.Mesh(tube(V(sx, 0.03, -0.72), V(sx, 1.27, -0.72), 0.034), uprightMat))
        g.add(new THREE.Mesh(tube(V(sx, 0.03, -0.72), V(sx * 0.5, 0.03, -0.72), 0.03), iron))
        const hook = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 6, 12, Math.PI), orange)
        hook.rotation.set(0, Math.PI / 2, Math.PI)
        hook.position.set(sx, 1.06, -0.66)
        g.add(hook)
      }
      g.position.set(x, 0, z)
      s.add(cast(g))
      barbell(this.benchBar, 1.8, [{ r: 0.225, w: 0.06, color: 'orange' }])
      this.benchBar.position.set(x, 1.1, z - 0.66)
      s.add(this.benchBar)
      this.boxes.push({ x0: x - 0.62, x1: x + 0.62, z0: z - 0.8, z1: z + 0.65 })
    }
    // ── dumbbell rack: two angled tiers of hex dumbbells ──
    {
      const [x, z] = SPOTS.curl.stand
      const rz = z - 1.25
      const V = (a: number, b: number, c: number) => new THREE.Vector3(a, b, c)
      for (const sx of [-0.85, 0, 0.85]) {
        B.put(tube(V(x + sx, 0, rz - 0.2), V(x + sx, 0.78, rz - 0.12), 0.03), iron, 0, 0, 0)
        B.put(tube(V(x + sx, 0, rz + 0.2), V(x + sx, 0.5, rz + 0.2), 0.03), iron, 0, 0, 0)
      }
      B.put(new THREE.BoxGeometry(1.8, 0.04, 0.26).rotateX(0.25), iron, x, 0.74, rz - 0.1)
      B.put(new THREE.BoxGeometry(1.8, 0.04, 0.26).rotateX(0.25), iron, x, 0.46, rz + 0.16)
      const sizes = [0.042, 0.048, 0.054, 0.06, 0.066]
      sizes.forEach((h, i) => {
        for (const tier of [0, 1]) {
          if (tier === 1 && i > 2) continue
          const px = x - 0.7 + i * 0.34 + (tier ? 0.18 : 0)
          const py = tier ? 0.82 : 0.54
          const pz = tier ? rz - 0.1 : rz + 0.16
          const isHeld = i === 2 && tier === 0
          const grp = new THREE.Group()
          for (const part of hexDumbbellParts(h)) {
            const m = new THREE.Mesh(part.geo, MAT[part.mat])
            m.position.x = part.x
            grp.add(m)
          }
          grp.position.set(px, py, pz)
          grp.rotation.y = Math.PI / 2
          if (isHeld) {
            // this pair leaves the rack while curling
            for (const side of [-1, 1]) {
              const c = grp.clone()
              c.position.x = px + side * 0.08
              s.add(cast(c))
              this.rackBells.push(c)
            }
          } else {
            B.absorb(grp)
          }
        }
      })
      // the pair in your hands
      for (let i = 0; i < 2; i++) {
        const bgrp = new THREE.Group()
        for (const part of hexDumbbellParts(0.054)) {
          const m = new THREE.Mesh(part.geo, MAT[part.mat])
          m.position.x = part.x
          bgrp.add(m)
        }
        bgrp.visible = false
        s.add(cast(bgrp))
        this.bells.push(bgrp)
      }
      this.boxes.push({ x0: x - 0.95, x1: x + 0.95, z0: z - 1.5, z1: z - 1.0 })
    }
    // ── squat rack: four drilled uprights, crossmembers, safeties, J-hooks, plate storage ──
    {
      const [x, z] = SPOTS.squat.stand
      const V = (a: number, b: number, c: number) => new THREE.Vector3(a, b, c)
      for (const sx of [-0.7, 0.7])
        for (const dz of [-0.55, 0.55]) {
          const up = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.3, 0.08), uprightMat)
          up.position.set(x + sx, 1.15, z + dz)
          up.castShadow = true
          s.add(up)
          B.put(new THREE.BoxGeometry(0.2, 0.02, 0.2), iron, x + sx, 0.01, z + dz)
        }
      for (const sx of [-0.7, 0.7]) {
        B.put(new THREE.BoxGeometry(0.08, 0.08, 1.18), iron, x + sx, 2.3, z)
        B.put(tube(V(x + sx, 0.62, z - 0.58), V(x + sx, 0.62, z + 0.58), 0.025), chrome, 0, 0, 0) // safeties
        B.put(new THREE.BoxGeometry(0.1, 0.06, 0.14), orange, x + sx, 1.42, z + 0.5) // J-hooks
        B.put(tube(V(x + sx, 0.4, z - 0.55), V(x + sx * 1.45, 0.4, z - 0.55), 0.025), iron, 0, 0, 0) // plate peg
        B.put(bumperGeo(0.25, 0.07), orange, x + sx * 1.36, 0.4, z - 0.55)
        B.put(hubGeo(0.07), plateSteel, x + sx * 1.36, 0.4, z - 0.55)
      }
      B.put(new THREE.BoxGeometry(1.48, 0.08, 0.08), iron, x, 2.3, z - 0.55)
      B.put(tube(V(x - 0.7, 2.24, z + 0.55), V(x + 0.7, 2.24, z + 0.55), 0.018), knurlMat, 0, 0, 0) // chin-up bar on top
      barbell(this.squatBar, 1.9, [{ r: 0.25, w: 0.07, color: 'orange' }, { r: 0.21, w: 0.05, color: 'black' }])
      this.squatBar.position.set(x, 1.48, z + 0.5)
      s.add(this.squatBar)
      for (const sx of [-0.7, 0.7]) for (const dz of [-0.55, 0.55]) this.boxes.push({ x0: x + sx - 0.1, x1: x + sx + 0.1, z0: z + dz - 0.1, z1: z + dz + 0.1 })
    }
    // ── heavy bag: stitched leather, caps, swivel and a real chain ──
    {
      B.put(new THREE.BoxGeometry(0.16, 0.2, 2.6), iron, BAG.x, 5.9, BAG.z)
      const leather = new THREE.MeshStandardMaterial({ map: leatherTexture('#6e1a12', D), roughness: 0.5, metalness: 0.05 })
      const link = new THREE.TorusGeometry(0.03, 0.007, 6, 12)
      const body = mesh(new THREE.CylinderGeometry(0.27, 0.25, 1.15, 28), leather, 0, -2.8, 0)
      const capTop = mesh(new THREE.CylinderGeometry(0.2, 0.27, 0.08, 28), rubber, 0, -2.2, 0)
      const capBot = mesh(new THREE.SphereGeometry(0.25, 24, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), leather, 0, -3.37, 0)
      const band = mesh(new THREE.CylinderGeometry(0.275, 0.275, 0.12, 28), orange, 0, -2.55, 0)
      const band2 = mesh(new THREE.CylinderGeometry(0.262, 0.262, 0.05, 28), orange, 0, -3.25, 0)
      const swivel = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 10), chrome, 0, -2.1, 0)
      // chain between the beam (y 1.75 above the bag pivot) and the top cap
      const ch = new THREE.Group()
      for (let i = 0; i < 40; i++) {
        const l = new THREE.Mesh(link, chrome)
        l.position.y = -0.04 - i * 0.05
        l.rotation.y = i % 2 ? Math.PI / 2 : 0
        l.scale.set(1, 1.4, 1)
        ch.add(l)
      }
      this.bag.add(ch, swivel, body, capTop, capBot, band, band2)
      this.bag.position.set(BAG.x, 4.15, BAG.z)
      s.add(cast(this.bag))
      this.boxes.push({ x0: BAG.x - 0.32, x1: BAG.x + 0.32, z0: BAG.z - 0.32, z1: BAG.z + 0.32 })
    }

    // ── deadlift platform: oak centre, rubber wings, bar loaded on the floor ──
    {
      const [x, z] = SPOTS.deadlift.stand
      const g = new THREE.Group()
      const oak = new THREE.MeshStandardMaterial({ map: woodTexture(D), roughness: 0.55 })
      g.add(mesh(new RoundedBoxGeometry(1.0, 0.045, 2.4, 1, 0.01), oak, 0, 0.022, 0.1))
      for (const sx of [-0.9, 0.9]) g.add(mesh(new RoundedBoxGeometry(0.8, 0.045, 2.4, 1, 0.01), rubber, sx, 0.022, 0.1))
      g.add(mesh(new THREE.BoxGeometry(2.62, 0.05, 0.05), iron, 0, 0.025, -1.12), mesh(new THREE.BoxGeometry(2.62, 0.05, 0.05), iron, 0, 0.025, 1.32))
      g.position.set(x, 0, z)
      g.traverse((o) => (o.receiveShadow = true))
      s.add(g)
      barbell(this.deadBar, 2.0)
      this.deadBar.position.set(x, DL_FLOOR_Y, z + 0.28)
      s.add(this.deadBar)
    }
    // ── pull-up station: tubular frame, knurled chrome bar, braced feet with rubber pads ──
    {
      const [x, z0] = SPOTS.pullup.stand
      const z = z0 + PULL_BAR_FWD
      const V = (a: number, b: number, c: number) => new THREE.Vector3(a, b, c)
      for (const sx of [-0.66, 0.66]) {
        B.put(tube(V(x + sx, 0.02, z), V(x + sx, PULL_BAR_Y + 0.12, z), 0.045, 10), iron, 0, 0, 0)
        B.put(tube(V(x + sx, 0.04, z - 0.55), V(x + sx, 0.04, z + 0.55), 0.04, 8), iron, 0, 0, 0)
        B.put(tube(V(x + sx, 0.04, z - 0.5), V(x + sx, 1.3, z), 0.03, 8), iron, 0, 0, 0)
        B.put(tube(V(x + sx, 0.04, z + 0.5), V(x + sx, 1.3, z), 0.03, 8), iron, 0, 0, 0)
        for (const dz of [-0.55, 0.55]) B.put(new RoundedBoxGeometry(0.14, 0.04, 0.14, 1, 0.015), rubber, x + sx, 0.02, z + dz)
      }
      B.put(tube(V(x - 0.7, PULL_BAR_Y, z), V(x + 0.7, PULL_BAR_Y, z), 0.019, 14), knurlMat, 0, 0, 0)
      B.put(tube(V(x - 0.7, PULL_BAR_Y + 0.12, z), V(x + 0.7, PULL_BAR_Y + 0.12, z), 0.035, 10), orange, 0, 0, 0)
      for (const sx of [-0.66, 0.66]) this.boxes.push({ x0: x + sx - 0.08, x1: x + sx + 0.08, z0: z - 0.55, z1: z + 0.55 })
    }
    // ── treadmill along the west wall: rounded deck, scrolling belt, rails, lit console ──
    {
      const [x, z] = SPOTS.treadmill.stand
      const g = new THREE.Group()
      const L = 2.1
      g.add(mesh(new RoundedBoxGeometry(L, 0.16, 0.86, 2, 0.04), iron, 0, 0.08, 0))
      const c = document.createElement('canvas')
      c.width = 32
      c.height = 128
      const cx = c.getContext('2d')!
      cx.fillStyle = '#1c1b1e'
      cx.fillRect(0, 0, 32, 128)
      cx.fillStyle = '#2b292e'
      for (let i = 0; i < 128; i += 16) cx.fillRect(0, i, 32, 5)
      const tex = new THREE.CanvasTexture(c)
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping
      tex.repeat.set(1, 6)
      tex.colorSpace = THREE.SRGBColorSpace
      this.belt = tex
      const belt = new THREE.Mesh(new THREE.PlaneGeometry(0.62, this.beltLen), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }))
      belt.rotation.x = -Math.PI / 2
      belt.rotation.z = Math.PI / 2
      belt.position.set(0, 0.165, 0)
      belt.receiveShadow = true
      g.add(belt)
      const V = (a: number, b: number, cc: number) => new THREE.Vector3(a, b, cc)
      for (const sz of [-0.4, 0.4]) {
        g.add(new THREE.Mesh(tube(V(0.82, 0.12, sz), V(0.9, 1.15, sz), 0.03), iron))
        g.add(new THREE.Mesh(tube(V(0.0, 1.05, sz), V(0.88, 1.08, sz), 0.022), chrome))
      }
      const con = mesh(new RoundedBoxGeometry(0.18, 0.36, 0.9, 2, 0.04), iron, 0.92, 1.25, 0)
      con.rotation.z = 0.35
      g.add(con)
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.19), new THREE.MeshBasicMaterial({ map: consoleTexture(D), toneMapped: false, color: new THREE.Color(1.8, 1.8, 1.8) }))
      screen.position.set(0.82, 1.29, 0)
      screen.rotation.set(0, -Math.PI / 2, 0)
      screen.rotateX(-0.35)
      g.add(screen)
      g.position.set(x + 0.2, 0, z)
      s.add(cast(g))
      this.boxes.push({ x0: x + 0.2 - L / 2, x1: x + 0.2 + L / 2 - 0.15, z0: z - 0.48, z1: z + 0.48 })
    }
    B.build(s, true)

    // rep feedback ring under the active lifter
    this.ringMat = new THREE.MeshBasicMaterial({ color: '#ff7a1a', transparent: true, opacity: 0, toneMapped: false, depthWrite: false })
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.66, 40), this.ringMat)
    this.ring.rotation.x = -Math.PI / 2
    this.ring.position.y = 0.03
    s.add(this.ring)

    // lighting: overhead key + orange rim + fill over the stations
    s.add(new THREE.HemisphereLight('#5a4a62', '#1a100a', 0.85))
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
    for (const id of ['press', 'bench', 'curl', 'squat', 'bag', 'deadlift', 'pullup', 'treadmill'] as const) {
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
    if (this.belt) this.belt.offset.y -= ((this.mode === 'treadmill' ? this.pace : 0) * dt * this.belt.repeat.y) / this.beltLen

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

  dispose() {
    this.disposed = true
    this.events?.onPrompt(null)
    if (this.player) disposeCharacter(this.player)
    if (this.coach) disposeCharacter(this.coach)
    disposeObject(this.scene)
  }
}
