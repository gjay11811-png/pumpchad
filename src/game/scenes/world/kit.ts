import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * StaticBatch: collect every non-moving piece of the town, then merge geometry that
 * shares a material into ONE mesh. A whole district becomes a handful of draw calls,
 * which is what keeps the town smooth on phones.
 */
export class StaticBatch {
  private buckets = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; cast: boolean; receive: boolean }>()

  add(geo: THREE.BufferGeometry, mat: THREE.Material, matrix: THREE.Matrix4, opts: { cast?: boolean; receive?: boolean } = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone()
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k)
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((g.attributes.position.count) * 2), 2))
    if (!g.attributes.normal) g.computeVertexNormals()
    g.applyMatrix4(matrix)
    g.clearGroups()
    let b = this.buckets.get(mat)
    if (!b) this.buckets.set(mat, (b = { geos: [], cast: false, receive: false }))
    b.geos.push(g)
    b.cast ||= opts.cast ?? true
    b.receive ||= opts.receive ?? true
    if (g !== geo) geo.dispose()
    g = null as unknown as THREE.BufferGeometry
  }

  /** Convenience: place geometry at position / rotationY / scale. */
  put(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, ry = 0, sx = 1, sy = 1, sz = 1, opts?: { cast?: boolean; receive?: boolean }) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(UP, ry), new THREE.Vector3(sx, sy, sz))
    this.add(geo, mat, m, opts)
  }

  /** Merge an existing object tree (e.g. the frozen statue) into the batch using world matrices. */
  absorb(root: THREE.Object3D) {
    root.updateMatrixWorld(true)
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh && !Array.isArray(m.material)) this.add(m.geometry, m.material, m.matrixWorld, { cast: m.castShadow })
    })
  }

  build(scene: THREE.Object3D, castShadows: boolean) {
    for (const [mat, b] of this.buckets) {
      const merged = mergeGeometries(b.geos, false)
      b.geos.forEach((g) => g.dispose())
      if (!merged) continue
      merged.computeBoundingSphere()
      const mesh = new THREE.Mesh(merged, mat)
      mesh.castShadow = castShadows && b.cast
      mesh.receiveShadow = b.receive
      mesh.matrixAutoUpdate = false
      scene.add(mesh)
    }
    this.buckets.clear()
  }
}

export const UP = new THREE.Vector3(0, 1, 0)

/** Box whose UVs are scaled to world size, so one tiling texture looks right on any wall size. */
export function boxUV(w: number, h: number, d: number, tile = 2) {
  const g = new THREE.BoxGeometry(w, h, d)
  const uv = g.attributes.uv as THREE.BufferAttribute
  // face order: +x, -x, +y, -y, +z, -z ; 4 verts each
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]
  for (let f = 0; f < 6; f++)
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile, (uv.getY(i) * dims[f][1]) / tile)
    }
  return g
}

/** Gable roof prism: width w (across ridge), depth d (along ridge), rise h. Ridge runs along Z. */
export function gableGeo(w: number, d: number, h: number, tile = 2) {
  const s = new THREE.Shape()
  s.moveTo(-w / 2, 0)
  s.lineTo(w / 2, 0)
  s.lineTo(0, h)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false })
  g.translate(0, 0, -d / 2)
  // world-scale UVs for shingles
  const pos = g.attributes.position as THREE.BufferAttribute
  const uv = g.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    uv.setXY(i, (z + Math.abs(x) * 0.2) / tile, (Math.hypot(Math.abs(x) - w / 2, y)) / tile)
  }
  return g
}

/**
 * A sash window drawn as a texture: a painted frame, glazing bars (muntins) dividing the panes, and glass that is either lamplit from inside (a warm gradient, a curtain
 * on each side, a hint of a room beyond) or dark and sky-reflecting (a cool gradient with a diagonal highlight). Planes with this map plus real frame / sill geometry read
 * as a window with depth, not an opaque glowing rectangle.
 */
