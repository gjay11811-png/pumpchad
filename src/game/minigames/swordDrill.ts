import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { HandRig } from './targetThrow'

/**
 * SWORD DRILL — thirty seconds with the Antique Estoc (Poly Haven, CC0 — see ASSETS.md) against three straw dummies in the Parkour Yard.
 * Press the action key (E / GO) to cut: the right arm sweeps the blade across the front of you (the arm IK of the pistol, along an arc), and a cut
 * that lands on a dummy in front of you scores. Hitting different dummies in a row builds a combo. Rules (pure) are at the top; `SwordDrill` owns the
 * props, the swing and the live round. Everything is local: a personal best, not a leaderboard.
 */
export const DRILL = { seconds: 30, swing: 0.34, hitFrom: 0.1, hitTo: 0.24, reach: 2.35, arc: 0.95, xpDiv: 16, xpCap: 55 } as const
export type DrillStats = { score: number; hits: number; swings: number; bestCombo: number }
/** points for the nth hit in a combo (10 + 5 per link, capped) */
export const hitPoints = (combo: number) => 10 + Math.min(combo - 1, 8) * 5
export const drillXp = (score: number) => Math.min(DRILL.xpCap, Math.round(score / DRILL.xpDiv))
export type DrillResult = { xp: number; best: number; newBest: boolean; coins: number }
export type DrillSite = { x: number; z: number; yaw: number }

type Dummy = { group: THREE.Group; body: THREE.Object3D; x: number; z: number; wobble: number; flash: number }

export class SwordDrill {
  active = false
  stats: DrillStats = { score: 0, hits: 0, swings: 0, bestCombo: 0 }
  timeLeft = 0
  combo = 0
  done = false
  result: DrillResult | null = null
  onEvent: (() => void) | null = null
  onFinish: ((s: DrillStats) => DrillResult) | null = null
  readonly rack: { x: number; z: number }
  private root = new THREE.Group()
  private dummies: Dummy[] = []
  private sword: THREE.Object3D | null = null
  private rackSword: THREE.Object3D | null = null
  private swing: { t: number; dir: 1 | -1; hit: Set<Dummy>; target: THREE.Vector3 } | null = null
  private lastDummy: Dummy | null = null
  private armed: THREE.Object3D | null = null
  private disposables: (THREE.BufferGeometry | THREE.Material)[] = []
  private aim = new THREE.Vector3()
  private dir: 1 | -1 = 1

