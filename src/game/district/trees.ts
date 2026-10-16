import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { TreeSpot } from './kit'
import type { Quality } from '../save'
import { FoliageBuilder, leafTexture } from '../scenes/world/foliage'

/**
 * Photoscanned trees (Poly Haven, CC0; see ASSETS.md): `jacaranda` (~40 K triangles, 512 px WebP set) for the street avenue and `island` (~19 K) for a
 * second silhouette. One GLB each, every tree an instance (one InstancedMesh per material part). Leaf cards are alpha-tested, not blended, so instances
 * never sort wrongly. Each instance gets a small hue / lightness variation and its own scale and heading, so no two trees match.
 * The scene's own geometry is already drawn when these arrive; a slow load never leaves a gap in the layout.
 */
const FILES = { jacaranda: 'jacaranda_opt.glb', island: 'island_tree_opt.glb' } as const
const cache = new Map<string, Promise<THREE.Group | null>>()
const load = (kind: keyof typeof FILES) => {
  let p = cache.get(kind)
  if (!p) {
    p = new GLTFLoader()
      .loadAsync(`${import.meta.env.BASE_URL}chadverse/models/veg/${FILES[kind]}`)
      .then((g) => g.scene)
      .catch(() => null)
    cache.set(kind, p)
  }
  return p
}

export function plantTrees(scene: THREE.Object3D, spots: TreeSpot[], D: (THREE.Material | THREE.Texture | THREE.BufferGeometry)[], q: Quality, baseY = 0.16) {
  const keep = q === 'low' ? 0.5 : 1
  for (const kind of ['jacaranda', 'island'] as const) {
    const mine = spots.filter((s, i) => s.kind === kind && (keep >= 1 || i % 2 === 0))
    if (!mine.length) continue
    void load(kind).then((src) => {
      if (!src) return
      src.updateWorldMatrix(true, true)
      const m4 = new THREE.Matrix4()
      const qn = new THREE.Quaternion()
      const e = new THREE.Euler()
      const col = new THREE.Color()
      src.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (!mesh.isMesh) return
        const mat = (mesh.material as THREE.MeshStandardMaterial).clone()
        mat.flatShading = false
        mat.roughness = Math.max(mat.roughness, 0.7)
        if (mat.transparent || (mat.name && /leaf|leaves|blossom|flower/i.test(mat.name))) {
          mat.transparent = false
          mat.alphaTest = 0.45
          mat.side = THREE.DoubleSide
        }
        D.push(mat)
        const inst = new THREE.InstancedMesh(mesh.geometry, mat, mine.length)
        mine.forEach((s, i) => {
          m4.compose(new THREE.Vector3(s.x, baseY, s.z), qn.setFromEuler(e.set(0, s.yaw, 0)), new THREE.Vector3(s.s, s.s, s.s)).multiply(mesh.matrixWorld)
          inst.setMatrixAt(i, m4)
          inst.setColorAt(i, col.setHSL(0.0 + ((i * 0.37) % 1) * 0.03, 0, 0.88 + ((i * 0.61) % 1) * 0.16))
        })
        inst.castShadow = q !== 'low'
        inst.frustumCulled = false
        scene.add(inst)
      })
    })
  }
}

/**
 * Street trees from the village's own tree generator (real branching trunks with leaf-card canopies, grouped into cells that drop to a cheap far
 * version by distance), tinted to natural daylight greens. `s` from the spots is a GLB scale; × 3.2 gives the generator's scale.
 */
export function plantProcedural(scene: THREE.Object3D, spots: TreeSpot[], D: (THREE.Material | THREE.Texture | THREE.BufferGeometry)[], q: Quality, baseY = 0.16, bushes: { x: number; y: number; z: number; s: number }[] = []) {
  if (!spots.length && !bushes.length) return
  const FB = new FoliageBuilder(4242, q === 'high' ? 1 : q === 'medium' ? 0.8 : 0.5)
  const greens = ['#4f8a3a', '#5c9a40', '#447d30', '#6aa646', '#3f7a38'].map((c) => new THREE.Color(c))
  const bark = new THREE.Color('#4a3c30')
  const bark2 = new THREE.Color('#cfcbc0')
  spots.forEach((sp, i) => {
    const s = 0.9 + ((i * 0.37) % 1) * 0.5
    if (sp.kind === 'island') FB.plant('birch', sp.x, sp.z, s * 1.05, greens, bark2, baseY)
    else FB.plant('oak', sp.x, sp.z, s * 0.9, greens, bark, baseY)
  })
  const shrub = ['#35662f', '#3f7536', '#2f5a2c', '#4a7f3a'].map((c) => new THREE.Color(c))
  bushes.forEach((b, i) => FB.bush(b.x, b.y, b.z, b.s, shrub[i % shrub.length]))
  FB.build(scene as THREE.Scene, leafTexture(D), D, false)
}
