// Optimise a Poly Haven (CC0) vegetation scan for the browser/phone: weld + meshopt-simplify the woody parts, thin the leaf cards to a
// target triangle count (keeping a deterministic spread of whole leaf clusters and scaling each up a little so the canopy keeps its
// density), switch BLEND leaves to alpha-test (MASK), downsize textures to WebP, drop the ARM map, write one GLB.
// Needs @gltf-transform/{core,functions,extensions}, meshoptimizer and sharp installed in a SCRATCH folder (not the project):
//   cd $TEMP/gtf && npm i @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions meshoptimizer sharp
//   node optimise-veg.mjs <in.gltf> <out.glb> <woodTris> <leafTris> <leafScale> <texSize>
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { weld, simplify, textureCompress, prune, dedup } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'

const [inp, outp, woodTris = '6000', leafTris = '9000', leafScale = '1.8', texSize = '512'] = process.argv.slice(2)
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(inp)
await MeshoptSimplifier.ready

const triCount = (p) => (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3

/** keep every K-th connected leaf cluster (union-find on shared vertices), scaled about its centroid */
function thinCards(prim, target, scale) {
  const pos = prim.getAttribute('POSITION').getArray()
  const nor = prim.getAttribute('NORMAL')?.getArray()
  const uv = prim.getAttribute('TEXCOORD_0')?.getArray()
  const idx = prim.getIndices().getArray()
  const nv = pos.length / 3
  const parent = new Int32Array(nv)
  for (let i = 0; i < nv; i++) parent[i] = i
  const find = (a) => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]]
      a = parent[a]
    }
    return a
  }
  for (let t = 0; t < idx.length; t += 3) {
    const a = find(idx[t])
    const b = find(idx[t + 1])
    const c = find(idx[t + 2])
    if (a !== b) parent[b] = a
    const a2 = find(a)
    const c2 = find(c)
    if (a2 !== c2) parent[c2] = a2
  }
  const compTris = new Map()
  for (let t = 0; t < idx.length; t += 3) {
    const r = find(idx[t])
    compTris.set(r, (compTris.get(r) ?? 0) + 1)
  }
  const total = idx.length / 3
  const K = Math.max(1, Math.ceil(total / target))
  const keep = new Set()
  const roots = [...compTris.keys()].sort((a, b) => a - b)
  roots.forEach((r, i) => {
    // a deterministic scatter (not every K-th in memory order, which would pick one side of the tree)
    const h = (Math.imul(r ^ 0x9e3779b9, 2654435761) >>> 0) % K
    if (h === 0) keep.add(r)
  })
  const remap = new Int32Array(nv).fill(-1)
  const sum = new Map()
  for (let v = 0; v < nv; v++) {
    const r = find(v)
    if (!keep.has(r)) continue
    const s = sum.get(r) ?? [0, 0, 0, 0]
    s[0] += pos[v * 3]
    s[1] += pos[v * 3 + 1]
    s[2] += pos[v * 3 + 2]
    s[3]++
    sum.set(r, s)
  }
  let n = 0
  for (let v = 0; v < nv; v++) if (keep.has(find(v))) remap[v] = n++
  const P = new Float32Array(n * 3)
  const N = nor ? new Float32Array(n * 3) : null
  const U = uv ? new Float32Array(n * 2) : null
  for (let v = 0; v < nv; v++) {
    const k = remap[v]
    if (k < 0) continue
    const s = sum.get(find(v))
    const cx = s[0] / s[3]
    const cy = s[1] / s[3]
    const cz = s[2] / s[3]
    P[k * 3] = cx + (pos[v * 3] - cx) * scale
    P[k * 3 + 1] = cy + (pos[v * 3 + 1] - cy) * scale
    P[k * 3 + 2] = cz + (pos[v * 3 + 2] - cz) * scale
    if (N) {
      N[k * 3] = nor[v * 3]
      N[k * 3 + 1] = nor[v * 3 + 1]
      N[k * 3 + 2] = nor[v * 3 + 2]
    }
    if (U) {
      U[k * 2] = uv[v * 2]
      U[k * 2 + 1] = uv[v * 2 + 1]
    }
  }
  const I = []
  for (let t = 0; t < idx.length; t += 3) if (remap[idx[t]] >= 0) I.push(remap[idx[t]], remap[idx[t + 1]], remap[idx[t + 2]])
  const buf = doc.getRoot().listBuffers()[0]
  prim.getAttribute('POSITION').setArray(P)
  if (N) prim.getAttribute('NORMAL').setArray(N)
  if (U) prim.getAttribute('TEXCOORD_0').setArray(U)
  for (const sem of prim.listSemantics()) if (!['POSITION', 'NORMAL', 'TEXCOORD_0'].includes(sem)) prim.setAttribute(sem, null)
  prim.getIndices().setArray(new Uint32Array(I))
  void buf
  return { before: total, after: I.length / 3, K, comps: roots.length, kept: keep.size }
}

