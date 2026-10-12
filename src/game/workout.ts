/** Gym station workouts — pure rules (timing, scoring, rewards) so they are deterministic and testable. */
import type { Pose } from './character/build'

export type StationId = 'bench' | 'curl' | 'squat' | 'bag'
export type RepGrade = 'clean' | 'sloppy'

export type StationSpec = {
  id: StationId
  name: string
  /** button label for one rep */
  verb: string
  pose: Pose
  reps: number
  /** seconds per tempo beat; the rep animation always finishes inside one beat */
  beat: number
  /** half-width of the clean window, as a fraction of the beat */
  window: number
  /** pressAmount at rest and at the far end of the movement */
  rest: number
  /** strength points per clean / sloppy rep */
  pts: { clean: number; sloppy: number }
  tip: string
}

export const STATIONS: Record<StationId, StationSpec> = {
  bench: { id: 'bench', name: 'Bench Press', verb: 'Press', pose: 'bench', reps: 10, beat: 1.5, window: 0.16, rest: 1, pts: { clean: 4, sloppy: 1 }, tip: 'Lower the bar, then drive it up on the beat.' },
  curl: { id: 'curl', name: 'Dumbbell Curls', verb: 'Curl', pose: 'curl', reps: 12, beat: 1.15, window: 0.17, rest: 0, pts: { clean: 3, sloppy: 1 }, tip: 'Elbows pinned. Curl when the ring locks in.' },
  squat: { id: 'squat', name: 'Back Squat', verb: 'Squat', pose: 'squat', reps: 10, beat: 1.7, window: 0.15, rest: 0, pts: { clean: 5, sloppy: 1 }, tip: 'Sit back, drive up through the heels.' },
  bag: { id: 'bag', name: 'Heavy Bag', verb: 'Punch', pose: 'guard', reps: 15, beat: 0.85, window: 0.2, rest: 0, pts: { clean: 2, sloppy: 1 }, tip: 'Jab, jab, cross — hit on the beat for full power.' },
}

/** Position inside the current beat, 0..1 (1 = the ring closes on the target). */
export const beatPhase = (t: number, beat: number) => (t / beat) % 1

/** Clean when the tap lands close to the beat (just before or just after the ring closes). */
export function judgeTap(phase: number, spec: StationSpec): RepGrade {
  const d = Math.min(phase, 1 - phase) // distance to the nearest beat
  return d <= spec.window ? 'clean' : 'sloppy'
}

export type SetState = { reps: number; clean: number; sloppy: number; combo: number; maxCombo: number; strength: number }
export const newSet = (): SetState => ({ reps: 0, clean: 0, sloppy: 0, combo: 0, maxCombo: 0, strength: 0 })

/** Combo bonus: +1 point per rep once you chain 3+ clean reps. */
export function applyRep(s: SetState, g: RepGrade, spec: StationSpec): { state: SetState; points: number } {
  const combo = g === 'clean' ? s.combo + 1 : 0
  const points = spec.pts[g] + (combo >= 3 ? 1 : 0)
  return {
    state: {
      reps: s.reps + 1,
      clean: s.clean + (g === 'clean' ? 1 : 0),
      sloppy: s.sloppy + (g === 'sloppy' ? 1 : 0),
      combo,
      maxCombo: Math.max(s.maxCombo, combo),
      strength: s.strength + points,
    },
    points,
  }
}

/** Strength level from lifetime strength points (shown as STR on the HUD). */
export const strengthLevel = (pts: number) => Math.floor(Math.sqrt(pts / 20)) + 1
export const strengthForLevel = (lvl: number) => 20 * (lvl - 1) ** 2
/** main XP for a finished set: a share of the strength earned, plus a bonus for a fully clean set */
export const setXp = (s: SetState, spec: StationSpec) => Math.round(s.strength / 2) + (s.clean === spec.reps ? 10 : 0)
