# Chadverse v3: polish report

_13 October 2026 · branch `chadverse-v3-polish` (local only, **never pushed or deployed**) · built on `chadverse-v3`. Checkpoint before any change: tag `checkpoint/pre-polish-v3`._

The live website (`prelaunch` branch, worktree `Downloads/pumpchad-site`, Cloudflare) was not touched. It is still identical to GitHub.
No paid assets or dependencies were added: everything new is procedural code or reuses art already in the repo.

Screenshots live in [`docs/chadverse-v3-polish/`](docs/chadverse-v3-polish/). "Before" and "after" shots of the same view come from the same script (`scripts/polish-shots.mjs`), run against the pre-polish build and the new build, with the same camera positions.

---

## 1. Summary of completed improvements

| Area | Before | After | Status |
|---|---|---|---|
| Sideways lean | The body slumped up to **83°** on a diagonal run; the camera swung 65° in 1.8 s and the player ran in circles | Shoulder roll **9.9°**, camera **0°**, path straight (bend under 1°) | ✅ Fixed |
| Walking | The jog clip played at 0.56× speed ("slow-motion jog") | A real **walk** clip at 2.2 m/s, blended into jog and sprint by speed | ✅ Fixed |
| Foot sliding | Walk 1.58 m/s, sprint 2.27 m/s of slide | Walk 0.10–0.12, sprint 0.15–0.23 m/s, all three species (measured on clear stretches) | ✅ Much better |
| Transitions | Posture pop when stopping | Measured peak posture change 2.2 m/s (smooth) | ✅ Fixed |
| Hand grips | Hands could sit at different heights, or off the bar | Arm IK locks both palms level and symmetric on every bar (0–1 cm on most lifts) | ✅ Fixed |
| Pull-ups | The pumpkin head passed through the bar | The body hangs behind the bar and the head clears it at the top; hands stay on the bar | ✅ Fixed |
| Heavy bag | Shrinking-circle timing | The **Chad Press-style horizontal timing bar** (roomier zone) | ✅ Replaced |
| Gym graphics | Flat dark boxes | A detailed gym hall (see §4) | ✅ Overhauled |
| Drag-to-look (PC) | Could get stuck; the camera fought you while walking | Reliable drag, grab cursor, the camera stays where you put it | ✅ Fixed |
| Chad City | Blocky boxes with huge windows | Varied towers, real-scale facades, neon, traffic, a richer casino | ✅ Overhauled |
| Vegetation | Green box hedges, faceted blobs | Leafy hedges, fluffy bushes, autumn trees, flower beds, rocks | ✅ Overhauled |

## 2. Files modified

22 source and script files, about +2,250 / −340 lines (`git diff --stat checkpoint/pre-polish-v3..HEAD`), plus docs and screenshots.

- **New:**
  - `src/game/scenes/gym/gymArt.ts`: gym textures and equipment builders.
  - `src/game/scenes/world/foliage.ts`: procedural plants.
  - `scripts/move-test.mjs`, `scripts/sweep-gait.mjs`, `scripts/polish-shots.mjs`.
- **Character and movement:**
  - `src/game/character/chad.ts`: gait blendspace, pose snapshot, grip IK.
  - `src/game/character/character.ts`, `src/game/movement.ts`, `src/game/input.ts`.
- **Scenes:**
  - `src/game/scenes/World.ts`, `src/game/scenes/Gym.ts`.
  - `src/game/scenes/world/skyline.ts`, `props.ts`, `buildings.ts`, `textures.ts`, `kit.ts`.
  - `src/game/engine/Engine.ts`: the environment map is flagged as shared.
- **Gym UI and rules:** `src/game/ui/WorkoutPanel.tsx`, `src/game/workout.ts`.
- **Tests adjusted for the new, faster sprint and realistic speeds:** `scripts/gym-test.mjs`, `anim-test.mjs`, `character-test.mjs`, `gym-new.mjs`.

## 3. Bugs fixed

