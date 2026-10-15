# Chadverse asset sources and attribution

Rule: only free, clearly licensed assets; verify the licence on the asset's own page before it goes into `public/` or `src/`; keep the
source URL here. Nothing is bought without separate authorisation. Runtime assets are stored with the project — the game never loads a
third-party preview viewer.

## Verified (2026-10-15)

| Source | What | Licence | Attribution | Status |
|---|---|---|---|---|
| Poly Haven (polyhaven.com) — https://polyhaven.com/license | HDRIs, PBR textures, 3D models | **CC0** (public domain; commercial use and redistribution inside a project allowed) | not required (credit appreciated) | Verified from the licence page. |
| Poly Haven **Antique Estoc** — https://polyhaven.com/a/antique_estoc | thrusting sword; authors James Ray Cock (texturing), Ulan Cabanilla (modelling) | **CC0** | not required; credit kept here | Exists. ~8K triangles; textures 1K/2K/4K/8K; formats Blend/glTF/USD/FBX; glTF + 1K textures via `https://api.polyhaven.com/files/antique_estoc`. **Suitable sword candidate** (low poly, 1K textures); to be downloaded, scale-checked and attached in Phase 4. |
| Chad assets already in the project | Quaternius rigged characters, skull etc. | CC0 (as recorded when added) | — | In use. |

## Checked and rejected / not usable as-is

* **Poly Haven vegetation models** (`fir_tree_01` 7.9 M tris, `pine_tree_01` 17 M, `pine_sapling_medium` 9.8 M, `island_tree_0x` 1.8–4.8 M, `jacaranda_tree` 312 K, `boulder_01` 124 K…): photoscanned, far too heavy for browser/mobile without a decimation + impostor pipeline (no Blender in this environment). Only the small ones (`fern_02` 6 K, `dead_quiver_trunk` 34 K, dry branches 17 K) are practical. Decision: **trees and bushes are generated procedurally** (branching trunks, layered alpha-tested leaf cards, bark and leaf textures painted at build time) so there is no licence or size risk; Poly Haven CC0 *textures* (bark, ground, leaf) may be added later where they improve the look.
* **"Lakeside mansion by cjmitchell"**: a search found no listing under that name on CGTrader/Sketchfab/TurboSquid/Daz, so source, licence and download availability are **unverified**. Not used. Mooncrest Manor stays our own model; to be revisited if Jay supplies the exact URL.
* **Detailed sports car / textured pistol**: no URLs were supplied and none were found by name, so licence and download are **unverified**. Nothing used. Cars and the pistol will be built procedurally (higher-quality coachwork/gun geometry) unless Jay supplies verified free links.

## Open actions
* Jay: supply exact URLs for the mansion, sports car and pistol if they should be considered.
* Download Antique Estoc glTF (1K) into `public/models/` with this record when Phase 4 starts; record triangle count and texture sizes after optimisation.


## Local inventory (checked 2026-10-15) — visual references vs usable 3D assets

**Visual references on disk (images only, not game assets)**
* PumpChad's original character art: `C:/Users/zafe5/Downloads/pumpchad/art-source-pumpchad.png` (2.2 MB)
* Chadverse brand art: `C:/Users/zafe5/Downloads/pumpchad/public/art/pumpchad-hero-1254.webp`, `pumpchad-hero-760.webp`, `pumpchad-logo.webp`, and `public/art/chadverse/01-pumpchad-throne.webp` … `05-pumpchad-army.webp`
* `C:/Users/zafe5/Downloads/Pumpkin King Crypto Throne.png`
* Our own game captures (evidence, not references): `C:/Users/zafe5/Downloads/pumpchad/docs/*` (chad-city, chadverse-v3, v3-polish, v4), `C:/Users/zafe5/Downloads/pumpchad-review/*`, `C:/Users/zafe5/Downloads/pumpchad-teasers/*` (gym teaser stills), `C:/Users/zafe5/Desktop/Chadverse-Overnight-Review/*`

**NOT on disk (MISSING)**: the "World Upgrade Pack" reference images (no zip or extracted folder anywhere under the user profile); any reference photo/render for a modern industrial gym, standalone arcade, automotive workshop, haunted houses, mansion + courtyard, parkour structures or housing-neighbourhood layout; the cjmitchell lakeside mansion; the detailed sports car; the textured pistol. The Antique Estoc is available online (CC0) but not downloaded yet.

**Usable 3D assets on disk (all Quaternius, CC0)** in `C:/Users/zafe5/Downloads/pumpchad-assets/raw/`:
* Universal Base Characters, Modular Character Outfits (Fantasy), Universal Animation Library 1 and 2, skull OBJ — INTEGRATED as `C:/Users/zafe5/Downloads/pumpchad/public/chadverse/models/chad_body.glb, chad_ranger.glb, chad_skull.glb, chad_anims.glb, chad_anims2.glb, villager_*.glb, vhair_*.glb`
* `bestiary-dungeon-monsters-kit.zip` (46 MB; e.g. Imp.glb 9.2 MB, Puglin.glb 7.7 MB) — AVAILABLE, not extracted, not integrated, too heavy for mobile without decimation; candidate haunted-combat enemies
* No vegetation, building, vehicle, pet, weapon or parkour 3D asset is on disk. Everything for those in the game today is procedural code.

