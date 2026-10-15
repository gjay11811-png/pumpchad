import { useEffect, useState } from 'react'

type Detail = { mode: 'none' | 'hang' | 'jump'; text: string }
const cmd = (c: 'pullup' | 'drop') => window.dispatchEvent(new CustomEvent('chad-trav-cmd', { detail: c }))

/**
 * Contextual traversal prompt. Desktop: a one-line key hint ("A / D shimmy · W or Space pull up · S or C drop"). Phone: while hanging, Pull up and Drop buttons
 * appear (reachable, above the Jump button); they only exist while they are useful. World sends `chad-trav-hint`; the buttons send `chad-trav-cmd`.
 */
export function TravHint({ touch }: { touch: boolean }) {
  const [d, setD] = useState<Detail>({ mode: 'none', text: '' })
  useEffect(() => {
    const f = (e: Event) => setD((e as CustomEvent<Detail>).detail)
    window.addEventListener('chad-trav-hint', f)
    return () => window.removeEventListener('chad-trav-hint', f)
  }, [])
  if (d.mode === 'none' && !d.text) return null
  const btn = 'pointer-events-auto flex h-14 min-w-[5.5rem] items-center justify-center rounded-full border border-bone/25 bg-ink/70 px-4 font-display text-sm uppercase tracking-wide text-bone backdrop-blur-sm active:scale-90'
  return (
    <>
      {d.text && (
        <p className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 rounded-full bg-ink/70 px-4 py-1.5 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-moon" data-testid="trav-hint">
          {touch && d.mode === 'hang' ? 'Hanging' : d.text}
        </p>
      )}
      {touch && d.mode === 'hang' && (
        <div className="pointer-events-none absolute bottom-[calc(max(28px,env(safe-area-inset-bottom))+11rem)] right-[max(24px,env(safe-area-inset-right))] flex flex-col gap-2" data-testid="trav-buttons">
          <button type="button" className={btn} onPointerDown={(e) => (e.preventDefault(), cmd('pullup'))} data-testid="trav-pullup">
            Pull up
          </button>
          <button type="button" className={btn} onPointerDown={(e) => (e.preventDefault(), cmd('drop'))} data-testid="trav-drop">
            Drop
          </button>
        </div>
      )}
    </>
  )
}
