/**
 * Unified input: keyboard + virtual joystick + camera drag, read once per frame.
 * Gameplay code only ever sees `move` (x,z in -1..1), `look` deltas and edge-triggered actions.
 */
/** UI that must never start a camera drag (buttons, panels, menus, the joystick…) */
const NO_LOOK = 'button, a, input, textarea, select, label, [role=menu], [role=dialog], [role=radio], [role=tab], [role=button], [role=slider], [role=option], .panel, [data-no-look]'
/** A press starts a drag-to-look only on the 3D view or empty UI space over it. */
export function lookable(t: EventTarget | null) {
  if (!(t instanceof Element)) return false
  return t.tagName === 'CANVAS' || !t.closest(NO_LOOK)
}

export class Input {
  private keys = new Set<string>()
  stick = { x: 0, y: 0, active: false }
  private lookDX = 0
  private lookDY = 0
  private actionQueued = false
  private jumpQueued = false
  private dragId: number | null = null
  private lastX = 0
  private lastY = 0
  enabled = true
  /** touch Sprint toggle (on-screen button): run whenever moving while it's on */
  sprint = false
  /** a desktop player has steered the view with the mouse: from then on the camera stays where they put it */
  mouseLooked = false
  /** the UI layer sits on top of the canvas, so presses are caught on the shared container and filtered */
  private surface: HTMLElement

  constructor(el: HTMLElement) {
    this.surface = el.parentElement ?? el
    // desktop: show that the 3D view can be dragged
    if (typeof window !== 'undefined' && !window.matchMedia?.('(pointer: coarse)').matches) el.style.cursor = 'grab'
    window.addEventListener('keydown', this.onKey)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.clear)
    this.surface.addEventListener('pointerdown', this.onDown)
    window.addEventListener('pointermove', this.onMove)
    window.addEventListener('pointerup', this.onUp)
    window.addEventListener('pointercancel', this.onUp)
    this.surface.addEventListener('lostpointercapture', this.onUp)
    this.surface.addEventListener('contextmenu', this.onMenu)
  }
  /** right-drag looks around too: no browser menu popping up over the 3D view */
  private onMenu = (e: MouseEvent) => {
    if (lookable(e.target)) e.preventDefault()
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
    if (k === ' ' && !e.repeat) this.jumpQueued = true
    this.keys.add(k)
  }
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase())
  clear = () => {
    this.endDrag()
    this.keys.clear()
    this.stick = { x: 0, y: 0, active: false }
    this.actionQueued = false
    this.jumpQueued = false
  }

  private onDown = (e: PointerEvent) => {
    if (!lookable(e.target)) return
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return
    // a mouse always has the same pointer id: if its release was missed (let go outside the window),
    // a new press simply restarts the drag instead of being ignored forever
    if (this.dragId !== null && this.dragId !== e.pointerId) return
    this.dragId = e.pointerId
    this.lastX = e.clientX
    this.lastY = e.clientY
    this.dragLive = e.pointerType !== 'mouse' // touch drags start at once; a mouse press must MOVE first
    this.downX = e.clientX
    this.downY = e.clientY
  }
  private dragLive = false
  private downX = 0
  private downY = 0
  /** a mouse press became a real drag: capture it (so a release outside the canvas still ends it) */
  private goLive(e: PointerEvent) {
    this.dragLive = true
    this.lastX = e.clientX
    this.lastY = e.clientY
    try {
      this.surface.setPointerCapture(e.pointerId)
    } catch {
      /* capture unsupported: window listeners still work */
    }
    this.surface.style.cursor = 'grabbing'
    this.surface.style.userSelect = 'none' // no text selection while looking around
  }
  private onMove = (e: PointerEvent) => {
    if (e.pointerId !== this.dragId) return
    // released somewhere we didn't hear about (another window, devtools…): stop, don't jump the camera
    if (e.pointerType === 'mouse' && e.buttons === 0) return this.endDrag()
    if (!this.dragLive) {
      // plain clicks never turn into drags (and keep working on UI underneath): wait for 4 px of travel
      if (Math.hypot(e.clientX - this.downX, e.clientY - this.downY) < 4) return
      this.goLive(e)
      return
    }
    const dx = e.clientX - this.lastX
    const dy = e.clientY - this.lastY
    this.lastX = e.clientX
    this.lastY = e.clientY
    // ignore teleport-sized deltas (pointer lock glitches, focus changes) so the camera never snaps
    if (Math.abs(dx) > 400 || Math.abs(dy) > 400) return
    this.lookDX += dx
    this.lookDY += dy
    if (e.pointerType === 'mouse' && (dx || dy)) this.mouseLooked = true
  }
  private onUp = (e: PointerEvent) => {
    if (e.pointerId === this.dragId) this.endDrag()
  }
  private endDrag() {
    if (this.dragId === null) return
    try {
      if (this.surface.hasPointerCapture?.(this.dragId)) this.surface.releasePointerCapture(this.dragId)
    } catch {
      /* already released */
    }
    this.dragId = null
    this.dragLive = false
    this.surface.style.cursor = ''
    this.surface.style.userSelect = ''
  }
  /** true while a drag-to-look is in progress (QA + camera auto-follow) */
  get dragging() {
    return this.dragId !== null && this.dragLive
  }

  queueAction() {
    this.actionQueued = true
  }
  queueJump() {
    this.jumpQueued = true
  }
  /** edge-triggered jump (Space / the touch Jump button) */
  takeJump() {
    const j = this.jumpQueued
    this.jumpQueued = false
    return j && this.enabled
  }

  /** Movement intent in camera space: x = strafe right, z = forward. */
  move() {
    if (!this.enabled) return { x: 0, z: 0, run: false, analog: false }
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
    return { x, z, run: k.has('shift') || (this.sprint && len > 0.1) || (this.stick.active && len > 0.92), analog: this.stick.active }
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
    this.surface.removeEventListener('pointerdown', this.onDown)
    window.removeEventListener('pointermove', this.onMove)
    window.removeEventListener('pointerup', this.onUp)
    window.removeEventListener('pointercancel', this.onUp)
    this.surface.removeEventListener('lostpointercapture', this.onUp)
    this.surface.removeEventListener('contextmenu', this.onMenu)
  }
}
