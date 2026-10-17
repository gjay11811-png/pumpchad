// MX4 stage 1: flatten + join + weld + decimate (about 150k tris) + scale mm→m, for LOOKING at the fused scan.
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { flatten, join, weld, simplify, prune, dedup } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
await MeshoptSimplifier.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read('C:/Users/zafe5/Downloads/talaria_sting_r_mx4.glb')
await doc.transform(flatten(), join({ keepMeshes: false, keepNamed: false }), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: +(process.argv[2] || 0.12), error: 0.01 }), prune())
const sc = doc.getRoot().listScenes()[0]
for (const n of sc.listChildren()) n.setScale([0.001, 0.001, 0.001])
await io.write(process.argv[3] || 'tmp-viewer/mx4_preview.glb', doc)
let t = 0
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) t += p.getIndices().getCount() / 3
console.log('tris', Math.round(t))
