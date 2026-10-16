import type { Input } from '../input'
import type { RideInput } from './sim'

/**
 * RIDE CONTROLS — one place that turns every input device into the riding model's `RideInput`.
 *
 *   DESKTOP   W / ↑ throttle · S / ↓ brake (hold at a stop to reverse) · A D / ← → steer · SPACE rear brake · SHIFT heave back (wheelie) · C / CTRL weight forward · E dismount
 *   TOUCH     the left joystick steers (sideways only); the right-hand buttons are THROTTLE, BRAKE, REAR BRAKE, WHEELIE (heave back), LEAN FORWARD. Each button is its own
 *             element with its own pointer capture, so throttle + steering + brake + wheelie can all be held together; every one is released on pointer-up, cancel,
 *             lost capture, blur, visibility change and orientation change, so nothing can stick on.
 *
 * Buttons write into `rideBtn`; keys are read from window listeners that exist only while riding.
 */
export const rideBtn = { throttle: false, brake: false, rear: false, heave: false, forward: false }
export type RideBtn = keyof typeof rideBtn

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
  rideBtn.throttle = rideBtn.brake = rideBtn.rear = rideBtn.heave = rideBtn.forward = false
  getOffRequested = false
  // the on-screen buttons un-press their visuals too
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('chad-ride-release'))
}

export class RideControls {
  private keys = new Set<string>()
  private on = false
  constructor(private input: Input) {}

  private down = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
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
  read(): RideInput {
    const k = this.keys
    const mv = this.input.move() // WASD / arrows, or the joystick
    const touchStick = mv.analog
    // steering: A/D, arrows or the stick's sideways axis
    const steer = Math.max(-1, Math.min(1, mv.x))
    // throttle / brake: W/S on the keyboard; on a touch screen only the buttons (the stick's vertical axis is ignored, so a thumb drifting up never means "go")
    let throttle = touchStick ? 0 : Math.max(0, mv.z)
    let brake = touchStick ? 0 : Math.max(0, -mv.z)
    if (rideBtn.throttle) throttle = 1
    if (rideBtn.brake) brake = 1
    const rear = k.has(' ') || rideBtn.rear ? 1 : 0
    const back = k.has('shift') || rideBtn.heave ? 1 : 0
    const fwd = k.has('c') || k.has('control') || rideBtn.forward ? 1 : 0
    return { throttle, brake, rear, steer, lean: back - fwd }
  }
}
