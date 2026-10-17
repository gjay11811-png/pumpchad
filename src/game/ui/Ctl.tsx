import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * EDITABLE TOUCH CONTROLS. Every on-screen control that can be moved is wrapped in <Ctl id=…>. Each has a DEFAULT place (its own CSS) and a saved OFFSET + SCALE on this device
 * (localStorage `pumpchad.controls.v1`). Editing is a separate mode (the menu's "Edit controls"): only then can a control be dragged (within the safe screen bounds) or resized, and a
 * drop that would overlap another control is rejected. In normal play the wrapper adds nothing but the saved transform, so a button can never be moved by accident.
 */
export type CtlPlace = { x: number; y: number; s: number }
export type CtlLayout = Record<string, CtlPlace>
const KEY = 'pumpchad.controls.v1'
let layout: CtlLayout = load()
let editing = false
const listeners = new Set<() => void>()
function load(): CtlLayout {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    const out: CtlLayout = {}
    for (const k of Object.keys(j)) if (typeof j[k]?.x === 'number' && typeof j[k]?.y === 'number') out[k] = { x: j[k].x, y: j[k].y, s: Math.max(0.6, Math.min(1.6, j[k].s ?? 1)) }
    return out
  } catch {
    return {}
  }
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(layout))
  } catch {
    /* storage unavailable: the layout simply does not persist */
  }
}
const emit = () => listeners.forEach((f) => f())
export const ctlLayout = () => layout
export const ctlEditing = () => editing
export function setCtlEditing(on: boolean) {
  editing = on
  emit()
}
export function resetCtlLayout() {
  layout = {}
  save()
  emit()
}
export function setCtlPlace(id: string, p: CtlPlace) {
  layout = { ...layout, [id]: p }
  save()
  emit()
}
export function useCtlStore() {
  const [, force] = useState(0)
  useEffect(() => {
    const f = () => force((n) => n + 1)
    listeners.add(f)
    return () => void listeners.delete(f)
  }, [])
  return { layout, editing }
}

const overlaps = (a: DOMRect, b: DOMRect) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1

/** the safe rectangle (px) a control must stay inside: the visible viewport minus the safe-area insets */
function safeBox() {
  const vv = window.visualViewport
  const w = vv?.width ?? window.innerWidth
  const h = vv?.height ?? window.innerHeight
  const probe = document.createElement('div')
  probe.style.cssText = 'position:fixed;left:0;top:0;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);visibility:hidden'
  document.body.appendChild(probe)
  const cs = getComputedStyle(probe)
  const box = { l: parseFloat(cs.paddingLeft) || 0, t: parseFloat(cs.paddingTop) || 0, r: w - (parseFloat(cs.paddingRight) || 0), b: h - (parseFloat(cs.paddingBottom) || 0) }
  probe.remove()
  return box
}

