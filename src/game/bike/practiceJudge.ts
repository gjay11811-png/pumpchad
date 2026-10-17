import { PRACTICE } from './practice'

/**
 * THE PRACTICE JUDGE — pure logic (no meshes): watches the riding model's state while the rider is on the practice strip and scores six small challenges. Nothing here
 * ever feeds back into the riding; it only reads. Scores are 0..100 and reward SMOOTH, CONTROLLED riding: sitting in the balance band, a gentle lift, a soft landing.
 * An extreme angle or a crash never scores high (a loop-out or a crash caps the attempt).
 *
 *   lift      front wheel up past 10° inside the LIFT ZONE; the nicer the rise (low pitch rate) the better; height beyond 30° adds nothing
 *   balance   hold 15°–35° (the BALANCE BAND) for 2.5 s of one wheelie; every second in the band counts, time out of it (or past 45°) does not
 *   cones     weave the five cones: each one passed on the correct side and clear of it; a smooth line earns the rest
 *   onehand   hold the one-hand pose for 1.5 s inside a wheelie (the pose only exists while the front wheel is up)
 *   scrape    drag a footpeg on a hard lean inside the SCRAPE SECTION for at least 0.4 s while keeping the bike up
 *   landing   bring a wheelie of at least 15° back down: the softer the touchdown the better
 */
export type ChallengeId = 'lift' | 'balance' | 'cones' | 'onehand' | 'scrape' | 'landing'
export const CHALLENGES: { id: ChallengeId; name: string; hint: string }[] = [
  { id: 'lift', name: 'Lift zone', hint: 'Roll on the gas in the blue box: lift the front smoothly past 10°' },
  { id: 'balance', name: 'Balance', hint: 'Hold the front between 15° and 35° for 2.5 s — ease the gas to hold, Brake to lower' },
  { id: 'cones', name: 'Cone weave', hint: 'Weave all five cones without touching them' },
  { id: 'onehand', name: 'One hand', hint: 'Once the front is up, hold ONE HAND for 1.5 s' },
  { id: 'scrape', name: 'Scrape section', hint: 'Lean hard through the yellow section until a peg scrapes (0.4 s)' },
  { id: 'landing', name: 'Landing', hint: 'Bring a 15° wheelie down softly' },
]

export type Sample = {
  x: number
  z: number
  v: number
  pitch: number
  pitchRate: number
  roll: number
  oneHand: number
  scrapePart: 'peg' | 'tail' | 'bash' | null
  touchdown: number
  crashed: boolean
}
export type Result = { id: ChallengeId; score: number; line: string }

/** where each challenge happens along the strip (z), reusing the route's marks */
export const ZONES = {
  lift: { z0: 57, z1: 65 },
  balance: { z0: 57, z1: 72 },
  scrape: { z0: 20, z1: 40 },
  cones: { z0: PRACTICE.slalom[0] - 3, z1: PRACTICE.slalom[PRACTICE.slalom.length - 1] + 3 },
  halfWidth: 4.2,
}
const inStrip = (x: number) => Math.abs(x - PRACTICE.x) <= ZONES.halfWidth + 0.5
/** the scrape section is judged over a wider band: a hard lean carries the bike sideways */
const inScrapeBand = (x: number) => Math.abs(x - PRACTICE.x) <= 8
const inZ = (z: number, a: number, b: number) => z >= a && z <= b

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const DEG = Math.PI / 180

export class PracticeJudge {
  results: Result[] = []
  /** the challenge shown on the small card right now (null = nothing active) */
  active: ChallengeId | null = null
  line = ''
  private pb: Record<string, number>
  // lift
  private liftOn = false
  private liftMaxRate = 0
  private liftDone = false
  // balance
  private balIn = 0
  private balUp = 0
  private balPeak = 0
  private balDone = false
  // cones
  private coneI = 0
  private coneHit = 0
  private coneOk = 0
  private coneRollMax = 0
  private coneLastZ = 0
  // one hand
  private oh = 0
  private ohDone = false
  // scrape
  private scr = 0
  private scrDone = false
  // landing
  private upMax = 0
  private landed = false
  private wasUp = false

