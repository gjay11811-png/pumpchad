# Chad Kingdom — Starting Area V4: Visual Quality and Interactivity Overhaul

**Branch:** `chadverse-v4-kingdom` (local only; nothing pushed, nothing deployed)
**Restore point:** tag `checkpoint/pre-kingdom-v4` (commit `0257aa1`)
**Untouched:** the `prelaunch` worktree / live marketing site, wallets, token contracts, secrets, credentials. No paid assets or packages; everything is procedural (Three.js geometry and canvas textures).

## How to run it locally

```
cd C:\Users\zafe5\Downloads\pumpchad
npm run build
npx vite preview --port 4318 --strictPort
```

Open **http://localhost:4318/chadverse/**. (`npm run dev` also works for live editing.)

Screenshots below are in `docs/chadverse-v4/`. Files named `cmp-*.jpg` show **before (left)** and **after (right)** from the same camera position. The "before" images were taken from a build of the `checkpoint/pre-kingdom-v4` tag, not reconstructed.

---

## Status summary

| # | Area | Status |
|---|---|---|
| 1 | Premium fountain (water, audio, collision) | **COMPLETE** |
| 2 | Plaza flooring and stone paths | **PARTIAL**: plaza fully rebuilt; street cobbles unchanged |
| 3 | Market stalls (3–4 variants) | **COMPLETE**, with one note about the notice board |
| 4 | Organic pumpkin rework | **COMPLETE** |
| 5A | Fountain discovery | **COMPLETE** |
| 5B | Notice board panel | **COMPLETE** |
| 5C | Sittable benches | **COMPLETE** |
| 5D | Special pumpkins (no unlimited XP) | **COMPLETE** |
| 5E | Village guide NPC | **COMPLETE** |
| 5F | Optional timing challenge | **COMPLETE** |
| 5G | Environmental prompts (castle gate, lookout, city sign) | **COMPLETE** |
| 6 | "Sir Hodl" → **b4s**, leg clipping fixed | **COMPLETE** |
| 7 | Atmosphere: lanterns, lighting, wayfinding | **PARTIAL**: lanterns and wayfinding done; building fronts and global lighting not reworked |
| 8 | Player experience at spawn | **COMPLETE** |
| 9 | Performance and stability | **PARTIAL**: no leaks and idle cost flat, but world load is about 1–3 s slower (see §9) |
| 10 | Process and reporting | **COMPLETE** |

---

## 1. Fountain: COMPLETE

`src/game/scenes/world/fountain.ts` (new) replaces the old fountain.

- **Stone:**
  - A carved-stone texture with a matching bump map (mottling, grain, veins, moss).
  - Two bevelled steps and a moulded basin.
  - A gold inscription band reading "MARKETS DUMP · CHADS PUMP".
  - A fluted centre column, a second-tier bowl, and the King statue on top.
- **Water:**
  - The water surface scrolls two normal-map layers against each other in a custom shader, so it reads as moving water rather than glass.
  - A translucent curtain falls from the upper bowl.
  - Eight arcing jets run from gold spouts on the rim.
  - Ripple rings expand where each jet lands and round the foot of the curtain, plus 72 splash droplets.
- **Audio:** a filtered, flickering noise "splash" layer whose volume rises as you approach. It follows the ambience volume and mute settings.
- **Collision:** a 5.45 m circle, so the player can't walk into the basin. The e2e statue-collision check passes.

Screenshots: `cmp-fountain-front.jpg`, `cmp-fountain-close.jpg`, `after-fountain-side.jpg`.

## 2. Plaza flooring and paths: PARTIAL

- **Plaza:** fully rebuilt (`textures.ts`, `plaza()`):
  - Radial courses of individually shaped stones, with jittered outlines and some chipped corners.
  - A darker basalt accent ring every sixth course.
  - Worn edges, grain, moss and dirt toward the rim, and darker "wet" patches near the fountain.
  - A bevel bump map.
  - Screenshot: `cmp-floor-plaza.jpg`.
- **Not done:** the cobbled streets leading off the plaza use the pre-existing texture, unchanged (`after-floor-road.jpg`).

## 3. Market stalls: COMPLETE (one note)

`src/game/scenes/world/market.ts` (new) contains one sturdy stall build:
- Square posts with knee braces and a planked counter.
- A cloth awning with folds and sag, and a scalloped valance.
- Rope ties, a hanging name sign and an iron lantern.

On top of that build there are four dressed variants:

