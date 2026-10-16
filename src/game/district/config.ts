/**
 * THE NEW DISTRICT — a separate, independently loaded place (its own scene, like a house interior, but outdoors), so the original starter map is never touched.
 * Everything about it hangs off this file: rename it here (`name`), move the entrance, or switch it off (`enabled`).
 *
 * ACCESS: not yet reachable from the starter map (the player-facing entrance is a later step). For review and testing:
 *   - open the game with `?district=1` and press Enter into the world; the district opens straight away, or
 *   - call `window.__chadverse.enterDistrict()` from the console.
 * `?sky=day` is the default look for the district; `?sky=sunset` also works.
 */
export const DISTRICT = {
  /** working name (easy to rename) */
  name: 'Chad City',
  id: 'chadcity',
  /** the district's own coordinate frame: origin at the avenue's centre line, +z = back toward the entry gate, −z = deeper into the district */
  room: { w: 220, d: 260, h: 60 },
  /** where you appear (the gate end of the avenue, looking down the street toward the gym) */
  spawn: { x: 0, z: 70, yaw: 0 },
  /** where you stand in the starter map when you come back out */
  exitAt: { x: 0, z: 56, yaw: Math.PI },
} as const

/** the district is only registered when asked for (URL flag) until its entrance in the starter map is approved */
export const DISTRICT_ENABLED = typeof window !== 'undefined' && /[?&]district=1\b/.test(window.location.search)

/** street geometry shared by every module (metres) */
export const ST = {
  road: 7, // half-width of the carriageway: 14 m = two 3.5 m lanes each way
  kerb: 0.16,
  pave: 6.5, // pavement width each side
  /** the avenue runs along z; the cross street runs along x at this z */
  crossZ: -66,
  cross: 5.5, // half-width of the cross street
}
