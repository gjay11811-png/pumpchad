import { useState } from 'react'
import { createPortal } from 'react-dom'

export const CHADVERSE_URL = `${import.meta.env.BASE_URL}chadverse/`

/**
 * Link into the game. Plays a short orange iris before navigating so the jump from
 * website to game feels like one continuous transition (the game's loader picks it up).
 * Real <a href> underneath: works without JS, middle-click / new tab still behave normally.
 */
export function EnterChadverse({ className = '', children }: { className?: string; children: React.ReactNode }) {
  const [going, setGoing] = useState(false)
  return (
    <>
      <a
        href={CHADVERSE_URL}
        className={className}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
          if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
          e.preventDefault()
          setGoing(true)
          setTimeout(() => (window.location.href = CHADVERSE_URL), 520)
        }}
      >
        {children}
      </a>
      {going &&
        createPortal(
          <div aria-hidden="true" className="fixed inset-0 z-[100] flex items-center justify-center bg-[#07060a] [animation:chadverse-iris_.52s_cubic-bezier(.65,0,.35,1)_forwards]">
            <div className="h-[60vmin] w-[60vmin] rounded-full bg-[radial-gradient(circle,rgba(255,122,26,0.4),transparent_65%)]" />
          </div>,
          document.body,
        )}
    </>
  )
}

/** Small gamepad glyph */
export const PlayIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M7 7h10a5 5 0 0 1 4.9 6l-.8 4a2.6 2.6 0 0 1-4.5 1.2L14.7 16H9.3l-1.9 2.2A2.6 2.6 0 0 1 2.9 17l-.8-4A5 5 0 0 1 7 7Zm1 3v1.5H6.5v1.5H8v1.5h1.5V13H11v-1.5H9.5V10H8Zm8.5 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm-2 2.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
  </svg>
)