| Brief asked for | What's there |
|---|---|
| Cosmetic-preview stall (no fake purchases) | **Wardrobe** stall: mannequin, cloth bolts, mirror. It says plainly that nothing is for sale yet, and its only option, "Open the wardrobe", opens the existing character wardrobe. The test checks there is no buy or price wording. |
| Village guide stall | **Guide** stall with a parchment kingdom map, staffed by **Pip** (new NPC). |
| Pumpkin Rush stand | The existing Rush cart, now heaped with organic pumpkins. Two **produce** stalls (crates, baskets, pumpkins) frame Market Row. |
| Notice-board stall | **Note:** the notice board is a standalone board by the spawn road, not a stall. It now opens a proper panel (5B). |

The fifth stall is an **apothecary** (glowing bottles and a cauldron), dressing for the existing Madame Marrowpot.

Screenshots: `cmp-market-stalls.jpg`, `after-market-row.jpg`.

## 4. Organic pumpkins: COMPLETE

`src/game/scenes/world/pumpkins.ts` (new). A `PumpkinBuilder` merges every pumpkin in the kingdom into three meshes (plain, carved, stems).

- **Bodies:** four shape variants (rib count, squash, depth) with lumps, a top dimple and vertex-colour variation, in four tints (orange, deep, pale, green).
- **Stems:** curved and ridged.
- **Carved faces:** four expressions (grin, angry, surprised, wink) from one canvas atlas. They glow and flicker together.
- **Where they appear:**
  - Natural clusters at 10 spots.
  - Doorstep pumpkins at houses.
  - Lanterns on the gate arch.
  - The Rush cart and the stall goods.
  - The "suspicious pumpkin", which keeps its own object so its squash-and-hop animation still works.
- **Pumpkin Rush is separate and preserved:** its gameplay pumpkins are untouched, and the rush suite passes.

Screenshot: `after-bench-npc-side.jpg` (clusters and the suspicious pumpkin).

## 5. Interactions

Every interaction has:
- a proximity prompt
- keyboard (E) and touch support
- Escape to close
- a cooldown after closing so it doesn't immediately re-fire
- a guard so only one dialogue or panel is open at a time

These are verified by the new `scripts/kingdom-interact-test.mjs`, which runs **71 checks** in a real browser.

- **A. Fountain discovery: COMPLETE.** "Read the fountain plaque" adds a lore line. The first time it records `lore_fountain` and shows a "Lore discovered" toast. A second read gives no XP; the test checks this.
- **B. Notice board: COMPLETE.** A panel (`NoticeBoardMenu`) in two sections:
  - **"What's on"** lists only features that exist, with live stats: Chad Gym (reps logged), Pumpkin Rush (best score), the Lookout (visited or not), golden seeds n/5, talking pumpkins n/3, and the residents.
  - **"Coming soon"** lists Castle, Chad City, Pump Arcade and Chad Casino. The casino entry says "Free-play only… No real money, ever."
  - The test checks that nothing unreleased appears under "What's on". Screenshot: `int-board.jpg`.
- **C. Benches: COMPLETE.**
  - Three of the four plaza benches are now sittable ("Sit by the fountain"); b4s occupies the fourth, which correctly shows no sit prompt.
  - The lookout benches still work.
  - Sitting and standing use the real sit clips. Any movement key stands you up, so you can't get stuck.
  - Screenshot: `int-plaza-bench.jpg`.
- **D. Special pumpkins: COMPLETE.** Three **talking pumpkins** with sparkles until found: Sage Gourd by the tavern, Grumpy Gourd at the end of Market Row, Tiny Gourd on the castle steps.
  - Each is discovered once, with a toast "Talking pumpkin n/3", and finding all three unlocks **Gourd Council** (+25 XP, once).
  - Talking to one again gives no XP; the test checks this.
  - The Grumpy Gourd was first placed on top of golden seed 3 and stole its prompt. The test caught this and the gourd was moved about 3 m.
- **E. Village guide: COMPLETE.** **Pip** stands at the guide stall and gives directions to the gym, Rush, the lookout and the castle.
- **F. Timing challenge: COMPLETE.**
  - The wishing well now offers a **coin toss**: stop a swinging marker over the bucket, three coins per round.
  - It reuses the Chad Press timing logic. Space, E, click or tap tosses; Escape leaves at any time.
  - **No farming:** only the first ever hit pays out (achievement "Bucket Shot", +25 XP), and replays pay nothing. The test aims shots deliberately to prove a hit pays exactly once.
  - No money involved ("pocket lint" coins, "no real money" on screen). Screenshot: `int-cointoss.jpg`.
