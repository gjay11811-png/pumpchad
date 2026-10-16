import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Frame } from './signs'
import { isNight } from './daylight'

/**
 * CHAD MOTORS' fictional cars (original designs, no real makes): a low wedge supercar body extruded from a side
 * profile, a tinted glass canopy, wheels with gold or chrome rims, light bars front and rear, a rear wing and an
 * underglow. Built through a Frame (static, batched) at the car's centre on the ground, nose toward local +z.
 */
export type CarModel = { id: string; name: string; tagline: string; paint: string; rim: 'gold' | 'chrome'; glow: string; wing?: boolean }
export const CARS: CarModel[] = [
  { id: 'phantom', name: 'Pumpkin Phantom GT', tagline: 'gold paint · gold rims · zero chill', paint: '#e0a83e', rim: 'chrome', glow: '#ffb24a', wing: true },
  { id: 'nightshade', name: 'Nightshade V8', tagline: 'midnight purple · a howl at the moon', paint: '#7a3ad8', rim: 'gold', glow: '#c08aff' },
  { id: 'raptor', name: 'Gourd Raptor', tagline: 'pumpkin orange · built for leg day', paint: '#e8641a', rim: 'gold', glow: '#ff8a3a', wing: true },
]

type D = (THREE.Material | THREE.Texture | THREE.BufferGeometry)[]
const matCache = new Map<string, Record<string, THREE.Material>>()
export function carMats(m: CarModel, D: D) {
  const key = m.id
  let s = matCache.get(key)
  if (!s || (s.paint as THREE.Material & { disposed?: boolean }).disposed) {
    const night = isNight()
    const std = (p: THREE.MeshStandardMaterialParameters) => {
      const mm = new THREE.MeshStandardMaterial(p)
      D.push(mm)
      return mm
    }
    const glow = (c: string, k: number) => {
      const mm = new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false })
      D.push(mm)
      return mm
    }
    s = {
      paint: (() => {
        const mm = new THREE.MeshPhysicalMaterial({ color: m.paint, metalness: 0.35, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.5, emissive: m.paint, emissiveIntensity: night ? 0.16 : 0.05 })
        D.push(mm)
        return mm
      })(),
      glass: std({ color: '#2a3c56', metalness: 0.85, roughness: 0.1, emissive: '#0a1220' }),
      tyre: std({ color: '#141416', roughness: 0.85 }),
      rim: std({ color: m.rim === 'gold' ? '#e0a83e' : '#d8d6d0', metalness: 0.75, roughness: 0.28, emissive: m.rim === 'gold' ? '#5a3a08' : '#4a4a48' }),
      trim: std({ color: '#1a1a1e', metalness: 0.6, roughness: 0.4 }),
      head: glow('#fff2d8', night ? 1.5 : 1.1),
      tail: glow('#ff2a3a', night ? 1.6 : 1.0),
      under: glow(m.glow, night ? 1.8 : 0.6),
    }
    matCache.set(key, s)
    // freed with the scene: forget them so the next scene builds fresh ones
    for (const mm of Object.values(s)) mm.addEventListener('dispose', () => matCache.delete(key))
  }
  return s
}

