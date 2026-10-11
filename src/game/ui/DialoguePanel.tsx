import { m } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { Dialogue, DialogueOption } from '../dialogue'
import { audio } from '../audio'
import { Btn } from './kit'

/** Bottom dialogue panel with a quick typewriter (tap/E to skip or advance). */
export function DialoguePanel({ d, onDone, reduced }: { d: Dialogue; onDone: (o: DialogueOption['action']) => void; reduced: boolean }) {
  const [i, setI] = useState(0)
  const [shown, setShown] = useState(reduced ? Infinity : 0)
  const line = d.lines[i]
  const typing = shown < line.length
  const last = i === d.lines.length - 1

  useEffect(() => {
    if (reduced) return
    setShown(0)
    const id = setInterval(() => setShown((s) => (s >= line.length ? s : s + 2)), 16)
    return () => clearInterval(id)
  }, [i, line, reduced])

  const advance = () => {
    if (typing) return setShown(Infinity)
    if (!last) {
      audio.play('click')
      setI(i + 1)
    } else if (!d.options) onDone('close')
  }

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (['e', 'enter', ' '].includes(e.key.toLowerCase())) {
        e.preventDefault()
        advance()
      }
      if (e.key === 'Escape') onDone('close')
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })

  return (
    <m.div
      role="dialog"
      aria-label={d.speaker}
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 30, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 p-3 safe-b safe-x"
    >
      <div className="panel mx-auto max-w-2xl rounded-[24px] p-5 md:p-6" onClick={advance} data-testid="dialogue">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-2xl uppercase tracking-wide text-molten">{d.speaker}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">{d.role}</p>
        </div>
        <p className="mt-3 min-h-[3.5rem] text-[17px] leading-relaxed text-bone md:text-lg" aria-live="polite">
          {line.slice(0, shown)}
          {typing && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-pump align-middle" />}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {last && !typing && d.options ? (
            d.options.map((o, k) => (
              <Btn
                key={o.label}
                variant={k === 0 ? 'primary' : 'ghost'}
                size="sm"
                sound={k === 0 ? 'confirm' : 'click'}
                onClick={(e) => {
                  e.stopPropagation()
                  onDone(o.action)
                }}
              >
                {o.label}
              </Btn>
            ))
          ) : (
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-bone/45">
              {typing ? 'Tap to skip' : last ? 'Tap to close' : `Tap to continue · ${i + 1}/${d.lines.length}`}
            </span>
          )}
        </div>
      </div>
    </m.div>
  )
}
