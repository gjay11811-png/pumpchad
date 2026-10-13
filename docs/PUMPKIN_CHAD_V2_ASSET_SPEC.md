# Pumpkin Chad v2: asset spec and Blender workflow

_Written 13 October 2026 for the `chadverse-v3` branch. This sets out how to take Pumpkin Chad from the code-built v2 to a sculpted, artwork-accurate model. It doesn't change the approved silhouette._

## Where things stand

| Part | Today (v2, in code) | Rollback |
|---|---|---|
| Body | CC0 Quaternius Universal Base Character, 65-bone rig, recoloured skin + shorts | — (unchanged) |
| Head | Procedural ribbed pumpkin (`buildPumpkinHead`, `src/game/character/chadParts.ts`): 12 deep ribs, lacquer clearcoat, glowing carved face, thick curled stem | `?pumpkin=classic` |
| Shades | Procedural (`buildShades`) | — |
| Chain | Chunky Cuban chain (46 flat interlocking links) + dripping gold **PUMP CHAD** letters, merged into **one mesh and one draw call**. The letters are alpha-cut, bump-bevelled and layered 4 deep | `?pumpkin=classic` (thin chain + crown medallion) |
| Shorts | Jack-o'-lantern logo decal on the left thigh (DecalGeometry, rides `thigh_l`) + white drawstring (rides `pelvis`) | `?pumpkin=classic` |

To compare the two, open `/chadverse/` and `/chadverse/?pumpkin=classic` side by side. The QA script `scripts/pumpkin-look.mjs` shoots both from the front, three-quarter and side.

**Budget (measured):** 28.8k triangles and 12 draw calls per character, inside the mobile budget of 40k triangles and 12 draws that `scripts/character-test.mjs` enforces.

## What code can't reach, and why a sculpt is the next step

Compared with the hero artwork (`public/art/pumpchad-hero-1254.webp`), three gaps remain:
1. **The carved face has no depth.** The eyes and grin are an emissive texture on a sphere. The artwork has real cut-through carving, thick rind walls and inner glow falloff.
2. **The head surface is too smooth.** The artwork has lumpy, asymmetric ribs, blemishes and a waxy rind. That needs sculpted normal and AO detail.
3. **The letters are flat cut-outs.** The artwork's PUMP CHAD letters are chunky, rounded 3D gold.

All three need a sculpting tool. Blender isn't installed on the development machine, and its 3.5 GB of RAM can't comfortably run it, so this spec hands the work to a workstation or an artist.

## Deliverables

| File | Contents | Budget |
|---|---|---|
| `pumpkin_head.glb` | Head only, origin at the neck joint, facing +Z, 1 unit = 1 m at the **unscaled** size (the game scales the head by 1.32) | ≤ 6,000 tris |
| `pumpkin_letters.glb` | The PUMP CHAD pendant as real geometry (bevelled, merged), origin at the bail ring | ≤ 2,500 tris |
| Textures (embedded) | Rind: base colour + normal + ORM at 1024². Carving glow: emissive mask at 512² | ≤ 1.5 MB total after KTX2 |

Material names must be exact, because the code hooks onto them:
- `Rind`: recoloured by the player's skin choice (hue shift on base colour), clearcoat about 0.45.
- `Carve`: emissive, driven by the player's glow colour. Keep it unlit-looking (emissive about 2.9 before bloom).
- `Stem`: dark green, roughness 0.7.
- `Gold`: metal 1, roughness 0.2, used for the letters.

## Blender workflow (4.x)

1. **Block-out.** Start from a UV sphere (64 × 32) and scale Y to 0.86. Add 12 rib grooves with a Simple Deform plus Displace modifier using a radial gradient, then apply. Match the in-game silhouette: export today's head with `scripts/pumpkin-look.mjs` screenshots and use them as a background image.
2. **Sculpt (multires 4–5).** Add asymmetric rib bulges, a flattened top around the stem, small blemishes and a waxy surface. Keep the grin, triangle eyes and nose in the artwork's proportions; screenshot `pk-v2-close-f.jpg` is the reference.
3. **Carve.** Boolean the face cut-outs about 3 cm deep, then add a 1.5 cm rind wall inside. Give the inner walls a separate `Carve` material slot.
4. **Retopo / decimate** to ≤ 6k tris, keeping the cut edges clean. UV-unwrap the rind as one island per rib.
5. **Bake** from multires to low: normal, AO and curvature. Paint the base colour from orange to deep orange in the grooves, with lighter rib crowns and subtle green near the stem.
6. **Letters.** Font: Anton (OFL licence; include `OFL.txt`) or a custom lettering trace. Extrude 6 mm with a 2 mm bevel, 3 segments. Add drips as metaballs converted to mesh, then join and decimate.
7. **Export glTF 2.0 (.glb):** +Y up, apply modifiers, no animation, no cameras or lights. Then run the existing pipeline for meshopt and KTX2:
   `node scripts/build-characters.mjs ../pumpchad-assets/raw --only=<new step>` (add a `head` step alongside `anims`; the doc-transform chain in that script already does resample, prune, dedup and meshopt).

## Dropping it in (code changes needed: small)

1. Put the files in `public/chadverse/models/`.
2. In `chadParts.ts`, add a `PUMPKIN_LOOK === 'sculpt'` branch to `buildPumpkinHead`. It loads `pumpkin_head.glb` (cached like the other GLBs in `chad.ts` → `file()`), clones it, applies `Rind` recolour and `Carve` glow, and returns a Group with the same origin and scale conventions as the procedural head. Shades and headwear attach exactly as they do now.
3. Swap the letters plane stack in `buildCubanChain` for `pumpkin_letters.glb`, placed at the same `PY`/`PZ`.
4. Keep `v2` and `classic` selectable until the sculpt is approved: `?pumpkin=sculpt|v2|classic`.
5. Run `character-test`, `species-test`, `anim-test` and `pumpkin-look`. The mobile budget gate must stay green.

## Licensing checklist
- Body and rig: Quaternius CC0 (see `CREDITS.md`).
- Font for the letters: Anton (OFL). Don't ship a font file you haven't checked the licence for.
- If an AI image-to-3D tool is used for the block-out, check its commercial-use terms before shipping.