/** a lofted body: rings of a superellipse section (half-width w, bottom yb, top yt, squareness n) stretched along z, capped at both ends */
type Station = [z: number, w: number, yb: number, yt: number, n?: number]
function loft(st: Station[], K = 32, nDef = 3.2) {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const sp = (c: number, n: number) => Math.sign(c) * Math.pow(Math.abs(c), 2 / n)
  for (let i = 0; i < st.length; i++) {
    const [z, w, yb, yt, n = nDef] = st[i]
    const yc = (yb + yt) / 2
    const h = (yt - yb) / 2
    for (let k = 0; k < K; k++) {
      const a = (k / K) * Math.PI * 2
      pos.push(w * sp(Math.cos(a), n), yc + h * sp(Math.sin(a), n), z)
      uv.push(k / K, i / (st.length - 1))
    }
  }
  for (let i = 0; i < st.length - 1; i++)
    for (let k = 0; k < K; k++) {
      const a = i * K + k
      const b = i * K + ((k + 1) % K)
      const c = (i + 1) * K + k
      const d = (i + 1) * K + ((k + 1) % K)
      idx.push(a, c, b, b, c, d)
    }
  // end caps (a fan to the centre of the first and last ring)
  for (const [ring, flip] of [[0, true], [st.length - 1, false]] as const) {
    const ci = pos.length / 3
    const [z, , yb, yt] = st[ring]
    pos.push(0, (yb + yt) / 2, z)
    uv.push(0.5, ring / (st.length - 1))
    for (let k = 0; k < K; k++) {
      const a = ring * K + k
      const b = ring * K + ((k + 1) % K)
      if (flip) idx.push(ci, a, b)
      else idx.push(ci, b, a)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** a tyre: a lathe profile with a rounded shoulder and a bulged sidewall (axis = x) */
function tyreGeo(r: number, wdt: number) {
  const hw = wdt / 2
  const rimR = r * 0.62
  const pts = [
    new THREE.Vector2(rimR, -hw * 0.82),
    new THREE.Vector2(rimR + 0.03, -hw * 0.98),
    new THREE.Vector2(r * 0.86, -hw * 1.02),
    new THREE.Vector2(r * 0.97, -hw * 0.78),
    new THREE.Vector2(r, -hw * 0.4),
    new THREE.Vector2(r, hw * 0.4),
    new THREE.Vector2(r * 0.97, hw * 0.78),
    new THREE.Vector2(r * 0.86, hw * 1.02),
    new THREE.Vector2(rimR + 0.03, hw * 0.98),
    new THREE.Vector2(rimR, hw * 0.82),
  ]
  return new THREE.LatheGeometry(pts, 28).rotateZ(Math.PI / 2)
}

function mergeGeos(gs: THREE.BufferGeometry[]) {
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  for (const g0 of gs) {
    const g = g0.index ? g0.toNonIndexed() : g0
    pos.push(...Array.from(g.attributes.position.array))
    nor.push(...Array.from(g.attributes.normal.array))
    uv.push(...Array.from(g.attributes.uv ? g.attributes.uv.array : new Float32Array(g.attributes.position.count * 2)))
  }
  const o = new THREE.BufferGeometry()
  o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  o.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  o.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  return o
}

/** a ten-spoke alloy (axis = x): rim lip, spokes, hub cap */
function alloyGeo(r: number) {
  const parts: THREE.BufferGeometry[] = []
  parts.push(new THREE.TorusGeometry(r, 0.022, 8, 28).rotateY(Math.PI / 2))
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2
    const sp = new THREE.BoxGeometry(0.035, r * 0.92, 0.05)
    sp.translate(0, r * 0.5, 0)
    sp.rotateX(a + (k % 2 ? 0.05 : -0.05))
    parts.push(sp)
  }
  parts.push(new THREE.CylinderGeometry(r * 0.2, r * 0.22, 0.05, 14).rotateZ(Math.PI / 2))
  return mergeGeos(parts)
}

export function sportsCar(F: Frame, m: CarModel, D: D) {
  const M = carMats(m, D)
  const L = 4.5
  const hw = 0.98 // half the body width at the wheels
  // ── the body: a mid-engine supercar lofted from sections — low pointed nose, a cab-forward glasshouse, wide haunches over the rear wheels,
  //    a tapered tail; every ring is a superellipse so the shoulders are rounded rather than boxy ──
  const body = loft(
    [
      [2.26, 0.5, 0.2, 0.26, 2.4],
      [2.15, 0.72, 0.17, 0.31, 3],
      [1.9, 0.88, 0.15, 0.44],
      [1.6, 0.95, 0.15, 0.62],
      [1.3, 0.97, 0.15, 0.8],
      [1.0, 0.97, 0.16, 0.84],
      [0.5, 0.94, 0.17, 0.8],
      [-0.2, 0.97, 0.17, 0.83],
      [-0.9, 1.0, 0.17, 0.9],
      [-1.4, 1.0, 0.17, 0.9],
      [-1.85, 0.9, 0.18, 0.84],
      [-2.15, 0.72, 0.2, 0.74, 2.8],
      [-2.26, 0.58, 0.24, 0.66, 2.4],
    ],
    36,
  )
  F.put(body, M.paint, 0, 0, 0)
  // ── the glasshouse: a smooth bubble canopy in the shoulder line, with a painted roof blade ──
  const canopy = loft(
    [
      [1.0, 0.62, 0.74, 0.8, 2.4],
      [0.75, 0.66, 0.74, 0.98],
      [0.3, 0.65, 0.74, 1.16],
      [-0.2, 0.62, 0.74, 1.2],
      [-0.7, 0.62, 0.74, 1.12],
      [-1.1, 0.66, 0.76, 0.96],
      [-1.4, 0.62, 0.78, 0.84, 2.4],
    ],
    28,
    2.6,
  )
  F.put(canopy, M.glass, 0, 0, 0)
  F.put(loft([[0.45, 0.4, 1.17, 1.2, 2.4], [0.0, 0.46, 1.19, 1.235], [-0.5, 0.44, 1.15, 1.2, 2.4]], 16, 2.5), M.paint, 0, 0, 0) // roof blade
  for (const sx of [-1, 1]) {
    F.put(new THREE.BoxGeometry(0.03, 0.04, 1.5), M.trim, sx * 0.965, 0.58, 0.0) // door shut-line, along the sill
    F.put(new THREE.BoxGeometry(0.1, 0.06, 0.18), M.paint, sx * 0.78, 0.88, 0.9) // mirror pod
    F.put(new THREE.BoxGeometry(0.1, 0.02, 0.1), M.trim, sx * 0.78, 0.86, 0.82)
    F.put(new THREE.BoxGeometry(0.06, 0.2, 0.48), M.trim, sx * 0.97, 0.55, -1.15) // rear side intake
    F.put(new THREE.BoxGeometry(0.05, 0.1, 0.34), M.trim, sx * 0.94, 0.5, 1.08)
  }
  // ── interior seen through the glass: two bucket seats, a wheel and a binnacle ──
  for (const sx of [-0.34, 0.34]) {
    F.put(new THREE.BoxGeometry(0.4, 0.07, 0.5), M.trim, sx, 0.82, -0.25)
    F.put(new THREE.BoxGeometry(0.4, 0.5, 0.1), M.trim, sx, 1.04, -0.55, -0.18)
  }
  F.put(new THREE.TorusGeometry(0.13, 0.014, 6, 16).rotateX(-0.9), M.trim, -0.34, 1.0, 0.28)
  F.put(new THREE.BoxGeometry(1.1, 0.12, 0.3), M.trim, 0, 0.9, 0.62, -0.3)
  // ── engine deck louvres behind the cabin ──
  for (let k = 0; k < 6; k++) F.put(new THREE.BoxGeometry(0.62, 0.015, 0.05), M.trim, 0, 0.9 - k * 0.002, -1.55 - k * 0.1, 0.08)
  // ── wheels: bulged tyres, ten-spoke alloys, brake discs and callipers ──
  const tyre = tyreGeo(0.38, 0.3)
  const alloy = alloyGeo(0.27)
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const wz = sz * 1.4
      const wx = sx * (hw - 0.1)
      F.put(tyre, M.tyre, wx, 0.38, wz)
      F.put(alloy, M.rim, wx + sx * 0.12, 0.38, wz)
      F.put(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 20).rotateZ(Math.PI / 2), M.trim, wx + sx * 0.06, 0.38, wz) // brake disc
      F.box(0.05, 0.14, 0.1, M.under, wx + sx * 0.06, 0.5, wz - sz * 0.12) // calliper
    }
  return finishCar(F, M, m, L)
}

