import * as THREE from 'three'
import { setNpcTextureCap } from '../character/chad'
import { Emoter, type EmoteId } from '../emotes'
import { Jumper, KERB, LOW_OBSTACLE, OUTDOOR, SPEED_UNIT, STEP_UP, leanFor, targetSpeed, turnRate, velocityRate } from '../movement'
import { buildCharacter } from '../character/build'
import { createCharacter, disposeCharacter, type Character } from '../character/character'
import type { Appearance } from '../character/types'
import { audio } from '../audio'
import { disposeObject, type Engine, type GameScene } from '../engine/Engine'
import type { Input } from '../input'
import type { Quality } from '../save'
import { forge, hollowHouse, house, stripeMats, tavern, type Collider, type LightSpot, type Town } from './world/buildings'
import { Fireflies, Leaves, Particles, type Fire, type Cloth } from './world/fx'
import { StaticBatch, makePalette } from './world/kit'
import { Crowd, RESIDENTS } from './world/npcs'
import { CASTLE_Z, ROADS, buildGround, castle, clutter, fence, lampPosts, poles, stringLights, vegetation } from './world/props'
import { BENCHES, kingdom, mountains } from './world/kingdom'
import { GARDEN, SPAWN, VALLEY_GATE, bridgeHeight, clampToCity } from './world/city'
import { EXPANSION_OPEN, SAFE_ARRIVAL, isLocked } from '../launch'
import { PANEL, boardTexture } from './world/signs'
import { citySkyline } from './world/skyline'
import { GYM_SHRUBS } from './world/gymExterior'
import { HERO_SHRUBS, HERO_TREES, placeHeroVeg } from './world/vegModels'
import { FoliageBuilder, leafTexture } from './world/foliage'
import { WORKSHOP_SHRUBS } from './world/workshop'
import { buildDaylight, isNight, skyPresetFromUrl } from './world/daylight'
import { B4S_BENCH, PLAZA_BENCHES, SEAT_FWD } from './world/props'

/** every bench the player can sit on: the lookout benches + the plaza benches b4s isn't using */
/** the three talking pumpkins (one-time discoveries; all three → Gourd Council) */
const GOURDS = [
  { id: 'gourd_1', name: 'Sage Gourd', x: -8.4, z: 16.0, r: 0.36, face: 3, facing: Math.PI / 2 + 0.4 },
  { id: 'gourd_2', name: 'Grumpy Gourd', x: -28.8, z: -5.2, r: 0.33, face: 1, facing: Math.PI / 4 },
  { id: 'gourd_3', name: 'Tiny Gourd', x: 3.7, z: -24.6, r: 0.18, face: 2, facing: 0 },
]

/** seats from the old town (lookout + plaza benches); the districts add theirs at build time (see World.seats) */
const BASE_SEATS = [
  ...BENCHES.map((b) => ({ x: b.x, z: b.z, ry: b.ry, label: 'Sit by the canal' })),
  ...PLAZA_BENCHES.filter((_, i) => i !== B4S_BENCH).map((b) => ({ x: b.x, z: b.z, ry: b.ry, label: 'Sit by the fountain' })),
]
import { buildChadCity } from './world/gothicCity'
import { kingdomStyle, styleMaterials } from './world/style'
import * as TX from './world/textures'
import { RushGame } from '../minigames/pumpkinRush'
import { EventDirector } from '../minigames/events'
import { TargetRange } from '../minigames/targetThrow'
import { flowerTexture } from './world/foliage'
import { fountainV4 } from './world/fountain'
import { fingerpost } from './world/wayfinding'
import { railingMaterial, waterfront } from './world/waterfront'
import { chadSquareGate } from './world/squaregate'
import { HOUSES, doorSpot } from './interiors/houses'
import { hauntedQuarter } from './world/hauntedQuarter'
import { MOTOR_ROW_LAMPS, MOTOR_ROW_TREES, motorRow } from './world/motorRow'

/** where the player appears: the start, outside the gym, or outside a house door */
export type SpawnAt = 'start' | 'gym' | { x: number; z: number; yaw: number }
import { GATE_SHRUBS, arrival } from './world/gateway'
import { perimeter } from './world/perimeter'
import { citadel, CITADEL } from './world/citadel'
import { eastside } from './world/eastside'
import { westside, type BenchSpot } from './world/westside'
import { chadRides } from './world/rides'
import { lawns, PATCH } from './world/lawns'
import { streetDetails } from './world/details'
import { MAPBOARD, WELCOME } from './world/gateway'
import { CHAMPIONS, NOTICE, squareExtras, standFor } from './world/square'
import { ARCADE, CANAL, OVERLOOK, RIDES, inCanal, insideCity } from './world/city'
import { PumpkinBuilder } from './world/pumpkins'
import { stallV4 } from './world/market'
import { FOREST, FOREST_WISPS, LAKE_FIREFLIES, enchantedForest, lakeLamps, moonlightLake } from './world/wilds'
import { inValley, lakeR } from './world/city'
import { CASTLE_AT, castleGround } from './world/mountain'
import { VALLEY_Y, descentGround } from './world/descent'
import { inFrame } from './world/frame'
import { VALLEY_DISCOVERIES, valleyGround } from './world/valley'
import { castleRoad } from './world/mountainRoad'
import { summitCastle } from './world/summitCastle'
import { downtown } from './world/downtown'
import { descentRoad } from './world/descentRoad'
import { LAKE_PIER, valleyLake } from './world/valleyLake'
import { hamlet, watchtower, woodland } from './world/hamlet'
import { manor } from './world/manor'
import { MILL_LAMPS, SOUTHSHORE_LAMPS, southshore } from './world/southshore'
import { LANTERNS, SIGIL, guardianLanterns, type GuardianLanterns } from './world/lanterns'
import { ESTATE_LAMPS, EstateView, estatesDistrict } from './world/estates'
import { PLOTS, PLOT_PRICE, cottageDoor, plotGate, type Estate } from '../estates'
import { Pet, type PetKind } from '../character/pet'

export type Interactable = { id: string; label: string; pos: THREE.Vector3; radius: number; kind: 'talk' | 'activity' | 'info' | 'collect' | 'secret' }
export type WorldEvents = {
  onPrompt(p: Interactable | null): void
  onInteract(id: string): void
  /** a place reached on foot (Discover Chad City): 'visit_square' | 'visit_gym' | 'visit_citadel' */
  onDiscover?(id: string): void
}

