/** Emotes — shared by Chad Square and the gym floor. Looping emotes hold until you move, jump or pick them again. */
import type { Pose } from './character/build'
import type { Character } from './character/character'
import type { OneShot } from './character/chad'

export type EmoteId = 'flex' | 'dance' | 'wave' | 'pushups' | 'celebrate' | 'chad' | 'point' | 'unbothered'
export type EmoteSpec = { id: EmoteId; label: string; key: string; pose?: Pose; once?: OneShot; hint: string }

/** order = wheel order (clockwise from the top) and number keys 1-8 */
export const EMOTES: EmoteSpec[] = [
  { id: 'flex', label: 'Flex', key: '1', pose: 'flex', hint: 'Double biceps' },
  { id: 'dance', label: 'Dance', key: '2', pose: 'dance', hint: 'Pump it' },
  { id: 'wave', label: 'Wave', key: '3', pose: 'wave', hint: 'GM' },
  { id: 'pushups', label: 'Push-ups', key: '4', pose: 'pushup', hint: 'Drop and give me ten' },
  { id: 'celebrate', label: 'Celebrate', key: '5', once: 'yes', hint: 'WAGMI' },
  { id: 'chad', label: 'Chad pose', key: '6', pose: 'hips', hint: 'Hands on hips, chest out' },
  { id: 'point', label: "You're next", key: '7', pose: 'point', hint: 'Point at the camera' },
  { id: 'unbothered', label: 'Unbothered', key: '8', pose: 'folded', hint: 'Arms folded. Paper hands seen.' },
]
export const emoteById = (id: string) => EMOTES.find((e) => e.id === id)

export class Emoter {
  active: EmoteId | null = null
  private onceLeft = 0

  /** start (or toggle off) an emote; returns the emote now playing, if any */
  start(p: Character | null, id: EmoteId): EmoteId | null {
    const e = emoteById(id)
    if (!p || !e) return this.active
    if (e.pose && this.active === id) {
      this.active = null // pressing a looping emote again stops it
      return null
    }
    p.cancelOneShot?.()
    if (e.once) {
      this.active = null
      this.onceLeft = p.playOnce?.(e.once) ?? 0
      return id
    }
    this.onceLeft = 0
    this.active = id
    return id
  }

  /** moving or jumping ends whatever is playing (smoothly — the rig blends back) */
  cancel(p: Character | null) {
    this.active = null
    if (this.onceLeft > 0) {
      p?.cancelOneShot?.()
      this.onceLeft = 0
    }
  }

  update(dt: number) {
    this.onceLeft = Math.max(0, this.onceLeft - dt)
  }

  get busy() {
    return this.active !== null || this.onceLeft > 0
  }

  /** pose to apply this frame, or null for normal locomotion */
  pose(): Pose | null {
    return this.active ? (emoteById(this.active)?.pose ?? null) : null
  }
}
