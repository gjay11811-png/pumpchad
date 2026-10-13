import * as THREE from 'three'

/**
 * PUMPKIN RUSH — a 45-second sprint round Chad Square collecting glowing pumpkins.
 * Three pumpkins are lit at any time; grab one and another lights up somewhere else.
 * Chain grabs within the combo window to multiply points; golden pumpkins are worth triple.
 * Rules are pure (below) so scoring is deterministic and testable; RushGame owns the 3D side.
 */
export const RUSH = {
  duration: 45,
  active: 3,
  /** pickup radius (m) around the player */
  radius: 1.05,
  base: 100,
  goldEvery: 5,
  goldMult: 3,
  /** seconds after a grab in which the next grab extends the combo */
  comboWindow: 3.2,
  maxCombo: 5,
  /** spawn spacing (m) from the player and from other lit pumpkins */
  minFromPlayer: 7,
  minApart: 6,
  /** XP for a run = score / xpDiv, capped */
  xpDiv: 120,
  xpCap: 60,
} as const

export type RushStats = { score: number; grabbed: number; gold: number; bestCombo: number }

/** points for one grab, given the combo it lands on (1 = no chain) */
export const grabPoints = (combo: number, gold: boolean) => RUSH.base * Math.min(combo, RUSH.maxCombo) * (gold ? RUSH.goldMult : 1)
/** XP for a finished run (before daily fatigue) */
export const rushXp = (score: number) => Math.min(RUSH.xpCap, Math.round(score / RUSH.xpDiv))

type Target = { group: THREE.Group; pos: THREE.Vector3; gold: boolean; born: number; pop: number }
export type RushPhase = 'idle' | 'countdown' | 'playing' | 'done'

/**
 * The live round. `valid(x, z)` says whether a point is open, walkable ground (World passes its collider test).
 * Events go out through callbacks so the UI can react without polling React state every frame.
 */
export class RushGame {
  phase: RushPhase = 'idle'
  timeLeft: number = RUSH.duration
  countdown = 0
  stats: RushStats = { score: 0, grabbed: 0, gold: 0, bestCombo: 0 }
  combo = 0
  comboT = 0
  onGrab: ((pts: number, combo: number, gold: boolean) => void) | null = null
  onEnd: ((s: RushStats) => void) | null = null
  private targets: Target[] = []
  private pool: THREE.Group[] = []
  private root = new THREE.Group()
  private t = 0
  private spawned = 0
  private rng = Math.random
  private geo: THREE.BufferGeometry
  private beamGeo: THREE.CylinderGeometry
  private mats: { orange: THREE.MeshStandardMaterial; gold: THREE.MeshStandardMaterial; stem: THREE.MeshStandardMaterial; beam: THREE.MeshBasicMaterial; beamGold: THREE.MeshBasicMaterial }

