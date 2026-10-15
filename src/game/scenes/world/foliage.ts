import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { barkTexture, growTree, needleTexture, type TreeGeo, type TreeKind } from './treegen'

/**
 * Procedural foliage for Chad Kingdom: bushes, hedges and autumn trees that read as plants, not cubes.
 *
 * Each plant = a smooth, noise-lumped core (vertex-coloured: dark inside, lighter crown) wrapped in
 * alpha-tested leaf cards that break up the silhouette. Everything is merged into two meshes per builder
 * (cores + cards), so a whole garden costs two draw calls. No downloads; cheap enough for phones.
 */

type D = (THREE.Material | THREE.BufferGeometry | THREE.Texture)[]
const rngF = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646

const canvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, D: D) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  D.push(t)
  return t
}

/** a spray of small leaves on transparent background (light grey: tinted per vertex) */
export function leafTexture(D: D) {
  return canvasTex(
    128,
    128,
    (g) => {
      const r = rngF(5)
      for (let i = 0; i < 46; i++) {
        const x = 14 + r() * 100
        const y = 14 + r() * 100
        const a = r() * Math.PI * 2
        const l = 9 + r() * 9
        const v = 170 + r() * 85
        g.fillStyle = `rgb(${v},${v},${v})`
        g.save()
        g.translate(x, y)
        g.rotate(a)
        g.beginPath()
        g.ellipse(0, 0, l, l * 0.45, 0, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = `rgba(0,0,0,0.25)`
        g.fillRect(-l, -0.6, l * 2, 1.2) // midrib
        g.restore()
      }
    },
    D,
  )
}

/** little blooms with stems (already coloured: orange, gold, purple, white — Halloween garden) */
export function flowerTexture(D: D) {
  return canvasTex(
    128,
    128,
    (g) => {
      const r = rngF(9)
      const cols = ['#ff8a2a', '#ffcf4a', '#9b5cff', '#f2ece0', '#ff5a4a']
      for (let i = 0; i < 9; i++) {
        const x = 12 + r() * 104
        const top = 20 + r() * 40
        g.strokeStyle = '#3f5a2a'
        g.lineWidth = 3
        g.beginPath()
        g.moveTo(x, 128)
        g.quadraticCurveTo(x + (r() - 0.5) * 16, 80, x + (r() - 0.5) * 10, top)
        g.stroke()
        g.fillStyle = '#4c6b32'
        g.beginPath()
        g.ellipse(x + 6, 100 - r() * 20, 7, 3, 0.6, 0, Math.PI * 2)
        g.fill()
        const c = cols[Math.floor(r() * cols.length)]
        g.fillStyle = c
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2
          g.beginPath()
          g.ellipse(x + Math.cos(a) * 6, top + Math.sin(a) * 6, 6, 4, a, 0, Math.PI * 2)
          g.fill()
        }
        g.fillStyle = '#3a2410'
        g.beginPath()
        g.arc(x, top, 3, 0, Math.PI * 2)
        g.fill()
      }
    },
    D,
  )
}

/** smooth position-based value noise (same displacement for shared vertex positions → no cracks) */
const lump = (x: number, y: number, z: number, s: number) => Math.sin(x * 3.1 + s) * Math.sin(y * 2.7 + s * 1.3) * Math.sin(z * 3.3 + s * 0.7)

type GeoSet = { bark: THREE.BufferGeometry[]; leaves: THREE.BufferGeometry[]; needles: THREE.BufferGeometry[] }
const CELL = 44
/** distance (m) where a cell drops to its far version, and where it disappears into the fog */
const LOD_NEAR = 75
const LOD_FAR = 260

export class FoliageBuilder {
  private cores: THREE.BufferGeometry[] = []
  private cards: THREE.BufferGeometry[] = []
  private bark: THREE.BufferGeometry[] = []
  private r: () => number
  /** real trees and shrubs, bucketed into ~44 m cells so each cell can switch between a full and a far version by distance (THREE.LOD) */
  private cells = new Map<string, { cx: number; cz: number; near: GeoSet; far: GeoSet }>()
  /** leaf-card density by quality (1 = high, fewer cards on medium / low phones) */
  constructor(seed = 1, private density = 1) {
    this.r = rngF(seed)
  }

  /** lumpy smooth blob, coloured from `dark` (bottom / inside) to `light` (crown) */
  blob(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, dark: THREE.Color, light: THREE.Color, detail = 1) {
    const g = new THREE.IcosahedronGeometry(1, detail)
    const pos = g.attributes.position as THREE.BufferAttribute
    const nor = g.attributes.normal as THREE.BufferAttribute
    const col: number[] = []
    const s = this.r() * 10
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = pos.getZ(i)
      const k = 1 + lump(x, y, z, s) * 0.22
      pos.setXYZ(i, cx + x * rx * k, cy + y * ry * k, cz + z * rz * k)
      const n = new THREE.Vector3(x / rx, y / ry, z / rz).normalize()
      nor.setXYZ(i, n.x, n.y, n.z)
      c.copy(dark).lerp(light, THREE.MathUtils.clamp(0.5 + y * 0.5 + lump(x, y, z, s + 3) * 0.3, 0, 1))
      col.push(c.r, c.g, c.b)
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    this.cores.push(g)
  }

