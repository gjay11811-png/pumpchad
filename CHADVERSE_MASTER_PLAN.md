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
| 2 | Better assets, consistent style; licence + attribution record (`ASSETS.md`); runtime assets stored with the project; shared-resource ownership kept | 2 | PARTIAL | `ASSETS.md` written: Poly Haven = CC0 (verified), Antique Estoc = CC0, ~8K tris, glTF 1K available (sword candidate, not yet downloaded); Poly Haven trees are 0.3–17 M tris = unusable without decimation; cjmitchell mansion / sports car / pistol: source+licence NOT verified (not found by name) — unused until Jay supplies URLs |
| 3 | Realistic trees and bushes (trunks, branching, layered canopy, species variety, alpha-tested foliage, LOD, terrain contact) across the launch area incl. Haunted Forest | 2 | PARTIAL — STANDARD ESTABLISHED, AWAITING REVIEW | procedural structure (`treegen.ts`, cells + LOD) + Poly Haven CC0 Jacaranda leaf/bark detail (`vegTextures.ts`). Scan model evaluated and rejected for repetition (sparse at 40 K tris, 120 K+ for a full canopy); Poly Haven shrubs are wild ground plants. Before/after: `vegrep-before-procedural-veg-rep2.jpg` vs `vegrep-after-scantex-veg-rep2.jpg` (+ `veg-close`, `veg-shrub`; intermediate scan-tree try: `vegrep-after-scan-*`). Forest expansion waits for approval of this look |
| 4 | PumpChad head fix (mobile + rear), identity preserved, other characters rechecked | 1 | PARTIAL (improved, verified in screenshots) | desktop-high vs phone-medium compared at identical pose/camera (`head-before-*` / `head-after-*`): geometry and scale are identical; from behind the head read as a smooth dead-red ball (no ridge contrast, no inner warmth). Deeper grooves, lighter ridge crests, deeper rib amplitude and a faint inner glow now make the ridges read from every angle. Front unchanged. Other species untouched (pumpkin-only texture change); still to check on a real phone |
| 5 | Garage / workshop rebuild; cars; lifts; tyres; reposition if impractical; bikes kept, no bicycles; driving + purchases stay unavailable | 2 | PARTIAL (workshop verified in screenshots; cars/bikes not yet) | `workshop.ts`: concrete-block shed with brick base, two roller-door bays, reception with glass door + awning, branded parapet, covered service bay with a two-post lift carrying a car on its lift points, tyre rack + stacked tyres (carcass + tread + chrome rim), drums, bench with vice, tool chest, compressor, painted asphalt yard, driveway to Motor Row, lake-side wall + shrub screen. Kept on its original plot (road-accessible, lake beyond). Cars (`vehicles.ts` supercars) and Sur-Ron/motorbikes still unchanged; no external car model available (see ASSETS.md) |
| 6 | Pump Gym exterior (interior preserved) | 2 | PARTIAL (verified in screenshots) | `gymExterior.ts`: dark standing-seam cladding on brick, brick feature tower, glazed bays showing the lit interior, wide entrance with recessed doors, cantilevered steel canopy with LED edge + lit soffit, illuminated PUMP GYM fascia lettering, roof plant, paved forecourt with lit bollards and real-shrub planters. Interior, door position and entry transition untouched (rush-test enters/exits it). Still to do: tune night lighting, the gym-front view from the street |
| 7 | Pump Arcade as a standalone landmark | 2 | PARTIAL | building moved back to the district edge and shortened (depth 7), taller (9.4), two neon pylons, a plaza inlay + bollards and paving that continues the street into a forecourt. NOT fully standalone: the two end shops (Chad Snacks / Chad Fits, which have interiors) still pinch the plaza sideways; a full relocation needs those shops' facades and HouseSpec doors moved together |
| 8 | Pets: species models, faces, animation, ground contact, shop presentation; behaviour through doors/activities/reload | 2 | PARTIAL (verified) | cat: whiskers, nose, inner ears, paws, haunches, chest; pumpkin: legs, boots, arms, trot; ghost: waving arms; bat unchanged. `pet-test` passes (adopt/name/equip/follow/recall/reload). Shop presentation and door/activity behaviour still to review |
| 9 | Haunted Quarter architecture | 3 | MISSING | |
| 10 | Expanded Haunted Forest + quest mystery; boundary kept closed to the valley | 3 | MISSING | |
| 11 | Sign fixes (post through text, orientation, contrast, housing signs) | 1 | PARTIAL (verified by build only) | fixed: fingerpost arms started inside the post; housing plot signs had a post through the board. Other signs still need a visual sweep |
| 12 | Real-phone landscape panels (compact HUD, Challenges button, scrolling panel, reachable Start/Close, safe areas) | 1 | PARTIAL (emulated only) | Challenges panel is a right-hand drawer in landscape (305x390 in the emulated 664x390 phone, `mobile-input-test` ALL PASS); activity cards fixed earlier. NOT yet checked on a real phone |
| 13 | Height-aware jumping, landing on surfaces, takeoff/air/landing animation, vault/mantle; release boundary stays separate | 1 | PARTIAL (verified) | `jump-test`: a hop onto a 0.6 m planter (vault look-ahead 1.25 m) stands on it and walks off the far side, walking into it is still blocked, jumping at the 3.6 m Valley Gate pier does not clear it, landing restores normal movement. Still to check: foot sliding / animation phases on a real device, designated climbable ledges (parkour phase) |
| 14 | Starter-map parkour area + rooftop/ledge routes | 3 | MISSING | |
| 15 | ~50 Chadville plots, stable ids, safe migration, LOD | 3 | MISSING | |
| 16 | One gun + one sword, shooting range, haunted combat activity | 4 | MISSING | no PvP, no networking |
| 17 | Rewards through existing XP/coins/achievements/cosmetics/trophies | 4 | MISSING | |
| 18 | Perimeter walls on slopes; distant Chad City skyline from the overlook | 1 / 5 | PARTIAL | skyline shells (`skyline.ts`, tall neon core + outskirts east of the castle mountain, own fog-free atmosphere) visible from the overlook as lit towers on the horizon (`walk4-v-valley-wide`); much of the city is hidden behind the intervening hill — needs a second pass. Perimeter-wall defects not yet located |
| 19 | Mooncrest Manor facade/courtyard/cars (expansion) | 5 | MISSING | |
| 20 | Castle parkour route (expansion) | 5 | MISSING | |
| 21 | Whole existing gameplay plan retained | — | tracked | see launch tracker above; BLOCKED backend items unchanged |
| 22–24 | Staged delivery, performance, evidence | — | ongoing | |