/** six hidden pumpkins: fair, reachable spots (no climbing), one per district */
export const HIDDEN: [string, number, number, string][] = [
  ['hp_1', -10.4, 53.2, 'behind the gateway’s west wing'],
  ['hp_2', 21.4, 37.0, 'by the east footbridge'],
  ['hp_3', -44, 23, 'inside the garden gazebo'],
  ['hp_4', 50.5, -4.4, 'in the orchard'],
  ['hp_5', -5.7, -25.6, 'beside the citadel steps'],
  ['hp_6', -58.4, 41.0, 'at the far corner of Chad View'],
]
/** Discover Chad City: places you reach on foot (zones) */
const ZONES: { id: string; inside: (x: number, z: number) => boolean }[] = [
  { id: 'visit_square', inside: (x, z) => Math.hypot(x, z) < 11.5 },
  { id: 'visit_gym', inside: (x, z) => Math.hypot(x - 14.4, z + 4) < 3.5 },
  { id: 'visit_citadel', inside: (x, z) => Math.abs(x) < 6 && z < -12 && z > -26 },
  // the wilds: districts of their own (a discovery each, not part of Discover Chad City)
  { id: 'visit_forest', inside: (x, z) => x < -40 && z < -19 }, // just through the gate (z -18)
  { id: 'visit_lake', inside: (x, z) => x > 66 && lakeR(x, z) < 1.5 },
  { id: 'visit_motor', inside: (x, z) => x > 30 && x < 64 && Math.abs(z - 36.25) < 3 },
  { id: 'visit_haunted', inside: (x, z) => x < -60 && z > -16 && z < 22 },
  { id: 'visit_downtown', inside: (x, z) => x > -86 && x < -8 && z > 394 && z < 464 },
  { id: 'visit_overlook', inside: (x, z) => Math.hypot(x - 14, z - 88) < 7 },
  { id: 'visit_castleroad', inside: (x, z) => x < -80 && x > -150 && z > 300 && z < 425 },
  { id: 'visit_castle', inside: (x, z) => Math.hypot(x + 110, z - 272) < 25 },
  { id: 'visit_southshore', inside: (x, z) => x > 66 && z > 74 },
  { id: 'visit_millrow', inside: (x, z) => x < -12 && z > 78 },
  { id: 'visit_hamlet', inside: (x, z) => x > -52 && x < -5 && z > 196 && z < 236 },
  { id: 'visit_watchtower', inside: (x, z) => Math.hypot(x - 96, z - 262) < 8 },
  { id: 'visit_landing', inside: (x, z) => x > 49 && x < 80 && z > 418 && z < 454 },
  { id: 'visit_bridge', inside: (x, z) => x > 2 && x < 44 && Math.abs(z - 415) < 4 },
  { id: 'visit_manor', inside: (x, z) => Math.hypot(x - 142, z - 516) < 30 },
  { id: 'visit_estates', inside: (x, z) => x < -30 && x > -66 && z > 44 },
]

/** the Pumpkin Rush cart (start point of the mini-game) on the plaza */
export const RUSH_CART = { x: 10.2, z: 10.4 }
const PLAYER_R = 0.45

/** Golden seed collectibles (5). Positions reward alleys, dead ends and the spooky corner. */
export const SEEDS: [string, number, number][] = [
  ['seed_1', -20.4, 24.8], // alley behind the tavern
  ['seed_2', 26.6, -21.6], // among the Hollow House graves
  ['seed_3', -30.4, -2.3], // behind the crates at the end of Market Row
  ['seed_4', -14.5, -18.3], // behind the forge
  ['seed_5', 44.6, 30.4], // behind the shops on Arcade Street
]

/** Walkable height: castle steps, tavern porch, fountain step. */
/** the old far skyline of needle towers (retired: see buildTown) */
const SHOW_GOTHIC_BACKDROP = false

