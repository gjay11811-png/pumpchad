# Chadverse — Development Audit

_Audit date: 13 October 2026 · branch audited: `chadverse-game` @ `8ebaaa3` · work continues on `chadverse-v3`_

## Branches & safety

| Branch | Purpose | State |
|---|---|---|
| `main` | Original one-page website (GitHub Pages: gjay11811-png.github.io/pumpchad) | Untouched since `e4d2095` |
| `prelaunch` | **Published** pre-launch site (Cloudflare: pumpchad.pchad.workers.dev, auto-deploys from this branch) | Separate worktree `Downloads/pumpchad-site`. **Not touched by game work.** |
| `chadverse-game` | Game development (3D Chadverse, page `/chadverse/`) | Clean, last commit `8ebaaa3` (Priority 2) |
| `chadverse-v3` | This session's work, branched from `chadverse-game` | Local only, never pushed |

No wallet integrations or token contracts exist in the game code (verified: none referenced under `src/game`). The game is a separate Vite page and is not part of the published site's build.

## Recovered priority system

The earlier sessions used this numbered plan (from the "Improve the Chadverse" brief):

| # | Priority | Status before this session |
|---|---|---|
| 1 | Interactive gym (bench, dumbbells, squat rack, punching bag; reps, XP, camera, exit) | **Complete** (`5c42a58`, `a65ae9e`) |
| 2 | Character animations (jump/land, emotes, blending, personalities, emote wheel, workout polish, movement polish) | **Complete** (`8ebaaa3`) |
| 3 | New activities (punching machine, basketball, obstacle course, arcade, local leaderboards) | Not started |
| 4 | World immersion (NPCs using equipment, interactive signs, ambient audio, collectibles) | Partly pre-existing (signs, collectibles, ambience); NPCs-on-equipment not started |

Before those: Milestone 1 (Chad Square environment), the character overhaul (Pumpkin approved; Skeleton/Demon on CC0 assets), and a QC pass (GPU leak fixes behind the old shader error).

## 1. Completed systems

- **Engine**: Three.js 0.186 renderer, bloom composer, PMREM environment, quality tiers, GPU-leak-free scene transitions, background shader pre-compilation (`compileAsync`) before scene swaps.
- **Characters**: Pumpkin / Skeleton / Demon on a real 65-bone rig (Quaternius UBC body + Ranger outfit + CC0 skull), 20 library clips (UAL1 + UAL2), procedural layers (flex, wave, press, bench, curl, squat, guard, push-ups, Chad pose, point), one-shot clips, per-species personality, lean, two-bone leg IK for squats.
- **Creator**: species, skins, gear, glow, name; drag-to-rotate (fixed in P2), zoom, pose preview; versioned validated saves.
- **Chad Square**: plaza + fountain + gold King statue, castle wall/gatehouse/4 towers (north), houses, tavern, forge, arcade (facade), Hollow House, market row, lamps, string lights, vegetation, fog, moon, stars, crowd NPCs (12), golden seeds (5), rune + stash secret, suspicious pumpkin, dialogue, achievements.
- **Movement**: WASD / joystick, Shift / far-stick run, Space / button jump, drag-to-look camera with occlusion handling, emote wheel (Q / 1-8).
- **Chad Gym**: walkable hall, 4 tempo stations + Chad Press timing game, strength stat, per-station reps, XP, Full Circuit / Century achievements.
- **Tests**: e2e, env, character, species, gym, anim, leak (3), creator, entrance, gallery, interact, tour — all green at `8ebaaa3`.

## 2. Partially completed

- **Progression**: XP + level + strength + reps exist; no stamina, no profile screen, no level-up moment, workout XP is farmable without limit.
- **Arcade building**: facade + "opening soon" sign only.
- **Castle**: walls, gatehouse and towers only — no keep, no visible landmark from the south half of town.
- **Town edge**: a 2.2 m perimeter wall; the south entrance arch leads nowhere; no view beyond the town.

## 3. Broken / weak (found during the audit)

- Nothing broken in the test suites.
- Walls are too low to read as a fortified kingdom; the world ends in fog in every direction (no vista).
- Mobile has no explicit sprint button (sprint = push the stick to the edge).

## 4. Technical limitations

- **No Blender** on this machine and no internet asset pipeline beyond what's already downloaded → character work must stay within code + existing CC0 assets (Quaternius UBC/UAL/Outfits, OpenGameArt skull).
- **3.5 GB RAM** total with ~300 MB free during development → one heavy job (build or headless browser) at a time.
- **Headless test browser renders in software** → frame-time numbers are relative, not real-device numbers.
- Fog (`FogExp2` 0.024) hides everything past ~40 m; camera far plane 220 m.
- Pumpkin Chad's look was **approved** by the owner; changes must be reversible.

## 5. Highest-priority improvements (this session)

1. Chad Kingdom: proper crenellated walls + watchtowers + south gate, a viewpoint, the road out, terrain falling away into a valley.
2. Distant Chad City skyline (real 3D, layered, lit windows, casino landmark) + "CHAD CITY — COMING SOON".
3. Castle keep as a landmark visible across town, with a style switch for the community vote (Gothic / Fantasy).
4. Pumpkin Chad upgrade (head detail, "PUMP CHAD" chain pendant, materials) behind a reversible switch.
5. Gym: deadlift, pull-ups, treadmill (real poses, not placeholders).
6. Progression: stamina, profile screen, level-up notification, anti-farm limits.
7. One complete new mini-game.
8. Mobile sprint button; tests; documentation.
