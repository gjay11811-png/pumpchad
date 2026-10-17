import { AnimatePresence, m } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { EMOTES, type EmoteId } from '../emotes'
import { audio } from '../audio'
import { Ctl } from './Ctl'

/**
 * Emote wheel. Desktop: Q opens it, 1-8 fire an emote directly, arrows move focus, Esc closes.
 * Touch: the round Emote button opens it; tap an emote. Moving or jumping ends a looping emote.
 */
export function EmoteWheel({ touch, disabled, onEmote, onJump }: { touch: boolean; disabled: boolean; onEmote: (id: EmoteId) => void; onJump: () => void }) {
  const [open, setOpen] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const items = useRef<(HTMLButtonElement | null)[]>([])

  const fire = useCallback(
    (id: EmoteId) => {
      audio.play('select')
      onEmote(id)
      setOpen(false)
      setFlash(EMOTES.find((e) => e.id === id)?.label ?? null)
    },
    [onEmote],
  )

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 1100)
    return () => clearTimeout(t)
  }, [flash])

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])
  // touch: Emote lives in the corner menu, which asks for the wheel with this event
  useEffect(() => {
    const f = () => !disabled && setOpen(true)
    window.addEventListener('chad-emote-open', f)
    return () => window.removeEventListener('chad-emote-open', f)
  }, [disabled])

  // keyboard: capture phase so Esc closes the wheel instead of opening the pause menu
  useEffect(() => {
    if (disabled) return
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      const key = e.key.toLowerCase()
      if (key === 'q' && !e.repeat) {
        e.preventDefault()
        setOpen((o) => !o)
        return
      }
      const direct = EMOTES.find((x) => x.key === key)
      if (direct && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        fire(direct.id)
        return
      }
      if (!open) return
      if (key === 'escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        setOpen(false)
      }
      if (['arrowright', 'arrowdown', 'arrowleft', 'arrowup'].includes(key)) {
        e.preventDefault()
        e.stopImmediatePropagation() // don't walk while choosing
        const i = items.current.findIndex((b) => b === document.activeElement)
        const step = key === 'arrowright' || key === 'arrowdown' ? 1 : -1
        items.current[(i + step + EMOTES.length) % EMOTES.length]?.focus()
      }
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [disabled, open, fire])

  useEffect(() => {
    if (open) setTimeout(() => items.current[0]?.focus(), 30)
  }, [open])

  const R = touch ? 112 : 128
  return (
    <>
      {/* open button + (touch) jump button */}
      {touch ? (
        <Ctl id="jump" className="absolute bottom-[calc(max(10px,env(safe-area-inset-bottom))+4.2rem)] right-[calc(max(10px,env(safe-area-inset-right))+0.2rem)]">
          <button
            type="button"
            aria-label="Jump"
            onPointerDown={(e) => {
              e.preventDefault()
              onJump()
            }}
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-bone/25 bg-ink/60 font-display text-[11px] uppercase tracking-wide text-bone backdrop-blur-sm active:scale-90"
            style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
            data-testid="jump-button"
          >
            Jump
          </button>
        </Ctl>
      ) : (
        <button
          type="button"
          aria-label="Emotes (Q)"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          disabled={disabled}
          className="panel pointer-events-auto absolute bottom-9 left-[max(16px,env(safe-area-inset-left))] flex items-center gap-2 rounded-full py-2 pl-2 pr-4 text-[13px] font-semibold"
          data-testid="emote-button"
        >
          <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-moon/90 px-2 font-mono text-[11px] font-semibold text-ink">Q</span>
          Emotes
        </button>
      )}

      {/* the wheel */}
      <AnimatePresence>
        {open && (
          <m.div key="wheel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-ink/35" onClick={() => setOpen(false)}>
            <m.div
              role="menu"
              aria-label="Emotes"
              initial={{ scale: 0.82 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              className="relative"
              style={{ width: R * 2 + 96, height: R * 2 + 96 }}
              onClick={(e) => e.stopPropagation()}
              data-testid="emote-wheel"
            >
              <div className="absolute inset-[22%] rounded-full border border-bone/10 bg-ink/70 backdrop-blur-md" aria-hidden />
              <button type="button" onClick={() => setOpen(false)} className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-mono text-[10px] uppercase tracking-[0.2em] text-bone/60" aria-label="Close emotes">
                Close
              </button>
              {EMOTES.map((e, i) => {
                const a = (i / EMOTES.length) * Math.PI * 2 - Math.PI / 2
                return (
                  <button
                    key={e.id}
                    ref={(el) => {
                      items.current[i] = el
                    }}
                    type="button"
                    role="menuitem"
                    title={e.hint}
                    onClick={() => fire(e.id)}
                    className="panel absolute flex h-[76px] w-[96px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-2xl px-1 text-center outline-none transition-transform hover:scale-105 focus-visible:scale-105 focus-visible:ring-2 focus-visible:ring-moon"
                    style={{ left: `calc(50% + ${Math.cos(a) * R}px)`, top: `calc(50% + ${Math.sin(a) * R}px)` }}
                    data-testid={`emote-${e.id}`}
                  >
                    <span className="font-display text-[15px] uppercase leading-tight">{e.label}</span>
                    {!touch && <span className="mt-1 font-mono text-[10px] text-moon/80">{e.key}</span>}
                  </button>
                )
              })}
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      {/* what you just did */}
      <AnimatePresence>
        {flash && !open && (
          <m.p key={flash} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pointer-events-none absolute left-1/2 top-[38%] -translate-x-1/2 font-display text-2xl uppercase tracking-wide text-moon drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" aria-live="polite" data-testid="emote-flash">
            {flash}
          </m.p>
        )}
      </AnimatePresence>
    </>
  )
}
