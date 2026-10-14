# Chadverse master plan: the full spec, mapped to the real project

Branch: `chadverse-dark-fantasy`, started from `chadverse-chad-city`. Rollback point: tag `checkpoint/pre-master-spec`.
Nothing is pushed or deployed. To test on a phone over home Wi-Fi: http://192.168.1.165:5180/chadverse/

## What exists today (inspected 2026-10-14)
- **Engine:** Three.js scenes for the World (Chad City), the Gym and the Showroom. Static geometry is batched. There are quality tiers (low, medium and high), bloom, and day-sky shading in `daylight.ts`.
- **World:** the core square plus south, east and west districts, the canal and bridges, Citadel facade, Arcade Street (shop facades), garden, overlook and Chad Rides teaser.
- **Gym (complete, protected):**
  - bench, squat, deadlift, pull-up and treadmill
  - Chad Press timing game, strength and stamina, daily fatigue, records
- **Progression:** XP, levels (`progression.ts`), achievements, discoveries, Discover Chad City (5 steps) and 6 hidden pumpkins.
- **Minigames:** Pumpkin Rush (timed collect) and coin toss (no farming: rewards pay once).
- **Characters:**
  - Pumpkin, Skeleton and Demon species, with the creator and wardrobe
  - About 26 NPCs (residents and walkers) with dialogue
- **Save:** `localStorage`, versioned and sanitised (`save.ts`). **There is no backend.** Progress lives in one browser on one device.

## Status key
- ✅ = done and tested
- 🔨 = this pass
- 📋 = planned for a later phase, buildable without a backend
- 🌐 = needs a backend/server first (accounts, shared data); it won't be faked