export function Ctl({ id, children, className = '' }: { id: string; children: ReactNode; className?: string }) {
  const { layout: L, editing: E } = useCtlStore()
  const place = L[id] ?? { x: 0, y: 0, s: 1 }
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ px: number; py: number; ox: number; oy: number; ok: CtlPlace } | null>(null)
  const [bad, setBad] = useState(false)

  const clampPlace = useCallback((p: CtlPlace): CtlPlace => {
    const el = ref.current
    if (!el) return p
    // measure the control at its DEFAULT place (no transform), then keep the moved + scaled box inside the safe bounds
    const prev = el.style.transform
    el.style.transform = 'none'
    const r = el.getBoundingClientRect()
    el.style.transform = prev
    const sb = safeBox()
    const w = r.width * p.s
    const h = r.height * p.s
    const cx = r.left + r.width / 2 + p.x
    const cy = r.top + r.height / 2 + p.y
    let x = p.x
    let y = p.y
    if (cx - w / 2 < sb.l) x += sb.l - (cx - w / 2)
    if (cx + w / 2 > sb.r) x -= cx + w / 2 - sb.r
    if (cy - h / 2 < sb.t) y += sb.t - (cy - h / 2)
    if (cy + h / 2 > sb.b) y -= cy + h / 2 - sb.b
    return { x, y, s: p.s }
  }, [])

  const free = useCallback((): boolean => {
    const me = ref.current?.getBoundingClientRect()
    if (!me) return true
    for (const o of document.querySelectorAll<HTMLElement>('[data-ctl]')) {
      if (o === ref.current || o.dataset.ctl === id) continue
      if (getComputedStyle(o).display === 'none') continue
      if (overlaps(me, o.getBoundingClientRect())) return false
    }
    return true
  }, [id])

  // keep a saved layout inside the screen after a rotation / resize
  useEffect(() => {
    const f = () => {
      if (!L[id]) return
      const c = clampPlace(L[id])
      if (Math.abs(c.x - L[id].x) > 0.5 || Math.abs(c.y - L[id].y) > 0.5) setCtlPlace(id, c)
    }
    window.addEventListener('resize', f)
    window.addEventListener('orientationchange', f)
    return () => {
      window.removeEventListener('resize', f)
      window.removeEventListener('orientationchange', f)
    }
  }, [L, id, clampPlace])

  const transform = place.x || place.y || place.s !== 1 ? `translate(${place.x}px, ${place.y}px) scale(${place.s})` : undefined
  if (!E) {
    return (
      <div ref={ref} data-ctl={id} className={className} style={{ transform, transformOrigin: 'center' }}>
        {children}
      </div>
    )
  }
  return (
    <div
      ref={ref}
      data-ctl={id}
      className={`${className} pointer-events-auto z-30 outline-dashed outline-2 ${bad ? 'outline-red-500' : 'outline-moon/70'}`}
      style={{ transform, transformOrigin: 'center', touchAction: 'none', cursor: 'grab' }}
      onPointerDownCapture={(e) => {
        e.preventDefault()
        e.stopPropagation()
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          /* synthetic */
        }
        drag.current = { px: e.clientX, py: e.clientY, ox: place.x, oy: place.y, ok: place }
        window.dispatchEvent(new CustomEvent('chad-ctl-select', { detail: id }))
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d) return
        const c = clampPlace({ x: d.ox + e.clientX - d.px, y: d.oy + e.clientY - d.py, s: place.s })
        setCtlPlace(id, c)
        requestAnimationFrame(() => setBad(!free()))
      }}
      onPointerUp={() => {
        const d = drag.current
        drag.current = null
        if (!d) return
        // a drop onto another control is rejected: it goes back to where it was
        if (!free()) setCtlPlace(id, d.ok)
        setBad(false)
      }}
      onPointerCancel={() => {
        const d = drag.current
        drag.current = null
        if (d) setCtlPlace(id, d.ok)
        setBad(false)
      }}
    >
      <div className="pointer-events-none">{children}</div>
    </div>
  )
}

/** resize the selected control (called by the edit bar) */
export function resizeCtl(id: string, delta: number) {
  const cur = layout[id] ?? { x: 0, y: 0, s: 1 }
  const next = { ...cur, s: Math.max(0.6, Math.min(1.6, +(cur.s + delta).toFixed(2))) }
  const el = document.querySelector<HTMLElement>(`[data-ctl="${id}"]`)
  const prev = layout[id]
  setCtlPlace(id, next)
  requestAnimationFrame(() => {
    // a size that would overlap another control, or leave the screen, is undone
    const me = el?.getBoundingClientRect()
    const sb = safeBox()
    let bad = !!me && (me.left < sb.l - 1 || me.right > sb.r + 1 || me.top < sb.t - 1 || me.bottom > sb.b + 1)
    if (me) for (const o of document.querySelectorAll<HTMLElement>('[data-ctl]')) if (o !== el && getComputedStyle(o).display !== 'none' && overlaps(me, o.getBoundingClientRect())) bad = true
    if (bad) setCtlPlace(id, prev ?? { x: 0, y: 0, s: 1 })
  })
}
