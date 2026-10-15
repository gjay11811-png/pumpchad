import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Town } from './buildings'

/**
 * THE LANTERN FAMILY (replaces the single street-lamp model once approved):
 *   L01 Gaslight Post  — fluted cast-iron post on a stone plinth, a scrolled bracket and a hung six-sided glass lantern (streets, squares)
 *   L02 Crook Lantern  — a slim shepherd's-crook post with a hung round glass globe in iron rings (gardens, estates, lanes)
 *   L03 Pillar Lantern — a short stone pillar carrying a square glass lantern under a pyramid cap (gates, path edges, the parkour yard)
 *
 * Each kind is built ONCE as three merged parts (iron, stone, glass) and drawn as InstancedMeshes: three draw calls per kind however many
 * stand in the town. At night the glass glows (emissive, blooms) and each lantern registers a LightSpot, so the existing night pool puts real
 * point lights on the few nearest the player and a warm ground pool under all of them (no per-pixel lights everywhere).
 */
export type LanternKind = 'L01' | 'L02' | 'L03'
export const LANTERN_INFO: Record<LanternKind, { name: string; post: number; lamp: number; r: number }> = {
  L01: { name: 'Gaslight Post', post: 3.3, lamp: 2.78, r: 0.25 },
  L02: { name: 'Crook Lantern', post: 2.5, lamp: 2.06, r: 0.18 },
  L03: { name: 'Pillar Lantern', post: 1.15, lamp: 0.98, r: 0.22 },
}

type Parts = { iron: THREE.BufferGeometry[]; stone: THREE.BufferGeometry[]; glass: THREE.BufferGeometry[] }
const at = (g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
  if (rx) g.rotateX(rx)
  if (ry) g.rotateY(ry)
  if (rz) g.rotateZ(rz)
  return g.translate(x, y, z)
}

function gaslight(): Parts {
  const iron: THREE.BufferGeometry[] = []
  const stone: THREE.BufferGeometry[] = []
  const glass: THREE.BufferGeometry[] = []
  // plinth + base ring + fluted shaft with collars
  stone.push(at(new THREE.CylinderGeometry(0.2, 0.26, 0.32, 8), 0, 0.16, 0))
  iron.push(at(new THREE.CylinderGeometry(0.15, 0.19, 0.22, 10), 0, 0.43, 0))
  iron.push(at(new THREE.CylinderGeometry(0.058, 0.09, 2.5, 10), 0, 1.7, 0))
  for (const y of [0.75, 1.5, 2.55]) iron.push(at(new THREE.TorusGeometry(0.085, 0.022, 6, 12).rotateX(Math.PI / 2), 0, y, 0))
  iron.push(at(new THREE.CylinderGeometry(0.1, 0.06, 0.16, 10), 0, 3.0, 0))
  iron.push(at(new THREE.SphereGeometry(0.075, 8, 6), 0, 3.14, 0))
  // the scrolled bracket: a curving arm out to +x with a curl under it, and a hook
  const arm = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 2.92, 0), new THREE.Vector3(0.22, 3.02, 0), new THREE.Vector3(0.45, 3.04, 0), new THREE.Vector3(0.6, 2.98, 0)])
  iron.push(new THREE.TubeGeometry(arm, 12, 0.026, 5, false))
  iron.push(at(new THREE.TorusGeometry(0.13, 0.016, 5, 12, Math.PI * 1.5), 0.15, 2.84, 0, 0, 0, Math.PI * 0.3))
  iron.push(at(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 4), 0.6, 2.92, 0))
  // the lantern: six corner bars, base plate, hex cap with finial, and the glass core + a small flame
  const lx = 0.6
  const ly = 2.62
  iron.push(at(new THREE.CylinderGeometry(0.19, 0.15, 0.05, 6), lx, ly - 0.2, 0))
  iron.push(at(new THREE.CylinderGeometry(0.02, 0.215, 0.18, 6), lx, ly + 0.3, 0))
  iron.push(at(new THREE.ConeGeometry(0.2, 0.15, 6), lx, ly + 0.46, 0))
  iron.push(at(new THREE.SphereGeometry(0.035, 6, 4), lx, ly + 0.56, 0))
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    iron.push(at(new THREE.BoxGeometry(0.03, 0.46, 0.03), lx + Math.cos(a) * 0.17, ly + 0.04, Math.sin(a) * 0.17))
  }
  glass.push(at(new THREE.CylinderGeometry(0.16, 0.13, 0.44, 6), lx, ly + 0.04, 0))
  return { iron, stone, glass }
}

