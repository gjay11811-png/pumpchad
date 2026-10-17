import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Collider, Town } from './buildings'
import { isNight } from './daylight'
import { boxUV } from './kit'

/**
 * HOUSE MODELS — the downloaded GLB houses (see ASSETS.md / CREDITS.md), optimised by `scripts/asset-house-optimise.mjs` and placed into the town as static
 * scenery with a simple box collider. Each file is loaded once; every placement is a clone that SHARES the geometry / materials / textures, so repeating a
 * house costs draw calls, not GPU memory. Placement is asynchronous (the town builds synchronously): the building appears as soon as its file arrives.
 *
 *   victorian_house.glb  massive-graphisme · CC BY 4.0 — the Haunted Quarter's green Victorian (turret, wraparound porch, bay window)
 *   stone_house.glb      Lofvu · CC BY 4.0           — the timber-framed stone house, kept maintained and lived-in
 */
export type HouseFile = 'victorian_house' | 'stone_house'
type Loaded = { scene: THREE.Group; size: THREE.Vector3; min: THREE.Vector3 }
const loader = new GLTFLoader()
const cache = new Map<string, Promise<Loaded>>()
export function loadHouse(file: HouseFile): Promise<Loaded> {
  let p = cache.get(file)
  if (!p) {
    p = loader.loadAsync(`${import.meta.env.BASE_URL}chadverse/models/houses/${file}.glb`).then((g) => {
      g.scene.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(g.scene)
      return { scene: g.scene, size: box.getSize(new THREE.Vector3()), min: box.min.clone() }
    })
    p.catch(() => cache.delete(file))
    cache.set(file, p)
  }
  return p
}

export type HousePlace = {
  x: number
  z: number
  /** the direction the front looks along (sin yaw, cos yaw); the models' fronts face +z, so this is also the model's rotation about y */
  yaw: number
  /** metres per model unit */
  scale: number
  /** sink the base this far into the ground (foundations / uneven ground) */
  sink?: number
  /** a collider box about the footprint (model-space half extents × scale, shrunk by `inset`); false = none */
  collide?: false | { inset?: number; h: number }
  /** optional tint applied to a clone of the named materials (e.g. {outerwalls: '#7a8a6a'}) */
  tint?: Record<string, string>
  /** window glow (emissive) for glass materials, when it is dark outside */
  glassGlow?: string
  /** replace materials by name (kept in T.disposables by the caller) */
  materials?: Record<string, THREE.Material>
  /** shift the model in its own space before placing (so a door can sit on a chosen spot) */
  offset?: [number, number]
  /** re-project the UVs of the named materials from world-space (planar, by dominant normal axis) at this many metres per repeat — for materials swapped in from the town's palette */
  reproject?: Record<string, number>
}

/** put a loaded house into the world; returns the placed group (or null if the file could not be loaded) */
export async function placeHouse(T: Town, file: HouseFile, o: HousePlace): Promise<THREE.Group | null> {
  if (/[?&]nohouse/.test(window.location.search)) return null // QA switch for isolating memory problems
  let L: Loaded
  try {
    L = await loadHouse(file)
  } catch (e) {
    console.warn(`[house] ${file} unavailable`, e)
    return null
  }
  const g = L.scene.clone(true)
  const night = isNight()
  // per-placement materials only where something is customised; everything else is shared with the other placements
  const own = new Map<THREE.Material, THREE.Material>()
  g.traverse((m) => {
    const mesh = m as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true
    const base = mesh.material as THREE.MeshStandardMaterial
    const key = base.name
    if (o.materials?.[key]) {
      mesh.material = o.materials[key]
      const tile = o.reproject?.[key]
      if (tile) {
        // planar UVs from the model-space position (metres after scaling), picking the two axes across the face by its dominant normal
        g.updateMatrixWorld(true)
        const g2 = mesh.geometry.clone()
        const pos = g2.attributes.position as THREE.BufferAttribute
        const nor = g2.attributes.normal as THREE.BufferAttribute
        const uv = (g2.attributes.uv as THREE.BufferAttribute) ?? new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2)
        const pv = new THREE.Vector3()
        const nv = new THREE.Vector3()
        for (let i = 0; i < pos.count; i++) {
          pv.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld) // (the parts are quantised: their real scale lives on the node)
          nv.fromBufferAttribute(nor, i).transformDirection(mesh.matrixWorld)
          const ax = Math.abs(nv.x)
          const ay = Math.abs(nv.y)
          const az = Math.abs(nv.z)
          const x = pv.x * o.scale
          const y = pv.y * o.scale
          const z = pv.z * o.scale
          if (ay >= ax && ay >= az) uv.setXY(i, x / tile, z / tile)
          else if (ax >= az) uv.setXY(i, z / tile, y / tile)
          else uv.setXY(i, x / tile, y / tile)
        }
        g2.setAttribute('uv', uv)
        mesh.geometry = g2
        T.disposables.push(g2)
      }
      return
    }
    const tint = o.tint?.[key]
    const glow = o.glassGlow && /glass/i.test(key) && night
    if (!tint && !glow) return
    let c = own.get(base)
    if (!c) {
      c = base.clone()
      const mm = c as THREE.MeshStandardMaterial
      if (tint) mm.color.multiply(new THREE.Color(tint))
      if (glow) {
        mm.emissive = new THREE.Color(o.glassGlow!)
        mm.emissiveIntensity = 1.1
      }
      own.set(base, c)
      T.disposables.push(c)
    }
    mesh.material = c
  })
  // the original loaded scene's own geometry / textures are freed with the town
  if (!(L.scene.userData.registered as boolean)) {
    L.scene.userData.registered = true
    L.scene.traverse((m) => {
      const mesh = m as THREE.Mesh
      if (!mesh.isMesh) return
      T.disposables.push(mesh.geometry)
      for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) T.disposables.push(mat)
    })
  }
  const S = o.scale
  const wrap = new THREE.Group()
  wrap.add(g)
  g.scale.setScalar(S)
  // base on the ground: the model's lowest point sits `sink` below y = 0
  g.position.set(-(L.min.x + L.size.x / 2) * S + (o.offset?.[0] ?? 0), -L.min.y * S - (o.sink ?? 0), -(L.min.z + L.size.z / 2) * S + (o.offset?.[1] ?? 0))
  wrap.position.set(o.x, 0, o.z)
  wrap.rotation.y = o.yaw
  T.scene.add(wrap)
  if (o.collide !== false && o.collide) {
    const inset = o.collide.inset ?? 0
    const hx = (L.size.x * S) / 2 - inset
    const hz = (L.size.z * S) / 2 - inset
    const c = Math.cos(o.yaw)
    const s = Math.sin(o.yaw)
    const ex = Math.abs(c) * hx + Math.abs(s) * hz
    const ez = Math.abs(s) * hx + Math.abs(c) * hz
    const col: Collider = { kind: 'box', minX: o.x - ex, maxX: o.x + ex, minZ: o.z - ez, maxZ: o.z + ez, h: o.collide.h }
    T.colliders.push(col)
  }
  return wrap
}

