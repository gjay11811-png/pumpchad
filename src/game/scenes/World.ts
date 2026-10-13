import * as THREE from 'three'
import { Emoter, type EmoteId } from '../emotes'
import { Jumper, OUTDOOR, SPEED_UNIT, leanFor, targetSpeed, turnRate, velocityRate } from '../movement'
import { buildCharacter } from '../character/build'
import { createCharacter, disposeCharacter, type Character } from '../character/character'
import type { Appearance } from '../character/types'
import { audio } from '../audio'
import { disposeObject, type Engine, type GameScene } from '../engine/Engine'
import type { Input } from '../input'
import type { Quality } from '../save'
import { arcade, entranceArch, forge, hollowHouse, house, stripeMats, tavern, type Collider, type Town } from './world/buildings'
import { Leaves, Particles, type Fire, type Cloth } from './world/fx'
import { StaticBatch, makePalette } from './world/kit'
import { Crowd, RESIDENTS } from './world/npcs'
import { CASTLE_Z, ROADS, buildGround, castle, clutter, fence, gym, lampPosts, poles, stringLights, vegetation } from './world/props'
import { BENCHES, CITY_SIGN, kingdom, mountains, valleyRoad } from './world/kingdom'
import { B4S_BENCH, PLAZA_BENCHES, SEAT_FWD } from './world/props'

/** every bench the player can sit on: the lookout benches + the plaza benches b4s isn't using */
/** the three talking pumpkins (one-time discoveries; all three → Gourd Council) */
const GOURDS = [
  { id: 'gourd_1', name: 'Sage Gourd', x: -8.4, z: 16.0, r: 0.36, face: 3, facing: Math.PI / 2 + 0.4 },
  { id: 'gourd_2', name: 'Grumpy Gourd', x: -28.8, z: -5.2, r: 0.33, face: 1, facing: Math.PI / 4 },
  { id: 'gourd_3', name: 'Tiny Gourd', x: 3.7, z: -24.6, r: 0.18, face: 2, facing: 0 },
]

const SEATS = [
  ...BENCHES.map((b) => ({ x: b.x, z: b.z, ry: b.ry, label: 'Sit and watch Chad City' })),
  ...PLAZA_BENCHES.filter((_, i) => i !== B4S_BENCH).map((b) => ({ x: b.x, z: b.z, ry: b.ry, label: 'Sit by the fountain' })),
]
import { buildChadCity } from './world/skyline'
import { kingdomStyle, styleMaterials } from './world/style'
import * as TX from './world/textures'
import { RushGame } from '../minigames/pumpkinRush'
import { flowerTexture } from './world/foliage'
import { fountainV4 } from './world/fountain'
import { fingerpost } from './world/wayfinding'
import { PumpkinBuilder } from './world/pumpkins'
import { stallV4 } from './world/market'

export type Interactable = { id: string; label: string; pos: THREE.Vector3; radius: number; kind: 'talk' | 'activity' | 'info' | 'collect' | 'secret' }
export type WorldEvents = {
  onPrompt(p: Interactable | null): void
  onInteract(id: string): void
}

const BOUNDS = 34.5
/** the Pumpkin Rush cart (start point of the mini-game) on the plaza */
export const RUSH_CART = { x: 10.2, z: 10.4 }
const PLAYER_R = 0.45

/** Golden seed collectibles (5). Positions reward alleys, dead ends and the spooky corner. */
export const SEEDS: [string, number, number][] = [
  ['seed_1', -20.4, 24.8], // alley behind the tavern
  ['seed_2', 26.6, -21.6], // among the Hollow House graves
  ['seed_3', -30.4, -2.3], // behind the crates at the end of Market Row
  ['seed_4', -14.5, -18.3], // behind the forge
  ['seed_5', 18.6, 21.5], // round the back of the arcade
]

/** Walkable height: castle steps, tavern porch, fountain step. */
export function groundHeight(x: number, z: number) {
  if (x > -4.5 && x < 4.5 && z < -24.4 && z > -29.6) return Math.min(4, Math.floor((-24.4 - z) / 1.05) + 1) * 0.22
  if (x > -8.5 && x < -5.5 && z > 13.8 && z < 24.2) return 0.3
  if (x >= -5.5 && x < -4.9 && z > 17.6 && z < 20.4) return 0.15
  const r = Math.hypot(x, z)
  if (r < 6.45) return r < 5.9 ? 0.55 : 0.25
  return 0
}

