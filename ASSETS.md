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

Visual references on disk: `~\Downloads\pumpchadrt-source-pumpchad.png` (PumpChad's original artwork, 2.2 MB) · `publicrt\pumpchad-hero-1254.webp`, `pumpchad-hero-760.webp`, `pumpchad-logo.webp`, `publicrt\chadverse–05-*.webp` (Chadverse art) · `~\Downloads\Pumpkin King Crypto Throne.png` · our own game captures in `~\Downloads\pumpchad\docs\*`, `~\Downloads\pumpchad-review\*`, `~\Downloads\pumpchad-teasers\*`, `~\Desktop\Chadverse-Overnight-Review\*`.
NOT on disk: the "World Upgrade Pack" reference images (no zip or extracted folder found anywhere under the user profile), any gym / arcade / workshop / mansion / haunted-house / parkour / housing reference photos, the cjmitchell mansion, the sports car, the pistol.

Usable 3D (all Quaternius, CC0, in `~\Downloads\pumpchad-assetsaw\`, already integrated where noted): Universal Base Characters + Modular Character Outfits (Fantasy) → in game as `public\chadverse\models\chad_body/ranger/villager_*.glb`; Universal Animation Library 1 + 2 → `chad_anims*.glb`; skull OBJ → `chad_skull.glb`; **Bestiary – Dungeon Monsters Kit** (`bestiary-dungeon-monsters-kit.zip`, 46 MB, NOT extracted, NOT integrated; contains e.g. Imp.glb 9 MB, Puglin.glb 7.7 MB — too heavy for mobile as-is, would need decimating; candidate enemies for the haunted combat activity).
