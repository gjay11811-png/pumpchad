import * as THREE from 'three'
import { leaf, softDot } from './textures'

/* ───────── GPU point particles (smoke, embers) ───────── */
const particleVS = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  uniform float uScale;
  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`
const particleFS = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float a = texture2D(uMap, gl_PointCoord).r * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
  }`

type Emitter = { x: number; y: number; z: number }

/**
 * Many emitters, one draw call. Each particle belongs to an emitter and loops through
 * its life: rise, drift with the wind, grow, fade.
 */
export class Particles {
  points: THREE.Points
  private pos: Float32Array
  private size: Float32Array
  private alpha: Float32Array
  private age: Float32Array
  private life: Float32Array
  private seed: Float32Array
  private owner: Uint16Array
  constructor(
    private emitters: Emitter[],
    perEmitter: number,
    private kind: 'smoke' | 'embers',
    color: string,
    additive: boolean,
  ) {
    const n = Math.max(1, emitters.length * perEmitter)
    this.pos = new Float32Array(n * 3)
    this.size = new Float32Array(n)
    this.alpha = new Float32Array(n)
    this.age = new Float32Array(n)
    this.life = new Float32Array(n)
    this.seed = new Float32Array(n)
    this.owner = new Uint16Array(n)
    for (let i = 0; i < n; i++) {
      this.owner[i] = Math.floor(i / perEmitter)
      this.life[i] = kind === 'smoke' ? 5 + Math.random() * 3 : 1.4 + Math.random() * 1.4
      this.age[i] = Math.random() * this.life[i]
      this.seed[i] = Math.random() * 100
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage))
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage))
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage))
    const m = new THREE.ShaderMaterial({
      vertexShader: particleVS,
      fragmentShader: particleFS,
      uniforms: { uMap: { value: softDot() }, uColor: { value: new THREE.Color(color).multiplyScalar(additive ? 2.2 : 1) }, uScale: { value: 300 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    })
    this.points = new THREE.Points(g, m)
    this.points.frustumCulled = false
  }

  setPixelScale(h: number, pr: number) {
    ;(this.points.material as THREE.ShaderMaterial).uniforms.uScale.value = h * pr * 0.5
  }

  update(dt: number, t: number) {
    const n = this.age.length
    for (let i = 0; i < n; i++) {
      this.age[i] += dt
      if (this.age[i] > this.life[i]) this.age[i] -= this.life[i]
      const e = this.emitters[this.owner[i]]
      const k = this.age[i] / this.life[i]
      const s = this.seed[i]
      if (this.kind === 'smoke') {
        const rise = k * 4.5
        this.pos[i * 3] = e.x + Math.sin(s + t * 0.3) * 0.3 * k + k * 1.6 // wind drifts east
        this.pos[i * 3 + 1] = e.y + rise
        this.pos[i * 3 + 2] = e.z + Math.cos(s + t * 0.25) * 0.3 * k
        this.size[i] = 1.2 + k * 3.2
        this.alpha[i] = Math.sin(Math.PI * Math.min(1, k * 1.15)) * 0.32
      } else {
        this.pos[i * 3] = e.x + Math.sin(s * 3 + t * 2) * 0.35 * k
        this.pos[i * 3 + 1] = e.y + k * 2.4
        this.pos[i * 3 + 2] = e.z + Math.cos(s * 2 + t * 1.7) * 0.35 * k
        this.size[i] = 0.12 + (1 - k) * 0.12
        this.alpha[i] = (1 - k) * 0.9
      }
    }
    const g = this.points.geometry
    g.attributes.position.needsUpdate = true
    g.attributes.aSize.needsUpdate = true
    g.attributes.aAlpha.needsUpdate = true
  }
}

/* ───────── Fire ───────── */
const flameGeo = new THREE.ConeGeometry(0.22, 0.7, 7, 1, true)
flameGeo.translate(0, 0.35, 0)
flameGeo.userData.shared = true // module-level: reused by every scene and by demon horns, never disposed by scene teardown
export const flameMats = {
  outer: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff6a10').multiplyScalar(3), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  inner: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd27a').multiplyScalar(3.2), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
}

flameMats.outer.userData.shared = flameMats.inner.userData.shared = true

