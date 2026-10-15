import * as THREE from 'three'

/**
 * Companions from CHAD PETS: small procedural creatures that follow the player. One shared rule for all of them —
 * keep to your side (visible past your shoulder), hurry when left behind, and pop back to your side if they fall too far behind (a teleport,
 * a door, a fast-travel). Walkers (cat, pumpkin) stay on the ground; the ghost floats, the bat flutters overhead.
 */
export type PetKind = 'cat' | 'ghost' | 'bat' | 'pumpkin'
export const PET_KINDS: PetKind[] = ['cat', 'ghost', 'bat', 'pumpkin']

const SIDE = 1.1
const BACK = 0
const SCALE = 1.35
const CATCH_UP = 12

export class Pet {
  readonly root = new THREE.Group()
  private body = new THREE.Group()
  private parts: Record<string, THREE.Object3D> = {}
  private disposables: (THREE.Material | THREE.BufferGeometry)[] = []
  private t = Math.random() * 10
  private speed = 0
  private placed = false

  constructor(readonly kind: PetKind) {
    this.root.add(this.body)
    this.root.scale.setScalar(SCALE)
    ;({ cat: () => this.cat(), ghost: () => this.ghost(), bat: () => this.bat(), pumpkin: () => this.pumpkin() })[kind]()
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true
    })
  }

  /** the spot beside you: off your shoulder and a little back, where the chase camera can see it */
  private spot(at: THREE.Vector3, yaw: number) {
    const fx = Math.sin(yaw)
    const fz = Math.cos(yaw)
    return { x: at.x + fz * SIDE - fx * BACK, z: at.z - fx * SIDE - fz * BACK }
  }

  /** stand at your side (on arrival, or when it catches up) */
  place(at: THREE.Vector3, yaw: number, ground: (x: number, z: number) => number) {
    const { x, z } = this.spot(at, yaw)
    this.root.position.set(x, ground(x, z), z)
    this.root.rotation.y = yaw
    this.speed = 0
    this.placed = true
  }

  update(dt: number, at: THREE.Vector3, yaw: number, ground: (x: number, z: number) => number, clamp?: (p: THREE.Vector3) => void) {
    this.t += dt
    const r = this.root.position
    if (!this.placed || Math.hypot(at.x - r.x, at.z - r.z) > CATCH_UP) return this.place(at, yaw, ground)
    // head for the spot beside you: faster the further away, settle when there
    const T = this.spot(at, yaw)
    const dx = T.x - r.x
    const dz = T.z - r.z
    const d = Math.hypot(dx, dz)
    const want = d > 0.2 ? Math.min(9, d * 3.2 + 0.4) : 0
    this.speed += (want - this.speed) * (1 - Math.exp(-dt * 8))
    let face = yaw
    if (this.speed > 0.05 && d > 0.01) {
      const step = Math.min(this.speed * dt, d)
      r.x += (dx / d) * step
      r.z += (dz / d) * step
      clamp?.(r)
      if (d > 0.3) face = Math.atan2(dx, dz)
    }
    let dy = face - this.root.rotation.y
    dy = Math.atan2(Math.sin(dy), Math.cos(dy))
    this.root.rotation.y += dy * (1 - Math.exp(-dt * 8))
    const g = ground(r.x, r.z)
    r.y += (g - r.y) * (1 - Math.exp(-dt * 15))
    this.animate()
  }

  private animate() {
    const t = this.t
    const moving = Math.min(1, this.speed / 2)
    const P = this.parts
    if (this.kind === 'cat') {
      this.body.position.y = Math.abs(Math.sin(t * 9)) * 0.03 * moving
      P.tail.rotation.z = Math.sin(t * (moving ? 6 : 1.6)) * 0.35
      const s = Math.sin(t * 12) * 0.5 * moving
      P.leg0.rotation.x = s
      P.leg3.rotation.x = s
      P.leg1.rotation.x = -s
      P.leg2.rotation.x = -s
    } else if (this.kind === 'pumpkin') {
      // a trot: small bounce, legs and arms swinging in opposition; at rest a slow breathing sway
      this.body.position.y = moving ? 0.07 + Math.abs(Math.sin(t * 9)) * 0.05 : Math.sin(t * 2) * 0.01
      const sw = Math.sin(t * 9) * 0.7 * moving
      P.legL.rotation.x = sw
      P.legR.rotation.x = -sw
      P.armL.rotation.x = -sw * 0.8
      P.armR.rotation.x = sw * 0.8
      P.armL.rotation.z = 0.15 + (moving ? 0 : Math.sin(t * 1.7) * 0.05)
      P.armR.rotation.z = -0.15 - (moving ? 0 : Math.sin(t * 1.7) * 0.05)
    } else if (this.kind === 'ghost') {
      this.body.position.y = 0.75 + Math.sin(t * 2.2) * 0.08
      this.body.rotation.z = Math.sin(t * 1.3) * 0.08
      this.body.rotation.x = moving * 0.25
      P.armL.rotation.z = Math.sin(t * 2.6) * 0.35 + 0.1
      P.armR.rotation.z = -Math.sin(t * 2.6 + 1) * 0.35 - 0.1
    } else {
      this.body.position.y = 1.25 + Math.sin(t * 3.1) * 0.1
      const f = Math.sin(t * 18) * 0.9
      P.wingL.rotation.z = f
      P.wingR.rotation.z = -f
    }
  }

  dispose() {
    this.root.removeFromParent()
    this.disposables.forEach((d) => d.dispose())
  }

  /* ── models ── */
  private std(color: string, rough = 0.6, extra: THREE.MeshStandardMaterialParameters = {}) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra })
    this.disposables.push(m)
    return m
  }
  private glow(color: string, k = 2) {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false })
    this.disposables.push(m)
    return m
  }
  private mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, parent: THREE.Object3D = this.body) {
    this.disposables.push(g)
    const o = new THREE.Mesh(g, m)
    o.position.set(x, y, z)
    parent.add(o)
    return o
  }

  private cat() {
    const fur = this.std('#121016', 0.75)
    const eye = this.glow('#ffd25a', 2.2)
    const torso = this.mesh(new THREE.CapsuleGeometry(0.11, 0.26, 6, 12).rotateX(Math.PI / 2), fur, 0, 0.26, 0)
    torso.scale.set(1, 0.95, 1)
    const head = new THREE.Group()
    head.position.set(0, 0.38, 0.22)
    this.body.add(head)
    this.mesh(new THREE.SphereGeometry(0.1, 16, 12), fur, 0, 0, 0, head).scale.set(1.1, 0.95, 1)
    for (const sx of [-1, 1]) {
      this.mesh(new THREE.ConeGeometry(0.04, 0.09, 4), fur, sx * 0.055, 0.1, -0.01, head).rotation.z = -sx * 0.25
      this.mesh(new THREE.SphereGeometry(0.018, 8, 6), eye, sx * 0.042, 0.015, 0.088, head).scale.set(1, 1.3, 0.5)
    }
    // a face: pink nose, pale muzzle, whiskers, slit pupils, inner ears
    const pink = this.std('#c8788a', 0.6)
    const pale = this.std('#cfc8c0', 0.8)
    const slit = this.std('#050408', 0.5)
    this.mesh(new THREE.SphereGeometry(0.045, 10, 8), pale, 0, -0.03, 0.085, head).scale.set(1.15, 0.8, 0.9)
    this.mesh(new THREE.SphereGeometry(0.014, 8, 6), pink, 0, -0.005, 0.125, head).scale.set(1.2, 0.8, 0.8)
    for (const sx of [-1, 1]) {
      this.mesh(new THREE.BoxGeometry(0.004, 0.012, 0.004), slit, sx * 0.042, 0.015, 0.093, head).scale.set(1, 1.6, 1)
      this.mesh(new THREE.ConeGeometry(0.022, 0.05, 4), pink, sx * 0.055, 0.095, 0.005, head).rotation.z = -sx * 0.25
      for (let k = 0; k < 3; k++) {
        const w = this.mesh(new THREE.CylinderGeometry(0.0015, 0.001, 0.12, 3), pale, sx * 0.075, -0.02 + (k - 1) * 0.016, 0.1, head)
        w.rotation.z = Math.PI / 2 + sx * (k - 1) * 0.18
        w.rotation.y = -sx * 0.25
      }
    }
    // haunches + a pale chest so it reads as an animal with a body, not a capsule
    this.mesh(new THREE.SphereGeometry(0.1, 12, 10), fur, 0, 0.26, -0.13).scale.set(1.05, 0.95, 1.05)
    this.mesh(new THREE.SphereGeometry(0.075, 10, 8), pale, 0, 0.23, 0.15).scale.set(0.85, 1, 0.7)
    // four legs pivoting at the hip, each with a paw on the ground
    ;[[-0.06, 0.13], [0.06, 0.13], [-0.06, -0.13], [0.06, -0.13]].forEach(([x, z], i) => {
      const hip = new THREE.Group()
      hip.position.set(x, 0.2, z)
      this.body.add(hip)
      this.mesh(new THREE.CylinderGeometry(0.027, 0.02, 0.2, 7), fur, 0, -0.1, 0, hip)
      this.mesh(new THREE.SphereGeometry(0.03, 8, 6), i < 2 ? pale : fur, 0, -0.195, 0.012, hip).scale.set(1, 0.6, 1.3)
      this.parts[`leg${i}`] = hip
    })
    // a curled tail
    const tail = new THREE.Group()
    tail.position.set(0, 0.3, -0.24)
    this.body.add(tail)
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.08, -0.1), new THREE.Vector3(0, 0.24, -0.12), new THREE.Vector3(0.03, 0.32, -0.06)])
    this.mesh(new THREE.TubeGeometry(curve, 16, 0.02, 6), fur, 0, 0, 0, tail)
    this.parts.tail = tail
  }

  private ghost() {
    const sheet = this.std('#eef2ff', 0.4, { emissive: '#9fb4ff', emissiveIntensity: 0.55, transparent: true, opacity: 0.88 })
    const dark = this.std('#0c0c14', 0.9)
    const pts: THREE.Vector2[] = []
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 0.5
      pts.push(new THREE.Vector2(Math.sin(a) * 0.22 + 0.0001, 0.2 + Math.cos(a) * 0.22))
    }
    pts.reverse()
    pts.push(new THREE.Vector2(0.24, -0.08), new THREE.Vector2(0.27, -0.2))
    const g = new THREE.LatheGeometry(pts, 24)
    // wavy hem
    const pos = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) < -0.15) pos.setY(i, pos.getY(i) + Math.sin(Math.atan2(pos.getZ(i), pos.getX(i)) * 6) * 0.04)
    g.computeVertexNormals()
    this.mesh(g, sheet)
    for (const sx of [-1, 1]) this.mesh(new THREE.SphereGeometry(0.035, 10, 8), dark, sx * 0.07, 0.24, 0.19).scale.set(1, 1.4, 0.5)
    this.mesh(new THREE.SphereGeometry(0.03, 10, 8), dark, 0, 0.14, 0.215).scale.set(1, 1.3, 0.4)
    // little arms that wave, and a wisp of tail at the hem
    for (const sx of [-1, 1]) {
      const arm = new THREE.Group()
      arm.position.set(sx * 0.2, 0.12, 0.02)
      this.body.add(arm)
      this.mesh(new THREE.CapsuleGeometry(0.035, 0.1, 4, 8), sheet, sx * 0.04, -0.05, 0.03, arm).rotation.z = sx * 0.9
      this.parts[sx < 0 ? 'armL' : 'armR'] = arm
    }
    this.body.position.y = 1
  }

  private bat() {
    const fur = this.std('#2a1e24', 0.8)
    const wing = this.std('#3a2430', 0.7, { side: THREE.DoubleSide })
    const eye = this.glow('#ff4d3d', 2)
    this.mesh(new THREE.SphereGeometry(0.09, 14, 10), fur).scale.set(1, 1.15, 1)
    this.mesh(new THREE.SphereGeometry(0.065, 12, 10), fur, 0, 0.11, 0.03)
    for (const sx of [-1, 1]) {
      this.mesh(new THREE.ConeGeometry(0.025, 0.07, 4), fur, sx * 0.035, 0.19, 0.03)
      this.mesh(new THREE.SphereGeometry(0.012, 6, 6), eye, sx * 0.025, 0.12, 0.085)
      // a scalloped wing on a shoulder pivot
      const s = new THREE.Shape()
      s.moveTo(0, 0.04)
      s.lineTo(0.32, 0.08)
      s.quadraticCurveTo(0.27, -0.02, 0.22, -0.06)
      s.quadraticCurveTo(0.16, -0.01, 0.11, -0.07)
      s.quadraticCurveTo(0.06, -0.02, 0, -0.05)
      s.closePath()
      const pivot = new THREE.Group()
      pivot.position.set(sx * 0.06, 0.03, 0)
      pivot.scale.x = sx
      this.body.add(pivot)
      this.mesh(new THREE.ShapeGeometry(s, 6), wing, 0, 0, 0, pivot)
      this.parts[sx < 0 ? 'wingL' : 'wingR'] = pivot
    }
    this.body.position.y = 1.9
  }

  private pumpkin() {
    const skin = this.std('#e8641a', 0.55)
    const stem = this.std('#3e6a2a', 0.8)
    const face = this.glow('#ffb24a', 2.4)
    const dark = this.std('#1a1210', 0.9)
    const g = new THREE.SphereGeometry(0.2, 24, 16)
    const pos = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const k = 1 - 0.07 * Math.abs(Math.sin(Math.atan2(pos.getZ(i), pos.getX(i)) * 4))
      pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * 0.82, pos.getZ(i) * k)
    }
    g.computeVertexNormals()
    const top = new THREE.Group() // the gourd rides a little above the ground so legs and boots show
    top.position.y = 0.09
    this.body.add(top)
    this.mesh(g, skin, 0, 0.2, 0, top)
    this.mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.08, 6), stem, 0.01, 0.39, 0, top).rotation.z = 0.2
    for (const sx of [-1, 1]) {
      this.mesh(new THREE.ConeGeometry(0.03, 0.05, 3), face, sx * 0.065, 0.25, 0.178, top).rotation.x = Math.PI / 2
      this.mesh(new THREE.SphereGeometry(0.04, 8, 6), dark, sx * 0.09, 0.03, 0.04, top).scale.set(1, 0.6, 1.3)
    }
    this.mesh(new THREE.BoxGeometry(0.11, 0.025, 0.02), face, 0, 0.17, 0.188, top)
    // stubby legs with boots (the hop is a walk, not a bounce of a ball) and little arms
    for (const sx of [-1, 1]) {
      const hip = new THREE.Group()
      hip.position.set(sx * 0.075, 0.13, 0.01)
      this.body.add(hip)
      this.mesh(new THREE.CylinderGeometry(0.03, 0.026, 0.12, 6), skin, 0, -0.06, 0, hip)
      this.mesh(new THREE.SphereGeometry(0.045, 8, 6), dark, 0, -0.12, 0.018, hip).scale.set(1, 0.6, 1.4)
      this.parts[sx < 0 ? 'legL' : 'legR'] = hip
      const arm = new THREE.Group()
      arm.position.set(sx * 0.215, 0.29, 0.02)
      this.body.add(arm)
      this.mesh(new THREE.CapsuleGeometry(0.02, 0.07, 4, 8), skin, 0, -0.045, 0, arm)
      this.parts[sx < 0 ? 'armL' : 'armR'] = arm
    }
  }
}
