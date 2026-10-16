import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/**
 * Photoscanned trees (Poly Haven, CC0): `island_tree_01` (1.6 M triangles in the scan → ~19 K here, one 512 px WebP set, see ASSETS.md).
 * One GLB is loaded for the whole forest and every tree is an instance of it (one InstancedMesh per material), added to the scene when it
 * arrives — the procedural trees around them are already there, so a slow load never leaves a gap. The leaf cards are alpha-tested
 * rather than blended so the instances never sort wrongly against each other.
 */
let load: Promise<THREE.Group | null> | null = null
function island() {
  load ??= new Promise<void>((r) => setTimeout(r, 5000))
    .then(() => new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}chadverse/models/veg/island_tree_opt.glb`))
    .then((g) => g.scene)
    .catch(() => null)
  return load
}

export type TreeSpot = [x: number, z: number, scale: number, yaw: number]

/** a tint multiplied over the scan's own colours, so the forest keeps its teal / violet / deep-green mood */
export function scatterIslandTrees(scene: THREE.Object3D, spots: TreeSpot[], tints: THREE.Color[], disposables: (THREE.Material | THREE.Texture | THREE.BufferGeometry)[]) {
  if (!spots.length) return
  void island().then((src) => {
    if (!src) return
    src.updateWorldMatrix(true, true)
    const m4 = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    src.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const mat = (mesh.material as THREE.MeshStandardMaterial).clone()
      mat.flatShading = false
      if (mat.name.includes('leaves')) {
        mat.transparent = false
        mat.alphaTest = 0.5
        mat.side = THREE.DoubleSide
      }
      disposables.push(mat)
      const inst = new THREE.InstancedMesh(mesh.geometry, mat, spots.length)
      const local = mesh.matrixWorld
      spots.forEach(([x, z, s, yaw], i) => {
        m4.compose(new THREE.Vector3(x, 0, z), q.setFromEuler(e.set(0, yaw, 0)), new THREE.Vector3(s, s, s)).multiply(local)
        inst.setMatrixAt(i, m4)
        inst.setColorAt(i, tints[i % tints.length])
      })
      inst.castShadow = true
      inst.frustumCulled = false
      scene.add(inst)
    })
  })
}