export class Fire {
  group = new THREE.Group()
  private a: THREE.Mesh
  private b: THREE.Mesh
  private phase = Math.random() * 10
  constructor(x: number, y: number, z: number, scale = 1, public light: THREE.PointLight | null = null, public baseIntensity = 0) {
    this.a = new THREE.Mesh(flameGeo, flameMats.outer)
    this.b = new THREE.Mesh(flameGeo, flameMats.inner)
    this.b.scale.setScalar(0.55)
    this.group.add(this.a, this.b)
    this.group.position.set(x, y, z)
    this.group.scale.setScalar(scale)
  }
  update(t: number) {
    const p = t * 9 + this.phase
    const f = 1 + Math.sin(p) * 0.12 + Math.sin(p * 2.7) * 0.08
    this.a.scale.set(1 + Math.sin(p * 1.3) * 0.08, f, 1 + Math.cos(p * 1.1) * 0.08)
    this.a.rotation.y = t * 1.5
    this.b.scale.set(0.55, 0.55 * (1 + Math.sin(p * 1.9) * 0.15), 0.55)
    if (this.light) this.light.intensity = this.baseIntensity * (0.88 + Math.sin(p * 1.7) * 0.07 + Math.sin(p * 4.3) * 0.05)
  }
}

/* ───────── Falling leaves (instanced, recycled around the player) ───────── */
export class Leaves {
  mesh: THREE.InstancedMesh
  private st: { x: number; y: number; z: number; vy: number; rx: number; ry: number; spin: number; ph: number }[] = []
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private e = new THREE.Euler()
  constructor(count: number) {
    const geo = new THREE.PlaneGeometry(0.22, 0.22)
    const mat = new THREE.MeshStandardMaterial({ map: leaf(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 })
    this.mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, count))
    this.mesh.count = count
    this.mesh.frustumCulled = false
    const cols = ['#c2531a', '#a8341a', '#d9892a', '#7a3b1c', '#e0a040'].map((c) => new THREE.Color(c))
    for (let i = 0; i < count; i++) {
      this.mesh.setColorAt(i, cols[i % cols.length])
      this.st.push({ x: 0, y: Math.random() * 9, z: 0, vy: 0.4 + Math.random() * 0.5, rx: Math.random() * 6, ry: Math.random() * 6, spin: 0.5 + Math.random() * 2, ph: Math.random() * 10 })
    }
  }
  update(dt: number, t: number, cx: number, cz: number) {
    for (let i = 0; i < this.st.length; i++) {
      const s = this.st[i]
      if (s.y <= 0.02 || Math.hypot(s.x - cx, s.z - cz) > 20) {
        const a = Math.random() * Math.PI * 2
        const r = 2 + Math.random() * 16
        s.x = cx + Math.cos(a) * r
        s.z = cz + Math.sin(a) * r
        s.y = 5 + Math.random() * 5
      }
      s.y -= s.vy * dt
      s.x += (0.7 + Math.sin(t * 0.6 + s.ph) * 0.5) * dt
      s.z += Math.sin(t * 1.3 + s.ph * 2) * 0.4 * dt
      s.rx += s.spin * dt
      s.ry += s.spin * 0.7 * dt
      this.e.set(s.rx, s.ry, Math.sin(t + s.ph))
      this.q.setFromEuler(this.e)
      this.m.compose(new THREE.Vector3(s.x, s.y, s.z), this.q, ONE)
      this.mesh.setMatrixAt(i, this.m)
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }
}
const ONE = new THREE.Vector3(1, 1, 1)

/* ───────── Waving cloth (banners, flags) — CPU wave on a few low-res planes ───────── */
export class Cloth {
  mesh: THREE.Mesh
  private base: Float32Array
  private h: number
  constructor(w: number, h: number, mat: THREE.Material, private amp = 0.12, private phase = Math.random() * 10) {
    this.h = h
    const g = new THREE.PlaneGeometry(w, h, 4, 6)
    g.translate(0, -h / 2, 0) // hangs from its top edge
    this.base = (g.attributes.position.array as Float32Array).slice()
    this.mesh = new THREE.Mesh(g, mat)
    this.mesh.castShadow = false
  }
  update(t: number) {
    const p = this.mesh.geometry.attributes.position as THREE.BufferAttribute
    const h = this.h
    for (let i = 0; i < p.count; i++) {
      const x = this.base[i * 3]
      const y = this.base[i * 3 + 1]
      const down = Math.min(1, -y / (h || 1))
      p.setZ(i, Math.sin(t * 2.1 + this.phase + y * 1.8 + x * 0.9) * this.amp * down)
    }
    p.needsUpdate = true
    this.mesh.geometry.computeVertexNormals()
  }
}
