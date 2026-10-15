import * as THREE from 'three'

/**
 * PUMPKIN TOSS — a target range. Ten throws at painted boards: click (or tap) a board and a pumpkin flies to that spot.
 *   rings: bullseye 50 · inner 25 · outer 10;   far boards ×1.5;   the sliding board ×2.
 * Rules are pure (below); `TargetRange` owns the range props and the live round. Everything is local — a personal best, not a leaderboard.
 */
export const TOSS = {
  throws: 10,
  bull: 0.2,
  inner: 0.55,
  /** seconds a pumpkin spends in the air, and the pause before the next throw is accepted */
  flight: 0.38,
  gap: 0.2,
  xpDiv: 18,
  xpCap: 60,
} as const

export type TossStats = { score: number; hits: number; bulls: number; thrown: number }
/** points for a hit at normalised distance `r` (0 centre … 1 rim) on a board worth `mult` */
export const ringPoints = (r: number, mult: number) => (r > 1 ? 0 : Math.round((r < TOSS.bull ? 50 : r < TOSS.inner ? 25 : 10) * mult))
export const tossXp = (score: number) => Math.min(TOSS.xpCap, Math.round(score / TOSS.xpDiv))
/** the best a perfect round could score: ten bullseyes on the sliding board */
export const MAX_TOSS_SCORE = 50 * 2 * TOSS.throws

type Board = { id: number; group: THREE.Group; face: THREE.Object3D; mult: number; R: number; lx: number; lz: number; slide: number; y: number }
export type TossPhase = 'idle' | 'playing' | 'done'
export type TossSite = { x: number; z: number; yaw: number }

export class TargetRange {
  phase: TossPhase = 'idle'
  stats: TossStats = { score: 0, hits: 0, bulls: 0, thrown: 0 }
  /** the last throw, for the HUD */
  last: { pts: number; label: string; k: number } | null = null
  onThrow: ((pts: number, label: string) => void) | null = null
  onEnd: ((s: TossStats) => void) | null = null
  readonly stand: { x: number; z: number; yaw: number }
  private root = new THREE.Group()
  private boards: Board[] = []
  private marks: THREE.Object3D[] = []
  private flying: { mesh: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t: number; pts: number; label: string; last: boolean } | null = null
  private cool = 0
  private t = 0
  private ray = new THREE.Raycaster()
  private pumpkin: THREE.Mesh
  private fwd: THREE.Vector3
  private right: THREE.Vector3
  private disposables: (THREE.BufferGeometry | THREE.Material)[] = []
  private k = 0

  constructor(
    scene: THREE.Scene,
    private camera: THREE.Camera,
    site: TossSite,
    private ground: (x: number, z: number) => number,
    private playerAt: () => THREE.Vector3,
  ) {
    this.stand = site
    this.fwd = new THREE.Vector3(Math.sin(site.yaw), 0, Math.cos(site.yaw))
    this.right = new THREE.Vector3(-Math.cos(site.yaw), 0, Math.sin(site.yaw))
    scene.add(this.root)
    const orange = new THREE.MeshStandardMaterial({ color: 0xf08a24, roughness: 0.55 })
    const geo = new THREE.SphereGeometry(0.2, 14, 10).scale(1, 0.85, 1)
    this.disposables.push(orange, geo)
    this.pumpkin = new THREE.Mesh(geo, orange)
    this.pumpkin.visible = false
    this.root.add(this.pumpkin)
    this.buildRange()
  }

  /** world position of local (lateral, depth) in front of the stand */
  at(lx: number, lz: number, y = 0) {
    const x = this.stand.x + this.right.x * lx + this.fwd.x * lz
    const z = this.stand.z + this.right.z * lx + this.fwd.z * lz
    return new THREE.Vector3(x, this.ground(x, z) + y, z)
  }