export function groundHeight(x: number, z: number) {
  const bh = bridgeHeight(x, z)
  if (bh !== null) return bh
  if (z > 56) {
    const dg = descentGround(x, z)
    if (dg !== null) return dg
    if (z > 200) {
      const mg = castleGround(x, z)
      if (mg !== null) return mg
    }
    const vg = valleyGround(x, z)
    if (vg !== null) return vg
    if (inValley(x, z)) return VALLEY_Y
  }
  if (Math.hypot(x - GARDEN.x, z - GARDEN.z) < 3.25) return 0.36 // the gazebo's stone floor
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
  bloom = 0.22
  player: Character | null = null
  playerPos = new THREE.Vector3(SPAWN.x, 0, SPAWN.z)
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
  private hidden = new Map<string, THREE.Group>()
  private zoneT = 0
  private visited = new Set<string>()
  private markers = new Map<string, THREE.Mesh>()
  private fires: Fire[] = []
  private cloths: Cloth[] = []
  private dynamic: { update(t: number, dt: number): void }[] = []
  private smoke: Particles | null = null
  private embers: Particles | null = null
  private leaves: Leaves | null = null
  private cityStacks: Particles | null = null
  private fireflies: Fireflies[] = []
  /** night: a small pool of point lights handed to the lamps / torches / lanterns nearest the player */
  private lightPool: { light: THREE.PointLight; spot: LightSpot | null; target: number }[] = []
  private lightSpots: LightSpot[] = []
  /** the opening adventure's Guardian Lanterns + Golden Sigil */
  private quest: GuardianLanterns | null = null
  private questLights = new Set<string>()
  /** Chadville Estates: the plots' signs + whatever the owner has built */
  private estate: EstateView | null = null
  private poolTimer = 0
  readonly night = isNight()
  private city: ReturnType<typeof buildChadCity> | null = null
  private daylight: ReturnType<typeof buildDaylight> | null = null
  private disposables: (THREE.Material | THREE.Texture | THREE.BufferGeometry)[] = []
  paused = false
  private actionCooldown = 0
  /** time of the last manual camera drag (auto-follow waits a moment after it) */
  private lastLookT = -10
  /** sitting on a lookout bench: sit-down clip → seated loop → stand-up clip */
  private seat: { b: number; phase: 'enter' | 'sit' | 'exit'; t: number; dur: number } | null = null
  /** every bench the player can sit on (old town + districts) */
  seats: BenchSpot[] = [...BASE_SEATS]
  /** movement locked while a full-body action plays (picking up a seed) */
  private lockT = 0
  private pendingHide: { g: THREE.Object3D; t: number } | null = null
  /** sparkle markers over the not-yet-found talking pumpkins */
  private gourdMarks = new Map<string, THREE.Object3D>()
  /** Pumpkin Rush mini-game (lives in the square; the UI drives start / stop) */
  rush!: RushGame
  eventDir!: EventDirector
  range: TargetRange | null = null
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
    s.environment = engine.env
    s.environmentIntensity = 0.5
    this.bloom = this.night ? 0.6 : 0.22 // night: windows, lanterns, the moon and the fires halo; day: only glints
    this.buildTown(quality)
    this.camYaw = this.playerYaw + Math.PI
  }

  /* ───────────────────────── town assembly ───────────────────────── */

  private buildTown(q: Quality) {
    setNpcTextureCap(q === 'low' ? 512 : q === 'medium' ? 768 : 1024)
    const cob = TX.cobble()
    const plz = TX.plaza(q === 'high' ? 2048 : 1024) // the plaza's map + bump are the biggest textures: halve them below High
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
    const P = makePalette(tex, this.night)
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
    const SM = styleMaterials(style, tex, this.disposables, this.night)
    castle(T, style, SM)
    const citadelShrubs = citadel(T, SM)
    tavern(T, -12, 19, 'e')
    forge(T, -16, -13, 's')
    hollowHouse(T, 21, -19.5, 'w')
    chadSquareGate(T, 27.5, SM.stone, SM.trim)
    house(T, { x: -9.5, z: -19, w: 6, d: 5, face: 'e', roof: P.roofSlate, seed: 3 })
    house(T, { x: 9.5, z: -19.5, w: 6, d: 5, face: 'w', roof: P.roofRed, seed: 7 })
    house(T, { x: -25, z: 13.5, w: 6, d: 5, face: 'n', roof: P.roofOrange, seed: 11 })
    house(T, { x: -26, z: -9.5, w: 6, d: 5, face: 's', roof: P.roofRed, seed: 13 })
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
    // Hazel's garden fence, with a gate gap at her front door
    fence(T, [[-22, 10.4], [-24.1, 10.4]])
    fence(T, [[-25.9, 10.4], [-28.2, 10.4]])

    clutter(T)
    kingdom(T, style, SM, q)
    // ── CHAD CITY: the canal + bridges, the arrival forecourt + gateway, the balustraded city edge ──
    const rail = railingMaterial(this.disposables)
    waterfront(T, wn, SM.stone, SM.trim, rail)
    arrival(T, SM.stone, SM.trim)
    perimeter(T, SM.stone, SM.trim, rail)
    // districts: gym frontage + yard, Arcade Street + PUMP ARCADE (east); social corner, garden, overlook (west)
    eastside(T, tex.stone)
    if (EXPANSION_OPEN) southshore(T, tex.stone) // Southshore: next update
    const extraSeats: BenchSpot[] = []
    const greenery = westside(T, SM.stone, SM.trim, stripes[1], extraSeats)
    hauntedQuarter(T, SM.stone, SM.trim)
    motorRow(T, tex.stone)
    enchantedForest(T, q, extraSeats)
    moonlightLake(T, wn, q, extraSeats)
    this.quest = guardianLanterns(T)
    estatesDistrict(T)
    this.estate = new EstateView(T, this.colliders)
    greenery.potted = [...citadelShrubs, ...GATE_SHRUBS, ...GYM_SHRUBS, ...WORKSHOP_SHRUBS]
    lawns(T, SM.trim, extraSeats, greenery)
    this.seats.push(...extraSeats)
    chadRides(T, SM.trim)
    // the valley city (Downtown, the Gate Plaza, the castle mountain) is built in its own frame, 52 m below the village
    // FIRST RELEASE: the valley stays as distant scenery only (the castle on its mountain, the descending road, the lake + bridge seen from the
    // overlook edge). Chad City (Downtown), the hamlet, woodland trail, watchtower and Mooncrest Manor — buildings, colliders, lights,
    // interiors, NPCs — are built only when the expansion is open (see launch.ts).
    inFrame(T, CASTLE_AT, q !== 'low', (L) => {
      castleRoad(L, q)
      summitCastle(L)
      if (EXPANSION_OPEN) downtown(L)
      else citySkyline(L) // shells only: the view of Chad City from the overlook, none of its interiors, colliders, lights or NPCs
    })
    descentRoad(T, q)
    const valleySeats: BenchSpot[] = []
    valleyLake(T, wn, q, valleySeats, tex.stone)
    if (EXPANSION_OPEN) {
      woodland(T, q)
      hamlet(T, q, tex.stone, valleySeats)
      watchtower(T)
      manor(T, q, tex.stone, valleySeats)
    }
    this.seats.push(...valleySeats)
    squareExtras(T, SM.trim)
    // street trees + bushes for the south + east districts
    greenery.trees.push(...MOTOR_ROW_TREES)
    greenery.trees.push([-12.5, 49.6], [12.5, 49.6], [-14, 71], [24.5, 70], [-26, 30.5], [26, 30.5], [33, 1], [52, 2], [56, 31], [36.5, 31.5], [48.6, 31.2])
    greenery.bushes.push([-13, 66.4], [-12.2, 66.4], [-9.5, 55.2], [9.5, 55.2], [-5.2, 46.6], [5.2, 46.6], [30.6, 2.2], [30.6, 10.5])
    // lamps along the new streets (same family as the old town's)
    lampPosts(T, [
      [-4.4, 48.5], [4.4, 48.5], [-4.4, 56.5], [4.4, 56.5], [-4.4, 69.5], [4.4, 69.5],
      [-8, 35.8], [8, 35.8], [-15, 35.8], [15, 35.8], [-23, 35.8], [23, 35.8], [-12, 46.4], [12, 46.4], [-24, 46.4], [24, 46.4],
      [14, 15.6], [22, 15.6], [14, 22.4], [22, 22.4], [29.6, 15.7], [29.6, 22.3], [37.45, 15.7], [37.45, 22.3], [46.2, 15.7], [46.2, 22.3],
      [-33.5, 12.4], [-54.5, 12.4], [-33.5, 33.6], [-46, 5.4], [-47, 42], [-58.4, 34],
      [-7.2, -12.6], [7.2, -12.6],
      ...MOTOR_ROW_LAMPS,
      ...lakeLamps(),
      ...ESTATE_LAMPS,
      ...(EXPANSION_OPEN ? SOUTHSHORE_LAMPS : []), // Southshore + Mill Row are the next update
      ...(EXPANSION_OPEN ? MILL_LAMPS : []),
    ])
    this.city = buildChadCity(this.scene, q, this.disposables, this.night)
    // the great distant skyline now stands far beyond the valley city (it is the backdrop, not a place you can reach)
    this.city.group.position.set(0, -8, 340)
    // (retired: the repeated pointed-tower backdrop now crowded the lake and the real city — the valley city, the lake, the castle mountain and the ridge ranges replace it)
    this.city.group.visible = SHOW_GOTHIC_BACKDROP

    // vegetation avoids roads, plaza and buildings
    const avoid = (x: number, z: number) => {
      if (Math.hypot(x, z) < 12.8) return true
      if (x < -58) return true // the Haunted Quarter dresses its own ground
      if (x > 64 || (x < -40 && z < -18) || (x < -10 && z > 74)) return true // so do Moonlight Lake + the Enchanted Forest
      if (x < -30 && x > -66 && z > 43) return true // and Chadville Estates (lanes + plots stay clear)
      if (x > 28 && z > 29 && z < 58 && (Math.abs(z - 36.25) < 3 || z > 38)) return true // Motor Row: street, forecourts, shops
      for (const r of ROADS) {
        const dx = r.x1 - r.x0, dz = r.z1 - r.z0
        const t = Math.max(0, Math.min(1, ((x - r.x0) * dx + (z - r.z0) * dz) / (dx * dx + dz * dz)))
        if (Math.hypot(x - (r.x0 + dx * t), z - (r.z0 + dz * t)) < r.w / 2 + 0.7) return true
      }
      for (const c of this.colliders) {
        if (c.kind === 'box' && x > c.minX - 0.8 && x < c.maxX + 0.8 && z > c.minZ - 0.8 && z < c.maxZ + 0.8) return true
        if (c.kind === 'circle' && Math.hypot(x - c.x, z - c.z) < c.r + 0.5) return true
      }
      if (z < CASTLE_Z + 2) return true
      // the districts' paving, water and yards stay clear of grass tufts + rocks
      if (z > CANAL.z0 - 4.2 && z < CANAL.z1 + 3.2 && x > -31 && x < 31) return true // canal + promenades
      if (z > 44 && Math.abs(x) < 15.6) return true // arrival forecourt + avenue
      if (Math.abs(x - RIDES.x) < 5 && Math.abs(z - RIDES.z) < 4) return true
      if (z > 15 && z < 23 && x > 2 && x < 48) return true // arcade street
      if (x > 15 && x < 30 && z > 1.5 && z < 12) return true // gym yard
      if (x > ARCADE.x - 6 && z > 10 && z < 28) return true
      if (x < -32 && z > -6 && z < 12) return true // social corner
      if (x < -32 && z > 12.5 && z < 34) return true // the garden (flowerbeds instead)
      if (x < -45 && z > 33) return true // overlook terrace
      if (x > PATCH.x0 - 0.5 && x < PATCH.x1 + 0.5 && z > PATCH.z0 - 0.5 && z < PATCH.z1 + 0.5) return true // pumpkin patch
      if (z < -11 && z > -24 && Math.abs(x) < 7) return true // citadel forecourt
      return !insideCity(x, z, 0.3)
    }
    this.rushCart(T) // before vegetation (nothing grows through it) and before the static batch is built
    this.pumpkinPatches(T)
    // spawn fingerpost: the first thing a new player sees on the road tells them where everything is
    fingerpost(T, -3.9, 18.8, [
      { label: 'SQUARE · CITADEL', to: [0, -20] },
      { label: 'MARKET · GARDEN', to: [-21, 2.5] },
      { label: 'PUMP GYM', to: [14.4, -4] },
      { label: 'ARCADE STREET', to: [30, 19] },
      { label: 'CANAL · GATEWAY', to: [0, 50] },
    ])
    // the forecourt fingerpost: every district from where you arrive
    fingerpost(T, 2.6, 57.6, [
      { label: 'CHAD SQUARE', to: [0, 0] },
      { label: 'PUMP GYM', to: [14.4, -4] },
      { label: 'ARCADE STREET', to: [40, 19] },
      { label: 'MARKET · GARDEN', to: [-30, 6] },
      { label: 'HAUNTED QUARTER', to: [-60, 2.5] },
      { label: 'CHAD RIDES', to: [12, 66.5] },
    ])
    streetDetails(T, SM.trim)
    vegetation(T, q, avoid, greenery)
    // every pumpkin in the kingdom → three merged meshes; carved ones flicker together
    const pk = T.pumpkins!.build(this.scene, this.disposables, q !== 'low')
    T.dynamic.push({ update: (t) => pk.update(t) })

    // merge everything static into a few draw calls
    T.batch.build(this.scene, q !== 'low')

    // dynamic bits
    this.fires = T.fires
    this.cloths = T.cloths
    this.dynamic = T.dynamic
    if (this.night) {
      // night: every lamp, torch and lantern is a candidate; the pool follows the player (see updateLightPool)
      this.lightSpots = T.lights
      const N = q === 'high' ? 4 : q === 'medium' ? 3 : 0
      for (let i = 0; i < N; i++) {
        const light = new THREE.PointLight('#ffb060', 0, 10, 1.6)
        light.position.set(0, -50, 0)
        this.scene.add(light)
        this.lightPool.push({ light, spot: null, target: 0 })
      }
      this.updateLightPool(99)
      // warm light pools on the ground under every lamp, torch and lantern: one instanced, additive draw call,
      // so the whole town reads lamplit without paying per-pixel point lights everywhere
      const spots = T.lights.filter((L) => L.y < 7)
      const c = document.createElement('canvas')
      c.width = c.height = 128
      const g = c.getContext('2d')!
      const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
      grd.addColorStop(0, 'rgba(255,255,255,0.55)')
      grd.addColorStop(0.35, 'rgba(255,255,255,0.22)')
      grd.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = grd
      g.fillRect(0, 0, 128, 128)
      const pt = new THREE.CanvasTexture(c)
      const pg = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
      const pm = new THREE.MeshBasicMaterial({ map: pt, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, fog: true })
      this.disposables.push(pt, pg, pm)
      const pools = new THREE.InstancedMesh(pg, pm, Math.max(1, spots.length))
      const m4 = new THREE.Matrix4()
      const col = new THREE.Color()
      spots.forEach((L, i) => {
        const r = Math.min(9, Math.max(3.5, L.dist * 0.75))
        m4.makeScale(r, 1, r).setPosition(L.x, groundHeight(L.x, L.z) + 0.05, L.z)
        pools.setMatrixAt(i, m4)
        pools.setColorAt(i, col.set(L.color).multiplyScalar(Math.min(1.1, 0.35 + L.intensity / 22)))
      })
      pools.count = spots.length
      pools.renderOrder = 1
      pools.frustumCulled = false
      this.scene.add(pools)
    } else {
      const maxLights = q === 'high' ? 3 : q === 'medium' ? 2 : 0 // daylight: lamps are accents, not light sources
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
    }
    if (q !== 'low') {
      this.smoke = new Particles(T.smoke, q === 'high' ? 14 : 9, 'smoke', this.night ? '#3e3850' : '#5a5260', false)
      this.scene.add(this.smoke.points)
      if (this.night && T.embers.length) {
        this.embers = new Particles(T.embers, q === 'high' ? 10 : 6, 'embers', '#ff8a30', true)
        this.scene.add(this.embers.points)
      }
      // chimney smoke over the Gothic city (scaled up: it's hundreds of metres away)
      if (SHOW_GOTHIC_BACKDROP && this.city.chimneys.length) {
        this.cityStacks = new Particles(this.city.chimneys.map((c) => ({ x: c.x, y: c.y - 8, z: c.z + 340 })), q === 'high' ? 6 : 4, 'smoke', this.night ? '#4a4262' : '#9a96a0', false, 7)
        this.scene.add(this.cityStacks.points)
      }
    }
    if (this.night) {
      const k = q === 'high' ? 1 : q === 'medium' ? 0.6 : 0.35
      const n = (v: number) => Math.max(2, Math.round(v * k))
      // fireflies over the garden, the canal banks, the orchard, the pumpkin patch and the lawns
      this.fireflies.push(
        new Fireflies(
          [
            { x: -44, y: 0.4, z: 23, r: 9, n: n(26) },
            { x: -14, y: 0.3, z: 46.5, r: 7, n: n(12) },
            { x: 14, y: 0.3, z: 46.5, r: 7, n: n(12) },
            { x: 44, y: 0.5, z: 1, r: 8, n: n(16) },
            { x: -23, y: 0.3, z: 60, r: 6, n: n(12) },
            { x: 16, y: 0.3, z: 54, r: 7, n: n(12) },
            { x: -53, y: 0.6, z: 38, r: 5, n: n(8) },
          ],
          '#d6ff7a',
        ),
      )
      // violet magic motes rising round the fountain and the citadel doors
      this.fireflies.push(new Fireflies([{ x: 0, y: 0.6, z: 0, r: 5.5, n: n(22) }, { x: 0, y: 0.8, z: -25, r: 5, n: n(16) }, { x: 0, y: 0.8, z: 51, r: 6, n: n(14) }], '#b98cff', 3.5))
      // ghost wisps drifting over the Haunted Quarter's graveyard, its square and its lanes
      this.fireflies.push(new Fireflies([{ x: -96, y: 0.5, z: 15, r: 5, n: n(18) }, { x: -80, y: 0.6, z: 2.5, r: 5, n: n(12) }, { x: -68, y: 0.5, z: 2.5, r: 6, n: n(10) }], '#a8ffe8'))
      // wisps among the forest trees, fireflies over the lake shore
      this.fireflies.push(new Fireflies(FOREST_WISPS.map((a) => ({ ...a, n: n(a.n) })), '#a8ffe8', 1.5))
      this.fireflies.push(new Fireflies(LAKE_FIREFLIES.map((a) => ({ ...a, n: n(a.n) })), '#d6ff7a'))
      for (const f of this.fireflies) this.scene.add(f.points)
    }
    this.leaves = new Leaves(q === 'high' ? 90 : q === 'medium' ? 55 : 25)
    this.scene.add(this.leaves.mesh)

    this.daylight = buildDaylight(this.scene, q, this.disposables, skyPresetFromUrl(), this.engine.renderer)
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
      [-13.4, 1.0, 0.24, 0.2],
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

  /** is (x, z) clear, plain ground for a prop (inside the village, level, off every collider and every sellable estate plot)? */
  private plainGround(x: number, z: number) {
    if (isLocked(x, z) || !insideCity(x, z, 0.8) || inCanal(x, z, 1) || Math.abs(groundHeight(x, z)) > 0.35) return false
    if (x < -29 && z > 40) return false // Chadville Estates (plots to buy and build on)
    if (Math.hypot(x, z) < 8) return false // the fountain
    for (const c of this.colliders) {
      if (c.kind === 'circle' ? Math.hypot(x - c.x, z - c.z) < c.r + 0.5 : x > c.minX - 0.5 && x < c.maxX + 0.5 && z > c.minZ - 0.5 && z < c.maxZ + 0.5) return false
    }
    return true
  }

  /** QA: an ASCII map of plainGround over the village (2 m cells) */
  siteMap() {
    const rows: string[] = []
    for (let z = -10; z <= 74; z += 2) {
      let r = ''
      for (let x = -62; x <= 130; x += 2) r += this.plainGround(x, z) ? '.' : '#'
      rows.push(String(z).padStart(4) + ' ' + r)
    }
    return rows
  }

  /** the open lawn on Moonlight Lake's south shore (else the nearest spot) with a clear 10 × 18 m rectangle (any quarter-turn), tested on the finished colliders */
  private findRangeSite(walk: (x: number, z: number) => boolean) {
    void walk
    const cands: { x: number; z: number; yaw: number; d: number }[] = []
    // preference: the open lawn on the lake's south shore (the village's one big flat green), then anywhere clear nearer the square
    for (let x = -60; x <= 126; x += 2) for (let z = -8; z <= 68; z += 2) for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) cands.push({ x, z, yaw, d: Math.hypot(x - 84, z - 56) })
    cands.sort((a, b) => a.d - b.d)
    for (const c of cands) {
      const f = [Math.sin(c.yaw), Math.cos(c.yaw)]
      const r = [-Math.cos(c.yaw), Math.sin(c.yaw)]
      let ok = true
      for (let lz = -2; lz <= 16 && ok; lz += 1.5) for (let lx = -5; lx <= 5 && ok; lx += 1.5) ok = this.plainGround(c.x + r[0] * lx + f[0] * lz, c.z + r[1] * lx + f[1] * lz)
      if (ok) return { x: c.x, z: c.z, yaw: c.yaw }
    }
    return null
  }

  private buildSky() {
    mountains(this.scene, this.disposables, this.night)
  }

  private buildInteractables(T: Town) {
    // anything in the locked expansion is not offered (the data stays for the next update)
    const add = (id: string, label: string, x: number, z: number, radius: number, kind: Interactable['kind']) => {
      if (isLocked(x, z)) return
      this.interactables.push({ id, label, pos: new THREE.Vector3(x, 0, z), radius, kind })
    }
    if (!EXPANSION_OPEN) add('valley_gate', 'Read the notice at the Valley Gate', VALLEY_GATE.x, VALLEY_GATE.z - 1.6, 2.3, 'info')
    add('statue', 'Read the fountain plaque', 0, 6.7, 1.6, 'info')
    // Moonlight Lake: fishing off the end of the pier
    add('fishing', 'Fish off the pier', 98, 33.2, 1.6, 'activity')
    // Moonmere: fishing off the landing's pier, and the small finds on the way down
    add('fishing_landing', 'Fish off the lakeside pier', LAKE_PIER.x + 0.7, LAKE_PIER.z, 1.9, 'activity')
    for (const d of VALLEY_DISCOVERIES) add(`disc:${d.id}`, d.name, d.x, d.z, 1.9, 'info')
    add('gate', 'Knock on the citadel doors', 0, -28.2, 1.8, 'info')
    add('gym', 'Enter Pump Gym', 14.4, -4, 2.2, 'activity')
    // every village home + Arcade Street shop: its front door opens into its own interior
    for (const h of HOUSES) {
      if (h.id === 'home') continue // your cottage's door follows your build (setEstate)
      const d = doorSpot(h)
      add(`house:${h.id}`, `Enter ${h.name}`, d.x, d.z, 1.15, 'activity')
    }
    const nb = standFor(NOTICE)
    add('board', 'Read the community noticeboard', nb.x, nb.z, 1.5, 'info')
    const ch = standFor(CHAMPIONS, 1.8)
    add('champions', 'Look at the Community Champions case', ch.x, ch.z, 1.4, 'info')
    add('citygate', 'Read the welcome board', WELCOME.x + 0.5, WELCOME.z + 1.3, 1.4, 'info')
    add('citymap', 'Study the city map', MAPBOARD.x - 0.5, MAPBOARD.z + 1.3, 1.4, 'info')
    add('rides', 'Look at Chad Rides', RIDES.x - 1.5, RIDES.z - 2.9, 1.6, 'info')
    add('overlook', 'Take in the view from Chad View', OVERLOOK.x + 1.5, OVERLOOK.z + 0.5, 1.8, 'info')
    add('lore_citadel', 'Read the citadel plaque', CITADEL.lore.x + 0.5, CITADEL.lore.z + 0.95, 1.2, 'info')
    add('yard', 'Read the yard board', 17.4, 12.9, 1.3, 'info')
    add('well', 'Toss a coin in the wishing well', -29.4, 2.5, 1.7, 'activity')
    add('window', 'Peer through the window', 16.6, -19.5, 1.8, 'info')
    add('arcade', 'Pump Arcade — opening soon', ARCADE.x - 2.4, ARCADE.z, 2.4, 'info')
    add('rune', 'Press the strange rune', -23.6, -25.5, 1.6, 'secret')
    add('pumpkin', 'Poke the suspicious pumpkin', -9.6, 10.4, 2.1, 'info')
    this.seats.forEach((b, i) => add(`bench_${i}`, b.label, b.x + Math.sin(b.ry) * 0.75, b.z + Math.cos(b.ry) * 0.75, 1.1, 'activity'))
    add('rush', 'Play Pumpkin Rush', RUSH_CART.x, RUSH_CART.z + 1.3, 1.5, 'activity')
    add('events', 'Read the Events Board', 6.5, 9.5, 2.5, 'activity')
    add('wardrobe', 'Browse the wardrobe stall', -24, 5.0, 1.3, 'info')
    add('lookout', 'Look out over the canal', -5.4, 32.4, 1.5, 'info')
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
    // the same test with player-width clearance and curb-height tolerance: what a runner can actually pass
    const walk = (x: number, z: number) => {
      if (Math.hypot(x, z) > 29.5 || Math.abs(groundHeight(x, z)) > 0.6) return false
      for (const c of this.colliders) {
        if (c.kind === 'circle' ? Math.hypot(x - c.x, z - c.z) < c.r + 0.62 : x > c.minX - 0.62 && x < c.maxX + 0.62 && z > c.minZ - 0.62 && z < c.maxZ + 0.62) return false
      }
      return true
    }
    // the same two tests for ANY village ground (the Ghost Hunt works in the Haunted Quarter, not just the square)
    const clearAt = (x: number, z: number, m: number) => {
      if (isLocked(x, z) || !insideCity(x, z, 0.5) || inCanal(x, z, 0.8) || Math.abs(groundHeight(x, z)) > 0.6) return false
      for (const c of this.colliders) {
        if (c.kind === 'circle' ? Math.hypot(x - c.x, z - c.z) < c.r + m : x > c.minX - m && x < c.maxX + m && z > c.minZ - m && z < c.maxZ + m) return false
      }
      return true
    }
    this.eventDir = new EventDirector(this.scene, open, walk, { walk: (x, z) => clearAt(x, z, 0.62), open: (x, z) => clearAt(x, z, 0.9) }, groundHeight, { r: 29 })
    // GHOST HUNT: a lantern-post at the Haunted Quarter's gate starts it (hidden ghosts, bounded to the quarter)
    {
      const post = new THREE.Group()
      const iron = new THREE.MeshStandardMaterial({ color: 0x25242a, metalness: 0.6, roughness: 0.5 })
      const orb = new THREE.MeshBasicMaterial({ color: 0x9ff0d0 })
      const pg = new THREE.CylinderGeometry(0.05, 0.07, 2.4, 6)
      const og = new THREE.SphereGeometry(0.2, 12, 8)
      this.disposables.push(iron, orb, pg, og)
      const pole = new THREE.Mesh(pg, iron)
      pole.position.y = 1.2
      const o = new THREE.Mesh(og, orb)
      o.position.y = 2.55
      post.add(pole, o)
      post.position.set(-60.6, groundHeight(-60.6, 4.6), 4.6)
      this.scene.add(post)
      T.dynamic.push({ update: (t) => (o.scale.setScalar(1 + Math.sin(t * 2.4) * 0.12)) })
      this.colliders.push({ kind: 'circle', x: -60.6, z: 4.6, r: 0.3, h: 2.5 })
      add('ghosthunt', 'Take up the Ghost Hunt', -61.4, 3.4, 2.4, 'activity')
    }
    // PUMPKIN TOSS: a target range on the nearest open ground big enough for it (searched against the finished colliders)
    const site = this.findRangeSite(walk)
    if (site) {
      const note = new THREE.MeshStandardMaterial({ map: boardTexture('PUMPKIN TOSS', ['10 throws · click or tap', 'bullseye 50'], 1.8, PANEL.dark, this.disposables), roughness: 0.8 })
      this.disposables.push(note)
      this.range = new TargetRange(this.scene, this.camera, site, groundHeight, () => this.playerPos, note)
      this.colliders.push(...this.range.colliders())
      const s = this.range.at(0, -1.6)
      add('target', 'Play Pumpkin Toss', s.x, s.z, 2.0, 'activity')
    }
    for (const r of RESIDENTS) if (r.talk) add(r.id, r.talk, r.talkAt?.[0] ?? r.x, r.talkAt?.[1] ?? r.z, r.talkAt ? 1.6 : 2.2, 'talk')

    // the Events Board: two posts and a lit notice, where the village events are started
    {
      const wood = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 0.9 })
      const paper = new THREE.MeshStandardMaterial({ map: boardTexture('VILLAGE EVENTS', ['Pumpkin Hunt · Ghost Invasion', 'Harvest Festival · Thunderstorm', 'Square Time Trial — press E'], 1.9, PANEL.dark, this.disposables), roughness: 0.8 })
      const eb = new THREE.Group()
      const g1 = new THREE.BoxGeometry(0.14, 2.1, 0.14)
      const g2 = new THREE.BoxGeometry(1.7, 1.0, 0.1)
      const g3 = new THREE.BoxGeometry(1.5, 0.8, 0.04)
      this.disposables.push(g1, g2, g3, wood, paper)
      for (const dx of [-0.8, 0.8]) {
        const post = new THREE.Mesh(g1, wood)
        post.position.set(dx, 1.05, 0)
        eb.add(post)
      }
      const plank = new THREE.Mesh(g2, wood)
      plank.position.y = 1.6
      const note = new THREE.Mesh(g3, paper)
      note.position.set(0, 1.6, 0.07)
      eb.add(plank, note)
      eb.position.set(6.5, groundHeight(6.5, 9.5), 9.5)
      eb.rotation.y = -0.5
      this.scene.add(eb)
      this.colliders.push({ kind: 'circle', x: 6.5, z: 9.5, r: 0.9, h: 2 })
    }

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
    rune.position.set(-23.6, 0.12, -25.5)
    this.scene.add(rune)
    const glyph = new THREE.Mesh(new THREE.CircleGeometry(0.18, 6), T.P.glowPurple)
    glyph.rotation.x = -Math.PI / 2
    glyph.position.set(-23.6, 0.26, -25.5)
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
    this.stash.position.set(-21.9, 0, -24.3)
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

    // hidden pumpkins: a small carved pumpkin with a soft sparkle ring, no marker (that's the hunt)
    {
      const hpGeo = new THREE.SphereGeometry(0.2, 14, 10).scale(1.2, 0.85, 1.2)
      const hpMat = new THREE.MeshStandardMaterial({ color: '#ff8a2a', emissive: '#ff6a10', emissiveIntensity: 0.55, roughness: 0.5 })
      const stemGeo = new THREE.CylinderGeometry(0.025, 0.04, 0.1, 6)
      const sparkGeo = new THREE.RingGeometry(0.34, 0.4, 24).rotateX(-Math.PI / 2)
      const sparkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd27a').multiplyScalar(1.2), transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false })
      this.disposables.push(hpGeo, hpMat, stemGeo, sparkGeo, sparkMat)
      for (const [id, x, z] of HIDDEN) {
        const g = new THREE.Group()
        const body = new THREE.Mesh(hpGeo, hpMat)
        body.position.y = 0.18
        body.castShadow = true
        const stem = new THREE.Mesh(stemGeo, T.P.foliage)
        stem.position.y = 0.38
        const ring = new THREE.Mesh(sparkGeo, sparkMat)
        ring.position.y = 0.04
        g.add(body, stem, ring)
        g.position.set(x, groundHeight(x, z), z)
        this.scene.add(g)
        this.hidden.set(id, g)
        add(id, 'Pick up the hidden pumpkin', x, z, 1.1, 'collect')
      }
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
      if (it.id === 'gym') m.position.x = 14.2
      if (it.id === 'well') m.position.x = -31
      const res = RESIDENTS.find((r) => r.id === it.id)
      if (res?.talkAt) m.position.set(res.x, y, res.z)
      this.scene.add(m)
      this.markers.set(it.id, m)
    }
  }

  /** Loads the player and townsfolk (async because GLB models may download). */
  /** the companion following you (null = none); swapping replaces the old one beside you */
  pet: Pet | null = null
  setPet(kind: PetKind | null) {
    if (this.pet?.kind === kind) return
    this.pet?.dispose()
    this.pet = kind ? new Pet(kind) : null
    if (this.pet) this.scene.add(this.pet.root)
  }

  async populate(player: Appearance, spawn: SpawnAt = 'start', discoveries: string[] = []) {
    // the representative real-scan plants (Poly Haven, optimised); if they cannot load the same spots get procedural plants
    if (!(await placeHeroVeg(this.scene, this.disposables, this.quality))) {
      const FB = new FoliageBuilder(88, this.quality === 'high' ? 1 : 0.6)
      for (const [x, z] of HERO_TREES) FB.plant('oak', x, z, 1, [new THREE.Color('#4f8a3a'), new THREE.Color('#5f9a40')], new THREE.Color('#3a2a20'))
      for (const [x, y, z, s] of HERO_SHRUBS) FB.bush(x, y, z, s * 2, new THREE.Color('#3f5e34'))
      FB.build(this.scene, leafTexture(this.disposables), this.disposables, false)
    }
    const [p] = await Promise.all([createCharacter(player), this.crowd.load(this.scene, this.quality, groundHeight, this.night)])
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
      if (d.startsWith('hp_')) this.collectHidden(d)
      if (d.startsWith('visit_')) this.visited.add(d)
    }
    this.questSync(discoveries)
    this.spawn(spawn)
  }

  /**
   * The opening adventure, from the save: lit lanterns burn (and join the night light pool), unlit ones show a gold
   * marker once Goldie has asked for help, and the Golden Sigil rises at the Citadel doors when all three burn.
   */
  /** the active objective's location (or null): its marker stays big and gold; every other hint is small and only near you */
  private track: { x: number; z: number } | null = null
  setTrack(t: { x: number; z: number } | null) {
    this.track = t
  }

  questSync(d: string[]) {
    const q = this.quest
    if (!q) return
    const started = d.includes('q1_start')
    const done = d.includes('q1_sigil')
    let lit = 0
    for (const L of LANTERNS) {
      const on = done || d.includes(`q1_lantern_${L.id}`)
      if (on) lit++
      q.setLit(L.id, on)
      q.setMarker(L.id, started && !on)
      const id = `lantern:${L.id}`
      if (on) {
        this.interactables = this.interactables.filter((i) => i.id !== id)
        if (!this.questLights.has(L.id)) {
          this.questLights.add(L.id)
          this.lightSpots.push({ x: L.x, y: 1.4, z: L.z, color: '#ffc864', intensity: 4, dist: 8, priority: 1 })
        }
        continue
      }
      let it = this.interactables.find((i) => i.id === id)
      if (!it) {
        it = { id, label: '', pos: new THREE.Vector3(L.x, 0, L.z), radius: 1.6, kind: 'info' }
        this.interactables.push(it)
      }
      it.label = started ? 'Relight the Guardian Lantern' : 'Look at the cold lantern'
      it.kind = started ? 'activity' : 'info'
    }
    const sigil = lit === LANTERNS.length && !done
    q.setSigil(sigil)
    this.interactables = this.interactables.filter((i) => i.id !== 'sigil')
    if (sigil) this.interactables.push({ id: 'sigil', label: 'Claim the Golden Sigil', pos: new THREE.Vector3(SIGIL.x, 0, SIGIL.z), radius: 1.8, kind: 'activity' })
    // chapter 2: the Elder Oak's hollow + the moonstone always have something to say; during the quest they're the steps
    const q2 = d.includes('q2_start') && !d.includes('q2_stone')
    for (const [id, x, z, label, active] of [
      ['oak', FOREST.oak.x, FOREST.oak.z + 2.7, 'Listen at the Elder Oak', q2 && !d.includes('q2_oak')],
      ['moonstone', FOREST.glade.x, FOREST.glade.z + 1.7, 'Read the moonstone', q2 && d.includes('q2_oak')],
    ] as const) {
      let it = this.interactables.find((i) => i.id === id)
      if (!it) {
        it = { id, label, pos: new THREE.Vector3(x, 0, z), radius: 1.5, kind: 'info' }
        this.interactables.push(it)
      }
      it.kind = active ? 'activity' : 'info'
    }
  }

  /** Chadville Estates from the save: signs, built pieces (+ their colliders) and each plot's gate prompt */
  setEstate(e: Estate, ownerName: string) {
    this.estate?.set(e, ownerName)
    for (const p of PLOTS) {
      const id = `plot:${p.id}`
      const g = plotGate(p)
      let it = this.interactables.find((i) => i.id === id)
      if (!it) {
        it = { id, label: '', pos: new THREE.Vector3(g.x, 0, g.z), radius: 1.7, kind: 'activity' }
        this.interactables.push(it)
      }
      const mine = e.plot === p.id
      it.label = mine ? 'Build on your plot' : e.plot ? `${p.name} · sold` : `Buy ${p.name} · ${PLOT_PRICE} coins`
      it.kind = mine || !e.plot ? 'activity' : 'info'
    }
    // your cottage's front door (the first cottage on your plot)
    this.interactables = this.interactables.filter((i) => i.id !== 'house:home')
    const door = cottageDoor(e)
    if (door) {
      const out = door.half + 0.7
      this.interactables.push({ id: 'house:home', label: 'Enter your cottage', pos: new THREE.Vector3(door.x + Math.sin(door.face) * out, 0, door.z + Math.cos(door.face) * out), radius: 1.1, kind: 'activity' })
    }
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

  spawn(where: SpawnAt) {
    // never arrive inside the locked expansion (an old exit point, a stale link): back to the arrival gate
    if (typeof where === 'object' && isLocked(where.x, where.z)) where = { x: SAFE_ARRIVAL.x, z: SAFE_ARRIVAL.z, yaw: SAFE_ARRIVAL.yaw }
    if (typeof where === 'object') {
      // back out of a house: on the step outside its door, facing the street
      this.playerPos.set(where.x, 0, where.z)
      this.playerYaw = where.yaw
    } else if (where === 'gym') {
      this.playerPos.set(12.6, 0, -4)
      this.playerYaw = -Math.PI / 2
    } else {
      this.playerPos.set(SPAWN.x, 0, SPAWN.z)
      this.playerYaw = SPAWN.yaw
      this.camPitch = 0.1 // a low, looking-up view: the gateway, the avenue and the citadel all in frame
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
  /** a hidden pumpkin was picked up (or was already found on a previous visit) */
  collectHidden(id: string) {
    this.interactables = this.interactables.filter((i) => i.id !== id)
    const g = this.hidden.get(id)
    if (g) g.visible = false
  }
  /** a talking pumpkin was found: its sparkle marker goes out */
  gourdFound(id: string) {
    const s = this.gourdMarks.get(id)
    if (s) s.visible = false
  }
  /** sit on lookout bench i (plays the sit-down clip, then the seated loop until the player moves) */
  sit(i: number) {
    const b = this.seats[i]
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

  /**
   * The height of the surface under (x, z) for a walker whose feet are at height y: the top of the tallest LOW obstacle (<= LOW_OBSTACLE)
   * whose footprint contains the point and whose top is within a step of the feet — else the terrain (0). Tall obstacles never support you.
   */
  private floorAt(x: number, z: number, y: number) {
    let best = 0
    for (const c of this.colliders) {
      const h = c.h
      if (h === undefined || h > LOW_OBSTACLE || h <= KERB || h > y + STEP_UP + 1e-3 || h <= best) continue
      const inside = c.kind === 'circle' ? Math.hypot(x - c.x, z - c.z) < c.r : x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ
      if (inside) best = h
    }
    return best
  }

  /** a low obstacle straight ahead that a plain jump cannot clear but a vault can: returns the apex to ask for, else 0 */
  private vaultApex() {
    const ax = this.playerPos.x + Math.sin(this.playerYaw) * 1.25
    const az = this.playerPos.z + Math.cos(this.playerYaw) * 1.25
    let top = 0
    for (const c of this.colliders) {
      const h = c.h
      if (h === undefined || h > LOW_OBSTACLE || h < 0.55 || h <= top) continue
      const near = c.kind === 'circle' ? Math.hypot(ax - c.x, az - c.z) < c.r + 0.25 : ax > c.minX - 0.25 && ax < c.maxX + 0.25 && az > c.minZ - 0.25 && az < c.maxZ + 0.25
      if (near) top = h
    }
    return top > 0.55 ? top + 0.22 : 0
  }

  private resolve(p: THREE.Vector3, r: number, feetY = 0) {
    for (const c of this.colliders) {
      // feet above a LOW obstacle's top (a hop over a wall, standing on a bench): it does not push you out
      if (c.h !== undefined && c.h <= LOW_OBSTACLE && feetY >= c.h - 0.12) continue
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
    clampToCity(p, r + 0.15) // the city's edge: cliff parapets, the canal ends, the overlook rail
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

  /**
   * Night lighting: hand the pool's point lights to the light spots nearest the player (priority breaks ties),
   * re-chosen a few times a second; intensities ease in/out so lamps never pop. Fires flicker their light.
   */
  private updateLightPool(dt: number) {
    this.poolTimer -= dt
    const p = this.playerPos
    if (this.poolTimer <= 0) {
      this.poolTimer = 0.4
      const ranked = this.lightSpots
        .map((L) => ({ L, d: Math.hypot(L.x - p.x, L.z - p.z) + L.priority * 1.5 }))
        .filter((r) => r.d < 34)
        .sort((a, b) => a.d - b.d)
        .slice(0, this.lightPool.length)
        .map((r) => r.L)
      const keep = new Set(ranked)
      // slots already showing a wanted spot keep it; the rest fade out and are reassigned once dark
      for (const slot of this.lightPool) slot.target = slot.spot && keep.has(slot.spot) ? slot.spot.intensity : 0
      const shown = new Set(this.lightPool.map((s) => s.spot).filter((s) => s && keep.has(s)))
      for (const L of ranked) {
        if (shown.has(L)) continue
        const free = this.lightPool.find((s) => s.target === 0 && s.light.intensity < 0.05)
        if (!free) break
        free.spot = L
        free.target = L.intensity
        free.light.color.set(L.color)
        free.light.distance = L.dist
        free.light.position.set(L.x, L.y, L.z)
        shown.add(L)
      }
    }
    const k = Math.min(1, dt * 3)
    for (const slot of this.lightPool) {
      const flick = slot.spot?.fire ? 0.85 + Math.sin(this.t * 13 + slot.spot.x) * 0.08 + Math.sin(this.t * 7.3 + slot.spot.z) * 0.07 : 1
      slot.light.intensity += (slot.target * flick - slot.light.intensity) * k
    }
  }

  resize(w: number, h: number) {
    const portrait = h > w
    this.camera.fov = portrait ? 66 : 55
    this.camDist = portrait ? 7 : 6.4
    this.camera.updateProjectionMatrix()
    const pr = this.engine.renderer.getPixelRatio()
    this.smoke?.setPixelScale(h, pr)
    this.embers?.setPixelScale(h, pr)
    this.cityStacks?.setPixelScale(h, pr)
    for (const f of this.fireflies) f.setPixelScale(h, pr)
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
        const b = this.seats[seat.b]
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
    if (jumpReq && !this.paused && this.jumper.tryJump(p, this.vaultApex())) this.emoter.cancel(p)
    if (mag > 0.05 && this.emoter.busy) this.emoter.cancel(p)
    this.jumper.update(dt, p, this.floorAt(this.playerPos.x, this.playerPos.z, this.jumper.y))
    this.emoter.update(dt)
    const nowSpeed = Math.hypot(this.playerVel.x, this.playerVel.z)
    this.playerVel.lerp(targetVel, 1 - Math.exp(-dt * velocityRate(mag > 0.01, nowSpeed, this.jumper.airborne)))
    const px = this.playerPos.x
    const pz = this.playerPos.z
    this.playerPos.addScaledVector(this.playerVel, dt)
    if (!this.seat) {
      this.resolve(this.playerPos, PLAYER_R, this.jumper.y) // seated = inside the bench's collider on purpose
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
      this.pet?.update(dt, this.playerPos, this.playerYaw, groundHeight, (q) => this.resolve(q, 0.2))
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
    if (this.intro) {
      const it = this.intro
      it.t += dt
      const u = Math.min(1, it.t / it.dur)
      const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2
      this.camera.position.copy(it.pos.getPoint(e))
      this.camera.lookAt(it.look.getPoint(e))
      if (u >= 1) this.endIntro()
    } else if (this.shotCam) {
      this.camera.position.copy(this.shotCam.cam)
      this.camera.lookAt(this.shotCam.look)
    } else this.placeCamera(1 - Math.exp(-dt * 9))

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
    this.cityStacks?.update(dt, t)
    for (const f of this.fireflies) f.update(dt, t)
    if (this.lightPool.length) this.updateLightPool(dt)
    this.daylight?.update(dt, this.playerPos)
    // fountain splash gets louder as you walk up to it
    audio.setWater(1 - Math.min(1, Math.max(0, (Math.hypot(this.playerPos.x, this.playerPos.z) - 5) / 13)))
    if (!this.paused) this.rush?.update(dt, this.playerPos, groundHeight)
    if (!this.paused) this.eventDir?.update(dt, this.playerPos)
    if (!this.paused) this.range?.update(dt)
    let mi = 0
    for (const [, m] of this.markers) {
      m.position.y += Math.sin(t * 2.4 + mi++) * 0.004
      m.rotation.y += dt * 1.6
      // hints are small and appear as you near them; only the tracked objective is large and always visible
      const isTrack = !!this.track && Math.hypot(m.position.x - this.track.x, m.position.z - this.track.z) < 3.2
      const dist = Math.hypot(m.position.x - this.playerPos.x, m.position.z - this.playerPos.z)
      const k = isTrack ? 1.5 : 0.62 * (1 - Math.min(1, Math.max(0, (dist - 9) / 7)))
      m.scale.setScalar(Math.max(0.0001, k))
      m.visible = k > 0.02
    }
    for (const [, s] of this.seeds) {
      s.rotation.y += dt * 2
      s.position.y = 0.55 + Math.sin(t * 2 + s.position.x) * 0.1
    }
    for (const [, h] of this.hidden) if (h.visible) h.rotation.y += dt * 0.8
    // Discover Chad City: places reached on foot (checked a few times a second)
    this.zoneT -= dt
    if (this.zoneT <= 0 && !this.paused) {
      this.zoneT = 0.3
      for (const zn of ZONES)
        if (!this.visited.has(zn.id) && zn.inside(this.playerPos.x, this.playerPos.z)) {
          this.visited.add(zn.id)
          this.events.onDiscover?.(zn.id)
        }
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
      walkerIds: this.crowd.live.filter((l) => l.walker).map((l) => l.def.id),
    }
  }
  /** first-visit flyover: the valley → over the gateway → down behind the player. Control returns at the end. */
  private intro: { t: number; dur: number; done: () => void; pos: THREE.CatmullRomCurve3; look: THREE.CatmullRomCurve3 } | null = null
  startIntro(done: () => void) {
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
    this.snapCamera()
    const end = this.camera.position.clone()
    const endLook = this.camTarget.clone()
    this.intro = {
      t: 0,
      dur: 7.5,
      done,
      pos: new THREE.CatmullRomCurve3([V(-6, 30, 118), V(10, 19, 92), V(4, 11.5, 70), V(1, 6.5, 66), end]),
      look: new THREE.CatmullRomCurve3([V(0, 6, 0), V(0, 7, 20), V(0, 7.5, 45), V(0, 5, 52), endLook]),
    }
  }
  /** skip / finish the flyover: the gameplay camera takes over exactly where it would be */
  endIntro() {
    if (!this.intro) return
    const done = this.intro.done
    this.intro = null
    this.snapCamera()
    done()
  }
  get introActive() {
    return !!this.intro
  }

  /** QA / marketing stills: a fixed camera (null = gameplay camera) */
  private shotCam: { cam: THREE.Vector3; look: THREE.Vector3 } | null = null
  setShotCam(o: { cam: [number, number, number]; look: [number, number, number]; fov?: number } | null) {
    this.shotCam = o ? { cam: new THREE.Vector3(...o.cam), look: new THREE.Vector3(...o.look) } : null
    this.camera.fov = o?.fov ?? (this.camera.aspect < 1 ? 66 : 55)
    this.camera.updateProjectionMatrix()
  }
  teleport(x: number, z: number, yaw?: number) {
    if (isLocked(x, z)) {
      x = SAFE_ARRIVAL.x
      z = SAFE_ARRIVAL.z
      yaw = SAFE_ARRIVAL.yaw
    }
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
    this.pet?.dispose()
    this.estate?.dispose()
    this.rush?.dispose()
    this.eventDir?.dispose()
    this.range?.dispose()
    this.daylight?.dispose()
    if (this.player) disposeCharacter(this.player)
    this.crowd.dispose()
    disposeObject(this.scene)
    this.disposables.forEach((d) => d.dispose())
    ;(this.smoke?.points.material as THREE.ShaderMaterial | undefined)?.uniforms.uMap.value.dispose()
    ;(this.embers?.points.material as THREE.ShaderMaterial | undefined)?.uniforms.uMap.value.dispose()
    ;(this.cityStacks?.points.material as THREE.ShaderMaterial | undefined)?.uniforms.uMap.value.dispose()
    for (const f of this.fireflies) (f.points.material as THREE.ShaderMaterial).uniforms.uMap.value.dispose()
    this.events.onPrompt(null)
  }
}

/** Warm sandstone ashlar for the citadel, walls and plinths: varied blocks, pale mortar, a little weathering. */
function stoneBlocks(size = 256) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  g.fillStyle = '#b9ad9a'
  g.fillRect(0, 0, size, size)
  let seed = 13
  const r = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  const rows = 6
  const h = size / rows
  for (let y = 0; y < rows; y++)
    for (let x = (y % 2) * -h * 0.8; x < size; x += h * 1.6) {
      const l = 70 + r() * 14
      g.fillStyle = `hsl(${32 + r() * 10}, ${16 + r() * 12}%, ${l}%)`
      g.fillRect(x + 2, y * h + 2, h * 1.6 - 4, h - 4)
      g.fillStyle = 'rgba(255,255,255,0.10)'
      g.fillRect(x + 3, y * h + 3, h * 1.6 - 6, 3)
      g.fillStyle = 'rgba(80,60,40,0.10)'
      g.fillRect(x + 3, y * h + h - 7, h * 1.6 - 6, 4)
      for (let k = 0; k < 6; k++) {
        g.fillStyle = `rgba(90,70,50,${r() * 0.12})`
        g.fillRect(x + 4 + r() * (h * 1.6 - 12), y * h + 4 + r() * (h - 10), 3 + r() * 6, 2 + r() * 4)
      }
    }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
