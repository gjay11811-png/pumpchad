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
| Antique Estoc (sword) | https://polyhaven.com/a/antique_estoc | **CC0** | ~8 K tris, 1K glTF textures | **DOWNLOADED + IN USE** (2026-10-15): glTF 1K pack in `C:/Users/zafe5/Downloads/pumpchad-assets/estoc/`; baked to `public/chadverse/models/estoc.glb` (8,246 triangles, 312 KB, 512 px WebP diffuse + normal, ARM map dropped to metal/rough constants) by gltf-transform in a scratch folder. Used by the Sword Drill (`minigames/swordDrill.ts`). |

**Manual download steps (Jay, ~2 minutes, no purchase):** sign in to Sketchfab → open each link → *Download 3D model* → choose **glTF** (the auto-converted `.zip`) → save the zip into `C:/Users/zafe5/Downloads/pumpchad-assets/sketchfab/<name>.zip` and tell me. I then unzip into a fresh folder, check geometry (faces, scale, materials), decimate + compress the mansion and car to a phone budget (gltf-transform + meshopt, target well under 60 K tris and 2 MB each), and record the author credit in `CREDITS.md` (CC BY requires it). Until then nothing from these three is used: the mansion, cars and pistol remain our own procedural models.

(Superseded: the mansion, car, pistol and sword links arrived in a later message and are recorded in the table above. The Antique Estoc (CC0) remains the only weapon asset that can be fetched without a login.)


## Weapons in the game (2026-10-15)

* **Sword Drill** — Antique Estoc (Poly Haven, CC0, James Ray Cock + Ulan Cabanilla) in the Parkour Yard's north strip: three straw dummies, 30 s, cuts with the action key, combo for hitting different dummies, local personal best.
* **Pistol Range** — the second weapon on the Pumpkin Toss range. The pistol is our own procedural model (slide, barrel, grip, sights; no third-party asset), held in the right hand with the arm IK following the aim. The supplied Sketchfab 9mm (CC BY 4.0, ~18 K faces) is still **blocked behind a login**; once downloaded it can replace the procedural model.


## Animation sources (2026-10-16)

