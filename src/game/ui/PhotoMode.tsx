import { m } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { Btn } from './kit'

/**
 * Photo mode: the HUD steps aside, you keep full control (drag to frame, WASD / stick to move), and the bar at
 * the bottom captures the canvas — with an optional small PUMPCHAD · CHAD CITY watermark — to a PNG download, or
 * the device share sheet where the browser supports sharing files. Esc (or Done) puts everything back.
 */
export function PhotoMode({ capture, onExit, touch }: { capture: () => string | null; onExit: () => void; touch: boolean }) {
  const [mark, setMark] = useState(true)
  const [flash, setFlash] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [hideBar, setHideBar] = useState(false)

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onExit])

  const shoot = useCallback(async () => {
    // hide the bar for the frame, then grab the canvas (the engine renders a fresh frame for the capture)
    setHideBar(true)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const url = capture()
    setHideBar(false)
    if (!url) {
      setStatus('Capture isn’t available here — take a screenshot instead.')
      return
    }
    const img = new Image()
    img.src = url
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    const g = c.getContext('2d')!
    g.drawImage(img, 0, 0)
    if (mark) {
      const s = Math.max(1, c.width / 1600)
      const text = 'PUMPCHAD · CHAD CITY'
      g.font = `400 ${Math.round(22 * s)}px Anton, Impact, sans-serif`
      const tw = g.measureText(text).width
      const pad = 12 * s
      const w = tw + pad * 2 + 26 * s
      const h = 38 * s
      const x = c.width - w - 18 * s
      const y = c.height - h - 18 * s
      g.fillStyle = 'rgba(16,14,20,0.55)'
      g.beginPath()
      g.roundRect(x, y, w, h, h / 2)
      g.fill()
      // little crown
      g.fillStyle = '#ffb24a'
      const cx = x + pad + 9 * s
      const cy = y + h / 2
      g.beginPath()
      g.moveTo(cx - 9 * s, cy + 6 * s)
      g.lineTo(cx + 9 * s, cy + 6 * s)
      g.lineTo(cx + 10 * s, cy - 6 * s)
      g.lineTo(cx + 4 * s, cy - 1 * s)
      g.lineTo(cx, cy - 8 * s)
      g.lineTo(cx - 4 * s, cy - 1 * s)
      g.lineTo(cx - 10 * s, cy - 6 * s)
      g.closePath()
      g.fill()
      g.fillStyle = '#fff4dc'
      g.textBaseline = 'middle'
      g.fillText(text, x + pad + 24 * s, cy + 1 * s)
    }
    setFlash(true)
    setTimeout(() => setFlash(false), 220)
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, 'image/png'))
    if (!blob) return setStatus('Capture failed — try again.')
    const name = `chad-city-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`
    const file = new File([blob], name, { type: 'image/png' })
    const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean }
    if (touch && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: 'Chad City' })
        setStatus('Shared.')
        return
      } catch {
        /* cancelled: fall through to a download */
      }
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    setStatus(`Saved ${name}`)
  }, [capture, mark, touch])

  return (
    <>
      {flash && <div className="pointer-events-none absolute inset-0 z-50 bg-white/60" />}
      {!hideBar && (
        <m.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="pointer-events-auto absolute bottom-[max(18px,env(safe-area-inset-bottom))] left-1/2 z-40 w-[min(94vw,32rem)] -translate-x-1/2"
          data-testid="photo-bar"
        >
          <div className="panel rounded-2xl p-3">
            <div className="flex items-center gap-2">
              <Btn className="flex-1" onClick={() => void shoot()} data-testid="photo-capture">
                Capture
              </Btn>
              <button
                type="button"
                onClick={() => setMark((v) => !v)}
                aria-pressed={mark}
                className={`min-h-11 rounded-xl px-3 font-mono text-[11px] uppercase tracking-[0.14em] ring-1 ${mark ? 'bg-pump/20 text-moon ring-pump/40' : 'text-bone/60 ring-bone/15'}`}
                data-testid="photo-watermark"
              >
                Watermark {mark ? 'on' : 'off'}
              </button>
              <Btn variant="ghost" onClick={onExit} data-testid="photo-done">
                Done
              </Btn>
            </div>
            <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-bone/55">
              {status ?? (touch ? 'Drag to frame · stick to move · Done to exit' : 'Drag to frame · WASD to move · Esc to exit')}
            </p>
          </div>
        </m.div>
      )}
    </>
  )
}

/** first-visit intro: a caption + a Skip button over the flyover */
export function IntroOverlay({ onSkip }: { onSkip: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') onSkip()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onSkip])
  return (
    <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-0 z-40" data-testid="intro">
      <div className="absolute inset-x-0 top-[12%] text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-moon drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">Welcome to</p>
        <p className="font-display text-5xl uppercase tracking-wide text-bone drop-shadow-[0_3px_12px_rgba(0,0,0,0.65)] sm:text-6xl">Chad City</p>
      </div>
      <button
        type="button"
        onClick={onSkip}
        className="panel pointer-events-auto absolute bottom-[max(22px,env(safe-area-inset-bottom))] right-[max(18px,env(safe-area-inset-right))] min-h-11 rounded-full px-5 font-mono text-[12px] uppercase tracking-[0.18em]"
        data-testid="intro-skip"
      >
        Skip ›
      </button>
    </m.div>
  )
}
