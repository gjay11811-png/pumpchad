import * as THREE from 'three'

/**
 * VILLAGE EVENTS — four short, replayable rounds run from the Events Board in Chad Square. All local; nothing online.
 *   hunt     Midnight Pumpkin Hunt: find the lit pumpkins before the clock runs out
 *   invasion Ghost Invasion: banish drifting ghosts by running into them before they reach the fountain (3 lives)
 *   festival Harvest Festival: light all five festival lanterns around the square
 *   storm    Thunderstorm: gather storm crystals and keep out of the marked strike circles (3 lives)
 * Rules are plain numbers below; EventDirector owns the 3D side (markers, ghosts, strike rings, rain, lightning).
 */
export type EventId = 'hunt' | 'invasion' | 'festival' | 'storm'
export const EVENT_IDS: EventId[] = ['hunt', 'invasion', 'festival', 'storm']

export const EVENT_DEFS: Record<EventId, { name: string; blurb: string; rules: string[]; duration: number; goal: number; lives: number; xp: number; color: number }> = {
  hunt: {
    name: 'Midnight Pumpkin Hunt',
    blurb: 'Lit pumpkins wake across the square after dark.',
    rules: ['Run into the glowing pumpkins — four are lit at any time.', 'Gather 10 before time runs out.'],
    duration: 70,
    goal: 10,
    lives: 0,
    xp: 40,
    color: 0xff9a2e,
  },
  invasion: {
    name: 'Ghost Invasion',
    blurb: 'Ghosts drift in from the walls toward the fountain.',
    rules: ['Run into a ghost to banish it.', 'If a ghost reaches the fountain you lose a life — three lives.', 'Banish 14 before time is up.'],
    duration: 80,
    goal: 14,
    lives: 3,
    xp: 55,
    color: 0xbfe4ff,
  },
  festival: {
    name: 'Harvest Festival',
    blurb: 'Light the five festival lanterns hung around the square.',
    rules: ['Walk up to each unlit lantern to light it.', 'Light all five — no rush, but the festival ends when the bell does.'],
    duration: 120,
    goal: 5,
    lives: 0,
    xp: 30,
    color: 0xffd36a,
  },
  storm: {
    name: 'Thunderstorm',
    blurb: 'Lightning strikes the square. Collect the storm crystals.',
    rules: ['Gather 6 storm crystals.', 'Red rings mark where lightning is about to strike — step out before it lands.', 'Three hits and the storm wins.'],
    duration: 75,
    goal: 6,
    lives: 3,
    xp: 60,
    color: 0x8ab4ff,
  },
}

export type EventStats = { id: EventId; won: boolean; score: number; goal: number; lives: number; timeLeft: number }
export type EventPhase = 'idle' | 'countdown' | 'playing' | 'done'

type Mark = { group: THREE.Object3D; x: number; z: number; born: number; vx?: number; vz?: number }

export class EventDirector {
  phase: EventPhase = 'idle'
  id: EventId = 'hunt'
  timeLeft = 0
  countdown = 0
  score = 0
  lives = 0
  hint = ''
  onHit: ((kind: 'good' | 'bad' | 'win' | 'lose' | 'strike') => void) | null = null
  onEnd: ((s: EventStats) => void) | null = null
  private root = new THREE.Group()
  private marks: Mark[] = []
  private rings: { mesh: THREE.Mesh; x: number; z: number; t: number }[] = []
  private t = 0
  private spawnT = 0
  private strikeT = 0
  private flash = 0
  private flashLight: THREE.HemisphereLight
  private rain: THREE.LineSegments
  private rainPos: Float32Array
  private geo: Record<string, THREE.BufferGeometry> = {}
  private mats: Record<string, THREE.Material> = {}