  constructor(best: Record<string, number>) {
    this.pb = { ...best }
  }
  best(id: ChallengeId) {
    return this.pb[id] ?? null
  }
  bests() {
    return { ...this.pb }
  }

  private finish(id: ChallengeId, score: number, line: string): Result {
    score = Math.round(Math.max(0, Math.min(100, score)))
    const prev = this.pb[id] ?? 0
    const isBest = score > prev
    if (isBest) this.pb[id] = score
    const r = { id, score, line: `${line}${isBest && prev > 0 ? ' · new best' : ''}` }
    this.results.push(r)
    this.line = r.line
    return r
  }

  /** the strip's attempts start fresh when the rider leaves it */
  private reset() {
    this.liftOn = this.liftDone = false
    this.liftMaxRate = 0
    this.balIn = this.balUp = this.balPeak = 0
    this.balDone = false
    this.coneI = this.coneHit = this.coneOk = 0
    this.coneRollMax = 0
    this.oh = 0
    this.ohDone = false
    this.scr = 0
    this.scrDone = false
    this.upMax = 0
    this.landed = false
    this.wasUp = false
    this.active = null
  }

  /** one frame; returns the results that finished this frame (for a brief note) */
  update(dt: number, s: Sample): Result[] {
    const out: Result[] = []
    if (!inScrapeBand(s.x) || s.z < PRACTICE.start - 3 || s.z > PRACTICE.end + 3) {
      if (this.active || this.liftOn || this.balUp > 0 || this.coneI > 0) this.reset()
      this.active = null
      return out
    }
    const up = s.pitch > 0.17 // 10°
    this.active = null

    // ── lift zone ──
    const onStrip = inStrip(s.x)
    if (onStrip && inZ(s.z, ZONES.lift.z0, ZONES.lift.z1) && !this.liftDone && !s.crashed) {
      this.active = 'lift'
      if (up) {
        this.liftMaxRate = Math.max(this.liftMaxRate, s.pitchRate)
        this.liftDone = true
        const smooth = 1 - clamp01((this.liftMaxRate - 0.35) / 0.65) // a slow, progressive rise
        const height = clamp01(s.pitch / (30 * DEG)) // beyond ~30° adds nothing
        out.push(this.finish('lift', 40 * smooth + 35 * height + 25 * clamp01(s.v / 6), `rise ${(this.liftMaxRate * 57.3).toFixed(0)}°/s`))
      } else this.liftMaxRate = Math.max(this.liftMaxRate, s.pitchRate)
    }

    // ── balance band ──
    if (onStrip && inZ(s.z, ZONES.balance.z0, ZONES.balance.z1) && !s.crashed) {
      if (up) {
        this.balUp += dt
        this.balPeak = Math.max(this.balPeak, s.pitch)
        if (s.pitch > 15 * DEG && s.pitch < 35 * DEG) this.balIn += dt
        if (!this.balDone) this.active = 'balance'
      }
      if (!this.balDone && this.balIn >= 2.5) {
        this.balDone = true
        const purity = clamp01(this.balIn / Math.max(this.balUp, 0.01))
        const calm = 1 - clamp01((this.balPeak - 40 * DEG) / (25 * DEG)) // an extreme angle costs points
        out.push(this.finish('balance', 100 * (0.7 * purity + 0.3 * calm) * clamp01(0.55 + this.balIn / 8), `${this.balIn.toFixed(1)} s in the band · ${(purity * 100).toFixed(0)}% control`))
      }
    }
    // a loop-out or crash caps any attempt: report the wheelie as it ended
    if (s.crashed && this.balUp > 0.4 && !this.balDone) {
      this.balDone = true
      out.push(this.finish('balance', 15 * clamp01(this.balIn / 2.5), 'lost it — brake earlier to bring it back'))
    }

    // ── one hand ──
    if (s.oneHand > 0.6 && up) {
      this.oh += dt
      if (!this.ohDone && inZ(s.z, PRACTICE.start, PRACTICE.end)) this.active = this.active ?? 'onehand'
      if (!this.ohDone && this.oh >= 1.5) {
        this.ohDone = true
        out.push(this.finish('onehand', 55 + 45 * clamp01(1 - Math.abs(s.pitch - 25 * DEG) / (25 * DEG)), `${this.oh.toFixed(1)} s one-handed`))
      }
    } else if (!up) this.oh = 0

    // ── cones ──
    if (onStrip && inZ(s.z, ZONES.cones.z0, ZONES.cones.z1)) {
      if (this.coneI < PRACTICE.slalom.length) {
        this.active = this.active ?? 'cones'
        this.coneRollMax = Math.max(this.coneRollMax, Math.abs(s.roll))
        const cz = PRACTICE.slalom[this.coneI]
        const cx = PRACTICE.x + (this.coneI % 2 ? -1 : 1) * PRACTICE.slalomX
        const dz = s.z - cz
        if (Math.abs(dz) < 0.55 && Math.hypot(s.x - cx, dz) < 0.5) this.coneHit++ // clipped it
        if (this.coneLastZ < cz && s.z >= cz) {
          const ok = Math.abs(s.x - cx) > 0.55 && Math.sign(s.x - cx) === -Math.sign(cx - PRACTICE.x)
          if (ok) this.coneOk++
          this.coneI++
          if (this.coneI === PRACTICE.slalom.length) {
            const smooth = 1 - clamp01((this.coneRollMax - 0.45) / 0.35)
            out.push(this.finish('cones', (this.coneOk / PRACTICE.slalom.length) * 75 * (this.coneHit ? 0.6 : 1) + 25 * smooth, `${this.coneOk}/${PRACTICE.slalom.length} cones${this.coneHit ? ' · clipped one' : ''}`))
          }
        }
      }
    } else if (this.coneI > 0 && this.coneI < PRACTICE.slalom.length && !inZ(s.z, ZONES.cones.z0, ZONES.cones.z1)) {
      this.coneI = this.coneOk = this.coneHit = 0
      this.coneRollMax = 0
    }
    this.coneLastZ = s.z

    // ── scrape section ──
    if (inZ(s.z, ZONES.scrape.z0, ZONES.scrape.z1) && !this.scrDone) {
      this.active = this.active ?? 'scrape'
      if (s.scrapePart === 'peg' && !s.crashed) this.scr += dt
      if (this.scr >= 0.4) {
        this.scrDone = true
        out.push(this.finish('scrape', 55 + 45 * clamp01(1 - Math.abs(s.roll) / 0.95) + 0, `${this.scr.toFixed(1)} s on the peg`))
      }
    }

    // ── landing ──
    this.upMax = up ? Math.max(this.upMax, s.pitch) : this.upMax
    if (up) this.wasUp = true
    if (this.wasUp && !up && s.pitch < 0.03 && this.upMax > 15 * DEG && !this.landed) {
      this.landed = true
      const hit = clamp01(s.touchdown / 1.6)
      const good = s.crashed ? 0 : 100 * (1 - hit * 0.85)
      out.push(this.finish('landing', good, s.touchdown < 0.4 ? 'feather-soft' : s.touchdown < 0.9 ? 'clean' : 'firm'))
    }
    if (!up && s.pitch < 0.02 && this.wasUp) {
      // the wheelie is over: the next one starts a fresh attempt
      this.wasUp = false
      this.upMax = 0
      this.landed = false
      this.balIn = this.balUp = this.balPeak = 0
      this.balDone = false
      this.liftDone = false
      this.liftMaxRate = 0
      this.ohDone = false
      this.oh = 0
    }
    return out
  }

  /** the little card for the HUD: the active challenge, or the last result for a moment */
  card(): { name: string; line: string; score: number | null; best: number | null } | null {
    const id = this.active
    if (!id) return null
    const c = CHALLENGES.find((x) => x.id === id)!
    return { name: c.name, line: c.hint, score: null, best: this.best(id) }
  }
}
