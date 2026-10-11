import * as THREE from 'three'
import { buildCharacter } from '../character/build'
import { createCharacter, disposeCharacter, type Character } from '../character/character'
import type { Appearance } from '../character/types'
import { audio } from '../audio'
import { disposeObject, type Engine, type GameScene } from '../engine/Engine'
import type { Input } from '../input'
import type { Quality } from '../save'
import { bannerTexture, cobbleTexture, signTexture, stoneTexture } from './textures'

type Collider = { kind: 'circle'; x: number; z: number; r: number } | { kind: 'box'; minX: number; maxX: number; minZ: number; maxZ: number }
export type Interactable = { id: string; label: string; pos: THREE.Vector3; radius: number }
export type WorldEvents = {
  onPrompt(p: Interactable | null): void
  onInteract(id: string): void
}

const BOUNDS = 36
const WALK = 3.4
const RUN = 6.2
const PLAYER_R = 0.45

export class World implements GameScene {
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200)
  bloom = 0.6
  player: Character | null = null
  private playerPos = new THREE.Vector3(0, 0, 13)
  private playerVel = new THREE.Vector3()
  private playerYaw = Math.PI
  private camYaw = 0
  private camPitch = 0.32
  private camDist = 6.4
  private camTarget = new THREE.Vector3()
  private colliders: Collider[] = []
  interactables: Interactable[] = []
  private prompt: Interactable | null = null
  private npcs = new Map<string, { c: Character; home: THREE.Vector3; facing: number }>()
  private oddPumpkin!: THREE.Group
  private boingT = -1
  private stash!: THREE.Group
  private stashT = -1
  private lanterns: THREE.PointLight[] = []
  private flames: THREE.Mesh[] = []
  private gymDoor!: THREE.Mesh
  paused = false
  private actionCooldown = 0
  cameraSensitivity = 1
  private t = 0
  private disposed = false
  private walkedTime = 0

  constructor(
    private engine: Engine,
    private input: Input,
    private events: WorldEvents,
    quality: Quality,
  ) {
    const s = this.scene
    s.background = new THREE.Color('#0a0810')
    s.fog = new THREE.FogExp2('#0d0a12', 0.022)
    s.environment = engine.env
    s.environmentIntensity = 0.18
    this.buildSky()
    this.buildGround()
    this.buildLights(quality)
    this.buildStatue()
    this.buildCastle()
    this.buildGym()
    this.buildProps()
    this.buildSecret()
    this.camYaw = this.playerYaw + Math.PI
  }

  /* ───────── world building ───────── */

  private buildSky() {
    const s = this.scene
    // moon + halo
    const moon = new THREE.Mesh(new THREE.SphereGeometry(6, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a0').multiplyScalar(2.88), toneMapped: false, fog: false }))
    moon.position.set(-40, 42, -110)
    s.add(moon)
    const halo = new THREE.Mesh(new THREE.CircleGeometry(16, 48), new THREE.MeshBasicMaterial({ color: '#ff9a3c', transparent: true, opacity: 0.08, fog: false, depthWrite: false }))
    halo.position.copy(moon.position).add(new THREE.Vector3(0, 0, 1))
    halo.lookAt(0, 0, 0)
    s.add(halo)
    // stars
    const N = 900
    const pos = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      const th = Math.random() * Math.PI * 2
      const ph = Math.random() * 0.45 * Math.PI
      const r = 140
      pos.set([Math.cos(th) * Math.cos(ph) * r, Math.sin(ph) * r + 10, Math.sin(th) * Math.cos(ph) * r], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    s.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#f3ece2', size: 0.6, sizeAttenuation: true, fog: false, transparent: true, opacity: 0.8 })))
    // distant silhouette hills (cheap ring of dark cones)
    const hillMat = new THREE.MeshBasicMaterial({ color: '#0b0910' })
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2
      const h = 10 + ((i * 37) % 11)
      const hill = new THREE.Mesh(new THREE.ConeGeometry(14, h, 5), hillMat)
      hill.position.set(Math.cos(a) * 75, h / 2 - 1, Math.sin(a) * 75)
      s.add(hill)
    }
  }

  private buildGround() {
    const tex = cobbleTexture()
    tex.repeat.set(18, 18)
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(60, 64),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.05, color: '#bdb2aa' }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)
    // inner plaza ring inlay (gold hairlines)
    for (const r of [7.5, 15.5]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.12, 96), new THREE.MeshStandardMaterial({ color: '#c89b3c', metalness: 1, roughness: 0.35 }))
      ring.rotation.x = -Math.PI / 2
      ring.position.y = 0.01
      this.scene.add(ring)
    }
    // low boundary wall with gaps for flavour; actual limit is BOUNDS
    const wallMat = new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 0.9 })
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2
      if (Math.abs(Math.sin(a)) < 0.25 && Math.cos(a) < 0) continue
      const seg = new THREE.Mesh(new THREE.BoxGeometry(6.6, 1.1, 0.8), wallMat)
      seg.position.set(Math.cos(a) * (BOUNDS + 1.2), 0.55, Math.sin(a) * (BOUNDS + 1.2))
      seg.rotation.y = -a + Math.PI / 2
      seg.castShadow = seg.receiveShadow = true
      this.scene.add(seg)
    }
  }

  private buildLights(q: Quality) {
    const s = this.scene
    s.add(new THREE.HemisphereLight('#5a4a78', '#1a0e08', 0.55))
    const moonLight = new THREE.DirectionalLight('#b9c6ff', 1.1)
    moonLight.position.set(-14, 24, -10)
    moonLight.castShadow = q !== 'low'
    moonLight.shadow.mapSize.set(q === 'high' ? 2048 : 1024, q === 'high' ? 2048 : 1024)
    const sc = moonLight.shadow.camera
    sc.left = sc.bottom = -30
    sc.right = sc.top = 30
    sc.near = 1
    sc.far = 70
    moonLight.shadow.bias = -0.0008
    moonLight.shadow.normalBias = 0.03
    s.add(moonLight)
    const warm = new THREE.DirectionalLight('#ff9a50', 0.35)
    warm.position.set(10, 6, 14)
    s.add(warm)

    // lanterns around the plaza. Only a few carry real lights (cost), the rest are emissive.
    const realLights = q === 'high' ? 4 : q === 'medium' ? 3 : 0
    const postMat = new THREE.MeshStandardMaterial({ color: '#1a161c', metalness: 0.7, roughness: 0.4 })
    const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffa040').multiplyScalar(4.32), toneMapped: false })
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8
      const x = Math.cos(a) * 12
      const z = Math.sin(a) * 12
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3.2, 8), postMat)
      post.position.set(x, 1.6, z)
      post.castShadow = true
      s.add(post)
      const cage = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), new THREE.MeshStandardMaterial({ color: '#2a222a', metalness: 0.8, roughness: 0.3, wireframe: true }))
      cage.position.set(x, 3.4, z)
      s.add(cage)
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), flameMat)
      flame.position.set(x, 3.4, z)
      s.add(flame)
      this.flames.push(flame)
      if (i < realLights) {
        const L = new THREE.PointLight('#ff8a30', 14, 14, 1.6)
        L.position.set(x, 3.3, z)
        s.add(L)
        this.lanterns.push(L)
      }
      this.colliders.push({ kind: 'circle', x, z, r: 0.35 })
    }
  }

  private buildStatue() {
    const s = this.scene
    const stone = new THREE.MeshStandardMaterial({ color: '#1c1820', roughness: 0.55, metalness: 0.3 })
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 0.6, 48), stone)
    base.position.y = 0.3
    base.receiveShadow = base.castShadow = true
    s.add(base)
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 1.6, 8), stone)
    ped.position.y = 1.4
    ped.castShadow = true
    s.add(ped)
    // glowing moat ring
    const moat = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.09, 8, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7a1a').multiplyScalar(3.6), toneMapped: false }))
    moat.rotation.x = Math.PI / 2
    moat.position.y = 0.62
    s.add(moat)
    // the King, cast in gold, mid-flex
    const king = buildCharacter({ species: 'pumpkin', skin: '#e8741c', outfit: '#141216', glow: '#ffb347', top: 'shirtless', headwear: 'crown', eyewear: 'shades', chain: true })
    const gold = new THREE.MeshPhysicalMaterial({ color: '#e0a83e', metalness: 1, roughness: 0.25, clearcoat: 0.5 })
    king.root.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh && !(m.material instanceof THREE.MeshBasicMaterial)) {
        ;(m.material as THREE.Material).dispose()
        m.material = gold
      }
    })
    king.pose = 'flex'
    for (let i = 0; i < 30; i++) king.update(0.1)
    king.root.scale.setScalar(1.9)
    king.root.position.y = 2.2
    king.root.rotation.y = 0
    s.add(king.root)
    const spot = new THREE.SpotLight('#ffd08a', 60, 16, 0.42, 0.5, 1.4)
    spot.position.set(0, 9, 5)
    spot.target = king.root
    s.add(spot)
    this.colliders.push({ kind: 'circle', x: 0, z: 0, r: 3.9 })
    this.interactables.push({ id: 'statue', label: 'Read the plaque', pos: new THREE.Vector3(0, 0, 4.2), radius: 1.8 })
  }

  private buildCastle() {
    const s = this.scene
    const stone = new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 0.92, color: '#a59ca8' })
    stone.map!.repeat.set(4, 2)
    const roofMat = new THREE.MeshStandardMaterial({ color: '#1a1118', roughness: 0.7, metalness: 0.2 })
    const Z = -31
    // curtain wall with gate gap
    for (const [x, w] of [[-13, 18], [13, 18]] as const) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 8, 2.4), stone)
      wall.position.set(x, 4, Z)
      wall.castShadow = wall.receiveShadow = true
      s.add(wall)
      this.colliders.push({ kind: 'box', minX: x - w / 2, maxX: x + w / 2, minZ: Z - 1.4, maxZ: Z + 1.4 })
      // crenellations
      for (let i = -w / 2 + 0.6; i < w / 2; i += 1.6) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 2.4), stone)
        c.position.set(x + i, 8.45, Z)
        c.castShadow = true
        s.add(c)
      }
    }
    // gatehouse
    const gh = new THREE.Mesh(new THREE.BoxGeometry(8, 11, 3.4), stone)
    gh.position.set(0, 5.5, Z - 0.4)
    gh.castShadow = true
    s.add(gh)
    const gate = new THREE.Mesh(new THREE.BoxGeometry(4, 5.4, 0.3), new THREE.MeshStandardMaterial({ color: '#0a0709', metalness: 0.6, roughness: 0.5 }))
    gate.position.set(0, 2.7, Z + 1.35)
    s.add(gate)
    const gateGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.08), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7a1a').multiplyScalar(3.6), toneMapped: false }))
    gateGlow.position.set(0, 0.2, Z + 1.52)
    s.add(gateGlow)
    this.colliders.push({ kind: 'box', minX: -4, maxX: 4, minZ: Z - 2.2, maxZ: Z + 1.6 })
    this.interactables.push({ id: 'gate', label: 'Knock on the castle gate', pos: new THREE.Vector3(0, 0, Z + 3), radius: 2.2 })
    // towers
    for (const x of [-22, -4.8, 4.8, 22]) {
      const r = Math.abs(x) > 10 ? 2.6 : 1.6
      const h = Math.abs(x) > 10 ? 14 : 15
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 16), stone)
      tower.position.set(x, h / 2, Z)
      tower.castShadow = true
      s.add(tower)
      const roof = new THREE.Mesh(new THREE.ConeGeometry(r * 1.25, r * 2.4, 16), roofMat)
      roof.position.set(x, h + r * 1.2, Z)
      roof.castShadow = true
      s.add(roof)
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb347').multiplyScalar(3.24), toneMapped: false }))
      win.position.set(x, h * 0.7, Z + r + 0.02)
      s.add(win)
      this.colliders.push({ kind: 'circle', x, z: Z, r: r + 0.3 })
    }
    // banners
    const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTexture(), roughness: 0.8, side: THREE.DoubleSide })
    for (const x of [-10, -16, 10, 16]) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(2, 4, 1, 6), bannerMat)
      b.position.set(x, 5, Z + 1.25)
      s.add(b)
    }
  }

  private buildGym() {
    const s = this.scene
    const X = 20
    const Z = -4
    const wall = new THREE.MeshStandardMaterial({ color: '#17131a', roughness: 0.6, metalness: 0.3 })
    const body = new THREE.Mesh(new THREE.BoxGeometry(9, 6, 10), wall)
    body.position.set(X, 3, Z)
    body.castShadow = body.receiveShadow = true
    s.add(body)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.5, 10.6), new THREE.MeshStandardMaterial({ color: '#0d0b0f', metalness: 0.5, roughness: 0.4 }))
    roof.position.set(X, 6.25, Z)
    s.add(roof)
    // neon trim
    const trim = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7a1a').multiplyScalar(3.96), toneMapped: false })
    for (const y of [0.15, 5.95]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 10), trim)
      t.position.set(X - 4.53, y, Z)
      s.add(t)
    }
    // sign
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: signTexture('CHAD GYM', { sub: 'NO PAIN · NO PUMP' }), toneMapped: false, color: new THREE.Color(2.8, 2.8, 2.8) }))
    sign.position.set(X - 4.56, 4.6, Z)
    sign.rotation.y = -Math.PI / 2
    s.add(sign)
    // door: recessed warm-lit doorway inside a steel frame
    const frameMat = new THREE.MeshStandardMaterial({ color: '#2a262c', metalness: 0.85, roughness: 0.3 })
    for (const dz of [-1.25, 1.25]) {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.5, 0.25), frameMat)
      jamb.position.set(X - 4.6, 1.75, Z + dz)
      s.add(jamb)
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 2.75), frameMat)
    lintel.position.set(X - 4.6, 3.5, Z)
    s.add(lintel)
    this.gymDoor = new THREE.Mesh(new THREE.PlaneGeometry(2.25, 3.35), new THREE.MeshBasicMaterial({ color: '#ff8a30', toneMapped: false }))
    this.gymDoor.position.set(X - 4.52, 1.68, Z)
    this.gymDoor.rotation.y = -Math.PI / 2
    s.add(this.gymDoor)
    // silhouette of equipment inside the doorway, so it reads as a lit room rather than a panel
    const inside = new THREE.MeshBasicMaterial({ color: '#2a1206' })
    const rack = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.6, 0.08), inside)
    rack.position.set(X - 4.5, 1.1, Z - 0.6)
    s.add(rack)
    const rack2 = rack.clone()
    rack2.position.z = Z + 0.6
    s.add(rack2)
    const barSil = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 1.6), inside)
    barSil.position.set(X - 4.5, 1.7, Z)
    s.add(barSil)
    const doorLight = new THREE.PointLight('#ff7a1a', 10, 9, 1.8)
    doorLight.position.set(X - 6, 2.2, Z)
    s.add(doorLight)
    this.colliders.push({ kind: 'box', minX: X - 4.7, maxX: X + 4.7, minZ: Z - 5.2, maxZ: Z + 5.2 })
    this.interactables.push({ id: 'gym', label: 'Enter Chad Gym', pos: new THREE.Vector3(X - 5.6, 0, Z), radius: 2.2 })
    // dumbbell rack outside (props)
    const iron = new THREE.MeshStandardMaterial({ color: '#2a262c', metalness: 0.9, roughness: 0.35 })
    for (let i = 0; i < 3; i++) {
      const db = new THREE.Group()
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8), iron)
      bar.rotation.z = Math.PI / 2
      db.add(bar)
      for (const sx of [-0.28, 0.28]) {
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 14), iron)
        plate.rotation.z = Math.PI / 2
        plate.position.x = sx
        db.add(plate)
      }
      db.position.set(X - 5.2, 0.17, Z + 3 + i * 0.5)
      db.rotation.y = Math.PI / 2
      db.castShadow = true
      s.add(db)
    }
  }

  private buildProps() {
    const s = this.scene
    // scattered pumpkins: one instanced draw call
    const pGeo = new THREE.SphereGeometry(0.35, 14, 10)
    pGeo.scale(1.15, 0.8, 1.15)
    const pMat = new THREE.MeshStandardMaterial({ color: '#d8661a', roughness: 0.6 })
    const spots: [number, number][] = []
    for (let i = 0; i < 46; i++) {
      const a = i * 2.39996
      const r = 17 + ((i * 53) % 17)
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      if (z < -26 || (x > 13 && x < 26 && z > -11 && z < 3)) continue
      spots.push([x, z])
    }
    const inst = new THREE.InstancedMesh(pGeo, pMat, spots.length)
    const m = new THREE.Matrix4()
    spots.forEach(([x, z], i) => {
      const sc = 0.7 + ((i * 7) % 5) * 0.15
      m.compose(new THREE.Vector3(x, 0.25 * sc, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i), new THREE.Vector3(sc, sc, sc))
      inst.setMatrixAt(i, m)
    })
    inst.castShadow = true
    s.add(inst)

    // dead trees
    const bark = new THREE.MeshStandardMaterial({ color: '#1b1416', roughness: 0.95 })
    const trees: [number, number][] = [[-26, 8], [-22, 18], [-30, -6], [26, 16], [30, 6], [-14, 24], [12, 26], [-28, -18], [28, -18]]
    for (const [x, z] of trees) {
      const g = new THREE.Group()
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.4, 5, 7), bark)
      trunk.position.y = 2.5
      g.add(trunk)
      for (let i = 0; i < 4; i++) {
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.14, 2.4, 5), bark)
        br.position.set(0, 3.2 + i * 0.5, 0)
        br.rotation.set(0.9, i * 1.7 + x, 0)
        br.translateY(1)
        g.add(br)
      }
      g.position.set(x, 0, z)
      g.traverse((o) => (o.castShadow = true))
      s.add(g)
      this.colliders.push({ kind: 'circle', x, z, r: 0.55 })
    }

    // the suspicious pumpkin
    this.oddPumpkin = new THREE.Group()
    const odd = new THREE.Mesh(new THREE.SphereGeometry(0.7, 24, 16), new THREE.MeshPhysicalMaterial({ color: '#e8741c', roughness: 0.5, sheen: 0.4 }))
    odd.scale.set(1.15, 0.85, 1.15)
    odd.position.y = 0.6
    odd.castShadow = true
    this.oddPumpkin.add(odd)
    const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb347').multiplyScalar(4.5), toneMapped: false })
    for (const sx of [-0.22, 0.22]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), eyeMat)
      e.position.set(sx, 0.72, 0.68)
      e.scale.set(1, 0.6, 0.4)
      this.oddPumpkin.add(e)
    }
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.3, 6), new THREE.MeshStandardMaterial({ color: '#3f5a2a' }))
    stem.position.y = 1.25
    this.oddPumpkin.add(stem)
    this.oddPumpkin.position.set(-13, 0, 7)
    this.oddPumpkin.rotation.y = 0.8
    s.add(this.oddPumpkin)
    this.colliders.push({ kind: 'circle', x: -13, z: 7, r: 0.9 })
    this.interactables.push({ id: 'pumpkin', label: 'Poke the suspicious pumpkin', pos: new THREE.Vector3(-13, 0, 7), radius: 2.2 })
  }

  private buildSecret() {
    const s = this.scene
    const rune = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.25, 6), new THREE.MeshStandardMaterial({ color: '#1d1820', roughness: 0.8 }))
    rune.position.set(-24.5, 0.12, -27)
    s.add(rune)
    const glyph = new THREE.Mesh(new THREE.CircleGeometry(0.18, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#9b5cff').multiplyScalar(3.6), toneMapped: false }))
    glyph.rotation.x = -Math.PI / 2
    glyph.position.set(-24.5, 0.26, -27)
    s.add(glyph)
    this.interactables.push({ id: 'rune', label: 'Press the strange rune', pos: new THREE.Vector3(-24.5, 0, -27), radius: 1.6 })
    // stash (hidden until found)
    this.stash = new THREE.Group()
    const gold = new THREE.MeshStandardMaterial({ color: '#e8b84a', metalness: 1, roughness: 0.25 })
    const coin = new THREE.CylinderGeometry(0.16, 0.16, 0.04, 16)
    for (let i = 0; i < 40; i++) {
      const c = new THREE.Mesh(coin, gold)
      const a = i * 2.4
      const r = Math.sqrt(i) * 0.14
      c.position.set(Math.cos(a) * r, 0.03 + (40 - i) * 0.012, Math.sin(a) * r)
      c.rotation.set((i % 3) * 0.3, 0, (i % 5) * 0.2)
      this.stash.add(c)
    }
    this.stash.position.set(-23, 0, -25.5)
    this.stash.scale.setScalar(0.001)
    this.stash.visible = false
    s.add(this.stash)
  }

  /** Loads the player + NPC characters (async because GLB models may download). */
  async populate(player: Appearance, spawn: 'start' | 'gym' = 'start') {
    const npcDefs: { id: string; a: Appearance; x: number; z: number; face: number }[] = [
      { id: 'coach', a: { species: 'skeleton', skin: '#e9e2d0', outfit: '#141216', glow: '#19f19a', top: 'shirtless', headwear: 'cap', eyewear: 'none', chain: true }, x: 13.4, z: 0.5, face: -2.2 },
      { id: 'hodl', a: { species: 'demon', skin: '#7e1a1a', outfit: '#2a262c', glow: '#ff4d3d', top: 'armor', headwear: 'horns', eyewear: 'none', chain: false }, x: -4.8, z: 5.6, face: 2.4 },
    ]
    const [p, ...npcs] = await Promise.all([createCharacter(player), ...npcDefs.map((d) => createCharacter(d.a))])
    if (this.disposed) {
      ;[p, ...npcs].forEach(disposeCharacter)
      return
    }
    this.player = p
    p.onStep = () => audio.play('step')
    this.scene.add(p.root)
    npcs.forEach((c, i) => {
      const d = npcDefs[i]
      c.root.position.set(d.x, 0, d.z)
      c.root.rotation.y = d.face
      this.scene.add(c.root)
      this.npcs.set(d.id, { c, home: new THREE.Vector3(d.x, 0, d.z), facing: d.face })
      this.colliders.push({ kind: 'circle', x: d.x, z: d.z, r: 0.6 })
      this.interactables.push({ id: d.id, label: d.id === 'coach' ? 'Talk to Coach Gourdon' : 'Talk to Sir Hodl', pos: new THREE.Vector3(d.x, 0, d.z), radius: 2.3 })
    })
    this.spawn(spawn)
  }

  spawn(where: 'start' | 'gym') {
    if (where === 'gym') {
      this.playerPos.set(12.6, 0, -4)
      this.playerYaw = -Math.PI / 2
    } else {
      this.playerPos.set(0, 0, 13)
      this.playerYaw = Math.PI
    }
    this.camYaw = this.playerYaw + Math.PI
    this.playerVel.set(0, 0, 0)
    this.snapCamera()
  }

  /* ───────── gameplay hooks used by the UI ───────── */

  faceNpcToPlayer(id: string) {
    const n = this.npcs.get(id)
    if (!n) return
    n.facing = Math.atan2(this.playerPos.x - n.home.x, this.playerPos.z - n.home.z)
  }

  /** ignore interact presses briefly (e.g. the key that closed a dialogue) */
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
            // centre inside the box: push out along the shallowest axis
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
    const d = Math.hypot(p.x, p.z)
    if (d > BOUNDS) {
      p.x *= BOUNDS / d
      p.z *= BOUNDS / d
    }
  }

  private snapCamera() {
    this.camTarget.set(this.playerPos.x, (this.player?.headHeight ?? 1.9) * 0.82, this.playerPos.z)
    this.placeCamera(1)
  }

  private placeCamera(k: number) {
    const target = new THREE.Vector3(this.playerPos.x, (this.player?.headHeight ?? 1.9) * 0.82, this.playerPos.z)
    this.camTarget.lerp(target, k)
    const cp = Math.cos(this.camPitch)
    const want = new THREE.Vector3(
      this.camTarget.x + Math.sin(this.camYaw) * cp * this.camDist,
      this.camTarget.y + Math.sin(this.camPitch) * this.camDist,
      this.camTarget.z + Math.cos(this.camYaw) * cp * this.camDist,
    )
    this.camera.position.lerp(want, k)
    this.camera.lookAt(this.camTarget)
  }

  resize(w: number, h: number) {
    // portrait phones: pull back + widen so the world doesn't feel claustrophobic
    const portrait = h > w
    this.camera.fov = portrait ? 68 : 55
    this.camDist = portrait ? 7.2 : 6.4
    this.camera.updateProjectionMatrix()
  }

  update(dt: number) {
    this.t += dt
    const p = this.player

    // camera look (drag)
    const look = this.input.takeLook()
    this.camYaw -= look.x * 0.006 * this.cameraSensitivity
    this.camPitch = Math.max(0.08, Math.min(1.05, this.camPitch + look.y * 0.004 * this.cameraSensitivity))

    // movement in camera space
    const mv = this.paused ? { x: 0, z: 0, run: false } : this.input.move()
    const fwd = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw))
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x)
    const wish = fwd.multiplyScalar(mv.z).add(right.multiplyScalar(mv.x))
    const mag = Math.min(1, wish.length())
    const maxSpeed = mv.run ? RUN : WALK
    const targetVel = mag > 0.01 ? wish.normalize().multiplyScalar(maxSpeed * mag) : new THREE.Vector3()
    this.playerVel.lerp(targetVel, 1 - Math.exp(-dt * (mag > 0.01 ? 10 : 14)))
    this.playerPos.addScaledVector(this.playerVel, dt)
    this.resolve(this.playerPos, PLAYER_R)

    const speed = this.playerVel.length()
    if (speed > 0.15) {
      const targetYaw = Math.atan2(this.playerVel.x, this.playerVel.z)
      let d = targetYaw - this.playerYaw
      d = Math.atan2(Math.sin(d), Math.cos(d))
      this.playerYaw += d * (1 - Math.exp(-dt * 12))
      // gentle auto-follow so phone players rarely need to touch the camera
      if (!look.x && mv.z > 0.2) {
        let cd = this.playerYaw + Math.PI - this.camYaw
        cd = Math.atan2(Math.sin(cd), Math.cos(cd))
        this.camYaw += cd * (1 - Math.exp(-dt * 0.9))
      }
      this.walkedTime += dt
    }
    if (p) {
      p.root.position.copy(this.playerPos)
      p.root.rotation.y = this.playerYaw
      p.speed = speed / WALK
      if (p.pose !== 'flex') p.pose = speed > 0.1 ? 'walk' : 'idle'
      p.update(dt)
    }
    this.placeCamera(1 - Math.exp(-dt * 9))

    // NPCs: idle, wave when the player approaches, turn smoothly toward their facing
    for (const [, n] of this.npcs) {
      const d = n.home.distanceTo(this.playerPos)
      if (d < 5 && !this.paused) n.facing = Math.atan2(this.playerPos.x - n.home.x, this.playerPos.z - n.home.z)
      let dy = n.facing - n.c.root.rotation.y
      dy = Math.atan2(Math.sin(dy), Math.cos(dy))
      n.c.root.rotation.y += dy * (1 - Math.exp(-dt * 5))
      n.c.pose = d < 4.2 && d > 2.4 ? 'wave' : 'idle'
      n.c.speed = 0
      n.c.update(dt)
    }

    // interaction prompt: nearest interactable in range
    let best: Interactable | null = null
    let bestD = Infinity
    if (!this.paused)
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
      this.events.onInteract(this.prompt.id)
    }

    // ambient animation
    this.flames.forEach((f, i) => f.scale.setScalar(1 + Math.sin(this.t * 9 + i * 1.7) * 0.12 + Math.sin(this.t * 23 + i) * 0.05))
    this.lanterns.forEach((L, i) => (L.intensity = 13 + Math.sin(this.t * 11 + i * 2) * 1.6))
    ;(this.gymDoor.material as THREE.MeshBasicMaterial).color.set('#ff8a30').multiplyScalar(1.1 + Math.sin(this.t * 2.5) * 0.15)
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
      const e = 1 - Math.pow(1 - this.stashT, 3)
      this.stash.scale.setScalar(Math.max(0.001, e))
      this.stash.rotation.y += dt
      if (this.stashT >= 1) this.stashT = -1
    }
  }

  /** for automated tests */
  debug() {
    return { x: +this.playerPos.x.toFixed(2), z: +this.playerPos.z.toFixed(2), yaw: +this.playerYaw.toFixed(2), prompt: this.prompt?.id ?? null, walked: +this.walkedTime.toFixed(2) }
  }
  teleport(x: number, z: number) {
    this.playerPos.set(x, 0, z)
    this.resolve(this.playerPos, PLAYER_R)
    this.snapCamera()
  }

  dispose() {
    this.disposed = true
    if (this.player) disposeCharacter(this.player)
    this.npcs.forEach((n) => disposeCharacter(n.c))
    disposeObject(this.scene)
    this.events.onPrompt(null)
    void this.engine
  }
}