  constructor(
    scene: THREE.Scene,
    private valid: (x: number, z: number) => boolean,
    private ground: (x: number, z: number) => number,
    private area: { r: number },
  ) {
    this.root.visible = false
    scene.add(this.root)
    // built once, at intensity 0, so lightning never changes the light count (no shader recompile mid-game)
    this.flashLight = new THREE.HemisphereLight(0xcfe0ff, 0x223355, 0)
    scene.add(this.flashLight)
    this.rainPos = new Float32Array(260 * 6)
    const rg = new THREE.BufferGeometry()
    rg.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3))
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xa8c0e8, transparent: true, opacity: 0.45 }))
    this.rain.frustumCulled = false
    this.rain.visible = false
    this.root.add(this.rain)
    this.geo.pumpkin = new THREE.SphereGeometry(0.34, 14, 10).scale(1, 0.82, 1)
    this.geo.beam = new THREE.CylinderGeometry(0.14, 0.38, 6, 10, 1, true).translate(0, 3, 0)
    this.geo.ghost = new THREE.CapsuleGeometry(0.42, 0.7, 4, 10)
    this.geo.crystal = new THREE.OctahedronGeometry(0.42)
    this.geo.lantern = new THREE.SphereGeometry(0.4, 12, 10)
    this.geo.pole = new THREE.CylinderGeometry(0.05, 0.07, 2.6, 6).translate(0, 1.3, 0)
    this.geo.ring = new THREE.RingGeometry(1.7, 2.2, 28).rotateX(-Math.PI / 2)
    for (const k of EVENT_IDS) {
      this.mats[k] = new THREE.MeshBasicMaterial({ color: EVENT_DEFS[k].color, transparent: true, opacity: 0.9 })
      this.mats[`${k}Beam`] = new THREE.MeshBasicMaterial({ color: EVENT_DEFS[k].color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
    }
    this.mats.pole = new THREE.MeshStandardMaterial({ color: 0x3a2c22 })
    this.mats.dim = new THREE.MeshBasicMaterial({ color: 0x4a3f36 })
    this.mats.strike = new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })
  }

  get def() {
    return EVENT_DEFS[this.id]
  }

  start(id: EventId, player: THREE.Vector3) {
    this.clear()
    this.id = id
    const d = EVENT_DEFS[id]
    this.timeLeft = d.duration
    this.score = 0
    this.lives = d.lives
    this.countdown = 3
    this.phase = 'countdown'
    this.spawnT = 0
    this.strikeT = 2.5
    this.root.visible = true
    this.hint = d.rules[0]
    if (id === 'festival') this.placeLanterns(player)
    if (id === 'hunt') for (let i = 0; i < 4; i++) this.spawnPumpkin(player)
    if (id === 'storm') {
      for (let i = 0; i < 3; i++) this.spawnCrystal(player)
      this.rain.visible = true
    }
  }

  stop() {
    this.clear()
    this.phase = 'idle'
    this.root.visible = false
    this.flashLight.intensity = 0
  }

  dispose() {
    this.stop()
    this.root.removeFromParent()
    this.flashLight.removeFromParent()
    for (const g of Object.values(this.geo)) g.dispose()
    for (const m of Object.values(this.mats)) m.dispose()
    this.rain.geometry.dispose()
    ;(this.rain.material as THREE.Material).dispose()
  }

  /** what the QA hook and the HUD show */
  info() {
    return { phase: this.phase, id: this.id, score: this.score, goal: this.def.goal, lives: this.lives, timeLeft: +this.timeLeft.toFixed(1), marks: this.marks.map((m) => ({ x: +m.x.toFixed(1), z: +m.z.toFixed(1) })) }
  }

  private clear() {
    for (const m of this.marks) m.group.removeFromParent()
    for (const r of this.rings) r.mesh.removeFromParent()
    this.marks = []
    this.rings = []
    this.rain.visible = false
  }

  private pick(player: THREE.Vector3, minFromPlayer: number, rMax = this.area.r - 3): [number, number] | null {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 5 + Math.random() * (rMax - 5)
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      if (Math.hypot(x - player.x, z - player.z) < minFromPlayer) continue
      if (this.marks.some((m) => Math.hypot(m.x - x, m.z - z) < 5)) continue
      if (this.valid(x, z)) return [x, z]
    }
    return null
  }

  private add(group: THREE.Object3D, x: number, z: number, extra: Partial<Mark> = {}) {
    group.position.set(x, this.ground(x, z), z)
    this.root.add(group)
    this.marks.push({ group, x, z, born: this.t, ...extra })
  }

  private spawnPumpkin(player: THREE.Vector3) {
    const p = this.pick(player, 7)
    if (!p) return
    const g = new THREE.Group()
    const m = new THREE.Mesh(this.geo.pumpkin, this.mats.hunt)
    m.position.y = 0.45
    const b = new THREE.Mesh(this.geo.beam, this.mats.huntBeam)
    g.add(m, b)
    this.add(g, p[0], p[1])
  }

  private spawnCrystal(player: THREE.Vector3) {
    const p = this.pick(player, 6)
    if (!p) return
    const g = new THREE.Group()
    const m = new THREE.Mesh(this.geo.crystal, this.mats.storm)
    m.position.y = 0.9
    const b = new THREE.Mesh(this.geo.beam, this.mats.stormBeam)
    g.add(m, b)
    this.add(g, p[0], p[1])
  }

  private placeLanterns(player: THREE.Vector3) {
    const base = Math.random() * Math.PI * 2
    for (let i = 0; i < 5; i++) {
      for (let k = 0; k < 12; k++) {
        const a = base + (i / 5) * Math.PI * 2 + k * 0.17
        const r = 13 + (i % 2) * 6
        const x = Math.cos(a) * r
        const z = Math.sin(a) * r
        if (!this.valid(x, z) || Math.hypot(x - player.x, z - player.z) < 2) continue
        const g = new THREE.Group()
        const pole = new THREE.Mesh(this.geo.pole, this.mats.pole)
        const l = new THREE.Mesh(this.geo.lantern, this.mats.dim)
        l.position.y = 2.7
        g.add(pole, l)
        this.add(g, x, z)
        break
      }
    }
  }

  private spawnGhost(player: THREE.Vector3) {
    for (let k = 0; k < 12; k++) {
      const a = Math.random() * Math.PI * 2
      const x = Math.cos(a) * (this.area.r - 2)
      const z = Math.sin(a) * (this.area.r - 2)
      if (Math.hypot(x - player.x, z - player.z) < 8) continue
      const g = new THREE.Group()
      const m = new THREE.Mesh(this.geo.ghost, this.mats.invasion)
      m.position.y = 1.2
      g.add(m)
      const sp = 1.5 + Math.random() * 0.7 + this.score * 0.04
      this.add(g, x, z, { vx: (-x / Math.hypot(x, z)) * sp, vz: (-z / Math.hypot(x, z)) * sp })
      return
    }
  }

  private finish(won: boolean) {
    this.phase = 'done'
    this.clear()
    this.root.visible = false
    this.flashLight.intensity = 0
    this.onHit?.(won ? 'win' : 'lose')
    this.onEnd?.({ id: this.id, won, score: this.score, goal: this.def.goal, lives: this.lives, timeLeft: Math.max(0, this.timeLeft) })
  }

  private collect(i: number, player: THREE.Vector3) {
    const m = this.marks[i]
    m.group.removeFromParent()
    this.marks.splice(i, 1)
    this.score++
    this.onHit?.('good')
    if (this.score >= this.def.goal) return this.finish(true)
    if (this.id === 'hunt') this.spawnPumpkin(player)
    if (this.id === 'storm') this.spawnCrystal(player)
    this.hint = this.id === 'festival' ? `${this.score} of ${this.def.goal} lanterns lit` : this.hint
  }

  update(dt: number, player: THREE.Vector3) {
    if (this.phase === 'idle' || this.phase === 'done') return
    this.t += dt
    if (this.phase === 'countdown') {
      this.countdown -= dt
      if (this.countdown <= 0) this.phase = 'playing'
      return
    }
    this.timeLeft -= dt
    // idle motion
    for (const m of this.marks) {
      if (this.id === 'hunt' || this.id === 'storm') m.group.children[0].rotation.y += dt * 1.6
      m.group.children[0].position.y += Math.sin(this.t * 2.4 + m.born) * dt * 0.12
    }
    // pickups / banishing
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const m = this.marks[i]
      if (this.id === 'invasion') {
        m.x += (m.vx ?? 0) * dt
        m.z += (m.vz ?? 0) * dt
        m.group.position.set(m.x, this.ground(m.x, m.z), m.z)
        m.group.rotation.y = Math.atan2(m.vx ?? 0, m.vz ?? 0)
        if (Math.hypot(m.x, m.z) < 2.6) {
          m.group.removeFromParent()
          this.marks.splice(i, 1)
          this.lives--
          this.onHit?.('bad')
          if (this.lives <= 0) return this.finish(false)
          continue
        }
        if (Math.hypot(m.x - player.x, m.z - player.z) < 1.35) {
          this.onHit?.('good')
          m.group.removeFromParent()
          this.marks.splice(i, 1)
          this.score++
          if (this.score >= this.def.goal) return this.finish(true)
        }
      } else if (this.id === 'festival') {
        if (Math.hypot(m.x - player.x, m.z - player.z) < 1.5) {
          ;(m.group.children[1] as THREE.Mesh).material = this.mats.festival
          this.marks.splice(i, 1) // lit lanterns stay up (the group is cleaned with the round), but no longer count
          this.score++
          this.onHit?.('good')
          this.hint = `${this.score} of ${this.def.goal} lanterns lit`
          if (this.score >= this.def.goal) return this.finish(true)
        }
      } else if (Math.hypot(m.x - player.x, m.z - player.z) < 1.1) {
        this.collect(i, player)
        if ((this.phase as EventPhase) === 'done') return
      }
    }
    // ghosts arrive over time
    if (this.id === 'invasion') {
      this.spawnT -= dt
      if (this.spawnT <= 0 && this.marks.length < 6) {
        this.spawnT = Math.max(1.1, 2.6 - this.score * 0.08)
        this.spawnGhost(player)
      }
    }
    // lightning: telegraphed red ring near the player, then a strike
    if (this.id === 'storm') {
      this.strikeT -= dt
      if (this.strikeT <= 0 && this.rings.length < 3) {
        this.strikeT = 2.4 + Math.random() * 1.2
        const a = Math.random() * Math.PI * 2
        const d = Math.random() * 6
        let x = player.x + Math.cos(a) * d
        let z = player.z + Math.sin(a) * d
        if (Math.hypot(x, z) > this.area.r - 2) {
          x *= 0.8
          z *= 0.8
        }
        const mesh = new THREE.Mesh(this.geo.ring, this.mats.strike)
        mesh.position.set(x, this.ground(x, z) + 0.08, z)
        this.root.add(mesh)
        this.rings.push({ mesh, x, z, t: 1.5 })
      }
      for (let i = this.rings.length - 1; i >= 0; i--) {
        const r = this.rings[i]
        r.t -= dt
        r.mesh.scale.setScalar(0.7 + 0.3 * Math.abs(Math.sin(this.t * 10)))
        if (r.t <= 0) {
          this.flash = 1
          this.onHit?.('strike')
          if (Math.hypot(r.x - player.x, r.z - player.z) < 2.2) {
            this.lives--
            this.onHit?.('bad')
          }
          r.mesh.removeFromParent()
          this.rings.splice(i, 1)
          if (this.lives <= 0) return this.finish(false)
        }
      }
      this.flash = Math.max(0, this.flash - dt * 3)
      this.flashLight.intensity = this.flash * 2.2
      const p = this.rainPos
      for (let i = 0; i < 260; i++) {
        const k = i * 6
        p[k + 1] -= dt * 26
        if (p[k + 1] < player.y - 1 || p[k] === 0) {
          p[k] = player.x + (Math.random() - 0.5) * 30
          p[k + 1] = player.y + 5 + Math.random() * 9
          p[k + 2] = player.z + (Math.random() - 0.5) * 30
        }
        p[k + 3] = p[k] - 0.05
        p[k + 4] = p[k + 1] - 0.9
        p[k + 5] = p[k + 2]
      }
      this.rain.geometry.attributes.position.needsUpdate = true
    }
    if (this.timeLeft <= 0) this.finish(this.score >= this.def.goal)
  }
}