- **G. Environmental prompts: COMPLETE.** "Knock on the castle gate", "Read the Chad City sign" and "Take in the view" at the lookout (a one-time discovery) all open, close and are tested.

## 6. b4s: COMPLETE

- **Name:** every visible occurrence of "Sir Hodl" is now **b4s**: the prompt "Talk to b4s", the dialogue speaker, and the notice board.
  - The dialogue header normally uppercases speaker names; it now keeps all-lowercase names as written, so it shows exactly "b4s".
  - The internal id stays `hodl` so existing saves and the Socialite achievement keep working.
  - The test checks that "Sir Hodl" appears nowhere on screen.
- **Leg clipping:** b4s now **sits** on his plaza bench, facing the fountain, using the same seat anchor the player's sit system uses. His legs no longer go through the bench.
  - Screenshots: `after-bench-npc-side.jpg`, `after-bench-npc-front.jpg`, `after-bench-npc-back.jpg`, `int-b4s.jpg`.

## 7. Atmosphere: PARTIAL

- **Done:**
  - **Lamp-post lanterns:** the old solid iron box hid the glow and read as a dark cube from above. They are now open-frame lanterns (corner bars, base plate, pyramid cap, finial, scroll bracket) around a glowing glass core. Screenshot: `cmp-lamp-lantern.jpg`.
  - **Stall lanterns,** carved-pumpkin glow and flicker, and fountain braziers and water glow.
  - **Wayfinding:** a carved timber **fingerpost** by the spawn road with five arms, each pointing at its real destination and readable from both sides: FOUNTAIN · CASTLE, MARKET ROW, CHAD GYM, PUMPKIN RUSH, LOOKOUT · CITY. Screenshots: `after-wayfinding-post.jpg`, `cmp-spawn.jpg`.
- **Not done:** building fronts were not re-detailed, and global lighting and fog were left as tuned in v3. No new real-time lights were added.

## 8. Spawn experience: COMPLETE

The first view from spawn (`cmp-spawn.jpg`, `cmp-mobile-spawn.jpg`) now shows:
- the signpost telling you where everything is
- the new fountain as the focal point
- carved pumpkins along the road
- the notice board

All of it is readable at phone size. The existing objective ("Find Coach Gourdon outside Chad Gym") is unchanged.

## 9. Performance and stability: PARTIAL

Measured in headless Chromium with software rendering on this machine (3.5 GB RAM), so the numbers are relative, not real-device figures.

- **Leaks: none.**
  - The scene-switch leak suite is flat over 5 world ↔ gym cycles (world holds at 193 geometries, 150 textures, 87 programs).
  - Character rebuilds add nothing, and the creator leak suite is flat.
- **Idle frame cost:** about 23 ms per frame, against about 21 ms (v3) and about 25 ms (pre-polish). That is within noise.
- **Draw calls:** all new static scenery is merged. Every pumpkin in the kingdom is three draw calls; stalls and signs are batched by material.
- **World load is slower: about 1–3 s added on this machine.** That is the cost of clicking "Enter Chad Square" until the world is ready.
  - Old build: about 4.5 s warm, 10.2 s cold.
  - v4: 3.9–7.3 s warm, 13–14 s cold.
  - Profiling (`scripts/load-profile.mjs`, `scripts/program-census.mjs`) shows this is **shader compilation**: v4 compiles 72 programs against 66 before. Canvas texture generation is only about 0.4 s.
  - Two needless programs were removed: the water curtain no longer draws in two passes, and the wardrobe cloth reuses the awning material.
  - The rest come from the new pumpkin, ripple, sign and particle materials. On a real GPU each program compiles far faster than in this software renderer, but this was **not measured on a phone**.
- **Frame rate just after load (software renderer):** about 29–31 fps for v4 against 33–38 for the old build.
- **Test adjustment, disclosed:** the e2e suite was the only one waiting just 15 s for the world (every other suite waits 60 s). Even the old build's cold load took 10.2 s here, so its world-entry wait was raised to 60 s to match.
  - On its first full run, e2e then failed two movement checks (1.31 m moved where 1.5 m is required) because of lower frame rate under load.
  - Run on its own, the same movement passes (1.73 m), and the e2e re-run passed 57/57.
  - I'm reporting this as a borderline, timing-sensitive test, not hiding it.

## 10. Build and test results

`npm run build` (`tsc -b && vite build`) builds with no TypeScript errors.

Regression run against the **final build** (served by `vite preview`, headless Chromium, one suite at a time):

