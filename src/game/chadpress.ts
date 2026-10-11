/** Chad Press rules — pure functions so scoring is deterministic and testable. */
export const REPS = 10

export type Grade = 'perfect' | 'good' | 'miss'
export type RepSpec = { center: number; good: number; perfect: number; speed: number }
export type RunState = { rep: number; score: number; combo: number; maxCombo: number; perfects: number; goods: number; misses: number }

export const newRun = (): RunState => ({ rep: 0, score: 0, combo: 0, maxCombo: 0, perfects: 0, goods: 0, misses: 0 })

/** Zone narrows and the marker speeds up every rep. `rand` injectable for tests. */
export function repSpec(rep: number, rand: () => number = Math.random): RepSpec {
  const good = Math.max(0.07, 0.16 - rep * 0.008)
  return { center: 0.25 + rand() * 0.5, good, perfect: good * 0.35, speed: 0.55 + rep * 0.07 }
}

/** Marker position 0..1 (ping-pong) after `t` seconds. */
export const markerAt = (t: number, speed: number) => {
  const x = (t * speed) % 2
  return x < 1 ? x : 2 - x
}

export function judge(pos: number, spec: RepSpec): Grade {
  const d = Math.abs(pos - spec.center)
  if (d <= spec.perfect) return 'perfect'
  if (d <= spec.good) return 'good'
  return 'miss'
}

export function applyGrade(s: RunState, g: Grade): { state: RunState; points: number } {
  if (g === 'miss') return { state: { ...s, rep: s.rep + 1, combo: 0, misses: s.misses + 1 }, points: 0 }
  const mult = 1 + 0.1 * Math.min(s.combo, 10)
  const points = Math.round((g === 'perfect' ? 100 : 50) * mult)
  const combo = s.combo + 1
  return {
    state: {
      ...s,
      rep: s.rep + 1,
      score: s.score + points,
      combo,
      maxCombo: Math.max(s.maxCombo, combo),
      perfects: s.perfects + (g === 'perfect' ? 1 : 0),
      goods: s.goods + (g === 'good' ? 1 : 0),
    },
    points,
  }
}

export const xpFor = (s: RunState) => 20 + Math.floor(s.score / 10)

/** Achievements earned by a finished run. */
export function runAchievements(s: RunState): string[] {
  const out = ['first_set']
  if (s.perfects >= 5) out.push('perfect_form')
  if (s.score >= 800) out.push('iron_chad')
  return out
}
