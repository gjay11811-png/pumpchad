# Chadverse character models: asset brief

The game is built to accept proper 3D character models. Until they exist, each species uses a
stand-in built in code (`src/game/character/build.ts`). Those stand-ins are fine for playtesting,
but they don't reach cinematic quality. Real models do.

Adding a model takes **no code changes**: drop the file in `public/chadverse/models/` and fill in its
entry in `src/game/character/models.ts`. The loading pipeline is already tested end to end with a
real rigged model (the CC0 *RobotExpressive* by Quaternius, used only as a test fixture). That test
covers loading, recolouring, attachment points and animation crossfades.

## What's needed: 3 models (Pumpkin, Skeleton, Demon)

| Requirement | Spec |
|---|---|
| Format | glTF 2.0 binary (`.glb`) |
| Orientation | Y-up, facing +Z, feet at the origin, metres |
| Height | about 1.9–2.1 m including head |
| Rig | One skinned mesh on a humanoid skeleton (Mixamo-compatible bone names are ideal) |
| Polygons | ≤ 25,000 triangles per character (mobile budget) |
| Materials | ≤ 3 materials; PBR (base colour, normal, roughness/metal) |
| Textures | ≤ 2048×2048 each, ideally KTX2/Basis compressed; ≤ 4 MB total per character |
| Recolourable parts | Separate materials named **`Skin`**, **`Outfit`** and **`Glow`** (Glow = emissive: carved pumpkin face, skull eye sockets, demon eyes) |
| Attachment bones | `Head`, `LeftHand`, `RightHand` (crown/cap/horns, eyewear and the gym barbell attach here) |

### Animation clips (in the same file)
| Clip | Notes |
|---|---|
| `Idle` | breathing, weight shift, loops |
| `Walk` | in place (no root motion), loops |
| `Run` | in place, loops |
| `Flex` | double-biceps pose, the signature move |
| `Press` | overhead press: bar at shoulders → locked out → back down |
| `Wave` | greeting |

### Character direction
- **Pumpkin:** the Pumpchad mascot. Massively muscular, a ribbed pumpkin head with a carved glowing
  grin, black sunglasses and the gold PUMP CHAD chain. It must match the website art.
- **Skeleton:** athletic, clean stylised bones, glowing eye sockets, works with the futuristic-armour outfit.
- **Demon:** muscular, horns, glowing eyes, brow ridge. Menacing but fun, not horror.

Wardrobe items (hoodie, armour, cap, crown, horns, shades, visor, chain) can either be separate
meshes in each file (toggled by name) or separate `.glb` accessories parented to the attachment bones.

## Realistic ways to get them
1. **Commission a 3D artist.** Highest quality and full control. Give them this brief plus the
   website art. Expect a fee per character, often quoted in the low hundreds to the low thousands,
   depending on detail. Ask for the `.glb` with the clips above and source files.
2. **AI image-to-3D, then auto-rig.** Feed the concept art to an image-to-3D service (e.g. Meshy,
   Tripo, Rodin), then rig and animate with Mixamo or the service's own auto-rigger. Fast and cheap
   (usually a monthly subscription), but expect clean-up work on hands, faces and topology. Check
   each service's licence terms for commercial use before shipping.
3. **Kitbash CC0 bases.** Use a CC0 rigged humanoid (e.g. Quaternius) and model custom heads on top.
   Cheapest, but it needs someone comfortable in Blender.

Whichever route you choose, test the models in-game on a real iPhone before release.