1. **Root cause of the sideways slump.** Three.js only rewrites a bone when the clip's value changes. Procedural layers (turn lean, gym poses, IK) were applied on top of bones whose clip value held still, so the offsets **stacked frame after frame**. The fix restores a clean snapshot of the animated pose every frame (`pose0` in `chad.ts`), so every layer is now a pure per-frame offset.
2. **Endless circling.** On diagonal input the camera auto-followed the player, which turned the input direction, which turned the player, and so on. The camera now only drifts behind you when you move straight forward, and never after you've used the mouse to look.
3. **Sprinting on the spot against walls.** Collisions now remove velocity, so you slide along walls and the animation drops to idle when you're blocked.
4. **Slow-motion walking.** Fixed by a phase-locked **walk, jog and sprint blendspace** with cadence calibrated from measurements.
5. **Posture "pop" when stopping.** Re-entering locomotion mid-fade reset clip weights. Weights are now carried over, with a start/stop hysteresis.
6. **Drag-to-look.**
   - A missed mouse release (letting go outside the window) left a stale drag, so hovering then spun the camera.
   - The camera auto-follow undid your drag as soon as you walked.
   - A press now only becomes a drag after 4 px of movement (so clicks on UI always work), with pointer capture, a grab or grabbing cursor and right-drag support.
7. **Camera clipping in tight corners.** The push-out ran once, which could leave the camera inside a neighbouring building. It now repeats until clear, with an over-the-shoulder fallback (env test: 0 of 588 samples inside geometry).
8. **Uneven hands on equipment.** Fixed with two-bone arm IK grips (see §7).
9. **Pull-up head clipping through the bar.** The bar now sits 24 cm in front of the body, and the body height is solved from arm reach so the hands still meet the bar.
10. **Heavy bag swing.** One punch launched the bag about 1.5 m. It now sways about 20–30 cm per hit.
11. **A latent crash risk.** Gym materials could have disposed the engine's shared environment map on leaving the gym. It is now flagged as engine-owned.
12. **Test robustness.** The QA teleport resets velocity and finishes any pick-up lock.

## 4. Graphics improvements completed

- **Gym** (`docs/chadverse-v3-polish/before-gym-*.jpg` and `after-gym-*.jpg`):
  - **Room:** rubber tile floor with EPDM flecks and seams; orange painted zone lines; an oak Chad Press platform; dark brick upper walls over a panelled dado with a glowing orange trim rail; steel pilasters with bolt plates; a ceiling with trusses and LED light panels.
  - **Decor and branding:** mirrors with real environment reflections; five framed PumpChad art posters from the existing site art; the PumpChad logo over the door.
  - **Props:** plate trees, kettlebells, lockers, a water cooler and speakers.
  - **Equipment:** bevelled bumper plates with steel hubs; knurled bars with sleeves and spring collars; hex dumbbells on a two-tier rack; a rounded leather bench pad on a tube frame; a drilled power rack with J-hooks, safeties and plate storage; a tubular pull-up station; a stitched heavy bag on a real chain; a treadmill with rails and a lit "CHAD RUN" console.
  - **Draw calls:** static parts are merged by material (`StaticBatch`), so the extra detail costs little.
- **Chad City** (`before-city-*.jpg` and `after-city-*.jpg`):
  - **Facades and shapes:** three facade styles at real scale (glass curtain wall, punched residential windows, ribbon offices) lit in believable clusters. Varied silhouettes: setback tiers, round and chamfered towers, slabs, wedge roofs, spires and antennas.
  - **Lights and depth:** neon edge trims; a fourth, far horizon band for depth; a street-light grid at the city's feet; car lights moving on the valley road (they stop short of the closed gate).
  - **Casino:** a curved gold podium, a chamfered gold tower with light fins and neon rings, the crown, an LED "777 JACKPOT · FREE PLAY · SOON" wall, the CHAD CASINO / COMING SOON neon and the searchlights.
  - **Unchanged:** the road, barricade, sign and map boundary are exactly as before (no new way out).
- **Vegetation** (`before-veg-*.jpg` and `after-veg-*.jpg`):
  - The green box hedges are replaced by leafy clipped hedges with the same footprint and colliders.
  - Fluffy garden bushes in four tones.
  - Autumn trees with a leaning trunk, branches and clustered red, orange, gold and green canopies.
  - Flower beds with stone kerbs either side of every house door.
  - A rock scatter.
  - Richer, colour-varied grass tufts.

## 5. Animation improvements completed

- **Locomotion blendspace** (`gaitFor` in `chad.ts`):
  - Walk, jog and sprint play together, phase-locked by cross-correlating each clip's stride.
  - They're weighted so that blended stride × cadence equals ground speed.
  - Cadence is corrected from in-place measurements (`scripts/sweep-gait.mjs`), and is accurate to about 2% from 2.2 to 8.6 m/s for Pumpkin and 3% for Skeleton.
