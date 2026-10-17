import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Collider, Town } from './buildings'
import { isNight } from './daylight'

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
