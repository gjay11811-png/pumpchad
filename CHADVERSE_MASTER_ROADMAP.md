# Chadverse master roadmap

_Last updated 13 October 2026 (end of the v3.0 development session, branch `chadverse-v3`)._

**Status labels.** ✅ **BUILT**: in the game and tested. 🟡 **PARTIAL**: playable, but not finished. 📋 **PLANNED**: design only, nothing in the game yet.
Everything after "Phase 1" is **PLANNED**. Nothing in those sections exists in the game today.

---

## The vision

The Chadverse is a connected browser universe built around the PumpChad mascot. Players start in **Chad Kingdom**, a Halloween fortress village. They train, play and explore there. From the walls they can already see the next destination: **Chad City**, a neon skyline across the valley. Over time the universe opens up into the city, a casino, racing venues, and skate and off-road parks, all joined into one world.

Ground rules that apply to every phase:
- **No real money anywhere.** No real-money gambling, no withdrawable rewards, no wallet betting, no token-gated gameplay. XP, levels, chips and unlocks are cosmetic and stay local.
- **Easy fun first.** Standard vehicles and activities are free to use straight away. Rare items are earned through skill challenges, never bought with money and never behind long grinds.
- **Modular, not monolithic.** Each district is its own scene and asset pack, loaded when you go there.
- **Mobile is a first-class target.** Every phase has to hold the mobile budgets enforced by the test suite.

---

## Phase 0: Starter experience (this session) ✅

| Area | Status |
|---|---|
| Chad Kingdom: walls, 8 watchtowers, south gatehouse, lookout terrace, castle keep landmark | ✅ |
| Kingdom style switch for the community vote (`?castle=gothic` / `?castle=fantasy`) | ✅ (vote still to happen) |
| Distant Chad City skyline: 3 haze layers, lit windows, casino landmark + searchlights, lamp-lit valley road, CHAD CITY · COMING SOON sign | ✅ |
| Pumpkin Chad v2 (Cuban chain, PUMP CHAD letters, glossy ribbed head, shorts logo) with `?pumpkin=classic` rollback | ✅ |
| Animations: idle, walk, jog, sprint, jump (crouch → air → land), turn lean, emotes, sit (benches), crouch pick-up (seeds) | ✅ |
| Chad Gym: bench, curls, squat, heavy bag, deadlift, pull-ups, treadmill + Chad Press | ✅ |
| Progression: XP, level-up moment, strength, stamina, workout stats, daily fatigue anti-farm, profile, records | ✅ |
| Mini-game: Pumpkin Rush | ✅ |
| Mobile Sprint button | ✅ |
| Sculpted head for Pumpkin Chad (needs Blender, see `docs/PUMPKIN_CHAD_V2_ASSET_SPEC.md`) | 🟡 spec written |

## Phase 1: Finish Chad Kingdom 📋

1. **Community vote → final castle style.** Then delete the losing branch of `style.ts` and polish the winner (unique trims, banners, roof tiles).
2. **Castle courtyard (walk-in).** Open the north gate into a small, detailed courtyard: well, training dummies, an armoury door leading to the next mini-game, and the King's balcony for events. Not a huge empty interior.
3. **Second and third mini-games**, one at a time, each finished end to end:
   - *Chad Arcade*: a punching-machine strength test (power meter, local leaderboard) inside the arcade building.
   - *Wall Run*: a timed obstacle course along the battlements (the walkable wall top is the course).
4. **Living village:** NPC daily routines (walk → sit on benches → visit stalls), NPCs using gym equipment, greeting barks, a day/night cycle (the skyline glows brighter at night), ambient audio layers per district.
5. **Shops (cosmetic only):** the wardrobe becomes a tailor's shop in the market, unlocking outfits with XP milestones.
6. **Pumpkin Chad sculpt** dropped in behind `?pumpkin=sculpt`, then made the default once approved.

## Phase 2: Vehicle prototype (test track only) 📋

Build vehicles in an **isolated test scene** first. They join the kingdom only once the handling feels good.

