# Chadverse — master requirements (condensed)

Source: Jay's master specification + mobile priority fixes + art-direction update (Oct 2026). Status lives in
`CHADVERSE_MASTER_PLAN.md`; this file only lists *what* is required, so nothing is dropped between sessions.

## Ground rules
- Preserve: the finished gym (interior + mechanics), playable roster + customisation, movement/camera, saves, working activities.
- Stages, working build throughout, checkpoint each stage. Never publish/deploy automatically.
- No fake interactions or decorative "minigames". Chad Coins are in-game only (never real money / token).
- Online features (leaderboards, voting, visiting, shared events, trading) only when real backend + identity exist.
- Done = verified in gameplay (not "it compiles"). Report what was actually tested, simulated vs real device.

## Mobile (priority)
- Stuck movement: release/cancel/lost capture/off-zone/background/rotation/menus always stop movement; separate fingers; no stale listeners.
- Portrait HUD: challenges collapse to a compact tab → scrollable sheet ≤ ½ height, swipe-down + close; grouped notifications; menus never move the game; safe areas; landscape compact.

## Art direction (definitive reference image)
- Blue/purple evening sky, luminous moon, warm gold windows + lanterns, readable paths/entrances/characters.
- Gothic stonework, arched openings, layered facades, varied roofs; ornate dark signs with raised gold letters + crests.
- Ivy/wisteria, flowers, planted borders, trees; detailed cobbles; courtyards; bridges/water; grand castle skyline.
- Finished-shop quality: recessed entrances, display windows with real interiors, aligned windows, cornices, physical signs.
- CHAD FITS (boutique), CHAD PETS (lively, shopkeeper), CHAD MOTORS (spacious glass showroom). Names: CHAD ___ scheme.
- Memorable views: gateway arrival, square, shopping street, bridge/waterfront to castle, residential gardens.
- Practical for phones + modest laptops (shared materials, on-demand interiors, economical lighting).

## World
- Fix list (bridge fences, GATES CLOSED sign + bushes, dead-end path, castle pumpkin decor, CHAD sign, windows, glitches).
- Double the current playable area (measure before/after; exclude scenery/water/padding); loops, shortcuts, fast travel.
- Districts: Chad Square, shopping street, Haunted Quarter, Castle District, Festival Grounds, Chadville Estates, Enchanted Forest, Moonlight Lake.
- All village houses enterable, varied interiors, stairs, clear entries/returns, on-demand loading.
- Castle: silhouette, gatehouse, recessed doors, nameplate; closed rooms clearly explained.
- NPCs: distinct villagers (not Chad copies), bounded routines, never block doors; not presented as online players.

## Gameplay
- Opening adventure (keeper, restore 3 lanterns, golden symbol, first XP + coins, points to the castle; no repeat).
- Curse of the Chadverse chapters (village → Haunted Quarter → forest → Order → castle trials/dungeon → world change).
- One progression/inventory system: XP/levels, Chad Coins, items, cosmetics, companions, quests, records, achievements, housing.
- Shops with browse/preview/buy/equip/close: clothing, pets, Chad Motors (inspect, info, colour preview, ownership; driving only when reliable), furniture/building supplies, café/shakes.
- Pets: black cat, ghost, bat, mini pumpkin; follow/catch up/dismiss/recall, saved; creature journal.
- Activities (start/rules/controls/win-fail/score/reward/replay/exit/records): racing, target throw, ghost hunt, escape room, parkour, maze, dungeon, fishing, farming, treasure hunts, gym challenges.
- Chadville Estates: buy plot, modular build (snap/rotate/validate/undo/move/remove), save, enter, decorate, trophies.
- Restoration projects; Order of the Golden Pumpkin; daily/weekly challenges (local until backend); bounded world events.
- Map (filters, track one objective), quest journal, profile/legacy, photo mode.
- Saving: versioned local save with migrations, reset confirm, export/import; account saving needs backend.
- Audio (district ambience, separate music/effects), accessibility (reduced motion/effects, readable text).
- Performance: chunk/district loading, instancing, LOD, light/shadow budgets, distant NPC limits.