  private buildRange() {
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3f2a, roughness: 0.9 })
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b2420, roughness: 0.9 })
    const hedge = new THREE.MeshStandardMaterial({ color: 0x2f5a34, roughness: 1 })
    const paper = new THREE.MeshStandardMaterial({ color: 0xe8d9b0, emissive: 0x6a4a18, emissiveIntensity: 0.55, roughness: 0.8 })
    this.disposables.push(wood, dark, hedge, paper)
    const yaw = this.stand.yaw
    const put = (m: THREE.Mesh, lx: number, lz: number, y: number) => {
      const p = this.at(lx, lz)
      m.position.set(p.x, p.y + y, p.z)
      m.rotation.y = yaw
      this.root.add(m)
      return m
    }
    const box = (w: number, h: number, d: number, mat: THREE.Material) => {
      const g = new THREE.BoxGeometry(w, h, d)
      this.disposables.push(g)
      return new THREE.Mesh(g, mat)
    }
    // the throw line: a low counter rail and two short posts (nothing tall in the line of sight to the boards), a small lit notice on the left post
    put(box(3.4, 0.7, 0.4, wood), 0, 1.0, 0.35)
    put(box(3.6, 0.07, 0.6, dark), 0, 1.0, 0.72)
    for (const s of [-1, 1]) put(box(0.12, 1.5, 0.12, wood), s * 1.7, 1.0, 0.75)
    put(box(0.9, 0.5, 0.06, paper), -1.7, 1.0, 1.5)
    // a painted throw line on the ground
    const line = box(3.4, 0.02, 0.12, new THREE.MeshBasicMaterial({ color: 0xf6c870 }))
    this.disposables.push(line.material as THREE.Material)
    put(line, 0, 0.1, 0.02)
    // boards: near row (two), far row (two, worth more), one that slides across the middle
    const defs: { lx: number; lz: number; R: number; mult: number; slide: number; y: number }[] = [
      { lx: -2.6, lz: 6, R: 0.85, mult: 1, slide: 0, y: 1.5 },
      { lx: 2.6, lz: 6, R: 0.85, mult: 1, slide: 0, y: 1.5 },
      { lx: 0, lz: 9.5, R: 0.8, mult: 2, slide: 3.2, y: 1.6 },
      { lx: -3.4, lz: 13, R: 0.95, mult: 1.5, slide: 0, y: 1.9 },
      { lx: 3.4, lz: 13, R: 0.95, mult: 1.5, slide: 0, y: 1.9 },
    ]
    const ringCols = [0xe8e0cc, 0x2a2a38, 0xf08a24, 0xf6c870]
    defs.forEach((d, i) => {
      const g = new THREE.Group()
      const post = box(0.12, d.y, 0.12, wood)
      post.position.y = d.y / 2
      g.add(post)
      const face = new THREE.Group()
      face.position.y = d.y
      // concentric rings (outer → bullseye), facing back toward the thrower (+z local after rotation)
      const radii = [1, TOSS.inner, TOSS.bull + 0.1, TOSS.bull]
      radii.forEach((r, k) => {
        const cg = new THREE.CylinderGeometry(d.R * r, d.R * r, 0.05, 28).rotateX(Math.PI / 2)
        const cm = new THREE.MeshStandardMaterial({ color: ringCols[k % 4 === 3 ? 3 : k], roughness: 0.6, emissive: ringCols[k % 4 === 3 ? 3 : k], emissiveIntensity: 0.12 })
        this.disposables.push(cg, cm)
        const m = new THREE.Mesh(cg, cm)
        m.position.z = 0.03 * (k + 1) // toward the thrower (the group is turned to face back)
        face.add(m)
      })
      g.add(face)
      g.rotation.y = yaw + Math.PI // the painted side looks back at the thrower
      const p = this.at(d.lx, d.lz)
      g.position.set(p.x, p.y, p.z)
      this.root.add(g)
      this.boards.push({ id: i, group: g, face, mult: d.mult, R: d.R, lx: d.lx, lz: d.lz, slide: d.slide, y: d.y })
    })
    // a hedge backstop so the far boards read against something
    for (let s = -3; s <= 3; s++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), hedge)
      this.disposables.push(m.geometry)
      const p = this.at(s * 1.35, 15.4)
      m.position.set(p.x, p.y + 0.8, p.z)
      m.scale.set(1.1, 1, 0.9)
      this.root.add(m)
    }
  }

  /** collider boxes for the counter (world axis-aligned; the range is placed on a quarter-turn) */
  colliders() {
    const a = this.at(-1.8, 0.8)
    const b = this.at(1.8, 1.2)
    return [{ kind: 'box' as const, minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minZ: Math.min(a.z, b.z), maxZ: Math.max(a.z, b.z), h: 1.0 }]
  }

  start() {
    this.clearMarks()
    this.stats = { score: 0, hits: 0, bulls: 0, thrown: 0 }
    this.last = null
    this.flying = null
    this.pumpkin.visible = false
    this.cool = 0.4
    this.phase = 'playing'
  }

  stop() {
    this.clearMarks()
    this.flying = null
    this.pumpkin.visible = false
    this.phase = 'idle'
  }

  dispose() {
    this.stop()
    this.root.removeFromParent()
    for (const d of this.disposables) d.dispose()
  }

  private clearMarks() {
    for (const m of this.marks) m.removeFromParent()
    this.marks = []
  }

  get left() {
    return TOSS.throws - this.stats.thrown
  }

  /** where a board is right now (the slider moves) */
  private boardCentre(b: Board) {
    const lx = b.lx + (b.slide ? Math.sin(this.t * 0.95) * b.slide : 0)
    const p = this.at(lx, b.lz, b.y)
    return p
  }

  /** QA: where each board's centre is on screen right now, as normalised device coords (to aim real clicks) */
  boardsNdc() {
    return this.boards.map((b) => {
      const v = this.boardCentre(b).project(this.camera)
      return { id: b.id, mult: b.mult, x: v.x, y: v.y }
    })
  }

  /** a click/tap at normalised device coords: throw at what is under it. Returns false while a throw is not accepted. */
  throwAt(ndcX: number, ndcY: number) {
    if (this.phase !== 'playing' || this.flying || this.cool > 0 || this.left <= 0) return false
    this.ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera)
    const o = this.ray.ray.origin
    const d = this.ray.ray.direction
    const n = this.fwd.clone().negate() // the boards face the thrower
    let best: { t: number; pt: THREE.Vector3; b: Board; r: number } | null = null
    for (const b of this.boards) {
      const c = this.boardCentre(b)
      const den = d.dot(n)
      if (Math.abs(den) < 1e-4) continue
      const t = c.clone().sub(o).dot(n) / den
      if (t <= 0.2) continue
      const pt = o.clone().addScaledVector(d, t)
      const r = pt.distanceTo(c) / b.R
      if (r <= 1.04 && (!best || t < best.t)) best = { t, pt, b, r }
    }
    let to: THREE.Vector3
    let pts = 0
    let label = 'Miss'
    if (best) {
      to = best.pt
      pts = ringPoints(Math.min(best.r, 1), best.b.mult)
      label = best.r < TOSS.bull ? 'Bullseye!' : best.r < TOSS.inner ? 'Inner ring' : 'Outer ring'
      // the splat sticks to the board (in the board's frame so a sliding board carries it)
      const splat = new THREE.Mesh(new THREE.CircleGeometry(0.1, 10), new THREE.MeshBasicMaterial({ color: 0xff6a10 }))
      const local = best.b.group.worldToLocal(to.clone())
      splat.position.set(local.x, local.y, 0.16)
      best.b.group.add(splat)
      this.marks.push(splat)
    } else if (d.y < -0.02) {
      const gy = this.playerAt().y
      const t = (gy - o.y) / d.y
      to = o.clone().addScaledVector(d, Math.min(t, 40))
    } else {
      to = o.clone().addScaledVector(d, 18)
    }
    const from = this.playerAt().clone().add(new THREE.Vector3(0, 1.35, 0)).addScaledVector(this.fwd, 0.3)
    this.flying = { mesh: this.pumpkin, from, to: to.clone(), t: 0, pts, label, last: this.stats.thrown + 1 >= TOSS.throws }
    this.pumpkin.visible = true
    this.pumpkin.position.copy(from)
    this.stats.thrown++
    return true
  }

  update(dt: number) {
    this.t += dt
    for (const b of this.boards) {
      if (b.slide) {
        const p = this.boardCentre(b)
        b.group.position.set(p.x, p.y - b.y, p.z)
      }
    }
    if (this.phase !== 'playing') return
    this.cool = Math.max(0, this.cool - dt)
    const f = this.flying
    if (!f) return
    f.t += dt / TOSS.flight
    const k = Math.min(1, f.t)
    f.mesh.position.lerpVectors(f.from, f.to, k)
    f.mesh.position.y += Math.sin(k * Math.PI) * 0.9
    f.mesh.rotation.x += dt * 12
    if (k >= 1) {
      this.flying = null
      this.pumpkin.visible = false
      this.cool = TOSS.gap
      if (f.pts > 0) {
        this.stats.hits++
        this.stats.score += f.pts
        if (f.label === 'Bullseye!') this.stats.bulls++
      }
      this.last = { pts: f.pts, label: f.label, k: ++this.k }
      this.onThrow?.(f.pts, f.label)
      if (f.last) {
        this.phase = 'done'
        this.onEnd?.({ ...this.stats })
      }
    }
  }
}