  constructor(
    scene: THREE.Scene,
    site: DrillSite,
    ground: (x: number, z: number) => number,
    private getPlayer: () => (HandRig & { root?: THREE.Object3D }) | null,
    private playerAt: () => THREE.Vector3,
    private playerYaw: () => number,
  ) {
    this.rack = { x: site.x, z: site.z }
    scene.add(this.root)
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3f2a, roughness: 0.9 })
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b2420, roughness: 0.9 })
    const straw = new THREE.MeshStandardMaterial({ color: 0xc8a550, roughness: 1 })
    const sack = new THREE.MeshStandardMaterial({ color: 0x8a6f48, roughness: 1 })
    const patch = new THREE.MeshStandardMaterial({ color: 0xe8641a, emissive: 0xe8641a, emissiveIntensity: 0.35, roughness: 0.6 })
    this.disposables.push(wood, dark, straw, sack, patch)
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
      this.disposables.push(g)
      const o = new THREE.Mesh(g, m)
      o.position.set(x, y, z)
      o.castShadow = true
      return o
    }
    // the rack: a low plinth with two brackets that hold the sword (the model is added when it has loaded)
    const base = new THREE.Group()
    base.add(mesh(new THREE.BoxGeometry(1.5, 0.5, 0.5), wood, 0, 0.25, 0))
    base.add(mesh(new THREE.BoxGeometry(1.6, 0.06, 0.6), dark, 0, 0.53, 0))
    for (const sx of [-0.45, 0.45]) base.add(mesh(new THREE.BoxGeometry(0.06, 0.2, 0.12), dark, sx, 0.66, 0))
    base.position.set(site.x, ground(site.x, site.z), site.z)
    base.rotation.y = site.yaw
    this.root.add(base)
    // three dummies in a shallow arc in front of the rack: post, cross-arm, straw body, sack head, a painted patch
    for (const [dx, dz] of [[-2.8, 3.2], [0, 4.4], [2.8, 3.2]]) {
      const x = site.x + Math.sin(site.yaw) * dz + Math.cos(site.yaw) * dx
      const z = site.z + Math.cos(site.yaw) * dz - Math.sin(site.yaw) * dx
      const g = new THREE.Group()
      g.position.set(x, ground(x, z), z)
      const body = new THREE.Group()
      body.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.9, 8), wood, 0, 0.95, 0))
      body.add(mesh(new THREE.BoxGeometry(1.1, 0.09, 0.09), wood, 0, 1.45, 0))
      body.add(mesh(new THREE.CylinderGeometry(0.27, 0.22, 0.75, 10), straw, 0, 1.2, 0))
      body.add(mesh(new THREE.SphereGeometry(0.19, 10, 8), sack, 0, 1.78, 0))
      const p = mesh(new THREE.CircleGeometry(0.13, 14), patch, 0, 1.22, 0.235)
      body.add(p)
      g.add(body)
      g.rotation.y = site.yaw // the painted side faces away from the rack, toward the player
      this.root.add(g)
      this.dummies.push({ group: g, body, x, z, wobble: 0, flash: 0 })
    }
    this.disposables.push(new THREE.MeshBasicMaterial())
    // the Antique Estoc (8 K triangles, one 512 px WebP set): loaded once, shown on the rack until a round starts
    void new GLTFLoader()
      .loadAsync(`${import.meta.env.BASE_URL}chadverse/models/estoc.glb`)
      .then((g) => {
        const m = g.scene
        m.scale.setScalar(0.72)
        m.traverse((o) => {
          const me = o as THREE.Mesh
          if (me.isMesh) me.castShadow = true
        })
        this.sword = m
        this.rackSword = m.clone(true)
        this.rackSword.rotation.set(0, 0, Math.PI / 2) // lying on the brackets, blade to the side
        this.rackSword.position.set(site.x, ground(site.x, site.z) + 0.78, site.z)
        this.rackSword.rotation.y = site.yaw + Math.PI / 2
        this.root.add(this.rackSword)
      })
      .catch(() => {
        this.sword = null // no model: the drill still works with a plain steel stand-in
      })
  }

  colliders() {
    const out: { kind: 'circle'; x: number; z: number; r: number; h: number }[] = this.dummies.map((d) => ({ kind: 'circle' as const, x: d.x, z: d.z, r: 0.45, h: 2 }))
    return out
  }

  start() {
    this.stats = { score: 0, hits: 0, swings: 0, bestCombo: 0 }
    this.combo = 0
    this.lastDummy = null
    this.timeLeft = DRILL.seconds
    this.done = false
    this.result = null
    this.swing = null
    this.active = true
    this.equip()
    this.onEvent?.()
  }
  stop() {
    this.active = false
    this.swing = null
    this.unequip()
    this.onEvent?.()
  }
  dispose() {
    this.stop()
    this.root.removeFromParent()
    for (const d of this.disposables) d.dispose()
  }

  private equip() {
    const hand = this.getPlayer()?.fistR
    const blade = this.sword
    if (!hand) return
    if (blade) {
      blade.position.set(0, 0.04, 0)
      blade.rotation.set(0, 0, 0) // the model's blade runs along +y, the bone's fingers along +y: the blade carries on from the fist
      hand.add(blade)
      this.armed = blade
    }
    if (this.rackSword) this.rackSword.visible = false
  }
  private unequip() {
    this.armed?.removeFromParent()
    this.armed = null
    if (this.rackSword) this.rackSword.visible = true
  }

  /** a cut (the action key): ignored while one is already under way or the round is not live */
  slash() {
    if (!this.active || this.done || this.swing) return false
    this.dir = this.dir === 1 ? -1 : 1
    this.stats.swings++
    this.swing = { t: 0, dir: this.dir, hit: new Set(), target: new THREE.Vector3() }
    return true
  }

  /** the point the hand is driven to at swing progress u (0…1): a diagonal cut across the front of the player */
  private arcPoint(u: number, dir: 1 | -1, out: THREE.Vector3) {
    const p = this.playerAt()
    const yaw = this.playerYaw()
    const fx = Math.sin(yaw)
    const fz = Math.cos(yaw)
    const rx = -fz
    const rz = fx
    const e = u * u * (3 - 2 * u)
    const side = (0.62 - 1.24 * e) * dir
    const up = 1.72 - 0.78 * e
    const fwd = 0.55 + Math.sin(Math.PI * e) * 0.5
    return out.set(p.x + rx * side + fx * fwd, p.y + up, p.z + rz * side + fz * fwd)
  }

  update(dt: number) {
    for (const d of this.dummies) {
      d.wobble *= Math.exp(-dt * 4.5)
      d.flash = Math.max(0, d.flash - dt * 5)
      d.body.rotation.z = Math.sin(performance.now() * 0.03) * d.wobble
      d.body.rotation.x = Math.cos(performance.now() * 0.027) * d.wobble * 0.5
    }
    if (!this.active) return
    const pl = this.getPlayer()
    if (!this.done) {
      this.timeLeft = Math.max(0, this.timeLeft - dt)
      if (this.timeLeft <= 0) {
        this.done = true
        this.swing = null
        this.result = this.onFinish?.({ ...this.stats }) ?? null
        this.onEvent?.()
      }
    }
    const s = this.swing
    if (s) {
      s.t += dt
      const u = Math.min(1, s.t / DRILL.swing)
      this.arcPoint(u, s.dir, s.target)
      pl?.grip?.(null, s.target)
      if (s.t >= DRILL.hitFrom && s.t <= DRILL.hitTo) this.cut(s)
      if (u >= 1) {
        // a cut that touched nothing breaks the combo
        if (s.hit.size === 0) this.combo = 0
        this.swing = null
        this.onEvent?.()
      }
    } else if (pl?.grip) {
      // at rest the blade is held ready: out and up in front of the right shoulder
      this.arcPoint(0, this.dir === 1 ? -1 : 1, this.aim)
      pl.grip(null, this.aim)
    }
  }

  /** which dummies the blade is touching right now: in reach and within the cut's cone in front of the player */
  private cut(s: { hit: Set<Dummy> }) {
    const p = this.playerAt()
    const yaw = this.playerYaw()
    for (const d of this.dummies) {
      if (s.hit.has(d)) continue
      const dx = d.x - p.x
      const dz = d.z - p.z
      const dist = Math.hypot(dx, dz)
      if (dist > DRILL.reach) continue
      let a = Math.atan2(dx, dz) - yaw
      a = Math.atan2(Math.sin(a), Math.cos(a))
      if (Math.abs(a) > DRILL.arc) continue
      s.hit.add(d)
      this.combo = d === this.lastDummy ? Math.max(1, this.combo) : this.combo + 1
      this.lastDummy = d
      this.stats.hits++
      this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo)
      this.stats.score += hitPoints(this.combo)
      d.wobble = 0.22
      d.flash = 1
      this.onEvent?.()
    }
  }
}
