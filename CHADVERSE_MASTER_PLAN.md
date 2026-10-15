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
| 12 | Curse of the Chadverse story | ✅ ch.1–2 / 📋 ch.3+ | Quest graph, relic collection, guiding NPCs. |
| 13 | Chad XP + levels | ✅ partly | XP and levels exist. Still to come: XP for quests and minigames, level-gated unlocks, a progress screen. |
| 14 | Chad Coins | ✅ done (1 coin / 2 XP, save v2) | In-game only. Never linked to $PCHAD and no real-money promises. |
| 15 | Chadville Estates housing + building | ✅ plots, builder, cottage interior | Plots, a snap/rotate/preview builder, and upgrades saved locally. Competitions and voting are 🌐. |
| 16 | Playable minigames | ✅ Rush, coin toss, fishing, Square Time Trial (on foot, ordered gates, best time kept) / 📋 rest (vehicle racing waits on reliable driving) | Pumpkin Rush and coin toss are live. Racing, target, ghost hunt, escape, parkour, maze, dungeon, fishing, farming, treasure hunts and gym challenges come later, each fully playable or not shipped. |
| 17 | Daily/weekly competitions + leaderboards | 📋 local → 🌐 | Personal-best boards can be local. Shared boards need a server with anti-cheat. |
| 18 | Dynamic world events | ✅ Built (local, solo) | Events Board in Chad Square: Midnight Pumpkin Hunt, Ghost Invasion (3 lives), Harvest Festival (5 lanterns), Thunderstorm (crystals + telegraphed lightning). Records, daily-fatigue XP, 4 achievements. Shared/online events and voting stay BLOCKED (need a backend). Not yet time-of-day/ambient-triggered: started from the board only. |
| 19 | Pets/companions | ✅ | |
| 20 | Creature collection + journal | ✅ fish log / 📋 pets journal | |
| 21 | Building restoration | 📋 Phase 5 | |
| 22 | Order of the Golden Pumpkin | 📋 Phase 5 | Tied to the story. |
| 23 | Legacy profile + home trophies | ✅ home trophy wall / 📋 legacy | |
| 24 | Shops + economy | ✅ coins, Fits, Pets / 📋 Motors, furniture, café | Shop interiors come with Phase 3. Trading is 🌐. |
| 25 | Map + quest journal | ✅ | |
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
| Map doubling | DONE: ~8,500 → 18,642 m² (2.19×) | city.ts DISTRICTS | Monte-Carlo over walkable union, canal water excluded |
| Coins + inventory/ownership (save v2 migration, HUD balance, never negative, unowned colours fall back) | DONE | economy.ts, save.ts, GameApp setSave/buy/wear | shop-test (16 checks) |
| Companions: cat/ghost/bat/pumpkin; adopt, follow at your side (world + interiors), catch up, send home/call (pause menu), saved | DONE (not in the gym yet; creature journal still missing) | character/pet.ts, economy.ts, World/Interior setPet | pet-test (16 checks) + screenshots |
| Quests (ch.1–2), fishing, housing, map/journal | DONE | atlas.ts, estates.ts, fishing.ts | quest/chapter2/fishing/estates/home/map tests |
| World events, more activities, NPC routines, Castle District, restoration | MISSING | — | — |
| Online leaderboards / multiplayer / account saves | BLOCKED: needs backend + identity (decision for Jay) | — | — |

