// Optimise a downloaded house GLB for the game: drop unwanted nodes/materials, resize textures per material, WebP, merge by material, decimate, quantise.
//   node scripts/asset-house-optimise.mjs stone|victorian
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions'
import { join, flatten, weld, simplify, prune, dedup, quantize, getBounds } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'
import { mkdirSync, statSync } from 'node:fs'
await MeshoptSimplifier.ready
const which = process.argv[2]
const CFG = {
  stone: {
    src: 'C:/Users/zafe5/Downloads/stone_house.glb', out: 'public/chadverse/models/houses/stone_house.glb',
    dropNodes: [/^Plane/], dropMaterials: [],
    // [base, normal, other] max edge per material (0 = drop the map)
    tex: { default: [1024, 0, 0], Rusty_metal: [512, 512, 0] }, ratio: 1, simplifyError: 0.01,
  },
  victorian: {
    src: 'C:/Users/zafe5/Downloads/victorian_house.glb', out: 'public/chadverse/models/houses/victorian_house.glb',
    dropNodes: [], dropMaterials: ['insidewoods', 'ceillings', 'insidetapestry'],
    tex: { default: [512, 0, 0], outerwalls: [1024, 512, 0], roofingbasis: [1024, 512, 0], corniches: [1024, 512, 0], bowwindow: [1024, 512, 0], archwindows: [1024, 512, 0], doorsandstairs: [1024, 512, 0], porche: [1024, 512, 0], glasses: [256, 0, 0] },
    ratio: 0.3, simplifyError: 0.02,
  },
}[which]
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(CFG.src)
const root = doc.getRoot()
// 1. drop nodes and the meshes that use unwanted materials
for (const n of root.listNodes()) if (CFG.dropNodes.some((r) => r.test(n.getName()))) { n.dispose() }
if (CFG.dropMaterials.length) {
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) if (CFG.dropMaterials.includes(p.getMaterial()?.getName())) p.dispose()
  for (const n of root.listNodes()) { const m = n.getMesh(); if (m && m.listPrimitives().length === 0) n.setMesh(null) }
}
await doc.transform(prune())
// 2. textures
const webp = doc.createExtension(EXTTextureWebP).setRequired(true)
for (const mat of root.listMaterials()) {
  const cfg = CFG.tex[mat.getName()] ?? CFG.tex.default
  const slots = [['base', mat.getBaseColorTexture(), mat.setBaseColorTexture.bind(mat), cfg[0]], ['mr', mat.getMetallicRoughnessTexture(), mat.setMetallicRoughnessTexture.bind(mat), cfg[2]], ['nrm', mat.getNormalTexture(), mat.setNormalTexture.bind(mat), cfg[1]], ['occ', mat.getOcclusionTexture(), mat.setOcclusionTexture.bind(mat), cfg[2]], ['emi', mat.getEmissiveTexture(), mat.setEmissiveTexture.bind(mat), cfg[0]]]
  for (const [, tex, set, size] of slots) {
    if (!tex) continue
    if (!size) { set(null); continue }
    const img = await sharp(Buffer.from(tex.getImage())).resize(size, size, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer()
    tex.setImage(img).setMimeType('image/webp')
  }
  // metal-rough map dropped: a plain satin response (the scan materials are all dielectrics except the iron bits)
  if (!mat.getMetallicRoughnessTexture()) { const m = mat.getMetallicFactor(); mat.setMetallicFactor(m > 0.6 ? 0.5 : Math.min(m, 0.1)); mat.setRoughnessFactor(Math.max(0.7, Math.min(1, mat.getRoughnessFactor()))) }
}
await doc.transform(prune())
// 3. geometry: flatten, merge by material, weld, decimate
await doc.transform(flatten(), join({ keepMeshes: false, keepNamed: false }), weld(), dedup())
let before = 0
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) before += p.getIndices().getCount() / 3
if (CFG.ratio < 1) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: CFG.ratio, error: CFG.simplifyError, lockBorder: false }))
await doc.transform(prune(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }))
let after = 0
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) after += p.getIndices().getCount() / 3
mkdirSync('public/chadverse/models/houses', { recursive: true })
await io.write(CFG.out, doc)
const b = getBounds(root.listScenes()[0])
let gpu = 0
for (const t of root.listTextures()) { const md = await sharp(Buffer.from(t.getImage())).metadata(); gpu += md.width * md.height * 4 * 1.33 }
console.log(which, 'tris', Math.round(before), '->', Math.round(after), '| materials', root.listMaterials().length, '| textures', root.listTextures().length, '| GPU tex ≈', (gpu / 1048576).toFixed(0), 'MB | file', (statSync(CFG.out).size / 1048576).toFixed(1), 'MB | bounds min', b.min.map((x) => +x.toFixed(2)), 'max', b.max.map((x) => +x.toFixed(2)))