/** second half of the car: arches, lights, bumpers, exhausts, wing, underglow */
function finishCar(F: Frame, M: Record<string, THREE.Material>, m: CarModel, L: number) {
  // lights: swept LED headlamp units with a DRL line, and a tail light bar
  for (const sx of [-1, 1]) {
    F.put(new THREE.BoxGeometry(0.34, 0.05, 0.06), M.head, sx * 0.58, 0.35, 2.03, -0.35, 0)
    F.put(new THREE.BoxGeometry(0.4, 0.09, 0.05), M.trim, sx * 0.58, 0.35, 2.02, -0.35, 0)
    F.put(new THREE.BoxGeometry(0.46, 0.05, 0.04), M.tail, sx * 0.55, 0.78, -2.15, 0.35, 0)
    F.put(new THREE.CylinderGeometry(0.06, 0.055, 0.22, 12).rotateX(Math.PI / 2), M.rim, sx * 0.22, 0.34, -L / 2 - 0.02) // exhaust tip
  }
  F.box(0.9, 0.09, 0.04, M.trim, 0, 0.3, L / 2) // lower intake
  F.box(1.5, 0.04, 0.34, M.trim, 0, 0.16, L / 2 - 0.12) // splitter
  F.box(1.3, 0.08, 0.26, M.trim, 0, 0.2, -L / 2 + 0.06) // diffuser
  F.box(0.34, 0.1, 0.02, M.rim, 0, 0.44, -L / 2 - 0.01, false) // plate
  if (m.wing) {
    F.box(1.7, 0.04, 0.34, M.paint, 0, 1.03, -L / 2 + 0.34)
    for (const sx of [-0.7, 0.7]) F.box(0.05, 0.22, 0.14, M.trim, sx, 0.93, -L / 2 + 0.4)
  }
  F.box(1.5, 0.01, 3.4, M.under, 0, 0.04, 0, false)
}

/**
 * Showpiece cars (Sketchfab, CC BY 4.0 — see CREDITS.md / ASSETS.md): `vette` is the "Realistic Sports Car" (decimated to ~32 K triangles) and
 * `gt3` the "Porsche 911 GT3 RS" (cleaned, ~14 K triangles). Each is loaded once, then cloned wherever a car stands, in the car's own paint.
 * Until a model arrives its place is simply bare for an instant. Each is turned (`yaw`) so its nose points along +z, like the procedural `sportsCar`.
 */
