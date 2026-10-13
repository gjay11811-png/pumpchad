# CHAD CITY — overnight build report

Branch: `chadverse-chad-city` (local only — nothing pushed or deployed; prelaunch worktree untouched).
Preview: `npx vite preview --port 4318 --strictPort` → http://localhost:4318/chadverse/
Screenshots: `docs/chad-city/` (`before-*` = previous starting area, `after-*` = Chad City).

## Summary
- The dark night-time starting square is now **CHAD CITY**: a bright daytime town. The sky has drifting clouds, a sun with soft shadows and distance haze, and the mountains now have snow caps.
- The walkable area grew from about 3,700 m² to about 8,800 m² (**≈2.4×**). Three new districts (south, east and west) and an overlook connect to the original square.
- One sign style is used everywhere: channel letters, framed boards, hanging signs and plaques. CHAD CITY, CHAD SQUARE, PUMP GYM, PUMP ARCADE, CHAD RIDES and CHAD CITADEL are named consistently.
- Nothing about earning, trading or farming was added. The Community Champions case is deliberately empty and says so. The bikes can't be ridden and show "Chad Rides — bikes are coming in a future update." There's no release date and no vehicle physics.

## Areas
| Area | What's there |
|---|---|
| Arrival forecourt (spawn) | CHAD CITY gateway arch with lettering on both faces, crown, banners, WELCOME board, live city map board, greeter NPC Goldie, fingerposts |
| Valley gate + **Chad Rides** | Bike shelter, rack, three bikes plus one by the gate, COMING SOON board; the interaction shows the teaser message |
| Canal + **Chad Bridge** | Water channel, embankments, railings, a stone arched bridge with lantern pillars and plaques, two timber footbridges, promenades |
| **Chad Square** | Fountain kept; stone paving; a new noticeboard; Community Champions glass case (empty pedestals plus a plaque); statue lectern |
| **Pump Gym** + yard | New brick-and-glass frontage and canopy, PUMP GYM letters; outdoor training yard (rig, dip bars, plyo boxes, tyre, battle ropes, yard board) |
| Arcade Street + **Pump Arcade** | Four shops (Pump Supply, Chad Snacks, Chad Cuts, Fresh Fits), a marquee with bulbs, fictional game posters, OPENING SOON |
| Market + social corner | PUMP SHAKES stall (Mo), pergola with string lights, picnic tables |
| Garden | Gravel loop, flower beds, hedges, gazebo (you can stand in it), rill pool, benches |
| Overlook | Compass paving, coin viewer, benches, CHAD VIEW lectern |
| **Chad Citadel** approach | New gatehouse with a real arched doorway and plank double doors (straps, studs, rings), forecourt, flags, topiary, lore lectern, GATES CLOSED notice |
| Lawns | Pumpkin patch (scarecrow, prize pumpkin), sundial lawn, orchard |

## Interactions added
- **Discover Chad City:** visit the Square, Pump Gym and Citadel, plus find the overlook, arcade and rides. Progress shows in the HUD (`Discover Chad City n/5`), and finishing unlocks the `city_explorer` achievement.
- **Six hidden pumpkins** across the districts unlock `pumpkin_hunter`. They save, and give no repeat reward.
- **New dialogues:** welcome board, city map, Chad Rides, overlook, citadel lore, Champions case, yard board, greeter, shake stall. Pip, the city guide, has been updated.
- **About 15 new NPCs:** benchgoers, chatting pairs, push-ups, a flexer, a reader and four more walkers. They scale with the quality setting.
- **Photo mode** (camera button in the HUD): hides the HUD and saves a watermarked PNG, using share on phones. Esc exits.
- **First-visit intro flyover**, which can be skipped. Force it with `?intro=1`.
- **Sound:** daytime birdsong in the square.
- **Debug:** `?sky=sunset` gives an alternate sky. `?pumpkin=classic` and `?castle=` still work.

## Preserved (verified by tests)
- Character creator and wardrobe, movement and camera, saves.
- Pump Gym interior and every exercise; the gym round trip; the coin toss; benches and sitting; Pumpkin Rush; the main site.

## Checks actually run (headless Chromium, this machine)
| Suite | Result |
|---|---|
| city-test (new) | 65/65 |
| kingdom-interact | 71/71 |
| env-test | 31/31 |
| sit-test | 11/11 |
| anim-test (4 runs) | 47/47 |
| gym-test (3 species) | 88–89/89 each. Pumpkin and Demon had 1–2 timing flakes in the batched run but **passed 88/88 when rerun alone** |
| e2e | 57 |
| character / species | 69 / 69 |
| move (×3), rush, progression, mobile | 27 / 31 / 24 / 25 |
| leak, leak-species, leak-scenes | flat (0 textures or geometry growth per rebuild or round trip) |
| Page errors in shot runs | none |

**Performance (headless software-ish GPU, so treat it as relative):**

| | Before | After |
|---|---|---|
| Median world load | 10.8 s | 10.4 s |
| Idle frame time | 20.9 ms | 21.3 ms |

On high quality the aerial view is about 413 draw calls and 774k triangles.

## Known issues and deferred
- **gym-test is timing-sensitive** under memory pressure; the machine has 3.5 GB. It fails intermittently in big batched runs and passes when run alone.
- **Context loss on low-memory devices:** an earlier batched run saw WebGL context loss on the iPhone/medium profile. Below high quality, texture sizes are now lower and env-test passed afterwards, but this still needs checking on a real phone.
- **Some placeholders:**
  - Pump Arcade, Chad Citadel interior and Chad Rides are facades or teasers only. This is intentional.
  - The Champions case stays empty until real winners exist.
- **Not done:** night/day cycle, weather, interiors for the shops, real arcade games.

## Inspect first in the morning
1. Load http://localhost:4318/chadverse/ with a fresh save to see the intro flyover, the gateway and the welcome board.
2. Walk north over Chad Bridge into the square, then east to Pump Gym and Arcade Street.
3. Check the citadel doors, Chad Rides by the valley gate, and the garden and overlook in the west.
4. Try photo mode (camera icon) on your phone, and check whether the frame rate holds.
5. Compare `docs/chad-city/before-spawn.jpg` with `after-spawn.jpg`, and look at `after-aerial.jpg`.