**Free sources checked online (licence verified, not downloaded)**: Poly Haven (CC0; vegetation scans far too heavy), Poly Haven Antique Estoc (CC0, ~8K tris, glTF 1K), Kenney Car Kit / Graveyard Kit / Blaster Kit (CC0; zip contents and formats must be checked after download, before import).


## Vegetation standard — evaluation (2026-10-15)

Source: Poly Haven, CC0 (licence page verified; attribution not required, credit given here and in CREDITS.md). Downloaded 1K glTF packs to `C:/Users/zafe5/Downloads/pumpchad-assets/polyhaven/` (jacaranda_tree 205 MB, shrub_02, shrub_03, shrub_04). Optimised outputs: `C:/Users/zafe5/Downloads/pumpchad-assets/polyhaven-optimised/` (`jacaranda_opt.glb` 2.0 MB, `shrub_02_opt.glb` 0.4 MB), built with `scripts/optimise-veg.mjs` (gltf-transform + meshoptimizer + sharp, run from a scratch folder).

| Candidate | Result |
|---|---|
| Jacaranda Tree as a model | Only one LOD ships (no lower-detail version): 1.2 M tris of wood + 2.4 M tris of leaf geometry, 11.6 M render vertices. Optimised to ~26 K (wood) + 14 K (leaves) = ~40 K tris, 2 MB, 512 px WebP, alpha rebuilt from the black-background JPEG. Limbs look right, canopy is sparse (116 K leaf clusters thinned to ~700); a full canopy needs 120 K+ tris. **Rejected for repetition**; kept (disabled) in `vegModels.ts` for review. |
| Shrub 02 / 03 / 04 as models | shrub_02 (5.3 m, sparse willowy stems), shrub_03 (1.3 x 0.4 m) and shrub_04 (0.6 x 0.2 m) are wild ground plants, not lush garden shrubs. **Rejected**; procedural shrubs stay. |
| **Chosen standard** | The procedural trees/shrubs/hedges (real branching, per-species recipes, cell LOD) **textured with Poly Haven's real Jacaranda leaf and bark maps**: `public/chadverse/textures/veg/leaf_jacaranda.webp` (89 KB, greyscale compound-leaf cutout) and `bark_jacaranda.webp` (13 KB). Vertex colours keep the species palette. Same triangle count as before; two small image swaps. |

## Supplied links — verified through the Sketchfab API (2026-10-15)

| Asset | URL | Licence | Size | Download |
|---|---|---|---|---|
| Lakeside mansion | https://sketchfab.com/3d-models/lakeside-mansion-d6c5158e0eb14915a3e9ed356f889fd9 | **CC BY 4.0** (credit the author on the page) | ~1.23 M faces (far too heavy for web/phone without heavy decimation) | `isDownloadable: true`, but the archive endpoint needs a signed-in Sketchfab session — **BLOCKED here** (anonymous requests return an empty archive list) |
| Realistic sports car | https://sketchfab.com/3d-models/realistic-sports-car-df14049903224e5b892c53be1bdd6ae7 | **CC BY 4.0** | ~762 K faces (heavy) | same: needs Jay's login |
| Pistol 9mm semi-auto | https://sketchfab.com/3d-models/pistol-9mm-semi-auto-7d363c3cf2f74a9a9fb0cab9874898eb | **CC BY 4.0** | ~18 K faces (light, suitable) | same: needs Jay's login |
| Antique Estoc (sword) | https://polyhaven.com/a/antique_estoc | **CC0** | ~8 K tris, 1K glTF textures | not blocked — **not downloaded yet** (kept for the sword activity; downloads from `https://api.polyhaven.com/files/antique_estoc`) |

**Manual download steps (Jay, ~2 minutes, no purchase):** sign in to Sketchfab → open each link → *Download 3D model* → choose **glTF** (the auto-converted `.zip`) → save the zip into `C:/Users/zafe5/Downloads/pumpchad-assets/sketchfab/<name>.zip` and tell me. I then unzip into a fresh folder, check geometry (faces, scale, materials), decimate + compress the mansion and car to a phone budget (gltf-transform + meshopt, target well under 60 K tris and 2 MB each), and record the author credit in `CREDITS.md` (CC BY requires it). Until then nothing from these three is used: the mansion, cars and pistol remain our own procedural models.

(Superseded: the mansion, car, pistol and sword links arrived in a later message and are recorded in the table above. The Antique Estoc (CC0) remains the only weapon asset that can be fetched without a login.)