**Blocker (2026-10-15):** the PC ran out of *commit* memory (14.1 of 14.3 GB committed; VS Code ~1.5 GB, Windows Update's TiWorker ~1 GB — not touched), so `tsc`, `vite build` and every browser run fail with `VirtualAlloc … errno 1455`. Everything above marked UNVERIFIED was written carefully against `noUnusedLocals`/strict but has not been compiled. Next step once memory recovers: `npx tsc --noEmit`, build, then screenshots (head, trees, gate/skyline, panels) and the jump test.

**Memory note (2026-10-15):** after the cleanup (npm cache, stale browser profiles, the orphaned test browser, an idle MCP helper) tsc and builds run again with ~2 GB commit free; `GOMAXPROCS=1 npx tsc --noEmit --singleThreaded` is the safe form.

**Asset links (2026-10-15):** the exact mansion, car, pistol and sword links were not in the message or the pack; blocked until supplied. See ASSETS.md.


## FINISH THE MAP AND BUILD PROPER TRAVERSAL — status (updated 2026-10-16; checkpoint brief of 15 Oct)

Labels: **implemented** (in the build) · **functionally checked** (scripted test passes) · **visual review pending** (I have looked at stills; Jay has not) · **blocked**. EVERY check below is a *simulated* one (headless Chromium, software GL, synthetic keys/touches). **No real phone, real mouse or real GPU has been used.** This PC has ~3.5 GB RAM (often ~200 MB free), so test browsers sometimes lose their WebGL context mid-run; stills from such runs are discarded by `make-review-pack.mjs`.

| # | Requirement | Status | Evidence / what is missing |
|---|---|---|---|
| 1 | Parkour entrance "invisible blocker" | **fixed (cause found), functionally checked** | `walk-route-test parkour` walks spawn → estates → Heights → yard apron. The yard entrance itself is clear (`blockMap` grid). What blocked a walker was the **first vault wall spanning the whole corridor with no prompt and the apron walled in**: the east wall of the apron is now open to the yard plaza, a fingerpost lists Rookie Run / Rooftop Run / Traversal Lane / Sword Drill, and a contextual hint says what Space does. I could not reproduce any *other* invisible wall at the entrance; if you still hit one, tell me where (the `blockMap` hook prints a solid-grid for any rectangle) |
| 2 | Housing: 52 plots, stable IDs, show homes | implemented · functionally checked · visual review pending | `A–D` + `H01–H48`; `heights-walk-test`, `heights-buy-test` (buy a north-facing plot, editor, save, reload, older save with plot A). Street trees added along both lanes. **Show-home interiors**: cottage / contemporary / premium are enterable (`showhome-test`: prompt → E → inside → out), each its own plan (hearth + kitchen corner + nook; open plan + loft bedroom; hall, drawing room, dining, library, two upstairs bedrooms). Interiors only exist while you are inside. They use the interior furniture kit, **not** the plot-builder pieces; the exteriors are show models (not buildable). Making the show homes from builder pieces, and extending the builder's piece list, is **not done** |
| 3 | Gym | interior mirrors + plant wall implemented; visual review pending | the plant wall (framed living wall on the front wall, trough, grow-light strip) could not be photographed: every gym capture on this PC since lost its graphics context. Machines (selectorised), slat walls, flooring changes: not done |
| 4 | Garage / Chad Motors | not revisited this pass | cars remain procedural (the supplied car is behind a Sketchfab login) |
| 5 | Arcade separation | partial · functionally checked | end shops stepped back/narrowed, all 4 shop doors re-tested; "truly separate from both shops" is not fully met — the shops still flank the street |
| 6 | Streets (paving, kerbs, facade depth, side walls, signs) | not started as a pass | shops already carry side/rear detail (`detailWalls`); I did not find the "blank brick" houses you saw — tell me which |
| 7 | Lanterns | demo only, awaiting your approval | day + night stills; recommendation: **L01 Gaslight Post for streets/squares, L02 Crook for gardens and the Heights lanes, L03 Pillar for gates/yard edges**; rollout is `?lanterns=all` |
| 8 | Jumping that looks grounded | implemented · functionally checked · visual review pending | take-off weight shift (sink + lean), rise lean at speed, landing absorb, **jump buffer 0.13 s and coyote time 0.1 s** (tunable constants in `movement.ts`), hop assist onto low obstacles. The `jump-test` failures were a **real movement defect** (a standing hop against a 0.6 m planter could not reach the top: wall-slide ate the velocity and air control was too slow) — fixed at the cause; the test now polls for landing instead of waiting a fixed time. Not done: a real planted-foot clip (no suitable animation; procedural lean only), foot-slide checks |
| 9 | Traversal: vault / mantle / catch / hang / shimmy / pull-up / release | implemented · functionally checked · visual review pending | `ledge.ts`, `parkourSystem.ts`, `traversal-test` (ordinary keys): sprint jump → fence vault → ledge catch → 2.5 s sustained hang → shimmy both ways → pull-up → roof-gap jump → landing → crate mantle → catch a 3.5 m ledge → release; refusals: a 3.5 m ledge from the ground, the 3 m wall; **two ordinary village fences (the pumpkin-patch fence, both directions)** are vaulted by the same rule. A held W after the catch no longer pulls straight up (the controls must be let go once). Corner wrap-around is coded but not exercised by a test. **Bar grab / swing / release: not started** (explicitly the next feature) |
| 10 | Animations (Mixamo etc.) | **blocked / not used** | see `ASSETS.md`: Mixamo FAQ returned 403 here, download needs your Adobe sign-in; nothing licensed or downloaded. Motion is procedural arm IK + the existing clips on the shared rig; PumpChad / Skeleton / Demon visual check pending |
| 11 | Demo route + several buildings | implemented · functionally checked | Traversal Lane in the yard plaza (ditch, fence, Workshop 2.35 m, Store 2.2 m, crate, Tower Shed 3.5 m). **Routes on existing village rooftops: not done** |
| 12 | Controls & phone | implemented · functionally checked (emulated) | desktop: one-click mouse capture, WASD/Shift/Space, **A/D shimmy · W or Space pull up · S or C drop**, R/T/X in a parkour run; phone: joystick + camera + sprint + jump together, **Pull up / Drop buttons appear only while hanging**. Real phone / real mouse: **not tested** |
| 13 | Character selection | implemented · functionally checked (desktop + emulated phone) · visual review pending | night-village stage, live-model portrait cards (captured once, 3 small JPEGs), arrows, keyboard, focus rings, gold enter button; one canvas only (`creator-test`). Before/after stills in the pack |
| 14 | Vehicles | not started this pass | |
| 15 | Haunted Quarter / forest / pets / backlog | Haunted: Victorian detailing implemented, **not yet visually reviewed**; forest terrain/trails/quest: not started | |
| 16 | Graphics-memory message | evidence + instrumentation | every context loss/restore is logged (`gfxLog`) with GPU + heap facts; `scene-leak-test` shows **no leak** over 10 world↔shop rounds; the static batch draws the whole town each frame (~0.8 M triangles at spawn). New today: with ~200 MB free the browser loses its context **even at Quality low** in the gym, in big aerial views and on interior entry — i.e. on this PC the message is memory pressure, not a leak in the game. A real phone's `chadverse.gfxlog` is still needed |
| 17 | Sword route / pistol | implemented · functionally checked | map marker "Sword Drill" at the yard, fingerpost; the pistol range is on the map as "Pumpkin Toss & Pistol Range" (110, 64) |

Next batch (not started): bar grab/swing/release; rooftop routes on existing buildings; builder-piece show homes + new builder pieces; gym machines; garage/bay interior; vehicles; forest.


## OVERNIGHT QUALITY AND GAMEPLAY PASS — status (updated 2026-10-16)
This extends the plan above; there is no second plan.

**Completed**
- PumpChad head v3 (lobes, grooves, rind bump, ridged stem, shades): `character/pumpkinHead.ts`; before/after stills in the review pack.
- Ledge traversal: hand-over-hand shimmy (planted hand stays, free hand lifts, reaches and re-grips; body follows the hands' midpoint; shoulders twist toward the reaching hand), hang fitted to the arms (HANG_DROP 1.74, BODY_OFF 0.36), vault/mantle hand targets in code, stray-release fix. `traversal-test`, `jump-test`, `parkour-test` pass.
- Continuous traversal recording with a tracking camera (`scripts/trav-sequence.mjs`) → `trav3-sequence.webm` in the review pack.
- Pistol: Poly Haven Service Pistol (CC0) in hand with recoil + existing muzzle flash/tracer; Pistol Range test passes.
- Workshop interior: Chad Motors Service is now enterable by its reception door (`interiors/garage.ts`, lift + two cars, bench, shelves, Dex); `scripts/garage-test.mjs` passes.
- Cars: new lofted body, bulged tyres, ten-spoke alloys, interior hints (original design).

**Partial**
- Vault/mantle/pull-up/landing poses: functional and sequenced, but I have not yet reviewed them frame by frame on Skeleton and Demon.
- Cars: better silhouette, still an original stylised design; headlights and arches are simple.

**Not started / blocked**
- McLaren-style and Realistic Sports Car candidates: Sketchfab login required (blocked).
- Mixamo: needs an Adobe sign-in (not used).
- Sur-Ron-style bike and street bike are unchanged this pass (they already exist in Chad Rides).
- Gym exterior/plant wall, arcade finish, builder-piece show homes, village materials/lighting, forest/waterfall/quest, bar swing and rooftop routes, mobile checks on all three characters: not touched in this session. Lanterns still await approval; expansion stays closed.

## NEW DISTRICT ("CHAD CITY" working name) — status (2026-10-16)
Built as a separate outdoor scene (`src/game/district/`), entered like a house interior but with the real sky and sun; the starter map's scene, buildings and systems are unchanged (it is only reachable with `?district=1` or `window.__chadverse.enterDistrict()`; no entrance exists in the starter map yet). Rename / switch off in `district/config.ts`. Checkpoint tag before the work: `checkpoint-before-new-district`.
- Phase 3 showcase done: the flagship PumpChad Gym (3 storeys, cantilever, glazing with a visible lit interior, gold lattice feature core with logo and wordmark, timber, recessed step-free entrance, forecourt, planters), a real-scale avenue (PBR asphalt, kerbs, pavements, lane markings, zebra crossings, drains, lamps, signals, bollards, benches), a curved-glass tower, a brick shopfront terrace, an office block on a colonnade, west-side wings, an arcade plot with hoarding and car park, street trees.
- Not yet: the arcade building, the social plaza, the connection to the starter map, NPCs/cars/ambient audio, golden-hour/night/rain looks, ultra/high/mobile preset tuning, ambient occlusion and other post effects.

## COMPLETE UPGRADE BRIEF (17 Oct 2026) — status
Words used: **implemented** (code in) · **visually reviewed** (I opened the screenshots / footage myself) · **ordinary-input tested** (real key / touch events in the headless browser, game time stepped) · **real-device tested** (nobody has done this; Jay's phone is the only real device). Environment for everything below: software-rendered headless Chromium (about 1 fps), 3.5 GB RAM, so every browser result is SIMULATED. A recurring cause of "WebGL context lost" / `ERR_INSUFFICIENT_RESOURCES` was **stale test-browser processes eating the machine's RAM** (the same build survived 24 s once they were killed; the pre-session commit lost its context just as readily while they were alive): `scripts/run-tests.sh` now kills them between tests.

| # | Item | Status |
|---|---|---|
| 1 | Audit, baseline, checklist | done. Baseline = commit `6124aa5` (git worktree `..\pumpchad-base`, served on :5181). Matched before/after captures are in the review pack. |
| 3 | The three downloads | **MX4**: a fused 1.1 M-triangle untextured scan (wheels NOT separate) → straightened, split into body / fork+bars+fender / two wheels around fitted axles, optimised to ≈ 80 K tris (25 K low-detail set for parked bikes), **integrated as the rideable e-dirt bike** (implemented, ordinary-key tested, visually reviewed). **Victorian house**: 226 MB / 3.5 GB of textures → 2.5 MB / 59 MB / 64 K tris, **placed as Ravenswood** in the Haunted Quarter (visually reviewed). **Stone house** (the two files are byte-identical): 255 MB → 24 MB of textures; **three placed as Greenside Row** on the Heights Green with the village plaster / tiles swapped in (visually reviewed); Greenside Row now has a glazed framed window over the gable's closed shutter and a stone chimney (cap + pot); NOT done: the side-wing shutters and the open rafter tails are still the model's own. Details: ASSETS.md. |
| 4 | Plots | **52 plots (A–D + H01…H48) enlarged from 12 × 10 m to 22 × 26 m** (fitted from an example mansion: manor 12 × 10 + double garage 6 × 6 + paved drive + gates + gardens, 17 pieces, 41 % of the cells), moved into a new district west of the spine road (rows on two lanes, x −552…−246); the old district is kept as the **Heights Green** (boulevard, lawns, show homes, benches, Greenside Row, traversal spots). New pieces: manor (2 floors), double garage, driveway, terrace, iron gates; piece limit 30 → 80; height limit 9 m. Saves: a layout v1 → v2 **migration** turns the old layout so its frontage meets the new street and pushes it to the street edge (tested on all 52 plots); an old furnished plot and its cottage door verified (`home-test`); a new mansion bought and built in the real editor and persisted (`estates-large-test`). Pure rules: `estate-rules-test` 14/14. Plot ids and ownership kept; positions changed. Launch-accessible connected area is now 33,726 m² (was 18,988); `launch-test` ALL PASS (gate still closed, expansion closed). |
| 5 | Mobile riding screen | compact HUD: profile / objective / walking buttons fold away while mounted, one speed pill, one small corner menu (lessons, assist, hints), keys GAS · REV · BRAKE · REAR · LEAN FWD + GET OFF around the right edge, joystick steers; speeds in km/h everywhere. **ordinary-touch tested (emulated CDP multi-touch, 17/17)**: gas + REV + steer held together, a camera-drag finger and a lifted finger do not cancel the others, brake + rear brake together, touch-cancel / focus-loss / hidden-page / dismount release everything. Landscape + portrait captures reviewed. **Real phone: pending.** |
| 6 | Riding, wheelies, REV, two bikes, three characters, camera, sound | sim: fixed 120 Hz, frame-rate independent, no timing bar; REV = eased throttle surge + weight back (lift in ≈ 1.3 s, loop-out ≈ 0.7 s later if held), rear brake lowers it, optional damping-only assist; **MX4 and street bike** with separate tuning; rider IK fits PumpChad / Skeleton / Demon on both bikes (palms ≤ 15 cm from grips at rest, ≤ 6 cm in motion; reach by lean + a slide on the saddle). `bike-sim-test` ALL PASS, `bike-test` 25/25 on both bikes. **Footage**: `bike/footage-final/ride-surron-pumpchad-chase.webm` (32 s: pull-away, S-bends, brake, over-hold loop-out + recovery, held wheelie with steer, rear-brake landing, short lift, dismount) + wheelie takes on the street bike (chase) and the MX4 (side). Sound is **procedural WebAudio** (no recorded audio used). Not done: other species' full takes (stills + numbers only); the practice-route lessons are text only. |
| 7 | Ledges throughout | `scripts/ledge-scan.mjs` verifies every box collider's top by ray-casting the visible scenery (37 candidates → 5 genuinely flat); they become mantle / hang platforms; plus purpose-built structures (Rides crate stair → 3 m roof, Heights Green 2.1 m / 2.5 m walls and a shed). **ordinary-key tested** (`ledge-world-test`): approach → jump → catch → hang → shimmy both ways → pull up on the yard Workshop and four new ledges, and a 3-step mantle stair. Fence vaults were already general (any 0.5–1.45 m collider). Honest limits: the village has few verifiable flat tops, so most ledge play is on the new structures; thin walls refuse a pull-up ("no room"); bar grabs / swings / rooftop routes NOT done; no mobile Grab button (a catch is automatic on a jump; Pull up / Drop exist). The wall-clock `traversal-test` shimmy-both-ways check failed once while other browsers were running; re-run alone it passes 3/3 on the current build (and on the baseline). Cause: the check holds A for 1.7 s of wall-clock and needs >0.8 m, so CPU contention starves it; the game's shimmy speed is unchanged. Test NOT weakened. `species-test`: 'foot sliding while jogging' is a wall-clock rAF sampling heuristic (observed 4 %, 26 %, 35 % across runs on the same build) and the later failures are `enter-muted` / resource-exhaustion timeouts on reload under memory pressure — environment noise, not yet replaced by a frame-stepped check. interior-test: Lantern Inn lives in the closed valley (teleport pushed 146 m, expected with expansion closed) and the show-home 'walks into the room' checks fail independently of the new exteriors. |
| 8–9 | Starter street, ground, buildings | real PBR **setts / paving / asphalt / plaster / roof tiles and slate / timber** (Poly Haven CC0) replace the cartoon cobbles and flat colours; houses got **sash windows with reveals, sills, shutters and flower boxes, panelled doors in stone surrounds, fascia + bargeboards, dormers, chimney caps and pots**. Visually reviewed day and night. NOT done: a back / side window variety audit, castle-side houses (closed area), every shop frontage. |
| 10 | Chad Motors, gym, arcade | **implemented, visually reviewed (day)**: new `facadeKit.ts` (recessed framed sash / industrial windows with reveal shadow, glass skin, stone surrounds, sills, arched heads; `wallBays` = plinth, string courses, pilasters, cornice, downpipes, lanterns). Chad Motors showroom: articulated sides + back with arched tall windows and a service door; the **workshop** has real service-bay openings (steel back wall, concrete floor, pegboard + tools, workbench, tyre stack); the **gym** front is a true recess (glazed bays with sills, racks and ceiling strips behind glass, entrance header) with industrial brick-plinth sides and back; the **arcade** has windowed, corniced sides and back with downpipes and bulb lanterns. All shop windows now use the framed-window builder. Regression: shop-door-test 13/13, launch-test 21/21. Night captures of the new exteriors NOT yet reviewed. No BMW file exists (nothing claimed). |
| 11 | Parkour + signage | yard rebuilt from believable parts: brick vault walls with stone coping, concrete blocks, timber crates, a plank beam on trestles, shipping containers on steel legs, thin painted edge lines instead of glowing hazard stripes. Signage unchanged (modest mounted boards). |
| 12 | Lighting, head, descent, forest + waterfall | head reviewed: the v3 pumpkin already has ribbing, skin speckle, lacquer and a curled stem — **no change**. Descent road reviewed with `?expansion=open`: retaining walls, kerbs, planting fine; the black faceted 'rocks' near the lamps were the hamlet shrubs: `vertexColors:true` with only an instance colour rendered black — **fixed** (`hamlet.ts`; also colours the fallen leaves), verified with an `?expansion=open` capture. **Waterfall built** (spring-fed brook from a crack in a mossy rock mass, flat lip, 7.6 m animated sheet, plunge pool with foam + mist, rock rim, stream under a plank footbridge where the loop path crosses it, viewing spot with a bench, "Watch the waterfall" discovery). The forest quest (Grim → Elder Oak → moonstone) already existed; no new quest chain. |
| 13 | Performance | measured: see the handover. Experiments that did NOT help and were reverted: spatial chunking of the static batch, tiling the terrain mesh. |
| 14 | Backlog | unchanged and carried: builder-piece show homes (the three show homes exist), remaining shop / workshop / castle interiors and chapters, accessibility, audio, save export. BLOCKED on a backend: accounts, multiplayer, trading, shared events, online leaderboards. Vehicle racing waits for reliable driving. |
| 15 | Review pack | `Chadverse-Overnight-Review\2026-10-17-complete-upgrade\` |

### Performance measured 17 Oct 2026 (same machine, quality medium, software GL — counts, not frame times; before = commit 6124aa5 on :5181)
| Spot | draw calls before → after | triangles per frame (all passes) before → after | JS heap |
|---|---|---|---|
| avenue | 532 → 455 | 1.43 M → 1.52 M (+7 %) | 191 → 204 MB |
| square | 643 → 673 | 1.80 M → 1.87 M (+4 %) | 190 → 223 MB |
| Haunted Quarter | 750 → 819 | 1.65 M → 1.86 M (+13 %: the Victorian) | 192 → 219 MB |
| Heights | 735 → 790 | 1.45 M → 1.65 M (+13 %: houses, trees) | 192 → 222 MB |
Textures (avenue) 127 → 170 (the PBR sets); geometries unchanged. Steady play vs loading: the Victorian and MX4 files load asynchronously (2.5 MB and 4 MB) after the world is up. **Memory settles**: `scene-leak-test` over 8 enter / exit rounds: geometries 318, textures 117, programs 88 on every round (growth 0). Frame time and hitches could NOT be measured on real hardware (software rendering is about 1 fps). Reverted experiments: chunking the static batch (no triangle saving, +130 draw calls), tiling the terrain (no saving, +400 draw calls).

### Test coverage (all SIMULATED headless browser)
estate-rules-test 14/14 · bike-sim-test ALL PASS · bike-test 25/25 (MX4 and street) · bike-mobile-test 17/17 (emulated touch) · estates-large-test (buy → build → persist, migrated old plot) ALL PASS · heights-walk-test 13/13 · home-test 9/9 · showhome-test 11/11 · launch-test 21/21 · ledge-world-test ALL PASS · parkour-test 22/22 · quest-test 25/25 · events-test 19/19 · fishing-test 14/14 · shop-door-test 13/13 · scene-leak-test settled. Known failing: traversal-test shimmy-both-ways (wall-clock, slower build); species-test (foot-sliding 35 % vs 30 % once, a resource-exhaustion error once — the baseline also lost its WebGL context in that test); interior-test timed out at 482 s with 255 passes (its two failures were the Contemporary show home's door blocked by a tree, fixed and re-verified by showhome-test). NOT run: the other older suites (gym, sword, pistol, valley, descent, chapter 2, …).