  constructor(
    scene: THREE.Scene,
    private valid: (x: number, z: number) => boolean,
    private area: { r: number },
  ) {
    // ribbed pumpkin (low-poly: there are only a handful on screen)
    const g = new THREE.SphereGeometry(0.34, 20, 14)
    const p = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const z = p.getZ(i)
      const a = Math.atan2(z, x)
      const k = 1 - 0.07 * (1 - Math.abs(Math.cos(a * 4)))
      p.setXYZ(i, x * k, p.getY(i) * 0.82, z * k)
    }
    g.computeVertexNormals()
    this.geo = g
    this.beamGeo = new THREE.CylinderGeometry(0.16, 0.42, 7, 12, 1, true)
    this.beamGeo.translate(0, 3.5, 0)
    this.mats = {
      orange: new THREE.MeshStandardMaterial({ color: '#ff7a1a', emissive: '#ff6a00', emissiveIntensity: 1.6, roughness: 0.45 }),
      gold: new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ffb347', emissiveIntensity: 2.4, metalness: 0.7, roughness: 0.25 }),
      stem: new THREE.MeshStandardMaterial({ color: '#3b5a22', roughness: 0.8 }),
      beam: new THREE.MeshBasicMaterial({ color: '#ff8a2a', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
      beamGold: new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    }
    this.root.name = 'pumpkin-rush'
    scene.add(this.root)
  }

  private make(gold: boolean) {
    const grp = this.pool.pop() ?? new THREE.Group()
    grp.clear()
    const body = new THREE.Mesh(this.geo, gold ? this.mats.gold : this.mats.orange)
    body.position.y = 0.42
    body.castShadow = true
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.14, 6), this.mats.stem)
    stem.position.y = 0.76
    stem.userData.own = true
    const beam = new THREE.Mesh(this.beamGeo, gold ? this.mats.beamGold : this.mats.beam)
    grp.add(body, stem, beam)
    grp.visible = true
    this.root.add(grp)
    return grp
  }

  private spawnSpot(player: THREE.Vector3) {
    for (let tries = 0; tries < 80; tries++) {
      const a = this.rng() * Math.PI * 2
      const r = Math.sqrt(this.rng()) * this.area.r
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      if (Math.hypot(x - player.x, z - player.z) < RUSH.minFromPlayer) continue
      if (this.targets.some((t) => Math.hypot(t.pos.x - x, t.pos.z - z) < RUSH.minApart)) continue
      if (!this.valid(x, z)) continue
      return new THREE.Vector3(x, 0, z)
    }
    return null
  }

  private spawn(player: THREE.Vector3, groundY: (x: number, z: number) => number) {
    const pos = this.spawnSpot(player)
    if (!pos) return
    this.spawned++
    const gold = this.spawned % RUSH.goldEvery === 0
    const group = this.make(gold)
    pos.y = groundY(pos.x, pos.z)
    group.position.copy(pos)
    group.scale.setScalar(0.001)
    this.targets.push({ group, pos, gold, born: this.t, pop: -1 })
  }

  /** begin the 3-2-1 countdown (targets light up when it ends) */
  start(rng: () => number = Math.random) {
    this.clearTargets()
    this.rng = rng
    this.phase = 'countdown'
    this.countdown = 3
    this.timeLeft = RUSH.duration
    this.stats = { score: 0, grabbed: 0, gold: 0, bestCombo: 0 }
    this.combo = 0
    this.comboT = 0
    this.spawned = 0
  }

  /** quit mid-run: no score, no reward */
  stop() {
    this.clearTargets()
    this.phase = 'idle'
  }

  private clearTargets() {
    for (const t of this.targets) this.release(t.group)
    this.targets = []
  }
  private release(g: THREE.Group) {
    g.traverse((o) => o.userData.own && (o as THREE.Mesh).geometry.dispose())
    g.clear()
    this.root.remove(g)
    this.pool.push(g)
  }

  update(dt: number, player: THREE.Vector3, groundY: (x: number, z: number) => number) {
    this.t += dt
    if (this.phase === 'countdown') {
      this.countdown -= dt
      if (this.countdown <= 0) {
        this.phase = 'playing'
        for (let i = 0; i < RUSH.active; i++) this.spawn(player, groundY)
      }
    } else if (this.phase === 'playing') {
      this.timeLeft = Math.max(0, this.timeLeft - dt)
      if (this.combo > 0 && (this.comboT -= dt) <= 0) this.combo = 0
      for (const t of this.targets) {
        if (t.pop >= 0) continue
        if (Math.hypot(t.pos.x - player.x, t.pos.z - player.z) < RUSH.radius) {
          t.pop = 0
          this.combo = Math.min(RUSH.maxCombo, this.combo + 1)
          this.comboT = RUSH.comboWindow
          const pts = grabPoints(this.combo, t.gold)
          this.stats.score += pts
          this.stats.grabbed++
          if (t.gold) this.stats.gold++
          this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo)
          this.onGrab?.(pts, this.combo, t.gold)
        }
      }
      if (this.timeLeft <= 0) {
        this.phase = 'done'
        this.clearTargets()
        this.onEnd?.({ ...this.stats })
        return
      }
    }
    // animate: grow in, bob + spin, pop on grab (then respawn elsewhere)
    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i]
      const g = t.group
      if (t.pop >= 0) {
        t.pop += dt
        const u = t.pop / 0.28
        g.scale.setScalar(1 + u * 0.8)
        g.position.y = t.pos.y + u * 0.8
        if (u >= 1) {
          this.release(g)
          this.targets.splice(i, 1)
          if (this.phase === 'playing') this.spawn(player, groundY)
        }
        continue
      }
      const age = this.t - t.born
      g.scale.setScalar(Math.min(1, age * 3.2) * (t.gold ? 1.12 : 1))
      g.position.y = t.pos.y + Math.sin(this.t * 3 + t.pos.x) * 0.08
      g.rotation.y += dt * (t.gold ? 2.4 : 1.2)
    }
  }

  /** QA: lit pumpkin positions */
  targetsInfo() {
    return this.targets.filter((t) => t.pop < 0).map((t) => ({ x: +t.pos.x.toFixed(2), z: +t.pos.z.toFixed(2), gold: t.gold }))
  }

  dispose() {
    this.clearTargets()
    this.root.removeFromParent()
    this.geo.dispose()
    this.beamGeo.dispose()
    Object.values(this.mats).forEach((m) => m.dispose())
  }
}
