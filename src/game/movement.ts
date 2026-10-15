/** Shared player-movement feel for Chad Square and the gym floor. */
import * as THREE from 'three'
import type { Character } from './character/character'

export const JUMP_V = 4.6 // m/s take-off speed  → ~0.7 m apex
export const GRAVITY = 15
export const JUMP_CROUCH = 0.11 // s between pressing jump and leaving the ground (the take-off clip's crouch, played slowly)

/** velocity response: snappy starts, a touch of slide when stopping from a run, little steering in the air */
export function velocityRate(wantsMove: boolean, speed: number, airborne: boolean) {
  if (airborne) return wantsMove ? 3 : 1.2
  if (wantsMove) return 11
  return speed > 4.5 ? 7 : 15
}

/**
 * Gait speeds (m/s). Each matches the rig's walk / jog / sprint blend at a natural cadence
 * (see gaitFor in character/chad.ts), so the feet never look slow-motion or skate.
 */
export type Gaits = { walk: number; jog: number; sprint: number }
export const OUTDOOR: Gaits = { walk: 2.2, jog: 5.2, sprint: 7.6 }
export const INDOOR: Gaits = { walk: 2.0, jog: 4.2, sprint: 5.6 }
/**
 * Target ground speed from input. Keys: walk, or sprint with Shift / the Sprint button.
 * Analog stick: a gentle push walks, a firmer push breaks into a jog, the far edge sprints.
 */
export function targetSpeed(mag: number, sprint: boolean, analog: boolean, g: Gaits) {
  if (mag < 0.01) return 0
  if (sprint) return g.sprint
  if (!analog) return g.walk
  if (mag <= 0.6) return g.walk * Math.max(0.35, mag / 0.6)
  return g.walk + (g.jog - g.walk) * Math.min(1, (mag - 0.6) / 0.32)
}
/** the rig's speed input is expressed in units of this (m/s) */
export const SPEED_UNIT = 3.4

/** turn rate: quick pivots at walking pace, wider arcs when sprinting */
export const turnRate = (speed: number) => THREE.MathUtils.lerp(16, 9, THREE.MathUtils.clamp(speed / 6, 0, 1))

/** Vertical state for a jumping character on the ground plane. */
export class Jumper {
  /** height of the feet above the terrain (0 on the ground, the surface's top when standing on something) */
  y = 0
  vy = 0
  /** the surface currently under the feet (0 = terrain) */
  floor = 0
  /** true for the first frame after touching down (for landing sounds / dust) */
  landed = false
  private crouch = -1
  private launch = JUMP_V

  get grounded() {
    return this.y <= this.floor + 1e-3 && this.vy <= 0 && this.crouch < 0
  }
  get airborne() {
    return !this.grounded
  }

  /**
   * returns true if the jump started. `apex` (m above the feet) asks for a taller jump — a vault onto a low ledge:
   * the take-off speed is whatever reaches that apex (capped so it is a hop, never a leap).
   */
  tryJump(p: Character | null, apex = 0) {
    if (!this.grounded) return false
    this.crouch = JUMP_CROUCH
    this.launch = apex > 0 ? Math.min(JUMP_V_MAX, Math.sqrt(2 * GRAVITY * apex)) : JUMP_V
    p?.jump?.()
    return true
  }

  /** `floorY` is the height of the surface under the feet this frame (terrain 0, or the top of a low obstacle you are over) */
  update(dt: number, p: Character | null, floorY = 0) {
    this.landed = false
    this.floor = floorY
    if (this.crouch >= 0) {
      this.crouch -= dt
      if (this.crouch < 0) this.vy = this.launch
    }
    if (this.vy !== 0 || this.y > floorY + 1e-3) {
      this.vy -= GRAVITY * dt
      this.y += this.vy * dt
      if (this.y <= floorY && this.vy <= 0) {
        this.y = floorY
        this.vy = 0
        this.landed = true
      }
    } else if (this.y < floorY) {
      this.y = floorY // a step up onto a kerb-height surface
    }
    p?.setGrounded?.(this.grounded)
  }

  reset() {
    this.y = 0
    this.vy = 0
    this.floor = 0
    this.crouch = -1
    this.launch = JUMP_V
  }
}

/** obstacles up to this tall can be jumped onto / over (taller things always block) */
export const LOW_OBSTACLE = 1.3
/** the tallest take-off speed a vault may use (apex ~1.5 m) */
export const JUMP_V_MAX = 6.7
/** tops this low never block walking at all (kerbs, pavers) */
export const KERB = 0.12
/** the biggest rise a walker steps up without jumping */
export const STEP_UP = 0.3

/** body lean for the rig: into turns (scaled by speed) and with acceleration */
export function leanFor(yawRate: number, accel: number, speed: number) {
  const k = THREE.MathUtils.clamp(speed / 5, 0, 1)
  return { turn: THREE.MathUtils.clamp(yawRate / 5, -1, 1) * k, accel: THREE.MathUtils.clamp(accel / 14, -1, 1) }
}
