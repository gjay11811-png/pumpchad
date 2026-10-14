// Builds game-ready character assets from the CC0 Quaternius packs.
//   node scripts/build-characters.mjs <path-to-pumpchad-assets/raw>
// Output: public/chadverse/models/chad_body.glb, chad_anims.glb
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, meshopt, prune, resample, textureCompress, weld } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'
import sharp from 'sharp'
import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import obj2gltf from 'obj2gltf'
import { join } from 'node:path'

const RAW = process.argv.slice(2).find((a) => !a.startsWith('--')) || '../pumpchad-assets/raw'
// --only=anims rebuilds just the animation packs (leaves the approved body / outfit / skull files untouched)
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7) ?? null
const want = (part) => !ONLY || ONLY === part
const OUT = 'public/chadverse/models'
mkdirSync(OUT, { recursive: true })
await MeshoptEncoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
const kb = (p) => `${(statSync(p).size / 1024).toFixed(0)} KB`

/* ── body: Superhero Male, human face meshes removed (the pumpkin head replaces them) ── */
if (want('body')) {
  const src = join(RAW, 'Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf')
  const doc = await io.read(src)
  const root = doc.getRoot()
  // keep eyes + brows (Demon uses the real face; Pumpkin hides them at runtime)
  for (const node of root.listNodes()) {
    const mesh = node.getMesh()
    if (mesh?.getName() === 'Face') mesh.setName('Eyebrows')
    if (mesh?.getName() === 'Face.001') mesh.setName('Eyes')
  }
  for (const mat of root.listMaterials()) {
    if (mat.getName() === 'MI_Hair_1') mat.setName('Brows')
    if (mat.getName() === 'MI_Eyes') mat.setName('EyeMat')
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
// only what the game uses; add clip names here when a feature needs them. Both libraries share the 65-bone rig.
const PACKS = [
  ['Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb', 'chad_anims.glb',
    ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Dance_Loop', 'Interact', 'Idle_Talking_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Punch_Jab', 'Punch_Cross', 'Sitting_Enter', 'Sitting_Idle_Loop', 'Sitting_Exit']],
  ['ual2/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb', 'chad_anims2.glb',
    ['Melee_Hook', 'Yes', 'Idle_FoldArms_Loop', 'OverhandThrow', 'ClimbUp_1m', 'Slide_Start', 'Slide_Loop', 'Slide_Exit', 'Farm_Harvest']],
]
if (want('anims')) for (const [file, outName, keep] of PACKS) {
  const KEEP = new Set(keep)
  const src = join(RAW, file)
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
  const out = join(OUT, outName)
  await io.write(out, doc)
  console.log('anims →', out, kb(out), root.listAnimations().map((a) => a.getName()))
}

/* ── Ranger outfit (Quaternius Modular Character Outfits – Fantasy, CC0): rigged to the same 65-bone skeleton ── */
if (want('ranger')) {
  const src = join(RAW, 'Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Outfits/Male_Ranger.gltf')
  const doc = await io.read(src)
  const root = doc.getRoot()
  for (const mat of root.listMaterials()) {
    if (mat.getName() === 'MI_Ranger') mat.setName('Ranger')
    if (mat.getName() === 'MI_Regular_Male') mat.setName('Hands')
  }
  await doc.transform(prune(), dedup(), weld(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 86 }))
  const out = join(OUT, 'chad_ranger.glb')
  await io.write(out, doc)
  const tris = root.listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((a, p) => a + (p.getIndices()?.getCount() ?? 0) / 3, 0), 0)
  console.log('ranger →', out, kb(out), `${tris} tris`, root.listMeshes().map((m) => m.getName()))
}

/* ── Skull (OpenGameArt "Human Skull" by CDmir, CC0) ── */
if (want('skull')) {
  const src = join(RAW, 'skull/skull-obj/skull-Low4K.obj')
  const glb = await obj2gltf(src, { binary: true })
  const tmp = join(OUT, '_skull_tmp.glb')
  writeFileSync(tmp, glb)
  const doc = await io.read(tmp)
  const root = doc.getRoot()
  for (const mat of root.listMaterials()) mat.setName('Bone')
  await doc.transform(prune(), dedup(), weld(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 86 }))
  const out = join(OUT, 'chad_skull.glb')
  await io.write(out, doc)
  ;(await import('node:fs')).unlinkSync(tmp)
  const tris = root.listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((a, p) => a + (p.getIndices()?.getCount() ?? 0) / 3, 0), 0)
  console.log('skull →', out, kb(out), `${tris} tris`, 'textures', root.listTextures().map((t) => t.getName() || t.getURI()))
}

/* ── Villagers (CC0): Quaternius Fantasy Peasant / Ranger outfits on regular bodies, the female base (for her head),
      and the head-rigged hairstyles + brows. All on the same 65-bone rig, so the game binds them to one skeleton
      and the existing animation library drives them. ── */
if (want('villagers')) {
  const FANT = join(RAW, 'Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Outfits')
  const BASE = join(RAW, 'Universal Base Characters[Standard]')
  const HAIR = join(BASE, 'Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)')
  const jobs = [
    [join(FANT, 'Male_Peasant.gltf'), 'villager_m.glb', { MI_Peasant: 'Outfit', MI_Regular_Male: 'Hands' }],
    [join(FANT, 'Female_Peasant.gltf'), 'villager_f.glb', { MI_Peasant: 'Outfit', MI_Regular_Female: 'Hands' }],
    [join(FANT, 'Female_Ranger.gltf'), 'villager_rf.glb', { MI_Ranger: 'Outfit', MI_Regular_Female: 'Hands' }],
    [join(BASE, 'Base Characters/Godot - UE/Superhero_Female_FullBody.gltf'), 'villager_fbody.glb', { MI_Superhero_Female: 'Skin', MI_Eyes: 'EyeMat', MI_Hair_2: 'Brows' }],
    ...['Hair_Beard', 'Hair_Buns', 'Hair_Buzzed', 'Hair_BuzzedFemale', 'Hair_Long', 'Hair_SimpleParted', 'Eyebrows_Female', 'Eyebrows_Regular'].map((h) => [join(HAIR, `${h}.gltf`), `vhair_${h.replace(/^(Hair_|Eyebrows_)/, (m) => (m === 'Hair_' ? '' : 'brows_')).toLowerCase()}.glb`, { MI_Hair_1: 'Hair', MI_Hair_2: 'Hair' }]),
  ]
  for (const [src, name, rename] of jobs) {
    const doc = await io.read(src)
    const root = doc.getRoot()
    for (const mat of root.listMaterials()) if (rename[mat.getName()]) mat.setName(rename[mat.getName()])
    for (const n of root.listNodes()) if (n.getMesh() && /Superhero_Female/.test(n.getName())) n.getMesh().setName('Body')
    const size = name.startsWith('vhair') ? 512 : 1024
    // no meshopt here: quantised positions put a dequantise scale on the mesh NODE, and the game lifts these parts
    // (heads, hair) out of their nodes to bind them onto another skeleton
    await doc.transform(prune(), dedup(), weld(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size, size], quality: 86 }))
    const out = join(OUT, name)
    await io.write(out, doc)
    const tris = root.listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((a, p) => a + (p.getIndices()?.getCount() ?? 0) / 3, 0), 0)
    console.log('villager →', out, kb(out), `${tris} tris`, root.listMaterials().map((m) => m.getName()))
  }
}
