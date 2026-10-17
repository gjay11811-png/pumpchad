// Inspect a downloaded GLB: nodes, geometry, materials, textures, bounds, asset metadata. node scripts/glb-inspect.mjs file.glb [--nodes]
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { getBounds } from '@gltf-transform/core'
import sharp from 'sharp'
import { statSync } from 'node:fs'
import draco3d from 'draco3d'
const f = process.argv[2]
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() })
const doc = await io.read(f)
const root = doc.getRoot()
console.log('file', f, (statSync(f).size / 1048576).toFixed(1), 'MB')
console.log('asset', JSON.stringify(root.getAsset()), 'extras', JSON.stringify(root.listExtensionsUsed().map((e) => e.extensionName)))
const sc = root.getDefaultScene() || root.listScenes()[0]
const b = getBounds(sc)
const sz = [0, 1, 2].map((i) => +(b.max[i] - b.min[i]).toFixed(3))
console.log('bounds min', b.min.map((x) => +x.toFixed(2)), 'max', b.max.map((x) => +x.toFixed(2)), 'size', sz)
let tris = 0, verts = 0, prims = 0
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
  prims++
  verts += p.getAttribute('POSITION').getCount()
  tris += (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3
}
console.log('nodes', root.listNodes().length, 'meshes', root.listMeshes().length, 'prims', prims, 'verts', verts, 'tris', Math.round(tris), 'animations', root.listAnimations().length, 'skins', root.listSkins().length)
let texMem = 0
console.log('materials', root.listMaterials().length)
for (const m of root.listMaterials()) {
  const t = []
  for (const [k, tx] of [['base', m.getBaseColorTexture()], ['mr', m.getMetallicRoughnessTexture()], ['nrm', m.getNormalTexture()], ['occ', m.getOcclusionTexture()], ['emi', m.getEmissiveTexture()]]) if (tx) {
    const meta = await sharp(Buffer.from(tx.getImage())).metadata()
    texMem += meta.width * meta.height * 4 * 1.33
    t.push(`${k}:${meta.width}x${meta.height}`)
  }
  console.log('  mat', JSON.stringify(m.getName()), 'color', m.getBaseColorFactor().map((x) => +x.toFixed(2)).join(','), 'metal', m.getMetallicFactor(), 'rough', m.getRoughnessFactor(), 'alpha', m.getAlphaMode(), t.join(' '))
}
console.log('GPU texture memory ≈', (texMem / 1048576).toFixed(0), 'MB (RGBA, mips)')
if (process.argv.includes('--nodes')) {
  const walk = (n, d) => {
    const mesh = n.getMesh()
    let info = ''
    if (mesh) { let t = 0; for (const p of mesh.getPrimitives?.() ?? mesh.listPrimitives()) t += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3; info = ` [mesh ${mesh.getName()} ${Math.round(t)} tris]` }
    console.log('  '.repeat(d) + (n.getName() || '(unnamed)') + info)
    if (d < 6) n.listChildren().forEach((c) => walk(c, d + 1))
  }
  sc.listChildren().forEach((n) => walk(n, 0))
}
