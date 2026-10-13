import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Pumpkins for Chad Kingdom (v4): organic, ribbed, a little lopsided — never perfect spheres.
 *
 * Four body variants (rib count, squash, lumps), curved ridged stems, vertex-coloured shading (dark grooves,
 * lighter ribs, green-brown around the stem), and four carved jack-o'-lantern faces in one emissive atlas.
 * Everything is merged into THREE meshes (plain skins, carved skins, stems) whatever the pumpkin count, and the
 * carved glow flickers gently through one shared material.
 */

type D = (THREE.Material | THREE.BufferGeometry | THREE.Texture)[]
const rngP = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646

/** 2×2 atlas of carved faces (white = cut through and glowing). Each quadrant is one whole unwrapped pumpkin:
 *  u runs around the pumpkin (the face sits at the front, u≈0.5), v runs bottom → top. */
function faceAtlas(D: D) {
  const S = 1024
  const H = S / 2
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, S, S)
  g.fillStyle = '#fff'
  const tri = (x: number, y: number, w: number, h: number, flip = false) => {
    g.beginPath()
    g.moveTo(x - w, y + (flip ? -h : h))
    g.lineTo(x + w, y + (flip ? -h : h))
    g.lineTo(x, y + (flip ? h : -h))
    g.closePath()
    g.fill()
  }
  const faces: ((ox: number, oy: number) => void)[] = [
    // 0 classic grin
    (ox, oy) => {
      const cx = ox + H / 2
      tri(cx - 34, oy + 150, 22, 18)
      tri(cx + 34, oy + 150, 22, 18)
      tri(cx, oy + 205, 12, 10)
      g.beginPath()
      g.moveTo(cx - 70, oy + 235)
      g.quadraticCurveTo(cx, oy + 300, cx + 70, oy + 235)
      for (let i = 0; i <= 6; i++) g.lineTo(cx + 70 - i * 23, oy + 248 + (i % 2) * 14)
      g.closePath()
      g.fill()
    },
    // 1 angry: slanted eyes, jagged frown
    (ox, oy) => {
      const cx = ox + H / 2
      for (const s of [-1, 1]) {
        g.beginPath()
        g.moveTo(cx + s * 12, oy + 165)
        g.lineTo(cx + s * 58, oy + 140)
        g.lineTo(cx + s * 50, oy + 178)
        g.closePath()
        g.fill()
      }
      g.beginPath()
      g.moveTo(cx - 64, oy + 262)
      for (let i = 0; i <= 8; i++) g.lineTo(cx - 64 + i * 16, oy + 240 + (i % 2 ? 0 : 18))
      g.lineTo(cx + 64, oy + 270)
      g.quadraticCurveTo(cx, oy + 248, cx - 64, oy + 270)
      g.closePath()
      g.fill()
    },
    // 2 surprised: round eyes, O mouth
    (ox, oy) => {
      const cx = ox + H / 2
      for (const s of [-1, 1]) {
        g.beginPath()
        g.arc(cx + s * 36, oy + 155, 18, 0, Math.PI * 2)
        g.fill()
      }
      g.beginPath()
      g.ellipse(cx, oy + 245, 22, 30, 0, 0, Math.PI * 2)
      g.fill()
    },
    // 3 sly wink + toothy smirk (the Chad)
    (ox, oy) => {
      const cx = ox + H / 2
      tri(cx - 36, oy + 152, 22, 18)
      g.fillRect(cx + 16, oy + 150, 44, 9) // closed winking eye
      g.beginPath()
      g.moveTo(cx - 60, oy + 238)
      g.quadraticCurveTo(cx + 10, oy + 290, cx + 72, oy + 222)
      g.lineTo(cx + 54, oy + 252)
      g.quadraticCurveTo(cx, oy + 268, cx - 60, oy + 238)
      g.fill()
      g.fillStyle = '#000'
      for (let i = 0; i < 3; i++) g.fillRect(cx - 24 + i * 24, oy + 240, 6, 22) // teeth
      g.fillStyle = '#fff'
    },
  ]
  faces.forEach((f, i) => {
    g.save()
    f((i % 2) * H, Math.floor(i / 2) * H)
    g.restore()
  })
  // soft glow halo inside the cuts
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  D.push(t)
  return t
}