**Area method:** sample the union of the core circle (r 34.5) + district rectangles in `city.ts`, minus canal water; buildings/props are not subtracted (they're small vs. the total).

**Known issues:** this laptop (3.5 GB RAM) loses the WebGL context in long or high-quality test runs, so most visual checks are at low/medium quality; long e2e runs time out. Chad Motors cars were reshaped after a first boxy pass — check in person.

**Done:** opening adventure — Goldie (gateway) → relight 3 Guardian Lanterns (Chad Bridge, Chad Square, Citadel forecourt; gold markers) → Golden Sigil at the Citadel doors (+50 XP, +50 coins, points to the sealed castle) → existing chain (Coach Gourdon). Saved per step, never repeats. quest-test 25/25.
**Done:** Map & journal (M key / HUD map button / pause menu): map drawn from city.ts layout, your position + facing, tracked objective (mirrors the HUD), filters (places / shops / quest), fast travel to places reached on foot, journal of quests + collections with steps. map-test 15/15; e2e 57/57.
**Done:** Curse chapter 2 — Whispers in the Wood: after the sigil (and the Coach/gym intro), Grim → the Elder Oak (+20 XP) → the moonstone oath (+60 XP, +60 coins), steps only in order, saved, no repeat; journal + map tracking. chapter2-test 15/15; quest 25/25; map 16/16; mobile-input 51/51; e2e 55/57 (2 = WebGL context lost while a typecheck ran out of memory alongside).
**Done:** Fishing at Moonlight Lake (pier head): aim → wait → strike → reel-tension fight, 6 species (rarer further out), 5 casts/round, score + record + XP (daily fatigue) + fish log in the journal; Fish again / Esc. Tuned by simulation (common ~100% landed, Lantern Eel ~97%, Old Gnarly ~11% for a quick player; careless holding always snaps). fishing-test 14/14 (an automated angler plays a full round).
**Done:** GPU context-loss recovery — a clear 'graphics took a nap' screen with Reload (progress is saved on every change); if the browser restores the context the game rebuilds post-processing and carries on (verified visually). gfx-lost-test 8/8. e2e: 55/57 with the only failure being a context loss on this 3.5 GB machine.
**Done:** Chadville Estates (west of the arrival lawns, below Chad View): 4 plots, buy one for 120 coins at its gate (one per player), top-down editor on a 2 m grid with 11 pieces (cottage 2×2, tower, fountain, tree, lamp, bench, hedge, fence, flowers, pumpkins, path), place / rotate / move / remove (full refund) / undo, checks for bounds, overlap, coins (never negative) and a 30-piece cap; built pieces render in 3D with collision, signs show ownership, saved + sanitised on load; journal 'A Place of Your Own' + map/travel. Walkable area now 18,642 m² (2.19× the original). estates-test 18/18.
**Done:** your cottage interior — a cottage on your plot gets a working front door (follows the piece's rotation); inside: furnished room + trophy wall (sigil, moonstone, gym cup, rush medal, a mounted fish per species), empty slots show what's left. home-test 8/8.
**Next task:** NPC daily routines (bounded walks between spots, never blocking doors), then world events.
**Map:** walkable area 17,568 m² (Monte Carlo over the walkable union, canal + lake water excluded) = 2.07× the original Chad City (~8,500 m²). New: Enchanted Forest (3,091 m², via the Haunted Quarter) + Moonlight Lake (3,208 m², via Motor Row). wilds-test passes; e2e/city-test re-run pending (machine memory).
**Testing note:** this machine (~0.6 GB free RAM) loses the WebGL context during long runs; shop-test treats that as an environment warning. Use Q=low.


## Reference-pack task (priority over events/activities) — 2026-10-14 · BUILT, awaiting Jay's review
**Walkable area (1 m grid, `insideCity` minus canal):** baseline **18,968 m²** (earlier Monte Carlo figure 18,642) → **38,987 m² = 2.06×**. Overhead before/after: `Downloads/pumpchad-review/overhead-before-after.png`.
| Item | Status | Notes |
|---|---|---|
| Layout planned first (roads fixed before modelling) | ✅ | Gate Plaza → Castle Road (8 hairpins, 475 m, y 0→56) → moat bridge → castle; Downtown avenue/boulevard/cross street; Southshore Shore Road + Quay Lane; Mill Row Mill Road + lane |
| Pump Gym exterior | ✅ | stone portico (piers, entablature, gold cornice), stepped gold-capped gable, layered quoins + string course, raised gold PUMP GYM sign, lit doors, landscaped forecourt. Interior + door interaction unchanged |
| Pump Arcade exterior | ✅ | entrance doors now visible (recess no longer a solid block), stone surround + gold cornice, lit cabinet windows, string course. Working games untouched |
| Chad Motors + cars | ✅ | cars rebuilt (plan-view body, shoulder deck, glasshouse + pillars + mirrors, arches, brake discs, calmer lights, exhausts, wing); showroom display bays + reception; **no separate workshop building yet** (gap) |
| Chad Rides motorbikes | ✅ | street bike + Sur-Ron-style electric dirt bike (forks, swingarm, shocks, discs, spoked wheels, engine/tank/exhaust vs battery/motor/knobbly tyres) on kickstands. Riding still "coming soon" |
| Mountain + summit castle | ✅ | road-driven massif; Castle Road with walls, parapets, lanterns, buttresses; moat bridge; Chad Castle (curtain wall, 8 towers, gatehouse, keep, hall, chapel, sky bridge). Bailey walkable; keep doors closed with a plaque |
| Downtown (ref 02 panel 3) | ✅ | 9 glass towers with lit window grids, shopfronts, avenue/boulevard, monument, helipad + turning helicopter, parked cars. Shop doors are dressed but closed |
| Southshore + Mill Row | ✅ | Gothic shop rows (shop() kit), terraces, market square fountain, pond + quay, orchard, Mill Court well. Doors dressed but closed |
| Map / travel / discovery | ✅ | map shows the mountain road + castle; 5 new landmarks with discovery zones; map-test passes |
| Tests (targeted) | ✅ | mountain-test (all legs walkable at road height, moat bridge, keep stops at steps), districts-test (7 streets + 5 travel spawns), routines-test, map-test, interior-test (functional checks pass), home-test |
**Honest gaps:** (1) the full e2e regression dies on WebGL context loss at check 16 on this 3.5 GB PC — an older build does too; last clean 57/57; (2) interior-test and several view runs show a WebGL context-loss "page error" and a NaN-bounding-sphere warning in The Hollow House (code untouched by this task; not confirmed pre-existing); (3) gym-test enters the gym but timed out clicking the workout start button (not investigated); (4) all touch checks are emulated iPhone, not a real phone; (5) night views are dark in screenshots — judged at Q=medium in headless Chromium, not a real GPU; (6) no real motorbike reference photo or external 3D assets were used — all models are procedural; (7) Castle District interiors, enterable Downtown/Southshore/Mill Row shops, and a Chad Motors workshop are not built.
**Blocked (backend, Jay's decision):** online leaderboards, multiplayer/visiting, accounts, trading, shared events.
**Next after review:** NPC routines are in; then world events (Midnight Pumpkin Hunt, Ghost Invasion, Festival, Thunderstorm) → activities → Castle District chapter 3.


## World Upgrade Pack (hillside world) — 2026-10-14 · BUILT locally, awaiting Jay's review
**Geography record (world coordinates, +z = south, y up).** Before: everything on one plane (y 0) from x −106..142, z −72..146 plus a Downtown/Castle I had placed north of the Citadel (z −76..−270). After:
| Place | Anchor | Elevation | Walk from the village gate (jog 5.2 m/s) |
|---|---|---|---|
| Village plateau (square, gym, arcade, Motor Row, lake, Haunted Quarter, forest, estates, Southshore, Mill Row) | (0, 0) | **0** | — |
| Village gateway / Valley Gate | (0, 74) | 0 | 0 |
| Panoramic overlook terrace | (14, 88) | −0.2 | ~3 s |
| Six hairpins down the notch between Mill Row and Southshore | z 104–154 | 0 → −17 | ~60 s |
| Moonspan Viaduct (stone arches over the ravine) | (46–56, 274–340) | ≈ −35 | ~105 s |
| City Gateway (arch, gold lettering) | (−3, 415) | **−52** | ~140 s |
| Chad City (Downtown + Gate Plaza) | x −128..−8, z 394..464 | −52 (valley floor) | ~150 s |
| Castle Road (12 hairpins, ~700 m) → Chad Castle summit | summit (−110, 272) | −52 → **+38** | +~140 s |
Valley road: 727 m, drop 52 m, ~7.2 % grade; walking 5.5 min, jogging 140 s, sprinting 96 s. Chad City sits 52 m below and ~340 m from the village; the castle summit stands 38 m ABOVE the village plateau and 90 m above the city.
**Visible from the village:** from the gate/overlook you look south over the valley: the road winding down, the lit city in the basin, the castle mountain on its west flank, the old Gothic skyline far beyond, and layered mountain walls round the whole valley.
**Built:** roadnet/descent/descentRoad (valley road, footways, kerbs, retaining walls + parapets, lanterns, 5 direction boards, overlook terrace with benches + telescope + plaque, viaduct, City Gateway), valley frame (`frame.ts` — Downtown, Gate Plaza, Castle Road, castle built locally and placed at (−120, −52, 470)), irregular layered ridge ranges (no cones, no white caps), rock-strata terrain colouring, valley woods + night hamlet lights, side/rear architecture + chimneys on every shop(), tiered/varied tree species, Chad Motors workshop, village signage renamed CHAD VILLAGE (Chad City now means the valley city), smaller interaction hints with only the tracked objective large.
**Map area (honest):** original (before the forest/lake doubling) ≈ 8,500 m² (earlier Monte-Carlo measurement in this build's history); first reference-pack baseline 18,968 m²; see the final figure in the report. Connected, walkable ground only; mountain backdrops and empty borders are not counted.
**Still open:** enterable Downtown/Southshore/Mill Row shops, workshop interior, Castle District interiors, performance on real devices, real-phone verification.


## Overnight world pass — 2026-10-15 · BUILT locally (no push/deploy), awaiting Jay's review

- **Valley**: lake with irregular shore + 4-span arched stone Moonspan Bridge, waterfront promenade (6 frontages, cafe terrace, pavilion, boathouse, moored boats), Lakeside Landing with a fishing pier (real fishing round).
- **Roadside places**: village overlook, autumn woodland trail + shrine, Hamlet (Lantern Inn with interior + keeper, hidden walled garden), Old Watchtower (viewpoint, climbable lookout), discoveries (shrine, garden, stream, treasure).
- **Mooncrest Manor**: gates, winding drive, fountain court, wings, conservatory, walled garden + greenhouse, carriage house, shoreline belvedere; interior hall + grand stair, living, dining, kitchen, library, trophy room, conservatory, upstairs bedrooms/bath, secret look.
- **City**: City Hall block, skyline hierarchy (Grand Gourd etc.), fewer repeated needle towers (old gothic backdrop retired), lumpy-crown trees.
- **Events** (item 18): see the table.
- **Checks passed**: events-test (11/11), valley-test, nan-check clean, tsc clean. Simulated-input tests (teleport to markers) — not real-device play.
- **Honest gaps**: gym bench-start WebGL context loss (cause unknown, reproduces on older build); generic interior-test stair timing fails for the manor (valley-test covers the stair and passes); e2e check 16 context loss; waterfall NOT built; hamlet cottages closed; Downtown/Southshore/Mill Row shop interiors pending; manor terrace not enterable from inside; walkable area **not re-measured** since the valley places (last measured 38,987 m² vs 5× target ≈ 42,500 m²; the valley additions plausibly close the gap but this is unverified).

### Verification follow-up — 2026-10-15
- **Connected walkable area** (1 m grid, `insideCity` minus canal, flood-filled from the spawn; `scripts/area-scan.mjs`): **55,516 m²** (plateau 35,808 + valley 19,708) vs original ~8,500 m² = **6.5×**, vs the 18,968 m² reference baseline = **2.9×**. Water excluded. Caveat: counts open meadow/woodland ground the player can walk on (no empty borders or backdrops), so the *built-up* share is smaller; no per-use classification yet.
- **Manor stair**: the conflict was two things. (1) The generic interior test held `W` too briefly for the manor's 10 m stair (fixed: hold scales with stair run). (2) A real defect found by walking from the door with real key presses (`scripts/stairs-test.mjs`): an armour stand plugged the stair mouth, so a player could not reach the stair at all (teleport tests hid it). Moved; walk-in, climb, landing and walk-down all pass; interior-test manor 15/15.
- **Gym bench context loss**: does **not** reproduce with ~0.8–1 GB free RAM (low/medium/high-ish runs, 0 losses); it happened only when free RAM was a few hundred MB. Working conclusion: memory starvation of the headless software-GL browser, not a game defect. Not proven on a real GPU/device.
- **Performance (headless software GL, medium, free RAM ~0.9 GB; compare spots only)**: overlook 19.9 ms (50 fps); descent mid 20.8 ms; city entrance 18.5 ms with one 117 ms first-arrival hitch; square (NPC-dense) 29 ms. Some spots read a flat 16.7 ms, which looks like a render cap, so treat those as unverified.
- **Still pending (unchanged)**: hamlet cottages (closed), Downtown / Southshore / Mill Row shop interiors, workshop interior, waterfall.

## LAUNCH DECISION — 2026-10-15

**FIRST RELEASE: CHAD VILLAGE. NEXT UPDATE: CHAD CITY AND THE VALLEY EXPANSION.**
- The Valley Gate is the launch boundary; it is closed (iron gates, sign "CHAD CITY — NEXT UPDATE", short explanatory interaction). Everything beyond it is the **expansion**: descent road, valley, Chad City, Moonspan Bridge, lake + waterfront, hamlet, woodland, watchtower, Mooncrest Manor, mountain castle. All of it is preserved (code, assets, tests) and checkpointed for the next update; none of it is deleted.
- One central switch (`EXPANSION_OPEN`, `src/game/launch.ts`) is read by walking bounds, fast travel, map, quests, save recovery and world building. Opening the expansion later = flip that switch.
- Existing saves are never reset: players saved in the expansion are moved to a safe village arrival (once, with a one-time notice); all progress and expansion data is kept for the future return.
- Priority: polished village, reliable activities, clear progression, working saves, usable mobile controls. Nothing pushed or deployed.
- Map size claims: the **full development world** is 55,516 m² connected (~6.5× the original ~8,500 m², includes walkable meadow and woodland). The valley expansion is **not available** in the first release; the launch-accessible area is measured separately below once the boundary is applied.
- Gym bench context loss: **Not reproduced in three runs with approximately 1 GB free RAM; real-device verification pending.**
- Still tracked (deferred, not removed): remaining activities (target throw, ghost hunt, escape rooms, parkour, maze, dungeon, farming, treasure hunts, vehicle racing after reliable driving); Castle chapter 3 + Castle District interiors; hamlet cottage interiors; Downtown / Southshore / Mill Row shop interiors; workshop interior; waterfall; restoration, Festival Grounds, collection, housing features; accessibility, audio, save export/import, performance. **BLOCKED until a backend exists:** accounts, multiplayer, trading, online leaderboards, shared events.

### Launch build (Chad Village) — status 2026-10-15 · local only, not pushed or deployed

**Boundary.** `src/game/launch.ts` holds `LAUNCH_EXPANSION_OPEN = false` (`?expansion=open` opens it for a session; used by the preserved valley/manor/stairs tests). It is read by walking bounds (`city.ts`), the atlas/map/fast travel (`atlas.ts`, `MapJournal.tsx`), interactables and NPCs (`World.ts`, `npcs.ts`), teleports/spawns (`World.teleport/spawn` redirect to the arrival gate), the descent road's direction boards, and world building. The Valley Gate is closed: iron leaves between the existing piers, warm lanterns, lamp posts, hedge planters, a plaque "CHAD CITY — NEXT UPDATE", full collision pier to pier, a notice (E) explaining the next update, and the road/castle still visible through the bars.

**Saves.** No position is saved, so every load arrives at the village gate. A player whose save contains expansion discoveries (`visit_downtown`, `visit_manor`, `disc_*` …) gets one welcome-back notice (`launch_notice_v1` discovery) and nothing is removed or reset. Housing (Chadville Estates), companions, coins, XP, achievements and quest history live in the village and are untouched. Systems that sit in the expansion (Lakeside Landing fishing, hamlet inn, watchtower, manor interiors, castle) are unavailable for this release; their data and code are intact.

**Map / quests / text.** The map is cropped to the village with a veiled "Chad City · the valley — next update" strip; the closed destinations are listed under the map ("Next update · not open yet"), selectable, never travel targets; an Activities filter marks Pumpkin Rush, Events Board, Pumpkin Toss, Ghost Hunt and Pier Fishing. All quests (Guardian Lanterns, Whispers in the Wood, Leg Day, Discover Chad Village) complete inside the village. "Chad City" wording that meant the village was changed to "Chad Village" (HUD, journal, photo mode); the valley direction boards beyond the gate are hidden while closed.

**Deferred at launch (what is actually not built):** Downtown (city buildings, colliders, lights), Southshore, woodland trail, hamlet, watchtower, Mooncrest Manor, their NPCs/interactables/zones, discoveries, and the lower-district walking bounds. **Still built as distant scenery (honest overhead):** terrain + valley height grid, the descent road and viaduct, the lake water + stone bridge, the castle road and mountain castle, mountains, valley woods/lights. Measured, medium quality, headless software GL, same machine: geometries 1006 → 656 (−35%), vertices 3.25 M → 2.26 M (−31%), textures 241 → 181, JS heap 195 → 143 MB, world load 16.1 s → 15.2 s (noisy). Not claimed: the expansion code is still bundled in the JS; the interiors are lazily built on entry as before.

**Launch-accessible area** (`scripts/area-scan.mjs`, connected 1 m grid, canal excluded): **18,988 m²** (2.2× the original ~8,500 m²; plateau only, valley 0). The full development world remains **55,516 m²** (~6.5×; includes walkable meadow and woodland); that figure is not advertised for launch. Built-up vs open: the village is dense (the Haunted Quarter, forest and lake lawns are the open part); no per-use split yet.

**Bug found and fixed on the way:** the Haunted Quarter seam (market road ↔ quarter) left a 1.2 m gap that nothing could walk across (teleport tests hid it), so the Chapter 2 hand-off to Grim could not be reached on foot; the quarter's walkable rect now overlaps the road by 2 m.

**Activities (all single-player, local personal bests; no leaderboards):**
| Activity | Where | Rules | Verification (simulated desktop browser unless stated) |
|---|---|---|---|
| Square Time Trial | Events Board, Chad Square | six ordered gates; course is searched so every leg is a clear straight run; limit derived from course length (~35 s): sprint/jog clears, strolling does not; best time kept; achievement; one payout per run | `trial-walk.mjs`: normal keys + mouse-drag steering from the board prompt, cleared in ~20 s (sprint); timeout, retry, quit, XP-once, best-time, controls-restored all pass. Jog on keys = walk (keys have no jog gait); stick jog is by design. |
| Pumpkin Toss | lawn on Moonlight Lake's south shore (~100, 56) | 10 throws, click/tap a board; rings 50/25/10, far ×1.5, sliding ×2; movement locked on the line and restored; local best; achievement for 3 bullseyes | `toss-test.mjs`: walk-up prompt, card, real mouse clicks, results, best saved, reward once, quit-mid-round no reward, movement restored. Touch tap checked in `mobile-activities-test.mjs` (emulated). |
| Ghost Hunt | post at the Haunted Quarter gate | 5 hidden ghosts in the quarter (flood-filled reachable ground), revealed within 7 m, hint line with distance + warmer/colder, hold still beside one to capture; 150 s; achievement | `ghost-test.mjs`: walk in through the gate, hunt, capture 5, quit/retry, XP once. Test reads ghost positions from the QA hook only to know where to walk. |
| Events Board (hunt, invasion, festival, storm) | Chad Square | unchanged objectives; each starts/ends cleanly; Escape during any leaves nothing behind; Rush still works afterwards | `events-test.mjs` (teleports to markers = logic check) + Escape-cleanup loop. Thunderstorm = rain + lightning telegraphs with a real crystal objective. |

**Mobile (SIMULATED, Chrome DevTools touch on an emulated iPhone 13, not a real phone):** `mobile-input-test.mjs` (stuck-movement regression: finger leaves, touch cancel, menu opens, blur, rotation) and the new `mobile-activities-test.mjs` (landscape 750×342: activity cards fit and scroll, action buttons sticky, close in the card header, HUDs clear of the stick/action button, touch tap throws, stick held across menu open/close/rotation stays stopped). Cards in short landscape screens were overflowing and have been fixed. The emulated layout viewport sits ~14 px lower than the visible area; confirm on a real device.

**Performance (headless software GL, medium quality, ~1 GB free RAM):** see the numbers recorded above; Chad Square with NPCs is the busiest launch spot (~29 ms/frame at medium in earlier measurement). Gym bench context loss: **Not reproduced in three runs with approximately 1 GB free RAM; real-device verification pending.**

**Remaining / deferred (tracked, not removed):** vehicle racing (after reliable driving); remaining activities (escape rooms, parkour, maze, dungeon, farming, treasure hunts); Castle chapter 3 + Castle District interiors; hamlet cottage interiors; Downtown / Southshore / Mill Row shop interiors; workshop interior; waterfall; remaining restoration, Festival Grounds, collection and housing features; accessibility, audio, save export/import, performance. **BLOCKED until a backend exists:** accounts, multiplayer, trading, online leaderboards, shared events (events here are explicitly single-player).

**Regression run for this build (simulated desktop/emulated-phone browser, headless software GL):** launch-test, events-test (incl. Escape-cleanup loop), ghost-test, toss-test, trial-walk (sprint), mobile-activities-test, mobile-input-test, valley-test and stairs-test (`?expansion=open`, i.e. the preserved expansion) all pass; rush-test passes alone (30/30) but timed out once when the machine was under memory pressure during a concurrent compile — treat as a resource flake, not a fix. Not run this stage: the full e2e (known context-loss at check 16 on low memory) and real-device checks. Review evidence: `Desktop\Chadverse-Overnight-Review\launch-*.jpg` (earlier `final-*`, `night*` captures preserved).

## WALKTHROUGH FIXES, REALISTIC ASSETS AND GAMEPLAY UPGRADE — tracker (started 2026-10-15)

FIRST RELEASE: Chad Village and its available surrounding activities. FUTURE EXPANSION: Chad City, the valley, mansion and mountain castle (closed in the public launch configuration; `?expansion=open` = controlled local review). Nothing pushed or deployed. Statuses: COMPLETE / PARTIAL / MISSING / BLOCKED (walkthrough items are *observed issues to investigate*, not assumed fixed by earlier automated checks).

| # | Requirement | Phase | Status | Notes |
|---|---|---|---|---|
| 1 | Selective inspection of the current build | 1 | PARTIAL | done per item below; no full audit |
| 2 | Better assets, consistent style; licence + attribution record (`ASSETS.md`); runtime assets stored with the project; shared-resource ownership kept | 2 | MISSING | candidates: Poly Haven (CC0), cjmitchell lakeside mansion, sports car, pistol, Antique Estoc — source/licence/availability to be verified before use; nothing purchased |
| 3 | Realistic trees and bushes (trunks, branching, layered canopy, species variety, alpha-tested foliage, LOD, terrain contact) across the launch area incl. Haunted Forest | 2 | MISSING | current: lumpy-crown geometry (`treegeo.ts`) + foliage.ts |
| 4 | PumpChad head fix (mobile + rear), identity preserved, other characters rechecked | 1 | MISSING | investigate geometry vs scaling vs LOD vs projection vs viewport |
| 5 | Garage / workshop rebuild; cars; lifts; tyres; reposition if impractical; bikes kept, no bicycles; driving + purchases stay unavailable | 2 | MISSING | |
| 6 | Pump Gym exterior (interior preserved) | 2 | MISSING | |
| 7 | Pump Arcade as a standalone landmark | 2 | MISSING | plan relocation before modifying |
| 8 | Pets: species models, faces, animation, ground contact, shop presentation; behaviour through doors/activities/reload | 2 | MISSING | |
| 9 | Haunted Quarter architecture | 3 | MISSING | |
| 10 | Expanded Haunted Forest + quest mystery; boundary kept closed to the valley | 3 | MISSING | |
| 11 | Sign fixes (post through text, orientation, contrast, housing signs) | 1 | MISSING | |
| 12 | Real-phone landscape panels (compact HUD, Challenges button, scrolling panel, reachable Start/Close, safe areas) | 1 | PARTIAL | activity cards fixed in emulation last stage; the Challenges panel + HUD still to rework; real-phone check outstanding |
| 13 | Height-aware jumping, landing on surfaces, takeoff/air/landing animation, vault/mantle; release boundary stays separate | 1 | MISSING | |
| 14 | Starter-map parkour area + rooftop/ledge routes | 3 | MISSING | |
| 15 | ~50 Chadville plots, stable ids, safe migration, LOD | 3 | MISSING | |
| 16 | One gun + one sword, shooting range, haunted combat activity | 4 | MISSING | no PvP, no networking |
| 17 | Rewards through existing XP/coins/achievements/cosmetics/trophies | 4 | MISSING | |
| 18 | Perimeter walls on slopes; distant Chad City skyline from the overlook | 1 / 5 | MISSING | |
| 19 | Mooncrest Manor facade/courtyard/cars (expansion) | 5 | MISSING | |
| 20 | Castle parkour route (expansion) | 5 | MISSING | |
| 21 | Whole existing gameplay plan retained | — | tracked | see launch tracker above; BLOCKED backend items unchanged |
| 22–24 | Staged delivery, performance, evidence | — | ongoing | |
