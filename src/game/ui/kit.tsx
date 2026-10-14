import type { ButtonHTMLAttributes, PointerEvent as RPointerEvent, MouseEvent as RMouseEvent, TouchEvent as RTouchEvent, ReactNode } from 'react'

/**
 * Button press that works for ANY finger. Browsers only synthesise `click` for the primary pointer, so with a thumb
 * on the joystick a tap on GO / pause / the challenges tab with the other thumb would be ignored. Touch presses fire
 * on release of the same finger that pressed; a following synthetic click is swallowed (no double fire).
 */
type TapEl = HTMLElement & { __tapDown?: number; __tapT?: number }
export function tap(fn: () => void) {
  return {
    onPointerDown: (e: RPointerEvent) => {
      ;(e.currentTarget as TapEl).__tapDown = e.pointerId
    },
    onPointerUp: (e: RPointerEvent) => {
      const el = e.currentTarget as TapEl
      if (e.pointerType === 'mouse' || el.__tapDown !== e.pointerId) return
      el.__tapDown = undefined
      el.__tapT = performance.now()
      fn()
    },
    // the touch already fired: cancel the browser's follow-up click, which would otherwise land on whatever this
    // tap just opened (e.g. the challenges sheet's tap-outside backdrop) and close it again
    onTouchEnd: (e: RTouchEvent) => {
      const el = e.currentTarget as TapEl
      if (el.__tapT && performance.now() - el.__tapT < 300 && e.cancelable) e.preventDefault()
    },
    onClick: (e: RMouseEvent) => {
      const el = e.currentTarget as TapEl
      if (el.__tapT && performance.now() - el.__tapT < 700) return
      fn()
    },
  }
}
import { audio } from '../audio'

export function Btn({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  onClick,
  sound = 'click',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost'; size?: 'sm' | 'md' | 'lg'; sound?: 'click' | 'select' | 'confirm' | null }) {
  const sizes = { sm: 'min-h-10 px-4 text-[13px]', md: 'min-h-12 px-6 text-[15px]', lg: 'min-h-14 px-8 text-base' }
  return (
    <button
      type="button"
      {...rest}
      onClick={(e) => {
        if (sound) audio.play(sound)
        onClick?.(e)
      }}
      className={`inline-flex items-center justify-center gap-2.5 rounded-full font-semibold uppercase tracking-[0.1em] disabled:cursor-not-allowed ${variant === 'primary' ? 'btn-primary' : 'btn-ghost text-bone'} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}

export function IconBtn({ label, children, onClick, active, className = '' }: { label: string; children: ReactNode; onClick: () => void; active?: boolean; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      {...tap(() => {
        audio.play('click')
        onClick()
      })}
      className={`panel flex h-12 w-12 items-center justify-center rounded-2xl text-bone transition-[transform,border-color] duration-150 hover:border-moon/40 active:scale-95 ${active ? 'border-pump/60 text-pump' : ''} ${className}`}
    >
      {children}
    </button>
  )
}

export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`font-mono text-[11px] uppercase tracking-[0.22em] text-ash ${className}`}>{children}</p>
}

export function Slider({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <label className="block">
      <span className="flex items-center justify-between">
        <span className="text-[14px] font-medium text-bone">{label}</span>
        <span className="font-mono text-[12px] text-moon">{format ? format(value) : value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="mt-2.5 h-2 w-full cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-bone [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(255,122,26,0.35)] [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-bone"
        style={{ background: `linear-gradient(90deg, #ff7a1a ${pct}%, rgba(243,236,226,0.12) ${pct}%)` }}
      />
    </label>
  )
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => {
        audio.play('click')
        onChange(!checked)
      }}
      className="flex w-full items-center justify-between gap-4 text-left"
    >
      <span>
        <span className="block text-[14px] font-medium text-bone">{label}</span>
        {hint && <span className="mt-0.5 block text-[12px] text-ash">{hint}</span>}
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${checked ? 'bg-pump' : 'bg-bone/15'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-bone shadow transition-transform duration-200 ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
        <span className="sr-only">{checked ? 'On' : 'Off'}</span>
      </span>
    </button>
  )
}

export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; name: string }[]; onChange: (v: T) => void }) {
  return (
    <div>
      <span className="text-[14px] font-medium text-bone">{label}</span>
      <div role="radiogroup" aria-label={label} className="mt-2 grid gap-1 rounded-2xl bg-ink/60 p-1 ring-1 ring-bone/10" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => {
              audio.play('select')
              onChange(o.id)
            }}
            className={`min-h-10 rounded-xl px-2 text-[13px] font-semibold transition-colors duration-150 ${value === o.id ? 'bg-pump text-ink' : 'text-bone/70 hover:bg-bone/[0.06] hover:text-bone'}`}
          >
            {o.name}
          </button>
        ))}
      </div>
    </div>
  )
}

/* Inline icons (kept local so the game bundle doesn't pull an icon library) */
type IP = { className?: string }
export const Icon = {
  pause: ({ className = 'h-5 w-5' }: IP) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>
  ),
  sound: ({ className = 'h-5 w-5' }: IP) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></svg>
  ),
  mute: ({ className = 'h-5 w-5' }: IP) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" /><path d="m17 9 5 6M22 9l-5 6" /></svg>
  ),
  rotateL: ({ className = 'h-5 w-5' }: IP) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" /></svg>
  ),
  rotateR: ({ className = 'h-5 w-5' }: IP) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" /></svg>
  ),
  dice: ({ className = 'h-5 w-5' }: IP) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="9" cy="9" r="1.2" fill="currentColor" /><circle cx="15" cy="15" r="1.2" fill="currentColor" /><circle cx="15" cy="9" r="1.2" fill="currentColor" /><circle cx="9" cy="15" r="1.2" fill="currentColor" /></svg>
  ),
  close: ({ className = 'h-5 w-5' }: IP) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
  ),
  trophy: ({ className = 'h-5 w-5' }: IP) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true"><path d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V17h3v3H8v-3h3v-2.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3Zm0 4H6v1a2 2 0 0 0 1 1.7V7Zm11 0h-1v2.7A2 2 0 0 0 18 8V7Z" /></svg>
  ),
  flex: ({ className = 'h-5 w-5' }: IP) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true"><path d="M6.5 4.5c1.6-1 3.6-.3 4.2 1.5l.6 1.8c1.2-.5 2.6-.6 3.9-.2 3 .9 4.8 4 4 7-.7 2.8-3.4 4.6-6.3 4.4l-6.7-.5A3.6 3.6 0 0 1 3 14.8V9.6c0-2 1.6-3.7 3.5-5.1Z" /></svg>
  ),
}