| # | Requirement | Status | Notes |
|---|---|---|---|
| 1 | Cinematic dark fantasy look | ✅ first pass | Night is the default: midnight-blue sky, big cratered moon + halo, twinkling stars, drifting moonlit clouds, violet horizon haze + fog, cool moon key light, warm lamplit windows, glowing sign letters, embers, fireflies, violet magic motes, a light pool following the player + warm ground glow under every lamp. `?sky=day` keeps daylight. |
| 2 | Distant Gothic city | ✅ first pass | Modern skyline replaced by `gothicCity.ts`: terraced townhouses with chimneys + smoke, Gothic needle-spire towers, 3 castles + the Great Citadel, cathedral with a lit clock face, giant PUMP CHAD banners, hundreds of lit windows, street lanterns, moving lantern lights, hanging light strings, drifting mist bands. Proper LOD tiers + walkable streets: later. |
| 3 | Bridge fences across the walkway | ✅ | Root cause: canal railing code assumed bridges were sorted west→east; one railing ran across Chad Bridge. Sorted; collisions were already correct. |
| 4 | GATES CLOSED sign + 2 bushes | ✅ | Sign moved off the house door to the foot of the citadel steps (clear of the lamp + path); faceted ball topiaries → leafy shrubs in low stone planters. |
| 5 | Pathway leading nowhere | ✅ | The Hollow House track ran into the yard fence and the side wall. Re-routed to the yard gate + a path to the front door; the broken cart moved off it. |
| 6 | Castle pumpkin decorations | ✅ | Low-res cloth banners (floating above the battlements, clipped by a lamp arm) → hi-res heraldic swallow-tail banners with a jack-o'-lantern crest, hung from iron poles; carved 3D jack-o'-lantern sconces on iron brackets with warm light along the castle walls. |
| 7 | CHAD sign | ✅ | Timber beam + flat board → Gothic stone CHAD SQUARE gate: piers with colonnettes, niches with carved lit pumpkins, crocketed pinnacles, pointed arch, polished gold letters (glow at night), pumpkin crest pediment, hanging lantern, uplights. |
| 8 | Windows show solid wall + glitch pass | ✅ windows / 🔨 audit ongoing | Shop glazing + doors were buried inside a solid box. Ground floors rebuilt with real 1.3 m display bays (platform, goods, lit interior, warm strip light) + real 0.35 m door recesses. Wider glitch audit continues. |
| 9 | Bigger village; every house enterable, unique interiors | ✅ interiors / 📋 more streets | Every existing village building is now enterable — 12 interiors, each with its own layout, wallpaper, floor, lighting and things to inspect: Steward Barnaby, Widow Marrow (witch), Hazel (gardener), Pumbledore (wizard) — all with stairs + lofts — Old Finn, Ivy's lantern workshop, the Flexing Gourd tavern (open again, upstairs rooms), the haunted Hollow House (first Curse clue), and the four Arcade Street shops. New streets of new houses: next. |
| 10 | Districts | 🔨 1 of 6 built | **Haunted Quarter ✅** — new land west of the garden through an iron gate: two crooked lanes, a square with a weeping-statue fountain and a dead oak, a graveyard + crypt, green ghost lamps, ghost wisps, Grim the gravedigger + a mourner; 7 distinct haunted houses + the crypt, all enterable (Crooked House, Apothecary's Rest, Ravenswood Manor, Dollmaker, Widow's Watch, Lanternless House, Grim's Cottage, Mortimer's Crypt) with Curse clues. Still to build: Castle District interior, Festival Grounds, Chadville Estates, Enchanted Forest, Moonlight Lake. |
| 11 | Replace outdated NPC models | ✅ first pass | 22 NPCs are now villagers: real human bodies, heads, hair, beards, outfits (CC0 Quaternius, same rig as the animation library), tinted per person, with role pieces (witch / wizard hats, guard helmets + lanterns, caps, bonnets, aprons, baskets, brooms). Coach Gourdon and b4s keep their own looks. Routines with destinations: later. |
| 12 | Curse of the Chadverse story | 📋 Phase 4 | Quest graph, relic collection, guiding NPCs. |
| 13 | Chad XP + levels | ✅ partly | XP and levels exist. Still to come: XP for quests and minigames, level-gated unlocks, a progress screen. |
| 14 | Chad Coins | ✅ done (1 coin / 2 XP, save v2) | In-game only. Never linked to $PCHAD and no real-money promises. |
| 15 | Chadville Estates housing + building | 📋 Phase 5 | Plots, a snap/rotate/preview builder, and upgrades saved locally. Competitions and voting are 🌐. |
| 16 | Playable minigames | 📋 Phases 4–5 | Pumpkin Rush and coin toss are live. Racing, target, ghost hunt, escape, parkour, maze, dungeon, fishing, farming, treasure hunts and gym challenges come later, each fully playable or not shipped. |
| 17 | Daily/weekly competitions + leaderboards | 📋 local → 🌐 | Personal-best boards can be local. Shared boards need a server with anti-cheat. |
| 18 | Dynamic world events | 📋 Phase 4 | Midnight Pumpkin Hunt, Ghost Invasion, Festival, Thunderstorm. |
| 19 | Pets/companions | 📋 Phase 5 | |
| 20 | Creature collection + journal | 📋 Phase 5 | |
| 21 | Building restoration | 📋 Phase 5 | |
| 22 | Order of the Golden Pumpkin | 📋 Phase 5 | Tied to the story. |
| 23 | Legacy profile + home trophies | 📋 Phases 4–5 | |
| 24 | Shops + economy | 📋 Phase 4 | Shop interiors come with Phase 3. Trading is 🌐. |
| 25 | Map + quest journal | 📋 Phase 4 | |
| 26 | First-time experience | ✅ partly | Flyover, greeter and objectives exist. Still to come: first quest, coin reward and castle clue. |
| 27 | Sound + per-district music | ✅ partly → 📋 | Ambience exists, with volume sliders in settings. |
| 28 | Reliable saves | ✅ local / 🌐 cross-device | `localStorage` survives reloads. Cross-device or permanent saves need accounts and a database (e.g. Supabase). This is a decision for you. |
| 29 | Multiplayer-ready | 🌐 | Data will be shaped so it can sync later. Nothing will be claimed to work until it is networked and tested. |
| 30 | Performance | ongoing | Every stage is measured; the baseline is about 21 ms/frame headless with a 10.4 s world load. |

## Rules for every stage
- Keep the gym, character systems, saves, `?pumpkin=classic` and `?castle=` working.
- Run the full regression suite after each phase.
- No fake buttons or decorative minigames.
- Never deploy or push without approval.

## Decisions needed from Jay
1. **Backend for saves, leaderboards and multiplayer:** a yes/no and which provider. Until then, everything is single-player and saved on the device.
2. **Night look approval** once Phase 2 shots are ready, before any further world-building.

---

## Progress checklist (updated 2026-10-14) — full requirement list: `docs/REQUIREMENTS.md`

