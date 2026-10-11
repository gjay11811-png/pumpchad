import { m, type HTMLMotionProps } from 'framer-motion'
import type { ReactNode, SVGProps } from 'react'

/* ───── Brand icons (lucide no longer ships brand marks) ───── */
export const XIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3Zm-1.08 16.17h1.7L7.4 4.74H5.58l11.09 14.43Z" />
  </svg>
)
export const TelegramIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M21.94 4.3 18.7 19.6c-.24 1.08-.88 1.35-1.79.84l-4.94-3.64-2.38 2.3c-.27.26-.49.48-1 .48l.36-5.04 9.17-8.29c.4-.36-.09-.55-.62-.2L6.17 13.2l-4.88-1.53c-1.06-.33-1.08-1.06.22-1.57l19.07-7.35c.88-.33 1.66.2 1.36 1.55Z" />
  </svg>
)

/** Small pumpkin glyph used as a separator / bullet. */
export const PumpkinMark = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...p}>
    <path d="M12 6.5c4.6 0 8 2.9 8 7s-3.4 6.5-8 6.5-8-2.4-8-6.5 3.4-7 8-7Z" fill="currentColor" />
    <path d="M12 6.8V4.2c0-.8.5-1.5 1.4-1.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M8.3 12.2 9.8 11l1 1.6M15.7 12.2 14.2 11l-1 1.6M8.6 15.4c1.8 1.4 5 1.4 6.8 0" stroke="#07060a" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/* ───── Motion ───── */
export const ease = [0.22, 1, 0.36, 1] as const

export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
  ...rest
}: { children: ReactNode; delay?: number; y?: number } & HTMLMotionProps<'div'>) {
  return (
    <m.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.9, ease, delay }}
      className={className}
      {...rest}
    >
      {children}
    </m.div>
  )
}

/** Editorial section index, e.g. "(02) — Tokenomics" */
export function SectionLabel({ n, children, className = '' }: { n: string; children: ReactNode; className?: string }) {
  return (
    <p className={`flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.28em] text-ash ${className}`}>
      <span className="text-pump">({n})</span>
      <span className="h-px w-8 bg-current opacity-40" />
      {children}
    </p>
  )
}

/* ───── Buttons ───── */
type CtaProps = {
  href: string
  children: ReactNode
  variant?: 'pump' | 'ghost' | 'ink'
  icon?: ReactNode
  className?: string
  label?: string
}

export function Cta({ href, children, variant = 'pump', icon, className = '', label }: CtaProps) {
  const external = href.startsWith('http')
  const styles = {
    pump: 'bg-pump text-ink hover:bg-ember shadow-[0_10px_40px_-10px_rgba(255,122,26,0.7)]',
    ghost: 'border border-bone/20 bg-bone/[0.03] text-bone backdrop-blur hover:border-bone/50 hover:bg-bone/[0.07]',
    ink: 'bg-ink text-bone hover:bg-coal',
  }[variant]
  return (
    <a
      href={href}
      aria-label={label}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={`group relative inline-flex min-h-13 items-center justify-center gap-3 overflow-hidden rounded-full px-7 font-sans text-[15px] font-semibold uppercase tracking-[0.08em] transition-[background-color,border-color,transform] duration-300 active:scale-[0.97] ${styles} ${className}`}
    >
      {icon && <span className="transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110">{icon}</span>}
      <span>{children}</span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
      />
    </a>
  )
}

/* ───── Art slot ─────
 * Every mascot placement goes through this. If `src` is empty, a branded
 * placeholder renders so the layout never breaks while art is pending.
 */
export function ArtSlot({
  slot,
  src,
  alt,
  className = '',
  imgClassName = '',
  eager,
  sizes,
  srcSet,
}: {
  slot: string
  src: string
  alt: string
  className?: string
  imgClassName?: string
  eager?: boolean
  sizes?: string
  srcSet?: string
}) {
  return (
    <div data-art-slot={slot} className={`relative overflow-hidden ${className}`}>
      {src ? (
        <img
          src={src}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          {...(eager ? { fetchPriority: 'high' as const } : {})}
          className={`h-full w-full object-cover ${imgClassName}`}
        />
      ) : (
        <div className="metal flex h-full w-full flex-col items-center justify-center gap-3 text-ash">
          <PumpkinMark className="h-12 w-12 text-pump/60" />
          <span className="font-mono text-[11px] uppercase tracking-[0.3em]">Pumpchad art — {slot}</span>
        </div>
      )}
    </div>
  )
}