/** subtle skin streaks (lighter vertical lines on the ribs) */
function skinTexture(D: D) {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const g = c.getContext('2d')!
  const r = rngP(4)
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, 256, 128)
  for (let i = 0; i < 260; i++) {
    g.fillStyle = r() < 0.5 ? `rgba(255,235,200,${0.25 + r() * 0.3})` : `rgba(120,60,20,${0.1 + r() * 0.15})`
    g.fillRect(r() * 256, r() * 128, 1 + r() * 1.5, 10 + r() * 50)
  }
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(90,50,20,${r() * 0.18})`
    g.fillRect(r() * 256, r() * 128, 2, 2)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  D.push(t)
  return t
}

const lumpN = (x: number, y: number, z: number, s: number) => Math.sin(x * 2.3 + s) * Math.sin(y * 1.9 + s * 1.7) * Math.cos(z * 2.1 + s * 0.6)

export type PumpkinOpts = {
  /** body radius (m) — small ≈ 0.15, medium ≈ 0.25, large ≈ 0.45 */
  r: number
  /** yaw the carved face looks toward (world: direction (sin, cos)); random if omitted */
  facing?: number
  /** carved face index 0–3, or undefined for an uncarved pumpkin */
  face?: number
  /** colour family */
  tint?: 'orange' | 'deep' | 'pale' | 'green'
  /** shape variant 0–3 */
  v?: number
}

const TINTS = {
  orange: [new THREE.Color('#9a3f0c'), new THREE.Color('#f07a1e')],
  deep: [new THREE.Color('#7a2a08'), new THREE.Color('#d9561a')],
  pale: [new THREE.Color('#9a6a2a'), new THREE.Color('#f2b25a')],
  green: [new THREE.Color('#3a4a22'), new THREE.Color('#7a8a3a')],
} as const

export class PumpkinBuilder {
  private plain: THREE.BufferGeometry[] = []
  private carved: THREE.BufferGeometry[] = []
  private stems: THREE.BufferGeometry[] = []
  private r = rngP(17)
  count = 0

  /** add one pumpkin resting on y (its base) */
  add(x: number, y: number, z: number, o: PumpkinOpts) {
    this.count++
    const v = o.v ?? Math.floor(this.r() * 4)
    const ribs = [10, 8, 12, 9][v]
    const squash = [0.78, 0.86, 0.7, 0.9][v]
    const depth = [0.09, 0.12, 0.07, 0.1][v]
    const R = o.r
    const g = new THREE.SphereGeometry(1, 28, 18)
    const pos = g.attributes.position as THREE.BufferAttribute
    const uv = g.attributes.uv as THREE.BufferAttribute
    const col: number[] = []
    const [dark, light] = TINTS[o.tint ?? 'orange']
    const c = new THREE.Color()
    const seed = this.r() * 10
    const lean = (this.r() - 0.5) * 0.12
    const face = o.face
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i)
      const py = pos.getY(i)
      const pz = pos.getZ(i)
      const th = Math.atan2(pz, px)
      const rib = 1 - depth * (1 - Math.pow(Math.abs(Math.cos((th * ribs) / 2)), 0.5))
      const lump = 1 + lumpN(px, py, pz, seed) * 0.05
      // dimple at the top where the stem sits, slightly flattened base
      const top = py > 0.82 ? (py - 0.82) * 1.2 : 0
      const yy = py * squash - top * 0.5
      const rr = rib * lump * (py < -0.85 ? 0.96 : 1)
      pos.setXYZ(i, px * rr * R + lean * py * R, yy * R + squash * R, pz * rr * R)
      // grooves dark, rib crowns light; greenish-brown near the stem, darker underneath
      const k = THREE.MathUtils.clamp((rib - (1 - depth)) / depth, 0, 1)
      c.copy(dark).lerp(light, 0.35 + k * 0.65)
      if (py > 0.7) c.lerp(new THREE.Color('#6a5a26'), (py - 0.7) * 0.9)
      if (py < -0.6) c.multiplyScalar(0.75 + (py + 1) * 0.6)
      col.push(c.r, c.g, c.b)
      // atlas UVs (only carved pumpkins sample the face atlas; plain ones use the streak texture)
      if (face !== undefined) {
        const u = uv.getX(i)
        const vv = uv.getY(i)
        // quadrant (col, row) of the atlas; row 0 is the top half of the canvas (v 0.5–1)
        uv.setXY(i, (face % 2) * 0.5 + u * 0.5, (1 - Math.floor(face / 2)) * 0.5 + vv * 0.5)
      } else uv.setXY(i, uv.getX(i) * 3, uv.getY(i))
    }
    g.computeVertexNormals()
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    // the face is drawn at the sphere's +X side; turn it toward `facing`
    g.rotateY(o.facing !== undefined ? o.facing - Math.PI / 2 : this.r() * Math.PI * 2)
    g.translate(x, y, z)
    ;(face !== undefined ? this.carved : this.plain).push(g)
    // curved, ridged stem
    const sh = R * (0.32 + this.r() * 0.18)
    const stem = new THREE.CylinderGeometry(R * 0.06, R * 0.11, sh, 6, 4)
    const sp = stem.attributes.position as THREE.BufferAttribute
    const bend = (this.r() - 0.3) * 0.5
    for (let i = 0; i < sp.count; i++) {
      const t = (sp.getY(i) + sh / 2) / sh
      const ang = Math.atan2(sp.getZ(i), sp.getX(i))
      const ridge = 1 + Math.cos(ang * 6) * 0.15
      sp.setXYZ(i, sp.getX(i) * ridge + t * t * bend * sh, sp.getY(i), sp.getZ(i) * ridge)
    }
    stem.computeVertexNormals()
    const sc: number[] = []
    const stemCol = new THREE.Color(this.r() < 0.5 ? '#4a5a26' : '#5a4a26')
    for (let i = 0; i < sp.count; i++) {
      const t = (sp.getY(i) + sh / 2) / sh
      const cc = stemCol.clone().multiplyScalar(0.7 + t * 0.5)
      sc.push(cc.r, cc.g, cc.b)
    }
    stem.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3))
    stem.rotateY(this.r() * Math.PI * 2)
    stem.translate(x, y + R * squash * 2 - R * 0.12 + sh / 2, z)
    this.stems.push(stem)
  }

  /** a natural little cluster: one bigger pumpkin with smaller ones around it */
  cluster(x: number, z: number, y = 0, big = 0.28, carvedChance = 0.3) {
    const n = 2 + Math.floor(this.r() * 3)
    this.add(x, y, z, { r: big, tint: this.r() < 0.2 ? 'deep' : 'orange', face: this.r() < carvedChance ? Math.floor(this.r() * 4) : undefined })
    for (let i = 0; i < n; i++) {
      const a = this.r() * Math.PI * 2
      const d = big * (1.2 + this.r() * 0.6)
      const t = this.r()
      this.add(x + Math.cos(a) * d, y, z + Math.sin(a) * d, { r: big * (0.45 + this.r() * 0.35), tint: t < 0.15 ? 'pale' : t < 0.25 ? 'green' : 'orange' })
    }
  }

  build(parent: THREE.Object3D, D: D, shadows = true) {
    const skin = skinTexture(D)
    const atlas = faceAtlas(D)
    const plainMat = new THREE.MeshStandardMaterial({ map: skin, vertexColors: true, roughness: 0.55, metalness: 0 })
    // carved: same skin look, but the face cuts glow (emissive atlas) and the cut areas read dark-orange
    const carvedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, emissive: new THREE.Color('#ffb24a'), emissiveMap: atlas, emissiveIntensity: 2.6 })
    const stemMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })
    D.push(plainMat, carvedMat, stemMat)
    const make = (geos: THREE.BufferGeometry[], m: THREE.Material) => {
      if (!geos.length) return
      const merged = mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)))!
      geos.forEach((g) => g.dispose())
      merged.computeBoundingSphere()
      const mesh = new THREE.Mesh(merged, m)
      mesh.castShadow = shadows
      mesh.receiveShadow = true
      mesh.matrixAutoUpdate = false
      parent.add(mesh)
      D.push(merged)
    }
    make(this.plain, plainMat)
    make(this.carved, carvedMat)
    make(this.stems, stemMat)
    this.plain = []
    this.carved = []
    this.stems = []
    // the carved glow breathes like candlelight (one shared material → every lantern, no per-object cost)
    return {
      update(t: number) {
        carvedMat.emissiveIntensity = 2.3 + Math.sin(t * 7.3) * 0.18 + Math.sin(t * 13.1 + 1.7) * 0.12 + Math.sin(t * 2.1) * 0.15
      },
    }
  }
}