* **Mixamo** (https://www.mixamo.com/) — **not used, not verified.** The Adobe FAQ page (`helpx.adobe.com/creative-cloud/faq/mixamo-faq.html`) returned HTTP 403 to an automated fetch, so the licence wording could not be read here; Mixamo downloads also need an Adobe sign-in, which only Jay can provide. I have **not** claimed it contains every requested parkour clip (vault / mantle / ledge hang / shimmy / pull-up) — that has to be checked by browsing its library signed in. Manual step, once: sign in → search "climb", "hang", "vault", "jump" → note the exact clip names and the licence text on the FAQ → tell me which to retarget (the rig is the shared PumpChad / Skeleton / Demon skeleton with `hand_l/r`, `lowerarm_l/r`, `upperarm_l/r`, `foot_l/r`).
* **Threepeat parkour animations** (https://www.threepeatgames.com/parkour_anims/) — Unity-oriented; format and licence unverified; **no purchase authorised or made**. Comparison only.
* **What the game does today instead**: the existing Universal Animation Library clips (jump start / loop / land, idle, run) plus **procedural arm IK** (`PumpkinChad.grip`) to put both hands on the ledge, a procedural pull-up path, and a root pitch/roll lean for vaults and mantles. This is *procedural motion on the existing rig, not motion capture*, and the three species share the one rig so the same motion plays on PumpChad, Skeleton and Demon (visual check on all three still to do).


## Overnight quality pass (2026-10-16)

| Asset | Source / author | Licence | Modifications | Status |
|---|---|---|---|---|
| Service Pistol | https://polyhaven.com/a/service_pistol (Poly Haven; glTF 1K via `https://api.polyhaven.com/files/service_pistol`) | **CC0** | Kept pistol A only (frame, slide, hammer, trigger; 11.2 K tris after dropping the second pistol, magazines and bullet), ARM map dropped to metal/rough constants, 1K WebP textures → `public/chadverse/models/service_pistol.glb`; scaled 1.15, turned muzzle +x → +z, recoil kick added in `targetThrow.ts` | **IN USE** (Pistol Range). The procedural stand-in shows while it loads |
| Antique Estoc | Poly Haven | CC0 | unchanged since 2026-10-15 | in use (Sword Drill) |
| PumpChad head v3 | original (procedural geometry + canvas textures) | own work | `character/pumpkinHead.ts` | in use |
| Chad Motors cars | original designs (lofted superellipse body, lathe tyres, ten-spoke alloys); not a licensed or real make | own work | `scenes/world/vehicles.ts` | in use. The McLaren-style Sketchfab candidate and the Realistic Sports Car stay **unused**: both need a Sketchfab login to download, which I cannot do |
| Mixamo | animation library | needs an Adobe sign-in | **not used** (the FAQ page returned 403 and downloads need an account) | existing Quaternius UAL and chad_anims clips stay the animation sources |

### Hero car (added 2026-10-16)
| Asset | Source | Licence | Modifications | Status |
|---|---|---|---|---|
| "Realistic Sports Car" | https://sketchfab.com/3d-models/realistic-sports-car-df14049903224e5b892c53be1bdd6ae7 (downloaded by Jay from his Sketchfab account; author name to be copied from the model page into CREDITS.md) | **CC BY 4.0** — credit required | 762 K → 31.6 K triangles (meshopt simplify, welded, smooth normals recomputed), node names stripped, 2 tiny textures kept → `public/chadverse/models/sports_car_hero.glb` (2.5 MB); body and rims repainted per car, glass retinted in `vehicles.ts` | **IN USE**: podium car outside Chad Motors, the first showroom podium, and the car on the garage lift. The model's internal names show it is a real production make: it is shown unbadged by name; do not market it as one |
Original file kept in `C:/Users/zafe5/Downloads/pumpchad-assets/sketchfab/realistic_sports_car.glb`.

| Asset | Source | Licence | Modifications | Status |
|---|---|---|---|---|
| "Porsche 911 GT3 RS" (file `porsche_911_gt3_rs.glb`) | Sketchfab, downloaded by Jay from his account (model page URL and author to be added here and in CREDITS.md; the licence shown on the page must be confirmed — I did not see it, so treat as **CC BY until verified**) | to verify | Removed the collider and shadow-plane meshes and the driver figure, scaled to 4.55 m, centred, wheels on y 0, textures → WebP 1K, turned 180° so the nose points +z → `public/chadverse/models/gt3.glb` (27 K triangles, 1.2 MB); body repainted per car | **IN USE** as every car that is not the Corvette-style hero: showroom podiums 2 and 3, showroom-floor cars seen through the window, the garage's second car, kerbside cars on the avenue and cross street, the manor carriage house, the service-bay lift. This is a real production make: not marketed under its name |

| Asset | Source | Licence | Modifications | Status |
|---|---|---|---|---|
| Island Tree 01 | https://polyhaven.com/a/island_tree_01 (Poly Haven; glTF 1K via the files API) | **CC0** | 1.6 M → 19 K triangles (meshopt), normal/ARM maps dropped, 512 px WebP diffuse → `public/chadverse/models/veg/island_tree_opt.glb` (1.5 MB); instancing loader in `scenes/world/scanTrees.ts` (leaf cards alpha-tested) | **BAKED, NOT WIRED IN**: I could not judge it visually (my test browser lost its graphics context in the forest each time), so the forest still uses the procedural trees. Hook: call `scatterIslandTrees` from `world/wilds.ts` |
| Fir Tree 01 | https://polyhaven.com/a/fir_tree_01 | CC0 | not downloaded: 7.9 M triangles / ~460 MB, too big to process on this 3.5 GB machine | not used |

## New district — "Chad City" working name (2026-10-16) — asset manifest
All CC0, from Poly Haven (https://polyhaven.com/a/<name>); no attribution required, credit kept here. Downloaded as 1K JPG (diffuse, GL normal, roughness), resized to 1024 and converted to WebP by `sharp`; files in `public/chadverse/district/tex/` (3.2 MB for all five sets, one request per map).

| Texture | Used for |
|---|---|
| `asphalt_04` | the carriageway |
| `concrete_pavement_03` | the kerb-side furniture strip of the pavements |
| `large_grey_tiles` | pavements and the gym forecourt |
| `concrete_wall_007` | concrete facades, plinths, columns |
| `red_brick_03` | the brick shopfront terrace |

Not downloaded from Poly Haven: every other surface (timber cladding, the gold lattice screen, the logo, the wordmark, shop signs, the curtain-wall facade) is drawn in code. Trees use the village's own tree generator (`scenes/world/foliage.ts`); Poly Haven's Jacaranda and Island Tree 01 were baked and tested but their decimated leaf cards looked too sparse, so they are NOT used in the district (the Island Tree file stays in `models/veg/`, unused). No Sketchfab asset is used in the district.

### Car audit (2026-10-16) — what is actually displayed
| Place | Cars | File | Notes |
|---|---|---|---|
| Podium outside Chad Motors | gold hero car | `sports_car_hero.glb` | night + day checked |
| Showroom podium 1 | gold hero car (Pumpkin Phantom GT) | `sports_car_hero.glb` | |
| Showroom podiums 2 and 3 | purple and orange GT3 RS (Nightshade V8, Gourd Raptor) | `gt3.glb` | |
| Cars seen through the showroom window from Motor Row | purple + orange GT3 RS | `gt3.glb` | |
| Workshop service-bay lift (outside) | orange GT3 RS | `gt3.glb` | |
| Garage interior | gold hero car on the lift, purple GT3 RS on the floor | both | |
| Downtown kerbside (8 cars) and the manor carriage house | GT3 RS in the three paints | `gt3.glb` | **only built when the closed expansion is open** (`?expansion=open`): not visible in the shipped first release, and NOT photographed |
`sportsCar()` (the old procedural car) is still in `vehicles.ts` but nothing calls it now. Hero car re-baked 2026-10-16 at ~55 K triangles (was 31 K) because the panels looked lumpy; file 1.5 MB.
