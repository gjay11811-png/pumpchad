/**
 * Progression rules — pure functions so they're deterministic and testable.
 * Everything is local, cosmetic and non-withdrawable: XP, levels and stats have no monetary value.
 */
import type { StationId } from './workout'

/** which stat a station trains: cardio stations build stamina, everything else strength */
export const STAT_FOR: Record<StationId, 'strength' | 'stamina'> = {
  bench: 'strength',
  curl: 'strength',
  squat: 'strength',
  deadlift: 'strength',
  pullup: 'strength',
  bag: 'stamina',
  treadmill: 'stamina',
}

/** stat level from lifetime points (same curve for strength and stamina) */
export const statLevel = (pts: number) => Math.floor(Math.sqrt(Math.max(0, pts) / 20)) + 1

/**
 * Anti-farm: the first sets each day at a station pay in full, then rewards fall off.
 * Sets 1–3: 100% · 4–6: 50% · 7+: 10%. Resets at local midnight. Reps still count toward lifetime totals.
 */
export const FATIGUE_STEPS = [
  { upTo: 3, mult: 1 },
  { upTo: 6, mult: 0.5 },
  { upTo: Infinity, mult: 0.1 },
] as const
/** reward multiplier for the next set, given how many sets were already finished at this station today */
export const fatigueMult = (setsDoneToday: number) => FATIGUE_STEPS.find((s) => setsDoneToday < s.upTo)!.mult

/** local calendar day, e.g. 2026-10-13 */
export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export type Daily = { day: string; sets: Record<string, number> }
/** today's counters (a new day starts fresh) */
export const rollDaily = (d: Daily | undefined, day = today()): Daily => (d && d.day === day ? d : { day, sets: {} })

/** Apply fatigue to a finished set's rewards. XP never drops below 1 so a finished set always registers. */
export function setRewards(baseXp: number, statPts: number, setsDoneToday: number) {
  const mult = fatigueMult(setsDoneToday)
  return { xp: Math.max(1, Math.round(baseXp * mult)), stat: Math.round(statPts * mult), mult }
}

/** levels crossed when XP goes from `a` to `b` (empty when no level-up) */
export function levelsGained(a: number, b: number, levelFor: (xp: number) => number) {
  const out: number[] = []
  for (let l = levelFor(a) + 1; l <= levelFor(b); l++) out.push(l)
  return out
}
