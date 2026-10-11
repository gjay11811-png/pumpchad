// Builds game-ready character assets from the CC0 Quaternius packs.
//   node scripts/build-characters.mjs <path-to-pumpchad-assets/raw>
// Output: public/chadverse/models/chad_body.glb, chad_anims.glb
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, meshopt, prune, resample, textureCompress, weld } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'
import sharp from 'sharp'
import { mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RAW = process.argv[2] || '../pumpchad-assets/raw'
const OUT = 'public/chadverse/models'
mkdirSync(OUT, { recursive: true })
await MeshoptEncoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
const kb = (p) => `${(statSync(p).size / 1024).toFixed(0)} KB`

/* ── body: Superhero Male, human face meshes removed (the pumpkin head replaces them) ── */
{
  const src = join(RAW, 'Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf')
  const doc = await io.read(src)
  const root = doc.getRoot()
  for (const node of root.listNodes()) {
    const mesh = node.getMesh()
    if (mesh && /^Face/.test(mesh.getName())) {
      node.setMesh(null)
      console.log('removed face mesh', mesh.getName())
    }
  }
  for (const mesh of root.listMeshes()) if (/Retopology/.test(mesh.getName())) mesh.setName('Body')
  for (const mat of root.listMaterials()) if (mat.getName() === 'MI_Superhero_Male') mat.setName('Skin')
  await doc.transform(
    prune(),
    dedup(),
    weld(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 88 }),
  )
  const out = join(OUT, 'chad_body.glb')
  await io.write(out, doc)
  const tris = root.listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((a, p) => a + (p.getIndices()?.getCount() ?? 0) / 3, 0), 0)
  console.log('body →', out, kb(out), `${tris} tris`, 'materials:', root.listMaterials().map((m) => m.getName()))
}

/* ── animations: library clips only (no mannequin mesh), resampled ── */
{
  // only what the game uses today; add clip names here when a mini-game needs them
  const KEEP = new Set(['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Dance_Loop', 'Interact', 'Idle_Talking_Loop'])
  const src = join(RAW, 'Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb')
  const doc = await io.read(src)
  const root = doc.getRoot()
  const killSampler = (smp) => {
    if (!smp) return
    const inp = smp.getInput()
    const out = smp.getOutput()
    smp.dispose()
    if (inp && inp.listParents().length <= 1) inp.dispose()
    if (out && out.listParents().length <= 1) out.dispose()
  }
  for (const a of root.listAnimations())
    if (!KEEP.has(a.getName())) {
      a.listSamplers().forEach(killSampler)
      a.dispose()
    }
  for (const node of root.listNodes()) {
    if (node.getMesh()) node.setMesh(null)
    if (node.getSkin()) node.setSkin(null)
  }
  for (const m of root.listMeshes()) m.dispose()
  for (const s of root.listSkins()) s.dispose()
  // drop scale tracks (the rig never animates scale) — big saving, no visual change
  for (const a of root.listAnimations())
    for (const ch of a.listChannels()) {
      const path = ch.getTargetPath()
      const name = ch.getTargetNode()?.getName() ?? ''
      // bone lengths never change: only root + pelvis need translation
      if (path === 'scale' || (path === 'translation' && name !== 'root' && name !== 'pelvis')) {
        const smp = ch.getSampler()
        ch.dispose()
        killSampler(smp)
      }
    }
  await MeshoptEncoder.ready
  await doc.transform(resample({ tolerance: 1e-3 }), prune({ keepLeaves: true }), dedup(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
  const out = join(OUT, 'chad_anims.glb')
  await io.write(out, doc)
  console.log('anims →', out, kb(out), root.listAnimations().map((a) => a.getName()))
}