export type HeroModel = 'vette' | 'gt3'
const HERO: Record<HeroModel, { file: string; scale: number; yaw: number; paint: string[]; rims: string[]; glass: string[]; hide: string[] }> = {
  vette: { file: 'sports_car_hero.glb', scale: 0.96, yaw: 0, paint: ['Material_283'], rims: ['Material_240'], glass: ['Material_325'], hide: [] },
  gt3: { file: 'gt3.glb', scale: 1, yaw: Math.PI, paint: ['070715SSCR_bodycolor'], rims: [], glass: ['070715SSCR_windows', '070715SSCR_glass'], hide: ['GR3D_driver'] },
}
const heroLoads = new Map<HeroModel, Promise<THREE.Object3D | null>>()
function loadHero(model: HeroModel) {
  let pr = heroLoads.get(model)
  if (!pr) {
    // started a few seconds after the scene is built, so the model and its textures never compete with the world's own loading
    pr = new Promise<void>((r) => setTimeout(r, 4000))
      .then(() => new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}chadverse/models/${HERO[model].file}`)
      ).then((g) => {
        g.scene.traverse((o) => {
          const m = o as THREE.Mesh
          if (!m.isMesh) return
          for (const mm of Array.isArray(m.material) ? m.material : [m.material]) {
            const sm = mm as THREE.MeshStandardMaterial
            if (sm.flatShading) {
              sm.flatShading = false // GLTFLoader flat-shades a mesh that ships without normals
              sm.needsUpdate = true
            }
          }
          m.castShadow = true
          m.receiveShadow = false
          // a texture that failed to decode (a starved GPU / browser) leaves a white part: give such materials a plausible flat colour instead
          for (const mm of Array.isArray(m.material) ? m.material : [m.material]) {
            const sm = mm as THREE.MeshStandardMaterial
            if (sm.map && !(sm.map as THREE.Texture).image) {
              sm.map = null
              sm.color.set(/tyre/i.test(sm.name) ? '#17171a' : /rim|wheel|disk/i.test(sm.name) ? '#2c2c30' : /interior|driver/i.test(sm.name) ? '#34343a' : /carbon/i.test(sm.name) ? '#18181a' : '#8a8a8e')
              sm.needsUpdate = true
            }
          }
        })
        return g.scene
      })
      .catch(() => null)
    heroLoads.set(model, pr)
  }
  return pr
}
export function heroCar(scene: THREE.Object3D, x: number, y: number, z: number, ry: number, paint = '#e0a83e', model: HeroModel = 'vette') {
  const cfg = HERO[model]
  const night = isNight() // at night the paint carries a little light of its own, so a car away from the display lights never reads as a black silhouette
  void loadHero(model).then((src) => {
    if (!src) return
    const car = src.clone(true)
    car.scale.setScalar(cfg.scale)
    car.position.set(x, y, z)
    car.rotation.y = ry + cfg.yaw
    car.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || Array.isArray(m.material)) return
      const name = (m.material as THREE.Material).name
      if (cfg.hide.includes(name)) m.visible = false
      else if (cfg.glass.includes(name)) {
        // the glasshouse: a lighter, soft tint so the windows read against the body and the dark room
        m.material = new THREE.MeshPhysicalMaterial({ color: '#27384e', metalness: 0.2, roughness: 0.55, transparent: true, opacity: 0.7, envMapIntensity: 1.2, emissive: '#0c1624', emissiveIntensity: 0.5, depthWrite: false })
      } else if (cfg.paint.includes(name) || cfg.rims.includes(name)) {
        const rim = cfg.rims.includes(name)
        // a per-car copy: glossy clearcoat paint with a little self-light so the shadows lift and the body shape reads
        m.material = new THREE.MeshPhysicalMaterial({ color: rim ? '#e6c46e' : paint, metalness: rim ? 0.9 : 0.62, roughness: rim ? 0.22 : 0.2, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: night ? 2.3 : 1.7, emissive: rim ? '#2a1c04' : paint, emissiveIntensity: rim ? 0.15 : night ? 0.3 : 0.12 })
      }
    })
    scene.add(car)
  })
}
/** put a hero car where a procedural car would have stood (same Frame: position + heading taken from its matrix) */
export function heroCarAt(F: Frame, scene: THREE.Object3D, paint: string, model: HeroModel = 'gt3') {
  const p = F.world(0, 0, 0)
  const yaw = new THREE.Euler().setFromRotationMatrix(F.M, 'YXZ').y
  heroCar(scene, p.x, p.y, p.z, yaw, paint, model)
}