export function windowTexture(lit: boolean, seed = 1) {
  const w = 128
  const h = 160
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  const r = rng(seed * 31 + (lit ? 7 : 3))
  // glass
  const grd = g.createLinearGradient(0, 0, 0, h)
  if (lit) {
    grd.addColorStop(0, '#ffcf86')
    grd.addColorStop(0.55, '#ffb457')
    grd.addColorStop(1, '#d9803a')
  } else {
    grd.addColorStop(0, '#5f7894')
    grd.addColorStop(0.5, '#2c3c52')
    grd.addColorStop(1, '#161e2c')
  }
  g.fillStyle = grd
  g.fillRect(0, 0, w, h)
  if (lit) {
    // a curtain at each side and a pale shape of a lamp / a shelf in the room
    for (const sx of [0, 1]) {
      g.fillStyle = `rgba(${150 + r() * 40},${60 + r() * 30},${40 + r() * 20},0.75)`
      g.beginPath()
      g.moveTo(sx ? w : 0, 0)
      g.lineTo(sx ? w - 34 : 34, 0)
      g.quadraticCurveTo(sx ? w - 24 : 24, h * 0.55, sx ? w - 40 : 40, h)
      g.lineTo(sx ? w : 0, h)
      g.fill()
    }
    g.fillStyle = 'rgba(255,240,200,0.55)'
    g.beginPath()
    g.arc(w * (0.35 + r() * 0.3), h * 0.58, 9, 0, Math.PI * 2)
    g.fill()
  } else {
    // a diagonal sky highlight
    g.fillStyle = 'rgba(210,225,245,0.16)'
    g.beginPath()
    g.moveTo(0, h * 0.7)
    g.lineTo(w * 0.7, 0)
    g.lineTo(w, 0)
    g.lineTo(0, h)
    g.fill()
  }
  // glazing bars + frame
  g.fillStyle = '#efe6d4'
  const bar = 7
  g.fillRect(w / 2 - bar / 2, 0, bar, h)
  g.fillRect(0, h * 0.4 - bar / 2, w, bar)
  g.lineWidth = 12
  g.strokeStyle = '#efe6d4'
  g.strokeRect(0, 0, w, h)
  g.lineWidth = 2
  g.strokeStyle = 'rgba(40,30,20,0.45)'
  g.strokeRect(10, 10, w - 20, h - 20)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Shared material palette for the town. Created once per World and disposed with it. */
export function makePalette(tex: Record<string, THREE.Texture>, night = false, surf?: import('./surfaces').Surfaces) {
  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.02, ...p })
  const wLit = windowTexture(true)
  const wDark = windowTexture(false)
  const pbr = (s: import('./surfaces').Surface, p: THREE.MeshStandardMaterialParameters) => std({ map: s.map, normalMap: s.normal, roughnessMap: s.rough, normalScale: new THREE.Vector2(1, 1), ...p })
  return {
    // real PBR plaster / timber / roofing (Poly Haven, CC0) when the surface set is supplied; the old drawn textures otherwise
    plaster: surf ? pbr(surf.plaster, { color: '#f2e6d0', roughness: 1 }) : std({ map: tex.plaster, color: '#d9cbb7', roughness: 0.92 }),
    plasterDark: surf ? pbr(surf.plaster, { color: '#9a8f80', roughness: 1 }) : std({ map: tex.plaster, color: '#8f8577', roughness: 0.95 }),
    timber: surf ? pbr(surf.timber, { color: '#7a5a46', roughness: 1 }) : std({ map: tex.wood, color: '#5a3a26', roughness: 0.8 }),
    woodLight: surf ? pbr(surf.timber, { color: '#e0a878', roughness: 1 }) : std({ map: tex.wood, color: '#9a6b44', roughness: 0.75 }),
    woodRotten: surf ? pbr(surf.timber, { color: '#5a524c', roughness: 1 }) : std({ map: tex.wood, color: '#3a3330', roughness: 0.95 }),
    roofRed: surf ? pbr(surf.clay, { color: '#c8786a', roughness: 1 }) : std({ map: tex.roof, color: '#7a2f22', roughness: 0.8 }),
    roofSlate: surf ? pbr(surf.slate, { color: '#9aa2ae', roughness: 1 }) : std({ map: tex.roof, color: '#4c5668', roughness: 0.7 }),
    roofOrange: surf ? pbr(surf.clay, { color: '#e8a070', roughness: 1 }) : std({ map: tex.roof, color: '#a8521f', roughness: 0.8 }),
    stone: std({ map: tex.stone, color: '#d6c7ad', roughness: 0.9 }),
    stoneLight: std({ map: tex.stone, color: '#efe4d0', roughness: 0.85 }),
    // the historic setts: real stone paving (Poly Haven cobblestone_pavement) when the surface set is supplied, the old drawn cobbles otherwise
    cobble: surf
      ? std({ map: surf.setts.map, normalMap: surf.setts.normal, roughnessMap: surf.setts.rough, normalScale: new THREE.Vector2(1.1, 1.1), color: '#e4ddd4', roughness: 1 })
      : std({ map: tex.cobble, bumpMap: tex.cobbleBump, bumpScale: 2.2, color: '#c9bdb5', roughness: 0.82 }),
    // flat small-sett paving for footpaths, lanes and garden paths; asphalt for carriageways and the workshop yard
    paving: surf ? std({ map: surf.paving.map, normalMap: surf.paving.normal, roughnessMap: surf.paving.rough, color: '#ddd5c9', roughness: 1 }) : std({ map: tex.cobble, color: '#c9bdb5', roughness: 0.85 }),
    asphalt: surf ? std({ map: surf.asphalt.map, normalMap: surf.asphalt.normal, roughnessMap: surf.asphalt.rough, color: '#cfcfcf', roughness: 1 }) : std({ color: '#3a3a3e', roughness: 0.9 }),
    plaza: std({ map: tex.plaza, bumpMap: tex.plazaBump, bumpScale: 3, color: '#e2d6cd', roughness: 0.82, metalness: 0.02 }),
    ground: std({ map: tex.ground, color: '#b8b2a8', roughness: 0.98 }),
    iron: std({ color: '#2b2a30', metalness: 0.8, roughness: 0.42 }),
    gold: std({ color: '#e0a83e', metalness: 1, roughness: 0.3 }),
    foliage: std({ color: '#4f7a3a', roughness: 0.9, flatShading: true }),
    foliageAutumn: std({ color: '#b8561c', roughness: 0.85, flatShading: true }),
    foliageDark: std({ color: '#35553a', roughness: 0.95, flatShading: true }),
    bark: std({ color: '#4a3326', roughness: 0.95 }),
    pumpkin: std({ color: '#d8661a', roughness: 0.6 }),
    rock: std({ color: '#9a9088', roughness: 0.95, flatShading: true }),
    flowers: std({ map: tex.flowers, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 }),
    soil: std({ color: '#5a3f2c', roughness: 1 }),
    cloth: std({ color: '#2a1c24', roughness: 0.95, side: THREE.DoubleSide }),
    // night: warm lamplit glass (bright enough for the bloom to halo it); day: dark glossy glass reflecting the sky
    // (textured: sash windows with glazing bars; lit ones glow warmly at night through their own map)
    windowLit: night ? std({ map: wLit, color: '#000000', roughness: 0.35, emissive: '#ffffff', emissiveMap: wLit, emissiveIntensity: 1.7 }) : std({ map: wDark, roughness: 0.1, metalness: 0.15, emissive: '#0c1422' }),
    windowDark: std({ map: wDark, roughness: 0.15, metalness: 0.15 }),
    shutter: std({ color: '#3d5a4a', roughness: 0.8 }),
    glowOrange: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff8a30').multiplyScalar(1.5), toneMapped: false }),
    glowGold: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc861').multiplyScalar(1.35), toneMapped: false }),
    glowPurple: new THREE.MeshBasicMaterial({ color: new THREE.Color('#9b5cff').multiplyScalar(1.5), toneMapped: false }),
    glowTeal: new THREE.MeshBasicMaterial({ color: new THREE.Color('#5fe0d0').multiplyScalar(1.3), toneMapped: false }),
  }
}
export type Palette = ReturnType<typeof makePalette>

/** Seeded RNG so the town is identical every visit. */
export function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

/** Instanced mesh from a list of transforms. */
export function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, items: { x: number; y: number; z: number; ry?: number; s?: number; sx?: number; sy?: number; sz?: number }[], cast = true) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length))
  const mtx = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  items.forEach((it, i) => {
    q.setFromAxisAngle(UP, it.ry ?? 0)
    const s = it.s ?? 1
    mtx.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.sx ?? s, it.sy ?? s, it.sz ?? s))
    m.setMatrixAt(i, mtx)
  })
  m.count = items.length
  m.castShadow = cast
  m.receiveShadow = true
  m.computeBoundingSphere()
  return m
}
