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
  private _enabled = true
  get enabled() {
    return this._enabled
  }
  set enabled(v: boolean) {
    this._enabled = v
    if (!v) this.releaseLock() // a menu / toss / dialogue needs the cursor back
  }
  /** DESKTOP mouse capture (Pointer Lock): one deliberate click on the 3D view captures it, then the mouse looks freely with no button held.
   *  Esc (the browser's own release), any menu or overlay, a lost window and the touch screens all leave it — and touch never uses it. */
  private canvas: HTMLElement
  private selfRelease = false
  lockAllowed = true
  /** fired when the browser (Esc) took the lock away while the game was running — the app opens its pause menu */
  onLockLost: (() => void) | null = null
  onLockChange: ((locked: boolean) => void) | null = null
  get locked() {
    return typeof document !== 'undefined' && !!this.canvas && document.pointerLockElement === this.canvas
  }
  requestLock() {
    if (!this.lockAllowed || !this._enabled || this.locked || typeof document === 'undefined') return
    try {
      const r = this.canvas.requestPointerLock?.() as unknown
      if (r && typeof (r as Promise<void>).catch === 'function') (r as Promise<void>).catch(() => {}) // too soon after Esc / not allowed: stay in drag-look
    } catch {
      /* unsupported */
    }
  }
  releaseLock() {
    if (!this.locked) return
    this.selfRelease = true
    try {
      document.exitPointerLock()
    } catch {
      /* already released */
    }
  }
  private onLockState = () => {
    const l = this.locked
    if (l) this.endDrag()
    else this.clearHeldKeysOnLockLoss()
    this.onLockChange?.(l)
    if (!l) {
      const mine = this.selfRelease
      this.selfRelease = false
      if (!mine && this._enabled) this.onLockLost?.()
    }
  }
  private clearHeldKeysOnLockLoss() {
    this.lookDX = 0
    this.lookDY = 0
  }
  /** touch Sprint toggle (on-screen button): run whenever moving while it's on — it never moves you by itself */
  sprint = false
  /** the pointer currently driving the virtual joystick (null = nobody): one owner, so a lost release can't leave it held */
  stickOwner: number | null = null
  /** UI that keeps its own copy of the touch state (the joystick's base + knob) resets when input is cleared */
  private resetters = new Set<() => void>()
  /** a desktop player has steered the view with the mouse: from then on the camera stays where they put it */
  mouseLooked = false
  /** the UI layer sits on top of the canvas, so presses are caught on the shared container and filtered */
  private surface: HTMLElement

  constructor(el: HTMLElement) {
    this.surface = el.parentElement ?? el
    this.canvas = el
    this.lockAllowed = typeof window !== 'undefined' && !window.matchMedia?.('(pointer: coarse)').matches
    document.addEventListener('pointerlockchange', this.onLockState)
    // desktop: show that the 3D view can be dragged
    if (typeof window !== 'undefined' && !window.matchMedia?.('(pointer: coarse)').matches) el.style.cursor = 'grab'
    window.addEventListener('keydown', this.onKey)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.clear)
    // phones: switching apps, locking the screen, rotating — every one of these must drop held movement
    document.addEventListener('visibilitychange', this.onVisibility)
    window.addEventListener('pagehide', this.clear)
    window.addEventListener('orientationchange', this.clear)
    screen.orientation?.addEventListener?.('change', this.clear)
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
    this.stickOwner = null
    this.actionQueued = false
    this.jumpQueued = false
    this.resetters.forEach((f) => f())
  }
  private onVisibility = () => {
    if (document.hidden) this.clear()
  }
  /** subscribe UI state to input resets (returns the unsubscribe) */
  onReset(fn: () => void) {
    this.resetters.add(fn)
    return () => void this.resetters.delete(fn)
  }

  /* ── the virtual joystick reports through these, so ownership lives in one place ── */
  setStick(pointerId: number, x: number, y: number, active: boolean) {
    this.stickOwner = pointerId
    this.stick = { x, y, active }
  }
  /** release the joystick (only its own pointer can, unless forced) */
  releaseStick(pointerId?: number) {
    if (pointerId !== undefined && pointerId !== this.stickOwner) return
    this.stickOwner = null
    this.stick = { x: 0, y: 0, active: false }
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
    if (this.locked && e.pointerType === 'mouse') {
      // captured mouse: raw movement, no button needed (touch pointers never take this path)
      const dx = e.movementX
      const dy = e.movementY
      if (Math.abs(dx) > 400 || Math.abs(dy) > 400) return
      this.lookDX += dx
      this.lookDY += dy
      if (dx || dy) this.mouseLooked = true
      return
    }
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
    // a plain left click on the 3D view (no drag) is the explicit gesture that captures the mouse
    if (e.pointerId === this.dragId && e.pointerType === 'mouse' && e.button === 0 && !this.dragLive) this.requestLock() // (the press already passed lookable(): the 3D view or empty HUD space over it)
    if (e.pointerId === this.dragId) this.endDrag()
    // backup for the joystick: a release that never reached it (capture lost, finger lifted off-zone) still lets go
    if (e.pointerId === this.stickOwner) {
      this.releaseStick()
      this.resetters.forEach((f) => f())
    }
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
    this.releaseLock()
    document.removeEventListener('pointerlockchange', this.onLockState)
    window.removeEventListener('keydown', this.onKey)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.clear)
    document.removeEventListener('visibilitychange', this.onVisibility)
    window.removeEventListener('pagehide', this.clear)
    window.removeEventListener('orientationchange', this.clear)
    screen.orientation?.removeEventListener?.('change', this.clear)
    this.resetters.clear()
    this.surface.removeEventListener('pointerdown', this.onDown)
    window.removeEventListener('pointermove', this.onMove)
    window.removeEventListener('pointerup', this.onUp)
    window.removeEventListener('pointercancel', this.onUp)
    this.surface.removeEventListener('lostpointercapture', this.onUp)
    this.surface.removeEventListener('contextmenu', this.onMenu)
  }
}