export class World implements GameScene {
  scene = new THREE.Scene()
  // far plane reaches the Chad City skyline (~330 m) and the mountains beyond it
  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 950)
  bloom = 0.6
  player: Character | null = null
  private playerPos = new THREE.Vector3(0, 0, 19.5)
  private playerVel = new THREE.Vector3()
  private playerYaw = Math.PI
  private camYaw = 0
  private camPitch = 0.3
  private camDist = 6.4
  private camDistNow = 6.4
  private camTarget = new THREE.Vector3()
  private colliders: Collider[] = []
  /** camera-only obstacles: things you can walk under but the lens must not pass through */
  private camBlockers: Collider[] = [
    { kind: 'box', minX: -4.4, maxX: 4.4, minZ: 27.05, maxZ: 27.95, h: 5.2 }, // entrance arch
    { kind: 'box', minX: -9, maxX: -5.1, minZ: 13.6, maxZ: 24.4, h: 3.7 }, // tavern porch roof
  ]
  interactables: Interactable[] = []
  private prompt: Interactable | null = null
  private crowd = new Crowd()
  private oddPumpkin!: THREE.Group
  private boingT = -1
  private stash!: THREE.Group
  private stashT = -1
  private seeds = new Map<string, THREE.Group>()
  private markers = new Map<string, THREE.Mesh>()
  private fires: Fire[] = []
  private cloths: Cloth[] = []
  private dynamic: { update(t: number, dt: number): void }[] = []
  private smoke: Particles | null = null
  private embers: Particles | null = null
  private leaves: Leaves | null = null
  private city: ReturnType<typeof buildChadCity> | null = null
  private disposables: (THREE.Material | THREE.Texture | THREE.BufferGeometry)[] = []
  paused = false
  private actionCooldown = 0
  /** time of the last manual camera drag (auto-follow waits a moment after it) */
  private lastLookT = -10
  /** sitting on a lookout bench: sit-down clip → seated loop → stand-up clip */
  private seat: { b: number; phase: 'enter' | 'sit' | 'exit'; t: number; dur: number } | null = null
  /** movement locked while a full-body action plays (picking up a seed) */
  private lockT = 0
  private pendingHide: { g: THREE.Object3D; t: number } | null = null
  /** sparkle markers over the not-yet-found talking pumpkins */
  private gourdMarks = new Map<string, THREE.Object3D>()
  /** Pumpkin Rush mini-game (lives in the square; the UI drives start / stop) */
  rush!: RushGame
  cameraSensitivity = 1
  private t = 0
  private disposed = false
  private walkedTime = 0
  private jumper = new Jumper()
  private lastSpeed = 0
  emoter = new Emoter()
  private quality: Quality

  constructor(
    private engine: Engine,
    private input: Input,
    private events: WorldEvents,
    quality: Quality,
  ) {
    this.quality = quality
    const s = this.scene
    s.background = new THREE.Color('#0b0912')
    s.fog = new THREE.FogExp2('#110c16', quality === 'low' ? 0.03 : 0.024)
    s.environment = engine.env
    s.environmentIntensity = 0.16
    this.buildTown(quality)
    this.camYaw = this.playerYaw + Math.PI
  }

  /* ───────────────────────── town assembly ───────────────────────── */

  private buildTown(q: Quality) {
    const cob = TX.cobble()
    const plz = TX.plaza()
    const tex: Record<string, THREE.Texture> = {
      cobble: cob.map,
      cobbleBump: cob.bump,
      plaza: plz.map,
      plazaBump: plz.bump,
      ground: TX.ground(),
      plaster: TX.plaster(),
      wood: TX.wood(),
      roof: TX.roof(),
      stone: stoneBlocks(),
      flowers: flowerTexture([]),
    }
    const P = makePalette(tex)
    Object.values(tex).forEach((t) => this.disposables.push(t))
    Object.values(P).forEach((m) => this.disposables.push(m))
    const T: Town = { batch: new StaticBatch(), P, scene: this.scene, colliders: this.colliders, smoke: [], embers: [], fires: [], cloths: [], lights: [], dynamic: [], disposables: this.disposables, pumpkins: new PumpkinBuilder() }

    this.buildSky()
    buildGround(T, tex)

    // ── central landmark: the Pump Fountain with the golden King ──
    const king = buildCharacter({ species: 'pumpkin', skin: '#e8741c', outfit: '#141216', glow: '#ffb347', top: 'shirtless', headwear: 'crown', eyewear: 'shades', chain: true })
    const gold = new THREE.MeshPhysicalMaterial({ color: '#e0a83e', metalness: 1, roughness: 0.25, clearcoat: 0.5 })
    this.disposables.push(gold)
    king.root.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh && !(m.material instanceof THREE.MeshBasicMaterial)) {
        ;(m.material as THREE.Material).dispose()
        m.material = gold
      }
    })
    king.pose = 'flex'
    for (let i = 0; i < 30; i++) king.update(0.1)
    const wn = TX.waterNormal()
    this.disposables.push(wn)
    fountainV4(T, king.root, wn)
    king.root.traverse((o) => (o as THREE.Mesh).geometry?.dispose())

    // ── districts ──
    const style = kingdomStyle()
    const SM = styleMaterials(style, tex, this.disposables)
    castle(T, style, SM)
    gym(T)
    tavern(T, -12, 19, 'e')
    forge(T, -16, -13, 's')
    arcade(T, 13, 19, 'w')
    hollowHouse(T, 21, -19.5, 'w')
    entranceArch(T, 27.5)
    house(T, { x: -9.5, z: -19, w: 6, d: 5, face: 'e', roof: P.roofSlate, seed: 3 })
    house(T, { x: 9.5, z: -19.5, w: 6, d: 5, face: 'w', roof: P.roofRed, seed: 7 })
    house(T, { x: -25, z: 13.5, w: 6, d: 5, face: 'n', roof: P.roofOrange, seed: 11 })
    house(T, { x: -26, z: -9.5, w: 6, d: 5, face: 's', roof: P.roofRed, seed: 13 })
    house(T, { x: 26, z: 10, w: 5, d: 6, face: 'w', roof: P.roofSlate, seed: 17 })
    // the two cottages by the south wall moved inland so the Lookout Terrace opens onto the valley
    house(T, { x: -15, z: 27, w: 5, d: 4, floors: 1, face: 'e', roof: P.roofRed, seed: 19 })
    house(T, { x: 16, z: 26.5, w: 5, d: 4, floors: 1, face: 'w', roof: P.roofOrange, seed: 23 })

    // Market Row
    const stripes = stripeMats(T)
    stallV4(T, -15, -1.3, 's', stripes[0], 'produce')
    stallV4(T, -21, -1.3, 's', stripes[1], 'apothecary')
    stallV4(T, -27, -1.3, 's', stripes[2], 'guide')
    stallV4(T, -18, 6.4, 'n', stripes[3], 'produce')
    stallV4(T, -24, 6.4, 'n', stripes[0], 'wardrobe')
    poles(T, [[-12.5, -0.4], [-18, -0.4], [-24, -0.4], [-29.5, -0.4], [-12.5, 5.5], [-21, 5.5], [-27, 5.5], [-29.5, 5.5]])
    stringLights(T, [
      [-12.5, -0.4, -21, 5.5],
      [-21, 5.5, -29.5, -0.4],
      [-12.5, 5.5, -18, -0.4],
      [-18, -0.4, -27, 5.5],
      [-24, -0.4, -29.5, 5.5],
    ])

    // lamps along the readable routes
    const ring: [number, number][] = [30, 60, 120, 150, 210, 240, 300, 330].map((d) => [Math.cos((d * Math.PI) / 180) * 10.7, Math.sin((d * Math.PI) / 180) * 10.7])
    lampPosts(T, [...ring, [-3, 12.4], [3, 24.2], [-3, 24.2], [3, -11.6], [-3, -22.8], [3, -22.8], [12.5, -1.7], [-11.6, -11.6], [5.6, 21.2], [-4.6, 16.4], [-29.8, 7.2], [11.8, -10.6]])

    // fences: Hollow House front yard (broken), garden at the east house
    fence(T, [[18, -23.6], [15.4, -23.6], [15.4, -21.1]], true)
    fence(T, [[15.4, -17.9], [15.4, -15.6], [18, -15.6]], true)
    fence(T, [[22.6, 6.8], [22.6, 4.5], [28.4, 4.5]])
    fence(T, [[-22, 10.4], [-28.2, 10.4]])

    clutter(T)
    kingdom(T, style, SM, q)
    this.city = buildChadCity(this.scene, q, this.disposables)
    valleyRoad(T, this.city.road)

    // vegetation avoids roads, plaza and buildings
    const avoid = (x: number, z: number) => {
      if (Math.hypot(x, z) < 12.8) return true
      for (const r of ROADS) {
        const dx = r.x1 - r.x0, dz = r.z1 - r.z0
        const t = Math.max(0, Math.min(1, ((x - r.x0) * dx + (z - r.z0) * dz) / (dx * dx + dz * dz)))
        if (Math.hypot(x - (r.x0 + dx * t), z - (r.z0 + dz * t)) < r.w / 2 + 0.7) return true
      }
      for (const c of this.colliders) {
        if (c.kind === 'box' && x > c.minX - 0.8 && x < c.maxX + 0.8 && z > c.minZ - 0.8 && z < c.maxZ + 0.8) return true
        if (c.kind === 'circle' && Math.hypot(x - c.x, z - c.z) < c.r + 0.5) return true
      }
      return z < CASTLE_Z + 2
    }
    this.rushCart(T) // before vegetation (nothing grows through it) and before the static batch is built
    this.pumpkinPatches(T)
    // spawn fingerpost: the first thing a new player sees on the road tells them where everything is
    fingerpost(T, -3.9, 18.8, [
      { label: 'FOUNTAIN · CASTLE', to: [0, -20] },
      { label: 'MARKET ROW', to: [-21, 2.5] },
      { label: 'CHAD GYM', to: [14.4, -4] },
      { label: 'PUMPKIN RUSH', to: [RUSH_CART.x, RUSH_CART.z] },
      { label: 'LOOKOUT · CITY', to: [-5.4, 32.4] },
    ])
    vegetation(T, q, avoid)
    // every pumpkin in the kingdom → three merged meshes; carved ones flicker together
    const pk = T.pumpkins!.build(this.scene, this.disposables, q !== 'low')
    T.dynamic.push({ update: (t) => pk.update(t) })

    // merge everything static into a few draw calls
    T.batch.build(this.scene, q !== 'low')

    // dynamic bits
    this.fires = T.fires
    this.cloths = T.cloths
    this.dynamic = T.dynamic
    const maxLights = q === 'high' ? 7 : q === 'medium' ? 4 : 1
    T.lights
      .sort((a, b) => a.priority - b.priority)
      .slice(0, maxLights)
      .forEach((L) => {
        const pl = new THREE.PointLight(L.color, L.intensity, L.dist, 1.6)
        pl.position.set(L.x, L.y, L.z)
        this.scene.add(pl)
        if (L.fire) {
          L.fire.light = pl
          L.fire.baseIntensity = L.intensity
        }
      })
    if (q !== 'low') {
      this.smoke = new Particles(T.smoke, q === 'high' ? 14 : 9, 'smoke', '#5a5260', false)
      this.embers = new Particles(T.embers, q === 'high' ? 16 : 10, 'embers', '#ff8a30', true)
      this.scene.add(this.smoke.points, this.embers.points)
    }
    this.leaves = new Leaves(q === 'high' ? 90 : q === 'medium' ? 55 : 25)
    this.scene.add(this.leaves.mesh)

    this.buildLightsAndSky(q)
    this.buildInteractables(T)
  }

  /** Pumpkin Rush cart: a market barrow heaped with pumpkins under a hanging sign (start of the mini-game) */
  private rushCart(T: Town) {
    const { x, z } = RUSH_CART
    const P = T.P
    const box = new THREE.BoxGeometry(1, 1, 1)
    const wheel = new THREE.CylinderGeometry(0.38, 0.38, 0.08, 16)
    wheel.rotateZ(Math.PI / 2)
    const gourd = new THREE.SphereGeometry(0.26, 14, 10)
    gourd.scale(1, 0.8, 1)
    this.disposables.push(box, wheel, gourd)
    T.batch.put(box, P.woodLight, x, 0.62, z, 0, 1.7, 0.12, 1.0) // bed
    for (const sx of [-0.86, 0.86]) T.batch.put(box, P.timber, x + sx, 0.82, z, 0, 0.06, 0.42, 1.0) // sides
    for (const sz of [-0.5, 0.5]) T.batch.put(box, P.timber, x, 0.82, z + sz, 0, 1.7, 0.42, 0.06)
    for (const sx of [-0.92, 0.92]) T.batch.put(wheel, P.iron, x + sx, 0.38, z - 0.15)
    for (const sx of [-0.6, 0.6]) T.batch.put(box, P.timber, x + sx, 1.45, z - 0.45, 0, 0.07, 1.7, 0.07) // sign posts
    T.batch.put(box, P.timber, x, 2.25, z - 0.45, 0, 1.4, 0.07, 0.07)
    const heap: [number, number, number][] = [[-0.5, 0.68, -0.2], [0, 0.68, 0.15], [0.5, 0.68, -0.15], [-0.25, 0.9, 0.05], [0.28, 0.9, 0.1], [-0.55, 0.68, 0.28], [0.55, 0.68, 0.3]]
    heap.forEach(([dx, y, dz], i) => T.pumpkins!.add(x + dx, y, z + dz, { r: i > 4 ? 0.2 : 0.26, tint: i === 3 ? 'deep' : 'orange', face: i === 4 ? 3 : undefined, facing: 0 }))
    const signMat = new THREE.MeshStandardMaterial({ map: TX.shopSign('PUMPKIN RUSH', '45-second sprint'), roughness: 0.7, emissive: '#3a1a08', side: THREE.DoubleSide })
    this.disposables.push(signMat, signMat.map!)
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.62), signMat)
    sign.position.set(x, 1.86, z - 0.42)
    this.disposables.push(sign.geometry)
    this.scene.add(sign)
    T.colliders.push({ kind: 'box', minX: x - 1.0, maxX: x + 1.0, minZ: z - 0.6, maxZ: z + 0.6, h: 1.2 })
  }

  /** pumpkin patches: little clusters by the plaza lamps, the road mouths, the castle steps and the tavern */
  private pumpkinPatches(T: Town) {
    const PB = T.pumpkins!
    const spots: [number, number, number, number][] = [
      // x, z, big radius, carved chance
      [10.8, 6.2, 0.3, 0.6], [-11.2, 6.6, 0.28, 0.5], [10.9, -6.8, 0.26, 0.4], [-10.6, -7.4, 0.3, 0.6],
      [3.6, 13.2, 0.24, 0.3], [-3.7, -12.4, 0.26, 0.5], [-3.8, -24.9, 0.32, 0.8],
      [6.9, 16.9, 0.24, 0.3], [15.6, -2.4, 0.26, 0.5], [-13.4, 1.0, 0.24, 0.2],
    ]
    for (const [x, z, big, carved] of spots) PB.cluster(x, z, groundHeight(x, z), big, carved)
    // the three talking pumpkins: bigger carved faces + a slow sparkle until you find them
    const sparkMat = new THREE.PointsMaterial({ color: new THREE.Color('#c9a0ff').multiplyScalar(2), size: 0.09, transparent: true, depthWrite: false, toneMapped: false })
    this.disposables.push(sparkMat)
    for (const g of GOURDS) {
      const y = groundHeight(g.x, g.z)
      PB.add(g.x, y, g.z, { r: g.r, face: g.face, facing: g.facing, v: 0 })
      const pts: number[] = []
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2
        pts.push(Math.cos(a) * g.r * 1.6, g.r * (0.6 + (i % 3) * 0.45), Math.sin(a) * g.r * 1.6)
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
      this.disposables.push(geo)
      const spark = new THREE.Points(geo, sparkMat)
      spark.position.set(g.x, y, g.z)
      this.scene.add(spark)
      this.gourdMarks.set(g.id, spark)
      T.dynamic.push({ update: (t) => (spark.rotation.y = t * 0.6) })
      T.colliders.push({ kind: 'circle', x: g.x, z: g.z, r: g.r * 0.9, h: 0.6 })
    }
  }

  private buildSky() {
    const s = this.scene
    const moon = new THREE.Mesh(new THREE.SphereGeometry(6, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a0').multiplyScalar(2.6), toneMapped: false, fog: false }))
    moon.position.set(-40, 44, -110)
    s.add(moon)
    const halo = new THREE.Mesh(new THREE.CircleGeometry(18, 48), new THREE.MeshBasicMaterial({ color: '#ff9a3c', transparent: true, opacity: 0.07, fog: false, depthWrite: false }))
    halo.position.copy(moon.position).add(new THREE.Vector3(0, 0, 1))
    halo.lookAt(0, 0, 0)
    s.add(halo)
    const N = 900
    const pos = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      const th = Math.random() * Math.PI * 2
      const ph = 0.06 + Math.random() * 0.42 * Math.PI
      pos.set([Math.cos(th) * Math.cos(ph) * 880, Math.sin(ph) * 880 + 10, Math.sin(th) * Math.cos(ph) * 880], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    s.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#f3ece2', size: 3.4, fog: false, transparent: true, opacity: 0.8 })))
    mountains(s, this.disposables)
  }

  private buildLightsAndSky(q: Quality) {
    const s = this.scene
    s.add(new THREE.HemisphereLight('#6a5a88', '#22140c', 0.62))
    const moonLight = new THREE.DirectionalLight('#b9c6ff', 1.15)
    moonLight.position.set(-14, 26, -10)
    moonLight.castShadow = q !== 'low'
    const size = q === 'high' ? 2048 : 1024
    moonLight.shadow.mapSize.set(size, size)
    const sc = moonLight.shadow.camera
    sc.left = sc.bottom = -36
    sc.right = sc.top = 36
    sc.near = 1
    sc.far = 80
    moonLight.shadow.bias = -0.0006
    moonLight.shadow.normalBias = 0.04
    s.add(moonLight)
    const warm = new THREE.DirectionalLight('#ff9a50', 0.3)
    warm.position.set(12, 7, 16)
    s.add(warm)
  }

  private buildInteractables(T: Town) {
    const add = (id: string, label: string, x: number, z: number, radius: number, kind: Interactable['kind']) => this.interactables.push({ id, label, pos: new THREE.Vector3(x, 0, z), radius, kind })
    add('statue', 'Read the fountain plaque', 0, 6.7, 1.6, 'info')
    add('gate', 'Knock on the castle gate', 0, -28.2, 1.8, 'info')
    add('gym', 'Enter Chad Gym', 14.4, -4, 2.2, 'activity')
    add('board', 'Read the notice board', 5.7, 21.5, 1.7, 'info')
    add('well', 'Toss a coin in the wishing well', -29.4, 2.5, 1.7, 'activity')
    add('window', 'Peer through the window', 16.6, -19.5, 1.8, 'info')
    add('arcade', 'Pump Arcade — opening soon', 7.8, 19, 1.9, 'info')
    add('rune', 'Press the strange rune', -24.5, -27, 1.6, 'secret')
    add('pumpkin', 'Poke the suspicious pumpkin', -9.6, 10.4, 2.1, 'info')
    add('citygate', 'Read the Chad City sign', CITY_SIGN.x - 0.4, CITY_SIGN.z - 1.2, 1.9, 'info')
    SEATS.forEach((b, i) => add(`bench_${i}`, b.label, b.x + Math.sin(b.ry) * 0.75, b.z + Math.cos(b.ry) * 0.75, 1.1, 'activity'))
    add('rush', 'Play Pumpkin Rush', RUSH_CART.x, RUSH_CART.z + 1.3, 1.5, 'activity')
    add('wardrobe', 'Browse the wardrobe stall', -24, 5.0, 1.3, 'info')
    add('lookout', 'Take in the view', -5.4, 32.4, 1.5, 'info')
    for (const g of GOURDS) add(g.id, `Talk to the ${g.name}`, g.x, g.z, 1.35, 'talk')
    // open, walkable plaza ground for rush pumpkins: inside the walls, clear of every collider, roughly level
    const open = (x: number, z: number) => {
      if (Math.hypot(x, z) > 29 || Math.abs(groundHeight(x, z)) > 0.35) return false
      for (const c of this.colliders) {
        if (c.kind === 'circle' ? Math.hypot(x - c.x, z - c.z) < c.r + 0.9 : x > c.minX - 0.9 && x < c.maxX + 0.9 && z > c.minZ - 0.9 && z < c.maxZ + 0.9) return false
      }
      return true
    }
    this.rush = new RushGame(this.scene, open, { r: 29 })
    for (const r of RESIDENTS) if (r.talk) add(r.id, r.talk, r.talkAt?.[0] ?? r.x, r.talkAt?.[1] ?? r.z, r.talkAt ? 1.6 : 2.2, 'talk')

    // the suspicious pumpkin
    this.oddPumpkin = new THREE.Group()
    // same organic, ribbed, carved pumpkin as the rest of the kingdom (own builder: it squashes and hops when poked)
    const oddPB = new PumpkinBuilder()
    oddPB.add(0, 0, 0, { r: 0.72, face: 2, facing: 0, v: 1 })
    const oddFx = oddPB.build(this.oddPumpkin, this.disposables, true)
    T.dynamic.push({ update: (t) => oddFx.update(t + 1.3) })
    this.oddPumpkin.position.set(-9.6, 0, 10.4)
    this.oddPumpkin.rotation.y = 0.9
    this.scene.add(this.oddPumpkin)
    this.colliders.push({ kind: 'circle', x: -9.6, z: 10.4, r: 0.9, h: 1.2 })

    // rune + hidden stash
    const rune = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.25, 6), T.P.rock)
    rune.position.set(-24.5, 0.12, -27)
    this.scene.add(rune)
    const glyph = new THREE.Mesh(new THREE.CircleGeometry(0.18, 6), T.P.glowPurple)
    glyph.rotation.x = -Math.PI / 2
    glyph.position.set(-24.5, 0.26, -27)
    this.scene.add(glyph)
    this.stash = new THREE.Group()
    const coin = new THREE.CylinderGeometry(0.16, 0.16, 0.04, 16)
    for (let i = 0; i < 40; i++) {
      const c = new THREE.Mesh(coin, T.P.gold)
      const a = i * 2.4
      const rr = Math.sqrt(i) * 0.14
      c.position.set(Math.cos(a) * rr, 0.03 + (40 - i) * 0.012, Math.sin(a) * rr)
      c.rotation.set((i % 3) * 0.3, 0, (i % 5) * 0.2)
      this.stash.add(c)
    }
    this.stash.position.set(-23, 0, -25.5)
    this.stash.scale.setScalar(0.001)
    this.stash.visible = false
    this.scene.add(this.stash)

    // golden seeds
    const seedGeo = new THREE.SphereGeometry(0.16, 14, 10)
    seedGeo.scale(0.8, 1.2, 0.8)
    const seedMat = new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ffb347', emissiveIntensity: 2.2, metalness: 0.8, roughness: 0.25 })
    const sparkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff0c0').multiplyScalar(3), toneMapped: false, transparent: true, opacity: 0.6, depthWrite: false })
    this.disposables.push(seedGeo, seedMat, sparkMat)
    for (const [id, x, z] of SEEDS) {
      const g = new THREE.Group()
      g.add(new THREE.Mesh(seedGeo, seedMat))
      const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), sparkMat)
      spark.scale.set(0.15, 1, 0.15)
      g.add(spark)
      g.position.set(x, 0.55, z)
      this.scene.add(g)
      this.seeds.set(id, g)
      add(id, 'Pick up the golden seed', x, z, 1.25, 'collect')
    }

    // floating markers on WORKING interactions only (talk NPCs + activities)
    const markerGeo = new THREE.OctahedronGeometry(0.16, 0)
    markerGeo.scale(1, 1.5, 1)
    this.disposables.push(markerGeo)
    for (const it of this.interactables) {
      if (it.kind !== 'talk' && it.kind !== 'activity') continue
      const m = new THREE.Mesh(markerGeo, it.kind === 'talk' ? T.P.glowGold : T.P.glowOrange)
      const y = it.kind === 'talk' ? 2.55 : it.id === 'gym' ? 4 : 2.2
      m.position.set(it.pos.x, y, it.pos.z)
      if (it.id === 'gym') m.position.x = 15.6
      if (it.id === 'well') m.position.x = -31
      const res = RESIDENTS.find((r) => r.id === it.id)
      if (res?.talkAt) m.position.set(res.x, y, res.z)
      this.scene.add(m)
      this.markers.set(it.id, m)
    }
  }

  /** Loads the player and townsfolk (async because GLB models may download). */
  async populate(player: Appearance, spawn: 'start' | 'gym' = 'start', discoveries: string[] = []) {
    const [p] = await Promise.all([createCharacter(player), this.crowd.load(this.scene, this.quality, groundHeight)])
    if (this.disposed) {
      disposeCharacter(p)
      return
    }
    this.player = p
    p.onStep = () => audio.play('step')
    this.scene.add(p.root)
    for (const d of discoveries) {
      if (d.startsWith('talk_')) this.markTalked(d.slice(5))
      if (d.startsWith('seed_')) this.collect(d)
    }
    this.spawn(spawn)
  }

  /** QA */
  animState() {
    return { emote: this.emoter.active, busy: this.emoter.busy, airborne: this.jumper.airborne, jumpY: +this.jumper.y.toFixed(3), speed: +Math.hypot(this.playerVel.x, this.playerVel.z).toFixed(3) }
  }

  /** play an emote from the wheel (ignored mid-air) */
  emote(id: EmoteId) {
    if (this.jumper.airborne || this.paused) return null
    return this.emoter.start(this.player, id)
  }

  spawn(where: 'start' | 'gym') {
    if (where === 'gym') {
      this.playerPos.set(12.6, 0, -4)
      this.playerYaw = -Math.PI / 2
    } else {
      this.playerPos.set(0, 0, 19.5)
      this.playerYaw = Math.PI
    }
    this.camYaw = this.playerYaw + Math.PI
    this.playerVel.set(0, 0, 0)
    this.jumper.reset()
    this.snapCamera()
  }

  /* ───────── hooks used by the UI ───────── */

  faceNpcToPlayer(id: string) {
    const n = this.crowd.get(id)
    if (n) n.facing = Math.atan2(this.playerPos.x - n.pos.x, this.playerPos.z - n.pos.z)
  }
  markTalked(id: string) {
    const m = this.markers.get(id)
    if (m) m.visible = false
  }
  collect(id: string, animate = false) {
    const s = this.seeds.get(id)
    this.interactables = this.interactables.filter((i) => i.id !== id)
    if (!s) return
    if (animate && this.player?.playOnce && !this.jumper.airborne) {
      // crouch down and pick it up (library clip); the seed vanishes as the hand reaches it
      this.emoter.cancel(this.player)
      this.playerYaw = Math.atan2(s.position.x - this.playerPos.x, s.position.z - this.playerPos.z)
      this.playerVel.set(0, 0, 0)
      this.lockT = this.player.playOnce('pickup', 0.15, { timeScale: 1.35, maxDur: 1.5 })
      this.pendingHide = { g: s, t: 0.55 }
    } else s.visible = false
  }
  /** a talking pumpkin was found: its sparkle marker goes out */
  gourdFound(id: string) {
    const s = this.gourdMarks.get(id)
    if (s) s.visible = false
  }
  /** sit on lookout bench i (plays the sit-down clip, then the seated loop until the player moves) */
  sit(i: number) {
    const b = SEATS[i]
    const p = this.player
    if (!b || !p?.playOnce || this.seat || this.jumper.airborne) return
    this.emoter.cancel(p)
    this.playerVel.set(0, 0, 0)
    const sx = b.x + Math.sin(b.ry) * SEAT_FWD
    const sz = b.z + Math.cos(b.ry) * SEAT_FWD
    this.playerPos.set(sx, groundHeight(sx, sz), sz)
    this.playerYaw = b.ry
    this.seat = { b: i, phase: 'enter', t: 0, dur: p.playOnce('sitDown', 0.2) }
  }
  private standUp() {
    const s = this.seat
    const p = this.player
    if (!s || s.phase !== 'sit') return
    s.phase = 'exit'
    s.t = 0
    s.dur = p?.playOnce?.('standUp', 0.2) ?? 0
  }
  /** QA */
  seatState() {
    return this.seat ? { ...this.seat } : null
  }
  cooldown(s = 0.4) {
    this.actionCooldown = s
  }
  boing() {
    this.boingT = 0
    audio.play('boing')
  }
  revealStash() {
    this.stash.visible = true
    this.stashT = 0
  }
  get stashFound() {
    return this.stash.visible
  }

  /* ───────── simulation ───────── */

  private resolve(p: THREE.Vector3, r: number) {
    for (const c of this.colliders) {
      if (c.kind === 'circle') {
        const dx = p.x - c.x
        const dz = p.z - c.z
        const d = Math.hypot(dx, dz)
        const min = c.r + r
        if (d < min && d > 1e-6) {
          p.x = c.x + (dx / d) * min
          p.z = c.z + (dz / d) * min
        }
      } else {
        const cx = Math.max(c.minX, Math.min(p.x, c.maxX))
        const cz = Math.max(c.minZ, Math.min(p.z, c.maxZ))
        const dx = p.x - cx
        const dz = p.z - cz
        const d = Math.hypot(dx, dz)
        if (d < r) {
          if (d > 1e-6) {
            p.x = cx + (dx / d) * r
            p.z = cz + (dz / d) * r
          } else {
            const pen = [p.x - c.minX, c.maxX - p.x, p.z - c.minZ, c.maxZ - p.z]
            const i = pen.indexOf(Math.min(...pen))
            if (i === 0) p.x = c.minX - r
            else if (i === 1) p.x = c.maxX + r
            else if (i === 2) p.z = c.minZ - r
            else p.z = c.maxZ + r
          }
        }
      }
    }
    // residents with posts are solid; walkers too (so you can't ghost through a guard)
    for (const l of this.crowd.live) {
      const dx = p.x - l.pos.x
      const dz = p.z - l.pos.z
      const d = Math.hypot(dx, dz)
      const min = 0.5 + r
      if (d < min && d > 1e-6) {
        p.x = l.pos.x + (dx / d) * min
        p.z = l.pos.z + (dz / d) * min
      }
    }
    const d = Math.hypot(p.x, p.z)
    if (d > BOUNDS) {
      p.x *= BOUNDS / d
      p.z *= BOUNDS / d
    }
  }

  /** Distance along target→camera at which a tall collider blocks the view (1 = clear). */
  private occlusion(tx: number, tz: number, cx: number, cz: number, ty: number) {
    let best = 1
    const dx = cx - tx
    const dz = cz - tz
    for (const c of [...this.colliders, ...this.camBlockers]) {
      if (!c.h || c.h < ty + 0.3) continue
      if (c.kind === 'box') {
        let t0 = 0
        let t1 = 1
        for (const [p, d, lo, hi] of [[tx, dx, c.minX, c.maxX], [tz, dz, c.minZ, c.maxZ]] as const) {
          if (Math.abs(d) < 1e-6) {
            if (p < lo || p > hi) {
              t0 = 2
              break
            }
          } else {
            let a = (lo - p) / d
            let b = (hi - p) / d
            if (a > b) [a, b] = [b, a]
            t0 = Math.max(t0, a)
            t1 = Math.min(t1, b)
          }
        }
        if (t0 <= t1 && t0 < best && t0 > 0) best = t0
      } else if (c.r > 1) {
        const fx = tx - c.x
        const fz = tz - c.z
        const a = dx * dx + dz * dz
        const b = 2 * (fx * dx + fz * dz)
        const cc = fx * fx + fz * fz - c.r * c.r
        const disc = b * b - 4 * a * cc
        if (disc > 0) {
          const t = (-b - Math.sqrt(disc)) / (2 * a)
          if (t > 0 && t < best) best = t
        }
      }
    }
    return best
  }

  private snapCamera() {
    this.camTarget.set(this.playerPos.x, this.playerPos.y + (this.player?.headHeight ?? 1.9) * 0.82, this.playerPos.z)
    this.camDistNow = this.camDist
    this.placeCamera(1)
  }

  private placeCamera(k: number) {
    const target = new THREE.Vector3(this.playerPos.x, this.playerPos.y + (this.player?.headHeight ?? 1.9) * 0.82, this.playerPos.z)
    this.camTarget.lerp(target, k)
    const cp = Math.cos(this.camPitch)
    const dirX = Math.sin(this.camYaw) * cp
    const dirZ = Math.cos(this.camYaw) * cp
    const fullX = this.camTarget.x + dirX * this.camDist
    const fullZ = this.camTarget.z + dirZ * this.camDist
    const block = this.occlusion(this.camTarget.x, this.camTarget.z, fullX, fullZ, this.camTarget.y + Math.sin(this.camPitch) * this.camDist * 0.5)
    const wantDist = block < 1 ? Math.max(0.55, this.camDist * block - 0.35) : this.camDist
    // pull in fast, ease back out slowly
    this.camDistNow += (wantDist - this.camDistNow) * (wantDist < this.camDistNow ? 0.5 : 1 - Math.exp(-0.05 * 60 * k))
    const d = this.camDistNow
    // when squeezed against a wall, rise into an over-the-shoulder view instead of clipping
    const squeeze = Math.max(0, 1 - d / 2.2)
    const want = new THREE.Vector3(this.camTarget.x + dirX * d, this.camTarget.y + Math.sin(this.camPitch) * d + squeeze * 0.6, this.camTarget.z + dirZ * d)
    // keep the lens out of NPC bodies
    for (const l of this.crowd.live) {
      const ex = want.x - l.pos.x
      const ez = want.z - l.pos.z
      const ed = Math.hypot(ex, ez)
      if (ed < 1.1 && ed > 1e-4 && want.y < l.pos.y + 2.3) {
        want.x = l.pos.x + (ex / ed) * 1.1
        want.z = l.pos.z + (ez / ed) * 1.1
      }
    }
    // keep the lens out of posts, lanterns, trees and other small solid props
    for (const c of this.colliders) {
      if (c.kind !== 'circle' || !c.h || want.y > c.h + 0.6) continue
      const ex = want.x - c.x
      const ez = want.z - c.z
      const ed = Math.hypot(ex, ez)
      const min = c.r + 0.75
      if (ed < min && ed > 1e-4) {
        want.x = c.x + (ex / ed) * min
        want.z = c.z + (ez / ed) * min
      }
    }
    this.camera.position.lerp(want, Math.min(1, k * 1.4))
    // hard guarantee: never leave the lens inside a building volume (smoothing can lag into corners)
    const cam = this.camera.position
    const boxes = [...this.colliders, ...this.camBlockers]
    const inBox = (c: (typeof boxes)[number]) => c.kind === 'box' && !!c.h && cam.y <= c.h && cam.x > c.minX - 0.15 && cam.x < c.maxX + 0.15 && cam.z > c.minZ - 0.15 && cam.z < c.maxZ + 0.15
    // a push out of one box can land in its neighbour (tight alleys): repeat until clear
    for (let pass = 0; pass < 4; pass++) {
      let moved = false
      for (const c of boxes) {
        if (c.kind !== 'box' || !inBox(c)) continue
        const pen = [cam.x - c.minX + 0.15, c.maxX + 0.15 - cam.x, cam.z - c.minZ + 0.15, c.maxZ + 0.15 - cam.z]
        const i = pen.indexOf(Math.min(...pen))
        if (i === 0) cam.x = c.minX - 0.15
        else if (i === 1) cam.x = c.maxX + 0.15
        else if (i === 2) cam.z = c.minZ - 0.15
        else cam.z = c.maxZ + 0.15
        moved = true
      }
      if (!moved) break
    }
    // still boxed in (a corner between buildings): look over the player's shoulder from just above the head
    if (boxes.some(inBox)) cam.set(this.camTarget.x, Math.max(cam.y, this.camTarget.y + 0.9), this.camTarget.z)
    this.camera.lookAt(this.camTarget)
  }

  resize(w: number, h: number) {
    const portrait = h > w
    this.camera.fov = portrait ? 66 : 55
    this.camDist = portrait ? 7 : 6.4
    this.camera.updateProjectionMatrix()
    const pr = this.engine.renderer.getPixelRatio()
    this.smoke?.setPixelScale(h, pr)
    this.embers?.setPixelScale(h, pr)
  }

  update(dt: number) {
    this.t += dt
    const p = this.player

    const look = this.input.takeLook()
    this.camYaw -= look.x * 0.006 * this.cameraSensitivity
    this.camPitch = Math.max(0.08, Math.min(1.05, this.camPitch + look.y * 0.004 * this.cameraSensitivity))

    let mv = this.paused ? { x: 0, z: 0, run: false, analog: false } : this.input.move()
    if (look.x || look.y) this.lastLookT = this.t
    let jumpReq = this.input.takeJump()
    this.lockT = Math.max(0, this.lockT - dt)
    if (this.pendingHide && (this.pendingHide.t -= dt) <= 0) {
      this.pendingHide.g.visible = false
      this.pendingHide = null
    }
    const seat = this.seat
    if (seat) {
      seat.t += dt
      const wantsUp = Math.hypot(mv.x, mv.z) > 0.3 || jumpReq || this.input.takeAction()
      if (seat.phase === 'enter' && seat.t >= seat.dur) seat.phase = 'sit'
      else if (seat.phase === 'sit' && wantsUp) this.standUp()
      else if (seat.phase === 'exit' && seat.t >= seat.dur) {
        // stood up: step clear of the bench so the collider doesn't shove the player
        const b = SEATS[seat.b]
        this.playerPos.set(b.x + Math.sin(b.ry) * 0.62, this.playerPos.y, b.z + Math.cos(b.ry) * 0.62)
        this.seat = null
      }
    }
    if (this.seat || this.lockT > 0) {
      mv = { x: 0, z: 0, run: false, analog: false }
      jumpReq = false
    }
    const fwd = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw))
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x)
    const wish = fwd.multiplyScalar(mv.z).add(right.multiplyScalar(mv.x))
    const mag = Math.min(1, wish.length())
    const targetVel = mag > 0.01 ? wish.normalize().multiplyScalar(targetSpeed(mag, mv.run, mv.analog, OUTDOOR)) : new THREE.Vector3()
    // jump (Space / touch button); moving or jumping ends an emote
    if (jumpReq && !this.paused && this.jumper.tryJump(p)) this.emoter.cancel(p)
    if (mag > 0.05 && this.emoter.busy) this.emoter.cancel(p)
    this.jumper.update(dt, p)
    this.emoter.update(dt)
    const nowSpeed = Math.hypot(this.playerVel.x, this.playerVel.z)
    this.playerVel.lerp(targetVel, 1 - Math.exp(-dt * velocityRate(mag > 0.01, nowSpeed, this.jumper.airborne)))
    const px = this.playerPos.x
    const pz = this.playerPos.z
    this.playerPos.addScaledVector(this.playerVel, dt)
    if (!this.seat) {
      this.resolve(this.playerPos, PLAYER_R) // seated = inside the bench's collider on purpose
      // walls / hedges / NPCs eat velocity: slide along them instead of sprinting on the spot
      if (dt > 0) {
        const ax = (this.playerPos.x - px) / dt
        const az = (this.playerPos.z - pz) / dt
        if (Math.hypot(ax, az) < Math.hypot(this.playerVel.x, this.playerVel.z) - 0.05) this.playerVel.set(ax, this.playerVel.y, az)
      }
    }
    const gy = groundHeight(this.playerPos.x, this.playerPos.z)
    this.playerPos.y += (gy - this.playerPos.y) * (1 - Math.exp(-dt * 18))

    const speed = Math.hypot(this.playerVel.x, this.playerVel.z)
    const yaw0 = this.playerYaw
    if (speed > 0.15) {
      const targetYaw = Math.atan2(this.playerVel.x, this.playerVel.z)
      let d = targetYaw - this.playerYaw
      d = Math.atan2(Math.sin(d), Math.cos(d))
      this.playerYaw += d * (1 - Math.exp(-dt * turnRate(speed)))
      // drift the camera behind the player only when running straight ahead (never while strafing / moving
      // diagonally — that made the player run in endless circles — and not right after a manual look)
      if (!look.x && mv.z > 0.2 && Math.abs(mv.x) < 0.25 && this.t - this.lastLookT > 1.2 && !this.input?.mouseLooked) {
        let cd = this.playerYaw + Math.PI - this.camYaw
        cd = Math.atan2(Math.sin(cd), Math.cos(cd))
        this.camYaw += cd * (1 - Math.exp(-dt * 0.9))
      }
      this.walkedTime += dt
    }
    if (p) {
      p.root.position.copy(this.playerPos)
      p.root.position.y += this.jumper.y
      p.root.rotation.y = this.playerYaw
      p.speed = speed / SPEED_UNIT
      p.pose = this.seat && this.seat.phase !== 'exit' ? 'sit' : this.emoter.pose() ?? (speed > 0.1 ? 'walk' : 'idle')
      if (p.lean) {
        let dy = this.playerYaw - yaw0
        dy = Math.atan2(Math.sin(dy), Math.cos(dy))
        const l = leanFor(dy / Math.max(dt, 1e-3), (speed - this.lastSpeed) / Math.max(dt, 1e-3), speed)
        p.lean.turn = l.turn
        p.lean.accel = l.accel
      }
      p.update(dt)
    }
    this.lastSpeed = speed
    this.placeCamera(1 - Math.exp(-dt * 9))

    this.crowd.update(dt, this.playerPos, this.camera.position, this.paused, groundHeight)

    // interaction prompt
    let best: Interactable | null = null
    let bestD = Infinity
    if (!this.paused && !this.seat && this.lockT === 0)
      for (const it of this.interactables) {
        const d = Math.hypot(it.pos.x - this.playerPos.x, it.pos.z - this.playerPos.z)
        if (d < it.radius + PLAYER_R && d < bestD) {
          best = it
          bestD = d
        }
      }
    if (best !== this.prompt) {
      this.prompt = best
      this.events.onPrompt(best)
    }
    this.actionCooldown = Math.max(0, this.actionCooldown - dt)
    if (this.input.takeAction() && this.prompt && !this.paused && this.actionCooldown === 0) {
      audio.play('interact')
      if (this.prompt.id.startsWith('bench_')) this.sit(+this.prompt.id.slice(6))
      this.events.onInteract(this.prompt.id)
    }

    // ambience
    const t = this.t
    for (const f of this.fires) f.update(t)
    for (const c of this.cloths) c.update(t)
    for (const d of this.dynamic) d.update(t, dt)
    this.smoke?.update(dt, t)
    this.embers?.update(dt, t)
    this.leaves?.update(dt, t, this.playerPos.x, this.playerPos.z)
    this.city?.update(dt)
    // fountain splash gets louder as you walk up to it
    audio.setWater(1 - Math.min(1, Math.max(0, (Math.hypot(this.playerPos.x, this.playerPos.z) - 5) / 13)))
    if (!this.paused) this.rush?.update(dt, this.playerPos, groundHeight)
    let mi = 0
    for (const [, m] of this.markers) {
      m.position.y += Math.sin(t * 2.4 + mi++) * 0.004
      m.rotation.y += dt * 1.6
    }
    for (const [, s] of this.seeds) {
      s.rotation.y += dt * 2
      s.position.y = 0.55 + Math.sin(t * 2 + s.position.x) * 0.1
    }
    if (this.boingT >= 0) {
      this.boingT += dt
      const k = this.boingT
      const sq = Math.exp(-k * 4) * Math.sin(k * 22)
      this.oddPumpkin.scale.set(1 - sq * 0.25, 1 + sq * 0.4, 1 - sq * 0.25)
      this.oddPumpkin.position.y = Math.max(0, Math.sin(Math.min(k, 0.5) * Math.PI * 2) * 0.6)
      if (k > 1.6) {
        this.boingT = -1
        this.oddPumpkin.scale.setScalar(1)
        this.oddPumpkin.position.y = 0
      }
    }
    if (this.stashT >= 0) {
      this.stashT = Math.min(1, this.stashT + dt * 1.5)
      this.stash.scale.setScalar(Math.max(0.001, 1 - Math.pow(1 - this.stashT, 3)))
      if (this.stashT >= 1) this.stashT = -1
    }
    if (this.stash.visible) this.stash.rotation.y += dt * 0.3
  }

  /** for automated tests + the perf overlay */
  debug() {
    const info = this.engine.renderer.info
    return {
      x: +this.playerPos.x.toFixed(2),
      y: +this.playerPos.y.toFixed(2),
      z: +this.playerPos.z.toFixed(2),
      yaw: +this.playerYaw.toFixed(2),
      camYaw: +this.camYaw.toFixed(3),
      t: this.t,
      prompt: this.prompt?.id ?? null,
      walked: +this.walkedTime.toFixed(2),
      camDist: +this.camDistNow.toFixed(2),
      calls: info.render.calls,
      triangles: info.render.triangles,
      npcs: this.crowd.live.length,
    }
  }
  /** QA: is the player or the camera inside any solid building volume right now? */
  integrity() {
    const inside = (x: number, z: number, y: number, pad: number) =>
      this.colliders.some((c) => c.kind === 'box' && (c.h ?? 0) > y && x > c.minX + pad && x < c.maxX - pad && z > c.minZ + pad && z < c.maxZ - pad)
    const cam = this.camera.position
    return {
      playerInside: inside(this.playerPos.x, this.playerPos.z, 0.5, 0.05),
      cameraInside: inside(cam.x, cam.z, cam.y, 0.05),
      finite: Number.isFinite(this.playerPos.x + this.playerPos.z + cam.x + cam.y + cam.z),
      walkers: this.crowd.live.filter((l) => l.walker).map((l) => [+l.pos.x.toFixed(2), +l.pos.z.toFixed(2)]),
    }
  }
  teleport(x: number, z: number, yaw?: number) {
    this.playerPos.set(x, groundHeight(x, z), z)
    this.playerVel.set(0, 0, 0)
    // QA jump: finish any full-body action (seed pick-up) instantly so prompts come straight back
    this.lockT = 0
    if (this.pendingHide) {
      this.pendingHide.g.visible = false
      this.pendingHide = null
    }
    this.resolve(this.playerPos, PLAYER_R)
    if (yaw !== undefined) {
      this.playerYaw = yaw
      this.camYaw = yaw + Math.PI
    }
    this.snapCamera()
  }

  dispose() {
    this.disposed = true
    this.rush?.dispose()
    if (this.player) disposeCharacter(this.player)
    this.crowd.dispose()
    disposeObject(this.scene)
    this.disposables.forEach((d) => d.dispose())
    ;(this.smoke?.points.material as THREE.ShaderMaterial | undefined)?.uniforms.uMap.value.dispose()
    ;(this.embers?.points.material as THREE.ShaderMaterial | undefined)?.uniforms.uMap.value.dispose()
    this.events.onPrompt(null)
  }
}

/** Block-stone texture for castle / plinths (kept here: it's the only user). */
function stoneBlocks(size = 256) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  g.fillStyle = '#121014'
  g.fillRect(0, 0, size, size)
  let seed = 13
  const r = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  const rows = 6
  const h = size / rows
  for (let y = 0; y < rows; y++)
    for (let x = (y % 2) * -h * 0.8; x < size; x += h * 1.6) {
      g.fillStyle = `hsl(${250 + r() * 30}, ${4 + r() * 6}%, ${14 + r() * 11}%)`
      g.fillRect(x + 2, y * h + 2, h * 1.6 - 4, h - 4)
      g.fillStyle = 'rgba(255,255,255,0.04)'
      g.fillRect(x + 3, y * h + 3, h * 1.6 - 6, 3)
    }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