/** the footprint (metres) a placement of this size would occupy, for planning */
export const footprint = async (file: HouseFile, scale: number) => {
  const L = await loadHouse(file)
  return { w: L.size.x * scale, d: L.size.z * scale, h: L.size.y * scale }
}

/**
 * GREENSIDE ROW — three of the downloaded stone houses along the north side of the Heights Green boulevard, kept like homes people live in: the weathered wall render is swapped
 * for the village's clean limewash plaster, the grey shingles for terracotta tiles (or slate), the timber frame and louvred shutters are warmed with a stain, and each house gets
 * a lantern + a warm light at the door, a path to the boulevard, a clipped hedge and pumpkins on the step. (The model has closed shutters and open rafter tails: those stay — see ASSETS.md.)
 */
export const GREENSIDE = [
  { x: -111, z: 38, tint: '#e4c9a0', roof: 'roofRed' as const },
  { x: -98.5, z: 38, tint: '#d9b88c', roof: 'roofSlate' as const },
  { x: -86, z: 38, tint: '#eed3a8', roof: 'roofRed' as const },
]
export function greensideRow(T: Town) {
  const P = T.P
  for (const h of GREENSIDE) {
    void placeHouse(T, 'stone_house', {
      x: h.x,
      z: h.z,
      yaw: 0,
      scale: 1,
      sink: 0.2,
      collide: { h: 10.4, inset: 0.45 },
      materials: { main_wall: P.plaster, roof: P[h.roof] },
      reproject: { main_wall: 2.4, roof: 2.0 },
      tint: { floor: h.tint, Material: '#f0e6d6' },
    })
    const doorZ = h.z + 1.7
    // a lantern beside the door and a warm light on the step
    T.batch.put(new THREE.BoxGeometry(0.16, 0.26, 0.16), P.glowGold, h.x + 0.95, 2.1, doorZ + 0.35, 0, 1, 1, 1, { cast: false })
    T.lights.push({ x: h.x + 0.9, y: 2.0, z: doorZ + 1.0, color: '#ffb868', intensity: 2.6, dist: 7, priority: 3 })
    // the path to the boulevard (setts), a clipped hedge either side, a pumpkin on the step
    const pathLen = 43.2 - (doorZ + 0.7)
    T.batch.put(new THREE.PlaneGeometry(1.6, pathLen).rotateX(-Math.PI / 2), P.cobble, h.x, 0.025, doorZ + 0.7 + pathLen / 2, 0, 1, 1, 1, { cast: false })
    for (const sx of [-1, 1]) T.batch.put(boxUV(0.6, 0.7, pathLen - 0.6, 1.2), P.foliageDark, h.x + sx * 1.35, 0.35, doorZ + 0.9 + (pathLen - 0.6) / 2)
    if (T.pumpkins) T.pumpkins.add(h.x - 0.8, 0.22, doorZ + 0.9, { r: 0.2, face: 1, facing: 0 })
  }
}