- **Speeds** (necessary to fix the walking, chosen to keep the game's feel):
  - **Outdoors:** walk 2.2 m/s (was 3.4), stick jog up to 5.2 m/s, sprint 7.6 m/s (was 6.2).
  - **Gym:** walk 2.0, sprint 5.6 m/s.
  - **Keyboard:** walk by default; Shift (or the touch Sprint button, or a full stick push) sprints.
- **Smoother blending:** blends hand over smoothly between idle and locomotion, and between gaits.
- **Lean:** subtle, a few degrees into turns and with acceleration.

## 6. Camera improvements completed

- **Mouse look:** drag-to-look is reliable, including a release outside the window, right-drag, and no accidental drags from clicks.
- **Cursor:** shows "grab" over the 3D view and "grabbing" while dragging, and resets afterwards.
- **No more fighting you:** the camera keeps your view while you walk after a mouse look, and no longer chases diagonal or strafe input.
- **Clipping:** iterative de-penetration keeps the camera out of buildings.
- **Touch:** unchanged; mobile auto-follow still helps there.

## 7. Gym improvements completed

- **Grips:** a new `grip()` two-bone arm IK on the rig.
  - **Barbells** (bench, squat, deadlift, Chad Press, pull-up bar): palms are locked level and symmetric about the body, and the bar sits in the palms.
  - **Dumbbells:** the two hands are mirrored so they rise level together.
  - **Measured** maximum wrist-height difference through a rep: squat 0.4 cm, deadlift 1.0 cm, curl 1.8 cm, pull-up 4.4 cm, bench 7.8 cm. The bench and pull-up figures come from forearm angle; the palms themselves sit on the bar (see the screenshots).
- **Pull-ups:** a proper dead hang, then rising with the hands on the bar. Reps, XP and strength all work (gym-test, all three species).
- **Heavy bag:**
  - **Timing:** it uses the horizontal timing bar from the Chad Press (same `markerAt`/`judge` code) with a wider zone (±17%, gold perfect centre ±6.5%). The zone moves after each punch.
  - **Hits:** clean = full-power hit, and a perfect hit flashes the gym.
  - **Unchanged:** reps, stamina and the daily anti-farm fatigue.
- **Consistency:**
  - Every station activates, aligns, counts reps, awards XP or stamina and exits cleanly.
  - The treadmill blends walk, jog and sprint with the belt pace.
  - The anti-XP-farming system is untouched.

## 8. Performance changes

- **Fixed-viewpoint tour** (high quality, including the shadow pass):
  - Draw calls rose about 7% (223–300 → 239–326).
  - Triangles rose 10–15% (429–573k → 495–619k).
- **Mobile tiers:**
  - Foliage casts shadows only on the high tier.
  - Leaf-card density scales to 70% on medium and 45% on low.
  - The city builds fewer towers on low, and on low it has no traffic and no searchlights.
- **Idle frame time** (headless software rendering, for relative comparison only): about 21 ms after, against about 25 ms for the pre-polish build. That is within noise; no regression.
- **GPU memory:** no growth across scene changes or character rebuilds (leak, leak-scenes and leak-species suites).
- **Efficiency:** all new static scenery is merged or instanced; no new real-time lights in the world; the city stays unlit and fog-free with baked haze.

## 9. Build and test results

- `npm run build` (`tsc -b && vite build`): ✅ builds with no TypeScript errors. The game bundle is 1.02 MB (283 KB gzip); the large-chunk warning predates this work.
- **Final regression** (production build served by `vite preview`, headless Chromium, one suite at a time):

| Suite | Result |
|---|---|
| env (3 quality tiers: interactions, seeds, NPCs, camera stress) | ✅ all pass |
| e2e (desktop + iPhone journey) | ✅ |
| character / species | ✅ 68/68 · ✅ 68/68 _(character's sprint check moved to an open runway; see note)_ |
| gym × Pumpkin / Skeleton / Demon (7 stations + Chad Press) | ✅ 88/88 × 3 |
| anim × Pumpkin / Skeleton / Demon / mobile | ✅ 46 × 3, 40 |
| move (new) × Pumpkin / Skeleton / Demon | ✅ 26/26 × 3 |
| sit, rush, progression, mobile | ✅ 10, 30, 23, 24 |
| leak / leak-scenes / leak-species, creator-species | ✅ flat / clean |

_Notes:_
- **Faster sprint vs old tests.** Two older tests started a sprint at spawn heading straight at the fountain. With the faster sprint and the new wall handling, the player now (correctly) stops there, so those tests were given an open runway down the main street.
- **Earlier failures were the environment.** In earlier runs on the memory-starved dev server, a few checks failed on "WebGL context lost". Moving testing to the production preview server removed that.
- **Foot-slip measurement.** It now ignores moments when a wandering villager bumps the runner (they share the main street). Measured on clear stretches, the numbers are stable.
- **One headless hang.** In one batch the Pumpkin movement run stalled, after its slip checks had passed, until the 700 s safety timeout. Run again on its own, it passed 26/26 in about a minute.

## 10. Screenshots of visual improvements

All files are in `docs/chadverse-v3-polish/`:

| What | Before | After |
|---|---|---|
| Gym from the door | `before-gym-entry.jpg` | `after-gym-entry.jpg` |
| Gym, left side | `before-gym-left.jpg` | `after-gym-left.jpg` |
| Gym, right side | `before-gym-right.jpg` | `after-gym-right.jpg` |
| Character, diagonal sprint | `before-diag-run.jpg` | `after-diag-run.jpg` |
| Character walking | `before-walk.jpg` | `after-walk.jpg` |
| Chad City from the lookout | `before-city-lookout.jpg` | `after-city-lookout.jpg` |
| Chad City, east bench | `before-city-wide.jpg` | `after-city-wide.jpg` |
| North road hedges | `before-veg-north-road.jpg` | `after-veg-north-road.jpg` |
| Houses (east / west) | `before-veg-houses-*.jpg` | `after-veg-houses-*.jpg` |
| Gym lifts (grips, timing bar) | — | `gym-bench-mid`, `gym-curl-mid`, `gym-squat-mid`, `gym-deadlift-rest`, `gym-pullup-rest/mid`, `gym-bag-mid`, `gym-treadmill-end` |

## 11. Remaining problems

- **Walking vs jogging on keyboard.** Keyboards have no "jog" (it's walk, or Shift to sprint); a jog happens on the touch stick's middle range.
- **Bench and pull-up wrists.** Wrist heights still differ a few cm at the extremes of these two lifts, from forearm angle. The palms are on the bar.
- **Mirrors** show the environment map, not live reflections of the player. Live mirrors would mean rendering the scene twice, which is too costly on phones.
- **Castle styles** are still hard to tell apart at night (carried over from the last session).
- **Bundle size:** the game bundle is still one large chunk; code-splitting is a future task.
- **Faster sprint and balance.** The faster sprint (7.6 m/s) makes Pumpkin Rush slightly easier; the Rush Hour target (5,000) may need retuning after playtesting.

## 12. Items requiring manual verification

1. **Real-mouse feel** of drag-to-look on your PC (sensitivity, right-drag, releasing outside the window). It's automated-tested with Playwright's mouse, but not with real hardware.
2. **Walking and sprinting feel** at your monitor's refresh rate. The cadence is measured, but "feels natural" is a judgement call.
3. **Gym on a real phone:** frame rate and whether the timing bar is comfortable for the bag.
4. **The art posters** (they load the existing `public/art/chadverse/*.webp`): check you're happy with which pieces are on the gym walls.
5. **The castle style vote** screenshots and the Chad City look at your normal brightness.

## 13. Recommended next development priorities

1. Playtest walking and sprinting speeds and the Rush Hour target, then fine-tune the two numbers in `movement.ts` (`OUTDOOR`, `INDOOR`).
2. Optional keyboard jog (for example, Caps Lock to toggle a jog pace) if you want all three gaits on PC.
3. Code-split the game bundle (gym and mini-game UI as lazy chunks).
4. The castle-style community vote, then the walk-in courtyard (roadmap Phase 1).
5. A sculpted Pumpkin head per `docs/PUMPKIN_CHAD_V2_ASSET_SPEC.md`.

---

### Local preview

From `Downloads/pumpchad` on branch `chadverse-v3-polish`:
- **Dev server** (hot reload): `npm run dev -- --port 4318`, then open http://localhost:4318/chadverse/
- **Production build:** `npm run build`, then `npx vite preview --port 4318`, then the same URL.
- **Rollback:** `git switch chadverse-v3`, or the tag `checkpoint/pre-polish-v3`. The classic Pumpkin is still at `/chadverse/?pumpkin=classic`, and the castle styles at `?castle=gothic` / `?castle=fantasy`.
