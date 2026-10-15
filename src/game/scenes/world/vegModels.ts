import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Quality } from '../../save'

/**
 * REAL-SCAN VEGETATION (the representative scene): two optimised Poly Haven models (CC0 — see ASSETS.md / CREDITS.md):
 *   • Jacaranda Tree (Rico Cilliers) — scan geometry simplified from 3.9 M triangles to ~40 K, leaf clusters thinned and enlarged,
 *     alpha-tested, 512 px WebP textures (2 MB);
 *   • Shrub 02 (Rico Cilliers) — thinned to ~11 K triangles, 512 px WebP (0.4 MB).
 * The pipeline is `scripts/optimise-veg.mjs`; the GLBs live in `public/chadverse/models/veg/`. Only a handful of hero plants use them
 * (instanced: one draw call per material per model); everything else stays on the procedural trees until this standard is approved.
 */
/** EVALUATED, NOT USED BY DEFAULT: at ~40 K triangles the scan tree has realistic limbs but a sparse canopy, and a full canopy costs 120 K+ (too heavy to repeat). Re-enable by filling these arrays and copying the GLBs from pumpchad-assets/polyhaven-optimised/ to public/chadverse/models/veg/. */
export const HERO_TREES: [number, number, number][] = [] // x, z, scale (the model is ~19 m tall at scale 1)
export const HERO_SHRUBS: [number, number, number, number][] = [] // x, y (the planter's soil line), z, scale (the model is 5.3 m wide at scale 1)

const near = (a: number, b: number, c: number, d: number) => Math.hypot(a - c, b - d) < 0.7
export const isHeroTree = (x: number, z: number) => HERO_TREES.some((t) => near(x, z, t[0], t[1]))
/** the ordinary bush entries the hero shrubs replace (the two clumps on the west forecourt planter) */
export const isHeroBush = (x: number, z: number) => HERO_SHRUBS.some((s) => Math.hypot(x - s[0], z - s[2]) < 1.7)

const loader = new GLTFLoader()

function instance(root: THREE.Object3D, spots: { x: number; y: number; z: number; s: number; ry: number }[], scene: THREE.Scene, D: (THREE.Material | THREE.BufferGeometry | THREE.Texture)[], shadows: boolean) {
  root.updateMatrixWorld(true)
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const mat = (m.material as THREE.MeshStandardMaterial).clone()
    mat.side = THREE.DoubleSide
    if (mat.alphaTest > 0 || mat.transparent) {
      mat.alphaTest = 0.5
      mat.transparent = false
      mat.alphaToCoverage = true
      mat.depthWrite = true
    }
    // night palette: a touch of warmth + the scene's own light does the rest
    mat.roughness = 0.9
    D.push(mat)
    const im = new THREE.InstancedMesh(m.geometry, mat, spots.length)
    const mat4 = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    spots.forEach((p, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.ry)
      mat4.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(p.s, p.s, p.s))
      mat4.multiply(m.matrixWorld)
      im.setMatrixAt(i, mat4)
      mat4.identity()
    })
    im.instanceMatrix.needsUpdate = true
    im.castShadow = shadows
    im.receiveShadow = true
    im.frustumCulled = false
    scene.add(im)
    D.push(m.geometry)
  })
}

/** loads the two models and plants the hero tree(s) + shrubs; resolves false (nothing placed) if a model cannot be loaded */
export async function placeHeroVeg(scene: THREE.Scene, D: (THREE.Material | THREE.BufferGeometry | THREE.Texture)[], q: Quality) {
  if (!HERO_TREES.length && !HERO_SHRUBS.length) return true
  try {
    const base = `${import.meta.env.BASE_URL}chadverse/models/veg/`
    const [tree, shrub] = await Promise.all([loader.loadAsync(`${base}jacaranda.glb`), loader.loadAsync(`${base}shrub_02.glb`)])
    instance(tree.scene, HERO_TREES.map((t, i) => ({ x: t[0], y: 0, z: t[1], s: t[2], ry: i * 1.7 })), scene, D, q === 'high')
    instance(shrub.scene, HERO_SHRUBS.map((s, i) => ({ x: s[0], y: s[1], z: s[2], s: s[3], ry: i * 2.1 })), scene, D, false)
    return true
  } catch (e) {
    console.warn('[chadverse] hero vegetation models could not be loaded; using the procedural plants there', e)
    return false
  }
}