function crook(): Parts {
  const iron: THREE.BufferGeometry[] = []
  const stone: THREE.BufferGeometry[] = []
  const glass: THREE.BufferGeometry[] = []
  stone.push(at(new THREE.CylinderGeometry(0.13, 0.18, 0.2, 8), 0, 0.1, 0))
  iron.push(at(new THREE.CylinderGeometry(0.035, 0.05, 2.1, 8), 0, 1.25, 0))
  iron.push(at(new THREE.TorusGeometry(0.06, 0.016, 5, 10).rotateX(Math.PI / 2), 0, 0.5, 0))
  // the crook: a half-circle over to +x then a short drop to the lantern's hook
  const crookCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 2.28, 0), new THREE.Vector3(0.04, 2.5, 0), new THREE.Vector3(0.2, 2.62, 0), new THREE.Vector3(0.38, 2.56, 0), new THREE.Vector3(0.44, 2.42, 0)])
  iron.push(new THREE.TubeGeometry(crookCurve, 14, 0.024, 5, false))
  iron.push(at(new THREE.SphereGeometry(0.05, 6, 5), 0, 2.32, 0))
  const lx = 0.44
  iron.push(at(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 4), lx, 2.36, 0))
  iron.push(at(new THREE.CylinderGeometry(0.05, 0.1, 0.07, 10), lx, 2.28, 0)) // cap
  iron.push(at(new THREE.TorusGeometry(0.152, 0.012, 4, 14).rotateX(Math.PI / 2), lx, 2.16, 0))
  iron.push(at(new THREE.TorusGeometry(0.152, 0.012, 4, 14).rotateX(Math.PI / 2), lx, 1.92, 0))
  iron.push(at(new THREE.CylinderGeometry(0.06, 0.04, 0.07, 8), lx, 1.82, 0))
  glass.push(at(new THREE.SphereGeometry(0.15, 12, 9), lx, 2.04, 0))
  return { iron, stone, glass }
}

function pillar(): Parts {
  const iron: THREE.BufferGeometry[] = []
  const stone: THREE.BufferGeometry[] = []
  const glass: THREE.BufferGeometry[] = []
  stone.push(at(new THREE.BoxGeometry(0.42, 0.18, 0.42), 0, 0.09, 0))
  stone.push(at(new THREE.BoxGeometry(0.3, 0.6, 0.3), 0, 0.48, 0))
  stone.push(at(new THREE.BoxGeometry(0.4, 0.07, 0.4), 0, 0.8, 0))
  // lantern: four corner posts, glass box, a pyramid cap and finial
  const y = 0.98
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) iron.push(at(new THREE.BoxGeometry(0.03, 0.3, 0.03), sx * 0.12, y, sz * 0.12))
  iron.push(at(new THREE.BoxGeometry(0.3, 0.03, 0.3), 0, y - 0.15, 0))
  iron.push(at(new THREE.ConeGeometry(0.24, 0.16, 4).rotateY(Math.PI / 4), 0, y + 0.23, 0))
  iron.push(at(new THREE.SphereGeometry(0.03, 6, 4), 0, y + 0.33, 0))
  glass.push(at(new THREE.BoxGeometry(0.21, 0.3, 0.21), 0, y, 0))
  return { iron, stone, glass }
}

const BUILD: Record<LanternKind, () => Parts> = { L01: gaslight, L02: crook, L03: pillar }

export type LanternSpot = { x: number; z: number; ry?: number }

/** stand `spots` of one lantern kind in the town (instanced), with colliders and night light spots */
export function lanternFamily(T: Town, kind: LanternKind, spots: LanternSpot[]) {
  if (!spots.length) return
  const P = T.P
  const parts = BUILD[kind]()
  const info = LANTERN_INFO[kind]
  // day: the glass is a pale unlit pane; night: it burns (emissive, so the bloom pass haloes it)
  const night = ((P.windowLit as THREE.MeshStandardMaterial).emissiveIntensity ?? 0) > 1
  const glassMat = new THREE.MeshStandardMaterial({ color: night ? '#ffd9a0' : '#cfd8dc', emissive: '#ff9a3a', emissiveIntensity: night ? 2.6 : 0.05, roughness: night ? 0.4 : 0.15, metalness: night ? 0 : 0.35 })
  T.disposables.push(glassMat)
  const mats: [THREE.BufferGeometry[], THREE.Material][] = [
    [parts.iron, P.iron],
    [parts.stone, P.stone],
    [parts.glass, glassMat],
  ]
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  for (const [geos, mat] of mats) {
    if (!geos.length) continue
    const merged = mergeGeometries(geos.map((g) => (g.index ? g : g)))
    for (const g of geos) g.dispose()
    if (!merged) continue
    T.disposables.push(merged)
    const im = new THREE.InstancedMesh(merged, mat, spots.length)
    spots.forEach((s, i) => {
      q.setFromAxisAngle(up, s.ry ?? 0)
      m4.compose(new THREE.Vector3(s.x, 0, s.z), q, new THREE.Vector3(1, 1, 1))
      im.setMatrixAt(i, m4)
    })
    im.castShadow = mat !== glassMat
    im.receiveShadow = true
    im.frustumCulled = false
    T.scene.add(im)
  }
  for (const s of spots) {
    T.colliders.push({ kind: 'circle', x: s.x, z: s.z, r: info.r, h: info.post })
    // the lantern's world position (it hangs to +x of the post, turned by ry)
    const off = kind === 'L01' ? 0.6 : kind === 'L02' ? 0.44 : 0
    const ry = s.ry ?? 0
    T.lights.push({ x: s.x + Math.cos(ry) * off, y: info.lamp, z: s.z - Math.sin(ry) * off, color: '#ffb060', intensity: kind === 'L03' ? 2.2 : 3.2, dist: kind === 'L03' ? 6 : 8.5, priority: 4 })
  }
}