### Recommended physics architecture
- **Engine:** [Rapier](https://rapier.rs) (`@dimforge/rapier3d-compat`, a WASM build). It's deterministic, fast in the browser, and has a ready-made `DynamicRayCastVehicleController`. Load it lazily, only in scenes that have vehicles, so the kingdom never pays its roughly 1.5 MB.
- **Cars (sports, supercars, Formula):** a raycast vehicle with one chassis rigid body and four suspension raycasts, plus an arcade tyre model (grip curves tuned for fun, not simulation). Formula cars get more downforce and grip; drift cars get a lower rear-grip multiplier and handbrake yaw assist.
- **Motorbikes and dirt bikes:** an arcade model on one rigid body with two suspension raycasts. Lean angle comes from speed × steer input. Wheelies and stoppies are pitch torque gated by throttle or brake. Mid-air control is a damped pitch and roll input. Stunt scoring is airtime + rotation + clean landings, judged by the landing angle against the ground normal.
- **BMX and e-bikes:** the same bike model with different mass, speed caps and trick sets.
- **Rider:** the existing 65-bone rig on the vehicle seat. Lean and steer come from bone layers (the same technique as the gym poses), with a thrown-off-and-recover clip for crashes.
- **Networking (later):** server-authoritative positions with client prediction. Rapier's determinism helps.

### Vehicle access design
- **Vehicle stands** at each venue: walk up, press E, pick from 3–4 standard vehicles, ride. No unlocks needed.
- **Special editions** (gold chain livery, pumpkin-head helmet, neon trims) are unlocked by challenge medals, never bought.
- **Parked cars** around Chad City can be borrowed and returned automatically when you leave them.

## Phase 3: Chad City vertical slice 📋

- One playable district (about 300 × 300 m): main boulevard, the **Chad Casino** exterior and lobby, a vehicle dealership showroom (cosmetic), apartments as façades, and two enterable venues.
- The skyline already in the kingdom becomes the LOD 2 impostor of the real city, so the view from the terrace stays truthful.
- Entering goes through the existing **portal transition + background shader pre-compile** flow. The valley road becomes a short drive or cutscene.

### Chad Casino (free-to-play only) 📋
- Visually the landmark of the city: gold crown, neon, searchlights (already teased on the skyline).
- Activities are **free-play novelty games** with cosmetic chips that can't be bought, sold, transferred or withdrawn. Daily free chip refill. No links to wallets or tokens.
- Before building it, get a legal check on how simulated gambling must be presented in target regions (age rating, labelling).

## Phase 4: Racing and action venues 📋

| Venue | Core loop | Notes |
|---|---|---|
| **Motocross park** | Timed laps, dirt jumps, berms, freestyle ramps, stunt challenges | Dirt-bike stand at the gate |
| **Formula circuit** | Time trials → ghost races; pit lane, garages, grandstands, timing system | Formula car stand in the pit lane |
| **Street racing district** | Street circuits, a drift zone with drift scoring, rally stages, cosmetic customisation | Sports-car stand |
| **Skate + BMX park** | Halfpipes, bowls, BMX track, trick combos | Board/BMX stand; reuses the bike model |
| **Off-road / mountain district** | Forest trails, mountain roads, hill climbs, exploration collectibles | Any vehicle; scenic route linking venues |

## Phase 5: Connected universe 📋

- **Map structure:** Chad Kingdom ↔ Chad City ↔ Entertainment District, with spokes out to the Motocross Park, Racing Circuit, Skate Park and Mountain District.
- **Streaming:** each district is a separate `GameScene` with its own lazily imported code chunk (Vite dynamic `import()`) and asset pack (meshopt + KTX2). Transitions reuse the portal flow: start fetching on approach, precompile behind the overlay, swap. Far districts appear as impostors or skyline cards. No single giant map.
- **Shared systems:** one save, one progression, one character, one interaction and prompt system, and one quality-tier system (draw-call and light budgets per tier).
- **Multiplayer (optional, last):** shared presence in hubs, then races. Only after the single-player loop is great.

---

## Technical foundations already in place (reusable for every phase)

- Scene architecture with leak-free transitions and background shader pre-compilation (`Engine.precompile`).
- Quality tiers (light caps, shadow sizes, particle counts), `StaticBatch` geometry merging, instanced vegetation, fog-free haze shaders for distant layers.
- A 65-bone CC0 rig with library clips + procedural pose layers (IK legs, aimed arms, body pitch) for any new activity.
- A reusable tempo-rep station system (`workout.ts`) and pure progression rules (`progression.ts`, with daily fatigue).
- Validated, versioned local saves that tolerate old and tampered data.
- Browser test harness (Playwright, local Chromium): about 20 suites, all run headless.
