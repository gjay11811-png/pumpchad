import type { Input } from '../input'
import type { RideInput } from './sim'

/**
 * RIDE CONTROLS — one place that turns every input device into the riding model's `RideInput`.
 *
 *   DESKTOP   W / ↑ gas · S / ↓ brake · A D / ← → steer · SPACE rear brake · R reverse (when nearly stopped) · SHIFT wheelie (press once: lift; press again: lower) · F one-hand trick (only acts while the front wheel is up) · C extra weight forward · E dismount
 *   TOUCH     LEFT: LEFT / RIGHT arrow buttons (hold to steer progressively, release to recentre) and a second BRAKE. RIGHT: big GAS and BRAKE. Small extras that appear only when they make sense: REVERSE (nearly stopped), ONE HAND (already in a wheelie).
 *             WHEELIE button (Shift): press once to lift smoothly into a held wheelie; Gas then raises it (toward a rear-fender scrape), Brake lowers it; there are no gas-tap wheelies.
 *             Gas and Brake are their own elements with their own pointer capture and the joystick is a separate touch, so gas + steering + brake can all be held together; every one is released on pointer-up, cancel,
 *             lost capture, blur, visibility change and orientation change, so nothing can stick on.
 *
 * Buttons write into `rideBtn`; keys are read from window listeners that exist only while riding.
 */
export const rideBtn = { throttle: false, brake: false, brake2: false, left: false, right: false, reverse: false, trick: false, wheelie: false }
export type RideBtn = keyof typeof rideBtn

/** a Wheelie press is remembered until the riding model has read it once, so even a very short tap (a frame or less) is never lost */
let wheelieLatch = false
export function latchWheelie() {
  wheelieLatch = true
}
let getOffRequested = false
/** the on-screen GET OFF button */
export function requestGetOff() {
  getOffRequested = true
}
export function takeGetOff() {
  const g = getOffRequested
  getOffRequested = false
  return g
}
export function releaseAllRideButtons() {
  rideBtn.throttle = rideBtn.brake = rideBtn.brake2 = rideBtn.left = rideBtn.right = rideBtn.reverse = rideBtn.trick = rideBtn.wheelie = false
  getOffRequested = false
  // the on-screen buttons un-press their visuals too
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('chad-ride-release'))
}

/** steering ramp (s): how fast a held arrow / key builds toward full lock, and how fast it recentres when released. Tunable; deliberately not instant, never laggy. */
export const STEER_RISE = 0.2
export const STEER_RELEASE = 0.12
export class RideControls {
  private steerNow = 0
  private keys = new Set<string>()
  private on = false
  constructor(private input: Input) {}

  private down = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
    if (e.key === 'Shift' && !e.repeat) wheelieLatch = true
    this.keys.add(e.key.toLowerCase())
  }
  private up = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase())
  private clear = () => {
    this.keys.clear()
    releaseAllRideButtons()
  }
  private vis = () => {
    if (document.hidden) this.clear()
  }

  start() {
    if (this.on) return
    this.on = true
    this.keys.clear()
    window.addEventListener('keydown', this.down)
    window.addEventListener('keyup', this.up)
    window.addEventListener('blur', this.clear)
    window.addEventListener('pagehide', this.clear)
    window.addEventListener('orientationchange', this.clear)
    document.addEventListener('visibilitychange', this.vis)
  }
  stop() {
    if (!this.on) return
    this.on = false
    window.removeEventListener('keydown', this.down)
    window.removeEventListener('keyup', this.up)
    window.removeEventListener('blur', this.clear)
    window.removeEventListener('pagehide', this.clear)
    window.removeEventListener('orientationchange', this.clear)
    document.removeEventListener('visibilitychange', this.vis)
    this.clear()
  }

  /** the rider's intent right now */
  read(dt = 1 / 60): RideInput {
    const k = this.keys
    const mv = this.input.move() // WASD / arrows (the touch stick is hidden while riding)
    // steering: LEFT / RIGHT arrow buttons or A / D: holding builds steering (and so lean) progressively, releasing recentres smoothly. The stick, if any, is analog and used as is.
    const dir = Math.max(-1, Math.min(1, mv.x + (rideBtn.right ? 1 : 0) - (rideBtn.left ? 1 : 0)))
    this.steerNow += (dir - this.steerNow) * (1 - Math.exp(-dt / (Math.abs(dir) > Math.abs(this.steerNow) ? STEER_RISE : STEER_RELEASE)))
    if (Math.abs(this.steerNow) < 0.005 && dir === 0) this.steerNow = 0
    const steer = mv.analog ? Math.max(-1, Math.min(1, mv.x)) : this.steerNow
    // gas / brake: W / S on the keyboard; on a touch screen the buttons (the two Brake buttons are ONE braking action: either, or both, give the same single brake)
    let throttle = mv.analog ? 0 : Math.max(0, mv.z)
    let brake = mv.analog ? 0 : Math.max(0, -mv.z)
    if (rideBtn.throttle) throttle = 1
    if (rideBtn.brake || rideBtn.brake2) brake = 1
    const rear = k.has(' ') ? 1 : 0
    const fwd = k.has('c') || k.has('control') ? 1 : 0
    const wheelieNow = k.has('shift') || rideBtn.wheelie || wheelieLatch
    wheelieLatch = false
    return { throttle, brake, rear, steer, lean: -fwd, reverse: k.has('r') || rideBtn.reverse, trick: k.has('f') || rideBtn.trick, wheelie: wheelieNow }
  }
}
