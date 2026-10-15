/**
 * LAUNCH SCOPE — the one place that says what the first release contains.
 *
 * FIRST RELEASE: CHAD VILLAGE. NEXT UPDATE: CHAD CITY AND THE VALLEY EXPANSION.
 * The Valley Gate (south end of the arrival forecourt) is the boundary. Everything beyond it — the descent road's walkable surface,
 * the valley, Chad City (Downtown, the Gate Plaza, Southshore, Mill Row), the lake and its bridge, the hamlet, woodland, watchtower,
 * Mooncrest Manor and the mountain castle — is the EXPANSION: fully built and tested, but closed. Walking bounds, fast travel, the
 * map, quests, teleports, spawns, interactables and world building all read this file.
 *
 * To open the expansion in the next update: set LAUNCH_EXPANSION_OPEN = true (nothing else needs to change).
 * QA/preview: `?expansion=open` in the URL opens it for that session (used by the preserved valley regression tests).
 */
export const LAUNCH_EXPANSION_OPEN = false

const flag = typeof window !== 'undefined' && /[?&]expansion=open\b/.test(window.location.search)
export const EXPANSION_OPEN = LAUNCH_EXPANSION_OPEN || flag

/** the Valley Gate line: village ground ends here (estates run a little past it on the west side) */
export const GATE_LINE_Z = 78.5
/** a district key that belongs to the expansion */
export const EXPANSION_DISTRICTS = ['downtown', 'plaza', 'southshore', 'millrow'] as const
/** a world point (x, z) that lies in the expansion */
export const inExpansionArea = (x: number, z: number) => z > GATE_LINE_Z || (x > 66 && z > 70)
/** is this point off-limits right now? (always false once the expansion is open) */
export const isLocked = (x: number, z: number) => !EXPANSION_OPEN && inExpansionArea(x, z)

/** where a player lands when something would put them in the locked area: the arrival forecourt, facing the village */
export const SAFE_ARRIVAL = { x: 0, z: 62, yaw: Math.PI }
/** clamp any requested arrival point to open ground */
export const safeArrival = <T extends { x: number; z: number; yaw?: number }>(p: T): T | (T & typeof SAFE_ARRIVAL) => (isLocked(p.x, p.z) ? { ...p, ...SAFE_ARRIVAL } : p)

export const LOCKED_SIGN = 'CHAD CITY — NEXT UPDATE'
export const LOCKED_TITLE = 'The Valley Gate'
export const LOCKED_LINES = [
  'Beyond these gates the road winds down into the valley — a lake, a stone bridge, an old hamlet, a manor on the shore, and Chad City itself beneath the castle mountain.',
  'It is not open yet. The gates stay shut for this first release; everything you have earned — coins, XP, companions, your home — will be waiting when they open in the next update.',
]
export const RELOCATION_NOTICE = ['Welcome back to Chad Village', 'Chad City and the valley open in the next update. Your progress there is safe — we have brought you to the arrival gate.'] as const

/** a save discovery that shows the player has been in the expansion (kept untouched in the save either way) */
export const EXPANSION_DISCOVERY_KEYS = ['visit_downtown', 'visit_overlook', 'visit_castleroad', 'visit_castle', 'visit_southshore', 'visit_millrow', 'visit_hamlet', 'visit_watchtower', 'visit_landing', 'visit_bridge', 'visit_manor']
export const isExpansionDiscovery = (d: string) => EXPANSION_DISCOVERY_KEYS.includes(d) || d.startsWith('disc_') || d.startsWith('valley_')