  /** leaf cards scattered over an ellipsoid surface, facing outwards, tinted */
  leaves(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, n: number, size: number, tint: THREE.Color, spread = 0.18, minY = -0.35) {
    const up = new THREE.Vector3(0, 1, 0)
    n = Math.max(3, Math.round(n * this.density))
    if (this.density < 1) size *= 1 + (1 - this.density) * 0.35 // fewer, slightly bigger cards keep the silhouette
    for (let i = 0; i < n; i++) {
      // random direction, biased to the upper half
      const u = this.r() * Math.PI * 2
      const v = Math.acos(THREE.MathUtils.lerp(1, minY, this.r()))
      const dir = new THREE.Vector3(Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u))
      const p = new THREE.Vector3(cx + dir.x * rx, cy + dir.y * ry, cz + dir.z * rz)
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir)
      q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.r() * Math.PI * 2))
      const sz = size * (0.75 + this.r() * 0.5)
      const g = new THREE.PlaneGeometry(sz, sz).toNonIndexed()
      g.applyQuaternion(q)
      g.translate(p.x + dir.x * sz * spread, p.y + dir.y * sz * spread, p.z + dir.z * sz * spread)
      // normals point outward from the plant centre: soft, consistent lighting on both faces
      const nor = g.attributes.normal as THREE.BufferAttribute
      for (let k = 0; k < nor.count; k++) nor.setXYZ(k, dir.x * 0.6 + up.x * 0.4, dir.y * 0.6 + up.y * 0.4, dir.z * 0.6 + up.z * 0.4)
      const t = tint.clone().offsetHSL((this.r() - 0.5) * 0.04, 0, (this.r() - 0.5) * 0.12)
      const col: number[] = []
      for (let k = 0; k < g.attributes.position.count; k++) col.push(t.r, t.g, t.b)
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
      this.cards.push(g)
    }
  }

  /**
   * Grow a real tree or shrub (see treegen.ts) and file it in its cell: a full version for nearby, a far version (trunk, main limbs, a few big
   * cards) for distance. `y` lifts it onto a planter. Detail follows the quality tier through `density`.
   */
  plant(kind: TreeKind, x: number, z: number, s: number, leaf: THREE.Color[], bark: THREE.Color, y = 0) {
    const key = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`
    let cell = this.cells.get(key)
    if (!cell) {
      cell = { cx: (Math.floor(x / CELL) + 0.5) * CELL, cz: (Math.floor(z / CELL) + 0.5) * CELL, near: { bark: [], leaves: [], needles: [] }, far: { bark: [], leaves: [], needles: [] } }
      this.cells.set(key, cell)
    }
    const seed = Math.floor(this.r() * 1e6)
    const yaw = this.r() * Math.PI * 2
    for (const far of [false, true]) {
      const g: TreeGeo = growTree(kind, seed, { detail: this.density, far, leaf, bark })
      const set = far ? cell.far : cell.near
      for (const [part, list] of [[g.bark, set.bark], [g.leaves, set.leaves], [g.needles, set.needles]] as const) {
        if (!part) continue
        part.rotateY(yaw)
        part.scale(s, s, s)
        part.translate(x - cell.cx, y, z - cell.cz)
        list.push(part)
      }
    }
  }

  /** garden shrub: a fan of thin stems, each carrying clumps of leaf cards — a varied outline, not a ball */
  bush(x: number, y: number, z: number, s: number, green: THREE.Color) {
    const palette = [green.clone().multiplyScalar(0.92), green.clone().multiplyScalar(1.12), green.clone().offsetHSL(0.02, 0, 0.04)]
    this.plant('shrub', x, z, s * 1.15, palette, new THREE.Color('#3a2c22'), y)
  }

  /** clipped hedge: overlapping lumps along a line + a leafy skin; axis 'x' or 'z' */
  hedge(x: number, z: number, len: number, width: number, height: number, axis: 'x' | 'z', green: THREE.Color) {
    const dark = green.clone().multiplyScalar(0.4)
    const light = green.clone().multiplyScalar(1.1)
    const n = Math.max(2, Math.round(len / 0.55))
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n - 0.5
      const end = Math.abs(t) > 0.5 - 0.5 / n ? 0.85 : 1 // rounded ends
      const px = axis === 'x' ? x + t * len : x
      const pz = axis === 'z' ? z + t * len : z
      const rw = (width / 2) * (0.95 + this.r() * 0.12) * end
      const rh = (height / 2) * (0.95 + this.r() * 0.1) * end
      const rl = (len / n) * 0.75
      this.blob(px, height / 2, pz, axis === 'x' ? rl : rw, rh, axis === 'z' ? rl : rw, dark, light)
      this.leaves(px, height / 2, pz, axis === 'x' ? rl : rw, rh, axis === 'z' ? rl : rw, 11, 0.44, light, 0.18, -0.25)
    }
  }

  /** a broadleaf tree (oak, now and then a birch): branching limbs, layered leaf clumps */
  tree(x: number, z: number, s: number, palette: THREE.Color[], barkColor: THREE.Color) {
    if (this.r() < 0.22) this.plant('birch', x, z, s, palette, new THREE.Color('#cfcbc0'))
    else this.plant('oak', x, z, s, palette, barkColor)
  }

  /** conifer: whorls of drooping branches with needle sprays, darkest at the base */
  conifer(x: number, z: number, s: number, green: THREE.Color, barkColor: THREE.Color) {
    this.plant('pine', x, z, s, [green.clone().multiplyScalar(0.9), green.clone().multiplyScalar(1.1)], barkColor)
  }

  /** poplar: a tall narrow column of upward limbs */
  poplar(x: number, z: number, s: number, palette: THREE.Color[], barkColor: THREE.Color) {
    this.plant('poplar', x, z, s, palette, barkColor)
  }

  /** merge into meshes: cores (smooth, vertex colours), leaf cards (alpha-tested), bark */
  build(parent: THREE.Object3D, leafMap: THREE.Texture, D: D, shadows = true) {
    const out: THREE.Mesh[] = []
    const make = (geos: THREE.BufferGeometry[], mat: THREE.Material, cast: boolean) => {
      if (!geos.length) return
      const prepared = geos.map((g) => {
        const n = g.index ? g.toNonIndexed() : g
        for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) n.deleteAttribute(k)
        return n
      })
      const merged = mergeGeometries(prepared)!
      geos.forEach((g) => g.dispose())
      merged.computeBoundingSphere()
      const m = new THREE.Mesh(merged, mat)
      m.castShadow = shadows && cast
      m.receiveShadow = true
      m.matrixAutoUpdate = false
      parent.add(m)
      D.push(merged, mat)
      out.push(m)
    }
    make(this.cores, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }), true)
    make(this.bark, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), true)
    make(this.cards, new THREE.MeshStandardMaterial({ map: leafMap, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 }), true)
    this.cores = []
    this.cards = []
    this.bark = []
    // the real trees + shrubs: one THREE.LOD per cell (full ≤ 75 m, far ≤ 260 m, then gone); the renderer updates it each frame
    const barkMat = new THREE.MeshStandardMaterial({ map: barkTexture(D), vertexColors: true, roughness: 0.95 })
    const leafMat = new THREE.MeshStandardMaterial({ map: leafMap, vertexColors: true, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.85 })
    const needleMat = new THREE.MeshStandardMaterial({ map: needleTexture(D), vertexColors: true, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.85 })
    D.push(barkMat, leafMat, needleMat)
    const group = (set: GeoSet, cast: boolean) => {
      const gr = new THREE.Group()
      for (const [list, mat, casts] of [[set.bark, barkMat, cast], [set.leaves, leafMat, cast], [set.needles, needleMat, cast]] as const) {
        if (!list.length) continue
        const merged = mergeGeometries(list)!
        list.forEach((g) => g.dispose())
        merged.computeBoundingSphere()
        const m = new THREE.Mesh(merged, mat)
        m.castShadow = casts
        m.receiveShadow = true
        m.matrixAutoUpdate = false
        gr.add(m)
        D.push(merged)
      }
      return gr
    }
    for (const cell of this.cells.values()) {
      const lod = new THREE.LOD()
      lod.position.set(cell.cx, 0, cell.cz)
      lod.addLevel(group(cell.near, shadows), 0)
      lod.addLevel(group(cell.far, false), LOD_NEAR)
      lod.addLevel(new THREE.Group(), LOD_FAR)
      lod.updateMatrix()
      lod.matrixAutoUpdate = false
      parent.add(lod)
    }
    this.cells.clear()
    return out
  }
}

/** a few lumpy rocks (flat-shaded on purpose: rocks are faceted) */
export function rockGeo(seed: number) {
  const g = new THREE.DodecahedronGeometry(1, 0)
  const pos = g.attributes.position as THREE.BufferAttribute
  const r = rngF(seed)
  const k = [0.75 + r() * 0.5, 0.45 + r() * 0.3, 0.75 + r() * 0.5]
  for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) * k[0], Math.max(-0.2, pos.getY(i)) * k[1], pos.getZ(i) * k[2])
  g.computeVertexNormals()
  return g
}
