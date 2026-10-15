import * as THREE from 'three'

/**
 * LUMPY TREE CROWNS — an irregular cluster of overlapping low-poly lobes (not stacked discs or one ball): each lobe is an
 * icosphere pushed in and out by a few sine harmonics so the silhouette has bays and shoulders; a baked darker underside makes
 * the crown read as volume under any light. Three shapes (broad, tall oval, wide spreading) × a seed give plenty of variety from
 * a handful of shared geometries. `plantCrown` drops one into a StaticBatch; instanced users take the geometry directly.
 */
const cache = new Map<string, THREE.BufferGeometry>()

export type CrownKind = 'broad' | 'oval' | 'spread'

export function crownGeo(kind: CrownKind, seed: number): THREE.BufferGeometry {
  const key = `${kind}:${seed}`
  const hit = cache.get(key)
  if (hit) return hit
  let s = seed * 9301 + 49297
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  const lobes = kind === 'oval' ? 7 : kind === 'spread' ? 8 : 9
  const R = kind === 'oval' ? 1.5 : kind === 'spread' ? 2.6 : 2.1
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < lobes; i++) {
    const a = rnd() * Math.PI * 2
    const d = kind === 'oval' ? rnd() * R * 0.45 : Math.sqrt(rnd()) * R * 0.75
    const r = R * (0.42 + rnd() * 0.36) * (kind === 'oval' ? 0.8 : 1)
    const cy = kind === 'oval' ? 3.2 + (i / lobes) * 4.2 + rnd() * 0.5 : 3.4 + rnd() * R * 0.9
    const g = new THREE.IcosahedronGeometry(1, 1)
    const p = g.attributes.position as THREE.BufferAttribute
    const ph = rnd() * 10
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k)
      const y = p.getY(k)
      const z = p.getZ(k)
      const w = 1 + 0.17 * Math.sin(x * 3.1 + ph) * Math.cos(z * 2.7 - ph) + 0.1 * Math.sin(y * 4.3 + x * 1.7 + ph * 2)
      p.setXYZ(k, Math.cos(a) * d + x * r * w * (kind === 'oval' ? 0.8 : 1), cy + y * r * w * (kind === 'oval' ? 1.25 : 0.62), Math.sin(a) * d + z * r * w * (kind === 'oval' ? 0.8 : 1))
    }
    parts.push(g.toNonIndexed())
    g.dispose()
  }
  // merge + bake a gradient (dark underside → light crown) into vertex colours
  let n = 0
  for (const g of parts) n += g.attributes.position.count
  const pos = new Float32Array(n * 3)
  let o = 0
  for (const g of parts) {
    pos.set(g.attributes.position.array as Float32Array, o)
    o += g.attributes.position.count * 3
    g.dispose()
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.computeVertexNormals()
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < n; i++) {
    minY = Math.min(minY, pos[i * 3 + 1])
    maxY = Math.max(maxY, pos[i * 3 + 1])
  }
  const col = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const t = (pos[i * 3 + 1] - minY) / (maxY - minY || 1)
    const k = 0.5 + 0.55 * t
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  cache.set(key, geo)
  return geo
}

/** a trunk (shared) */
export function trunkGeo() {
  const hit = cache.get('trunk')
  if (hit) return hit
  const g = new THREE.CylinderGeometry(0.16, 0.28, 3.6, 7)
  g.translate(0, 1.8, 0)
  cache.set('trunk', g)
  return g
}

/** plant one tree into a StaticBatch: trunk + a crown of the given kind, scaled, with a little yaw */
export function plantCrown(batch: { put: (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, ry?: number, sx?: number, sy?: number, sz?: number, opts?: { cast?: boolean; receive?: boolean }) => void }, leaf: THREE.Material, bark: THREE.Material, x: number, y: number, z: number, s: number, kind: CrownKind, seed: number) {
  batch.put(trunkGeo(), bark, x, y, z, 0, s, s, s)
  batch.put(crownGeo(kind, seed), leaf, x, y, z, (seed * 1.7) % 6.28, s, s, s)
}

export function disposeCrowns() {
  for (const g of cache.values()) g.dispose()
  cache.clear()
}