const log = []
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const mat = prim.getMaterial()
    const leafy = mat && (mat.getAlphaMode() !== 'OPAQUE' || /leaf|leaves|shrub/i.test(mat.getName()))
    if (leafy) {
      const r = thinCards(prim, Number(leafTris), Number(leafScale))
      log.push(`${mat.getName()}: leaves ${r.before} -> ${r.after} tris (1 of ${r.K} of ${r.comps} clusters)`)
    }
  }
}
// detach the (already thinned) leaf primitives so the woody parts can be welded + simplified on their own
const detached = []
for (const mesh of doc.getRoot().listMeshes()) {
  for (const p of mesh.listPrimitives()) {
    const m = p.getMaterial()
    if (m && (m.getAlphaMode() !== 'OPAQUE' || /leaf|leaves|shrub/i.test(m.getName()))) {
      mesh.removePrimitive(p)
      detached.push([mesh, p])
    }
  }
}
const hasWood = doc.getRoot().listMeshes().some((m) => m.listPrimitives().length > 0)
if (hasWood) await doc.transform(weld({ tolerance: 0.0001 })) // (a model that is all leaves has no woody part to weld; transforms would drop its emptied meshes)
const woodPrims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())
const woodBefore = woodPrims.reduce((a, p) => a + triCount(p), 0)
if (hasWood && woodBefore > Number(woodTris)) {
  await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: Number(woodTris) / woodBefore, error: 0.6, lockBorder: false }))
}
const woodAfter = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).reduce((a, p) => a + triCount(p), 0)
log.push(`wood: ${woodBefore} -> ${woodAfter} tris`)
for (const [mesh, p] of detached) mesh.addPrimitive(p)
for (const m of doc.getRoot().listMaterials()) {
  if (m.getAlphaMode() === 'BLEND') {
    m.setAlphaMode('MASK').setAlphaCutoff(0.5)
  }
  m.setMetallicRoughnessTexture(null).setOcclusionTexture(null)
  m.setRoughnessFactor(0.9).setMetallicFactor(0).setDoubleSided(true)
}
// Poly Haven's glTF leaf textures are RGB JPEGs on a BLACK background (the alpha only exists in their PNG/Blender versions): rebuild the
// alpha from the pixel brightness so the leaf cards cut out properly (otherwise they render as black rectangles).
for (const m of doc.getRoot().listMaterials()) {
  if (!/leaf|leaves/i.test(m.getName())) continue
  const tex = m.getBaseColorTexture()
  if (!tex) continue
  const { data, info } = await sharp(Buffer.from(tex.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (let i = 0; i < data.length; i += 4) data[i + 3] = Math.max(0, Math.min(255, (Math.max(data[i], data[i + 1], data[i + 2]) - 14) * 9))
  const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer()
  tex.setImage(new Uint8Array(png)).setMimeType('image/png')
}
await doc.transform(
  prune(),
  dedup(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [Number(texSize), Number(texSize)], quality: 82 }),
)
await io.write(outp, doc)
console.log(log.join('\n'))
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) console.log(' prim', p.getMaterial()?.getName(), triCount(p), 'tris')