| Suite | Result |
|---|---|
| **kingdom-interact** (new): every v4 interaction, no repeat XP, no overlap, Escape closes, b4s naming, coin toss | ✅ 71/71 |
| env (3 quality tiers: interactions, seeds, NPCs, camera stress) | ✅ 31/31 |
| e2e (desktop and iPhone journey) | ✅ 57/57 (see §9 for the earlier flaky run) |
| character / species | ✅ 69/69 · ✅ 69/69 |
| gym × Pumpkin / Skeleton / Demon (7 stations + Chad Press) | ✅ 89/89 × 3 |
| anim × Pumpkin / Skeleton / Demon / mobile | ✅ 47 × 3, 41/41 |
| move × Pumpkin / Skeleton / Demon | ✅ 27/27 × 3 |
| sit, rush, progression, mobile | ✅ 11, 31, 24, 25 |
| leak / leak-scenes / leak-species, creator-species | ✅ flat / flat (world 190 geometries, 151 textures, 85 programs every cycle) / 0 per rebuild / no errors |
| perf-idle | ✅ 22.6 ms average frame (worst 37 ms) |

**URL options:** `?pumpkin=classic`, `?castle=gothic` and `?castle=fantasy` all load into the world on the final build. This was a load check only; their code wasn't changed in v4.

**Earlier run, disclosed:** on the build before the last fixes, the Skeleton animation suite once measured +2 geometries after a round trip (the check allows +1). The dedicated leak suites were flat, and on the final build every animation suite passes the check.

---

## Files changed (since `checkpoint/pre-kingdom-v4`)

**New:**
- `src/game/scenes/world/fountain.ts`: the fountain.
- `src/game/scenes/world/market.ts`: market stalls.
- `src/game/scenes/world/pumpkins.ts`: organic pumpkin builder and carved-face atlas.
- `src/game/scenes/world/wayfinding.ts`: the spawn fingerpost.
- `scripts/kingdom-interact-test.mjs`: 71-check interaction test.
- `scripts/kingdom-shots.mjs`: before/after screenshot tour.
- `scripts/load-time.mjs`, `scripts/load-profile.mjs`, `scripts/program-census.mjs`: world-load timing, profiling and shader-program diffing.
- `docs/chadverse-v4/`: screenshots.

**Modified:**
- `src/game/scenes/World.ts`:
  - The fountain swap and water audio level.
  - Seats, pumpkin patches, talking gourds, the fingerpost and the new stalls.
  - New interactables (wardrobe, lookout, gourds) and the suspicious pumpkin model.
- `src/game/scenes/world/buildings.ts`: exports the placement helper; doorstep and arch pumpkins.
- `src/game/scenes/world/props.ts`: shared plaza-bench seat anchors and the new lamp lanterns.
- `src/game/scenes/world/npcs.ts`: b4s seated on his bench; Pip added.
- `src/game/scenes/world/textures.ts`: new plaza texture.
- `src/game/scenes/world/kit.ts`: plaza material.
- `src/game/audio.ts`: fountain water sound layer.
- `src/game/dialogue.ts`:
  - b4s, Pip, the gourds and the lookout.
  - Fountain lore, the wardrobe option and the coin-toss option.
- `src/game/save.ts`: the Gourd Council and Bucket Shot achievements.
- `src/game/GameApp.tsx`: notice-board panel, coin-toss panel, discoveries and toasts, and the wardrobe hand-off.
- `src/game/ui/Menus.tsx`: `NoticeBoardMenu` and `WellToss`.
- `src/game/ui/DialoguePanel.tsx`: lowercase names keep their case.
- `scripts/e2e.mjs`: world-entry wait 15 s → 60 s (see §9).

**Local commits on `chadverse-v4-kingdom`:**
- `216e8d0`: fountain, plaza, stalls, pumpkins, b4s, board, gourds, guide.
- `0dc87b1`: lanterns, fingerpost.
- `b24acd9`: interaction tests, gourd move, b4s lowercase.
- `ac64a84`: coin toss, fewer shader programs, load tooling.
- `124cd20`: suspicious pumpkin model.
- Plus the commit that adds this report and the screenshots.

## Known issues and next steps

- **Street cobbles** off the plaza still use the old texture (§2).
- **World load time** is about 1–3 s longer in software rendering. A good next step is timing it on a real phone, and if needed warming the new shaders during the title screen.
- **Building fronts and global lighting** were not reworked (§7).
- **Camera through awnings:** the follow camera can pass through stall awnings when you stand right behind a stall. This is a pre-existing camera-collision limit; awnings aren't camera blockers.
