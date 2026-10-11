/**
 * Unified input: keyboard + virtual joystick + camera drag, read once per frame.
 * Gameplay code only ever sees `move` (x,z in -1..1), `look` deltas and edge-triggered actions.
 */
export class Input {
  private keys = new Set<string>()
  stick = { x: 0, y: 0, active: false }
  private lookDX = 0
  private lookDY = 0
  private actionQueued = false
  private dragId: number | null = null
  private lastX = 0
  private lastY = 0
  enabled = true

  constructor(private el: HTMLElement) {
    window.addEventListener('keydown', this.onKey)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.clear)
    el.addEventListener('pointerdown', this.onDown)
    window.addEventListener('pointermove', this.onMove)
    window.addEventListener('pointerup', this.onUp)
    window.addEventListener('pointercancel', this.onUp)
  }

  private isTyping = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
  }

  private onKey = (e: KeyboardEvent) => {
    if (this.isTyping(e)) return
    const k = e.key.toLowerCase()
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k) && this.enabled) e.preventDefault()
    if ((k === 'e' || k === 'enter') && !e.repeat) this.actionQueued = true
    this.keys.add(k)
  }
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase())
  clear = () => {
    this.keys.clear()
    this.stick = { x: 0, y: 0, active: false }
    this.actionQueued = false
  }

  private onDown = (e: PointerEvent) => {
    if (this.dragId !== null) return
    this.dragId = e.pointerId
    this.lastX = e.clientX
    this.lastY = e.clientY
  }
  private onMove = (e: PointerEvent) => {
    if (e.pointerId !== this.dragId) return
    this.lookDX += e.clientX - this.lastX
    this.lookDY += e.clientY - this.lastY
    this.lastX = e.clientX
    this.lastY = e.clientY
  }
  private onUp = (e: PointerEvent) => {
    if (e.pointerId === this.dragId) this.dragId = null
  }

  queueAction() {
    this.actionQueued = true
  }

  /** Movement intent in camera space: x = strafe right, z = forward. */
  move() {
    if (!this.enabled) return { x: 0, z: 0, run: false }
    let x = 0
    let z = 0
    const k = this.keys
    if (k.has('w') || k.has('arrowup')) z += 1
    if (k.has('s') || k.has('arrowdown')) z -= 1
    if (k.has('d') || k.has('arrowright')) x += 1
    if (k.has('a') || k.has('arrowleft')) x -= 1
    if (this.stick.active) {
      x = this.stick.x
      z = -this.stick.y
    }
    const len = Math.hypot(x, z)
    if (len > 1) {
      x /= len
      z /= len
    }
    return { x, z, run: k.has('shift') || (this.stick.active && len > 0.92) }
  }

  takeLook() {
    const d = { x: this.lookDX, y: this.lookDY }
    this.lookDX = 0
    this.lookDY = 0
    return this.enabled ? d : { x: 0, y: 0 }
  }

  takeAction() {
    const a = this.actionQueued
    this.actionQueued = false
    return a && this.enabled
  }

  dispose() {
    window.removeEventListener('keydown', this.onKey)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.clear)
    this.el.removeEventListener('pointerdown', this.onDown)
    window.removeEventListener('pointermove', this.onMove)
    window.removeEventListener('pointerup', this.onUp)
    window.removeEventListener('pointercancel', this.onUp)
  }
}