| Area | Status | Where | Verified |
|---|---|---|---|
| Phase 1 fixes (bridge, sign, bushes, path, castle decor, CHAD sign, windows) | COMPLETE | various world/*.ts | screenshots + tests |
| Night look + Gothic distant city | COMPLETE (first pass) | daylight.ts, gothicCity.ts | gameplay shots |
| Enterable houses | COMPLETE for every village building (22) | Interior.ts, interiors/* | interior-test |
| Villager NPCs | PARTIAL (looks done; routines missing) | character/villager.ts, npcs.ts | shots, perf ~22 ms |
| Haunted Quarter | PARTIAL (built; restoration/passages/story encounters missing) | hauntedQuarter.ts, interiors/haunted.ts | interior-test |
| Mobile stuck movement + portrait challenges | COMPLETE (simulated) | input.ts, Joystick.tsx, Challenges.tsx | mobile-input-test 51/51 (emulated iPhone 13, NOT a real phone) |
| Art direction: shopping street style | PARTIAL | ornament.ts (signs, ivy, wisteria, window boxes), architecture.ts | Motor Row + Arcade Street shots |
| CHAD PETS / CHAD MOTORS / CHAD FITS | PARTIAL: CHAD FITS buying (Vera) + CHAD PETS adoption (Patches) work; Motors talk-only until driving | motorRow.ts, interiors/shops.ts, vehicles.ts, ui/Shop.tsx | interior-test, shop-test, pet-test |
| Map doubling | PARTIAL: ~8,500 → ~11,200 m² (1.3×); need ~17,000 | city.ts DISTRICTS | Monte-Carlo over walkable union, canal water excluded |
| Coins + inventory/ownership (save v2 migration, HUD balance, never negative, unowned colours fall back) | DONE | economy.ts, save.ts, GameApp setSave/buy/wear | shop-test (16 checks) |
| Companions: cat/ghost/bat/pumpkin; adopt, follow at your side (world + interiors), catch up, send home/call (pause menu), saved | DONE (not in the gym yet; creature journal still missing) | character/pet.ts, economy.ts, World/Interior setPet | pet-test (16 checks) + screenshots |
| Quests, activities, housing, events, map/journal | MISSING | — | — |
| Online leaderboards / multiplayer / account saves | BLOCKED: needs backend + identity (decision for Jay) | — | — |

**Area method:** sample the union of the core circle (r 34.5) + district rectangles in `city.ts`, minus canal water; buildings/props are not subtracted (they're small vs. the total).

**Known issues:** this laptop (3.5 GB RAM) loses the WebGL context in long or high-quality test runs, so most visual checks are at low/medium quality; long e2e runs time out. Chad Motors cars were reshaped after a first boxy pass — check in person.

**Done:** opening adventure — Goldie (gateway) → relight 3 Guardian Lanterns (Chad Bridge, Chad Square, Citadel forecourt; gold markers) → Golden Sigil at the Citadel doors (+50 XP, +50 coins, points to the sealed castle) → existing chain (Coach Gourdon). Saved per step, never repeats. quest-test 25/25.
**Done:** Map & journal (M key / HUD map button / pause menu): map drawn from city.ts layout, your position + facing, tracked objective (mirrors the HUD), filters (places / shops / quest), fast travel to places reached on foot, journal of quests + collections with steps. map-test 15/15; e2e 57/57.
**Done:** Curse chapter 2 — Whispers in the Wood: after the sigil (and the Coach/gym intro), Grim → the Elder Oak (+20 XP) → the moonstone oath (+60 XP, +60 coins), steps only in order, saved, no repeat; journal + map tracking. chapter2-test 15/15; quest 25/25; map 16/16; mobile-input 51/51; e2e 55/57 (2 = WebGL context lost while a typecheck ran out of memory alongside).
**Done:** Fishing at Moonlight Lake (pier head): aim → wait → strike → reel-tension fight, 6 species (rarer further out), 5 casts/round, score + record + XP (daily fatigue) + fish log in the journal; Fish again / Esc. Tuned by simulation (common ~100% landed, Lantern Eel ~97%, Old Gnarly ~11% for a quick player; careless holding always snaps). fishing-test 14/14 (an automated angler plays a full round).
**Done:** GPU context-loss recovery — a clear 'graphics took a nap' screen with Reload (progress is saved on every change); if the browser restores the context the game rebuilds post-processing and carries on (verified visually). gfx-lost-test 8/8. e2e: 55/57 with the only failure being a context loss on this 3.5 GB machine.
**Next task:** Chadville Estates — buy a plot with Chad Coins and place/rotate/remove modular pieces (validated, saved).
**Map:** walkable area 17,568 m² (Monte Carlo over the walkable union, canal + lake water excluded) = 2.07× the original Chad City (~8,500 m²). New: Enchanted Forest (3,091 m², via the Haunted Quarter) + Moonlight Lake (3,208 m², via Motor Row). wilds-test passes; e2e/city-test re-run pending (machine memory).
**Testing note:** this machine (~0.6 GB free RAM) loses the WebGL context during long runs; shop-test treats that as an environment warning. Use Q=low.
