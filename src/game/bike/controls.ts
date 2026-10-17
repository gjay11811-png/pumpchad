import type { Input } from '../input'
import type { RideInput } from './sim'

/**
 * RIDE CONTROLS — one place that turns every input device into the riding model's `RideInput`.
 *
 *   DESKTOP   W / ↑ gas · S / ↓ brake · A D / ← → steer · SPACE rear brake · R reverse (when nearly stopped) · SHIFT one-hand trick (only acts while the front wheel is up) · C extra weight forward · E dismount
 *   TOUCH     LEFT: the floating virtual joystick (sideways only: steering; its vertical axis is ignored so a thumb drifting up never means gas). RIGHT: big GAS and BRAKE. Small extras that appear only when they make sense: REVERSE (nearly stopped), ONE HAND (already in a wheelie).
 *             There is NO lift / REV control on any device: the front comes up from the gas, the bike's torque and the rider's weight shifting by themselves.
 *             Gas and Brake are their own elements with their own pointer capture and the joystick is a separate touch, so gas + steering + brake can all be held together; every one is released on pointer-up, cancel,
 *             lost capture, blur, visibility change and orientation change, so nothing can stick on.
 *
 * Buttons write into `rideBtn`; keys are read from window listeners that exist only while riding.
 */
export const rideBtn = { throttle: false, brake: false, reverse: false, trick: false }
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
  rideBtn.throttle = rideBtn.brake = rideBtn.reverse = rideBtn.trick = false
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
  read(_dt = 1 / 60): RideInput {
    const k = this.keys
    const mv = this.input.move() // WASD / arrows, or the on-screen joystick
    const touchStick = mv.analog
    // steering: A/D, arrows or the joystick's sideways axis (the stick is analog, so a small push is a small turn)
    const steer = Math.max(-1, Math.min(1, mv.x))
    // gas / brake: W/S on the keyboard; on a touch screen only the buttons (the stick's vertical axis is ignored)
    let throttle = touchStick ? 0 : Math.max(0, mv.z)
    let brake = touchStick ? 0 : Math.max(0, -mv.z)
    if (rideBtn.throttle) throttle = 1
    if (rideBtn.brake) brake = 1
    const rear = k.has(' ') ? 1 : 0
    const fwd = k.has('c') || k.has('control') ? 1 : 0
    return { throttle, brake, rear, steer, lean: -fwd, reverse: k.has('r') || rideBtn.reverse, trick: k.has('shift') || rideBtn.trick }
  }
}
