import { useState } from 'react'
import { COLS, MAX_PIECES, PIECE, PIECES, PLACE_MSG, PLOT, ROWS, canPlace, footprint, type Estate, type Piece, type PieceKind } from '../estates'
import { Btn } from './kit'
import { Header, Overlay, useEsc } from './Menus'

/**
 * The plot editor: a top-down grid of your plot (north up, the lane + gate marked), a palette of pieces with prices,
 * and tools. Pick a piece and tap a cell to place it (rotate first if you like); tap a placed piece to rotate, move
 * or remove it. Every change is checked (inside the plot, nothing overlapping, enough coins), saved straight away and
 * shown in the world behind; Undo steps back through this session's changes (coins included).
 */
export function EstateEditor({
  estate,
  coins,
  onCommit,
  onBack,
}: {
  estate: Estate
  coins: number
  /** apply a new layout costing `spend` coins (negative = refund); false if it can't be afforded */
  onCommit: (pieces: Piece[], spend: number) => boolean
  onBack: () => void
}) {
  useEsc(onBack)
  const plot = PLOT(estate.plot ?? '')!
  const pieces = estate.pieces
  const [tool, setTool] = useState<PieceKind | null>(null)
  const [rot, setRot] = useState(0)
  const [sel, setSel] = useState<number | null>(null)
  const [moving, setMoving] = useState(false)
  const [msg, setMsg] = useState('Pick a piece, then tap your plot to place it. Tap a placed piece to rotate, move or remove it.')
  const [history, setHistory] = useState<{ pieces: Piece[]; spend: number }[]>([])

  const commit = (next: Piece[], spend: number, ok: string) => {
    if (!onCommit(next, spend)) return setMsg(PLACE_MSG.coins)
    setHistory((h) => [...h, { pieces, spend }].slice(-30))
    setMsg(ok)
  }

  const tapCell = (x: number, z: number) => {
    if (moving && sel !== null) {
      const p = pieces[sel]
      const moved = { ...p, x, z }
      const err = canPlace(pieces, moved, p)
      if (err) return setMsg(PLACE_MSG[err])
      commit(pieces.map((q, i) => (i === sel ? moved : q)), 0, `Moved the ${PIECE(p.k)!.name.toLowerCase()}.`)
      setMoving(false)
      return
    }
    if (!tool) return setSel(null)
    const def = PIECE(tool)!
    const p: Piece = { k: tool, x, z, r: rot }
    const err = canPlace(pieces, p)
    if (err) return setMsg(PLACE_MSG[err])
    if (coins < def.price) return setMsg(`${PLACE_MSG.coins} (${def.name}: ${def.price}, you have ${coins})`)
    commit([...pieces, p], def.price, `Placed a ${def.name.toLowerCase()} · −${def.price} coins.`)
  }

  const rotateSel = () => {
    if (sel === null) return
    const p = pieces[sel]
    const turned = { ...p, r: (p.r + 1) % 4 }
    const err = canPlace(pieces, turned, p)
    if (err) return setMsg(PLACE_MSG[err])
    commit(pieces.map((q, i) => (i === sel ? turned : q)), 0, 'Rotated.')
  }
  const removeSel = () => {
    if (sel === null) return
    const def = PIECE(pieces[sel].k)!
    commit(pieces.filter((_, i) => i !== sel), -def.price, `Removed the ${def.name.toLowerCase()} · +${def.price} coins back.`)
    setSel(null)
  }
  const undo = () => {
    const last = history[history.length - 1]
    if (!last) return
    if (!onCommit(last.pieces, -last.spend)) return setMsg(PLACE_MSG.coins)
    setHistory((h) => h.slice(0, -1))
    setSel(null)
    setMoving(false)
    setMsg('Undone.')
  }

  const selPiece = sel !== null ? pieces[sel] : null
  const laneFirst = plot.gate === 'w' || plot.gate === 'n' // the lane strip comes before the grid (left / above)
  const sideways = plot.gate === 'n' || plot.gate === 's' // the lane runs along the top / bottom edge
  return (
    <Overlay label="Build on your plot" wide>
      <Header title={plot.name} onBack={onBack} />
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-moon">
          Chadville Estates · {pieces.length}/{MAX_PIECES} pieces · refunds in full
        </p>
        <span className="rounded-full bg-[#ffd25a]/15 px-3 py-1 font-mono text-[12px] font-semibold text-[#ffd25a] ring-1 ring-[#ffd25a]/40" data-testid="estate-coins">
          ◉ {coins}
        </span>
      </div>

      <div className={`mt-3 flex justify-center gap-2 ${sideways ? "flex-col items-center" : "items-stretch"}`}>
        {laneFirst && <LaneStrip horizontal={sideways} />}
        <svg viewBox={`-0.05 -0.05 ${COLS + 0.1} ${ROWS + 0.1}`} className="block h-[40svh] w-auto min-w-0 max-w-[calc(100%-2rem)] touch-manipulation rounded-xl bg-[#3a5236]" role="grid" aria-label="Your plot" data-testid="estate-grid">
          {Array.from({ length: COLS * ROWS }, (_, i) => {
            const x = i % COLS
            const z = Math.floor(i / COLS)
            return <rect key={i} x={x + 0.02} y={z + 0.02} width={0.96} height={0.96} rx={0.06} fill="#4a6a44" stroke="#5a7a52" strokeWidth={0.02} onClick={() => tapCell(x, z)} data-cell={`${x},${z}`} className="cursor-pointer" />
          })}
          {pieces.map((p, i) => {
            const f = footprint(p)
            const def = PIECE(p.k)!
            const cx = f.x0 + f.w / 2
            const cz = f.z0 + f.h / 2
            // a notch on the piece's front (its door / face): r=0 faces south (+z), then clockwise
            const [fx, fz] = [[0, f.h / 2], [-f.w / 2, 0], [0, -f.h / 2], [f.w / 2, 0]][p.r]
            return (
              <g
                key={i}
                onClick={(e) => {
                  e.stopPropagation()
                  if (moving) return
                  setSel(i === sel ? null : i)
                  setTool(null)
                }}
                className="cursor-pointer"
                data-piece-index={i}
                data-piece={p.k}
              >
                <rect x={f.x0 + 0.08} y={f.z0 + 0.08} width={f.w - 0.16} height={f.h - 0.16} rx={0.12} fill={def.color} stroke={i === sel ? '#ffd25a' : '#14111c'} strokeWidth={i === sel ? 0.08 : 0.03} />
                <circle cx={cx + fx * 0.75} cy={cz + fz * 0.75} r={0.09} fill="#14111c" />
                <text x={cx} y={cz + 0.07} textAnchor="middle" fontSize={f.w > 1 ? 0.3 : 0.19} fill="#14111c" style={{ fontWeight: 700 }}>
                  {def.name}
                </text>
              </g>
            )
          })}
        </svg>
        {!laneFirst && <LaneStrip horizontal={sideways} />}
      </div>

      <p className="mt-2 min-h-[2.5em] text-[13px] leading-snug text-bone/85" data-testid="estate-msg" aria-live="polite">
        {moving ? 'Tap where it should go.' : msg}
      </p>

      {selPiece ? (
        <div className="flex flex-wrap gap-2" data-testid="estate-selected">
          <Btn size="sm" variant="ghost" onClick={rotateSel} data-testid="estate-rotate">
            Rotate
          </Btn>
          <Btn size="sm" variant="ghost" onClick={() => setMoving((m) => !m)} data-testid="estate-move">
            {moving ? 'Cancel move' : 'Move'}
          </Btn>
          <Btn size="sm" variant="ghost" onClick={removeSel} data-testid="estate-remove">
            Remove (+{PIECE(selPiece.k)!.price})
          </Btn>
          <Btn size="sm" variant="ghost" onClick={() => (setSel(null), setMoving(false))}>
            Deselect
          </Btn>
        </div>
      ) : (
        <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="listbox" aria-label="Pieces" data-testid="estate-palette">
          {PIECES.map((d) => (
            <button
              key={d.kind}
              type="button"
              role="option"
              aria-selected={tool === d.kind}
              onClick={() => setTool((t) => (t === d.kind ? null : d.kind))}
              data-kind={d.kind}
              className={`flex min-h-12 shrink-0 items-center gap-2 rounded-2xl px-3 text-left ring-1 ${tool === d.kind ? 'bg-bone/15 ring-[#ffd25a]' : 'bg-bone/[0.04] ring-bone/10'} ${coins < d.price ? 'opacity-50' : ''}`}
            >
              <span className="h-4 w-4 rounded" style={{ background: d.color }} />
              <span className="text-[13px] font-semibold">{d.name}</span>
              <span className="font-mono text-[11px] text-[#ffd25a]">◉{d.price}</span>
              {d.w > 1 && <span className="font-mono text-[10px] text-ash">2×2</span>}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        {tool && !selPiece && (
          <Btn size="sm" variant="ghost" onClick={() => setRot((r) => (r + 1) % 4)} data-testid="estate-rot-new">
            Facing: {['south', 'west', 'north', 'east'][rot]}
          </Btn>
        )}
        <Btn size="sm" variant="ghost" onClick={undo} disabled={!history.length} className={!history.length ? 'opacity-40' : ''} data-testid="estate-undo">
          Undo
        </Btn>
        <Btn size="sm" className="ml-auto" onClick={onBack}>
          Done
        </Btn>
      </div>
    </Overlay>
  )
}

function LaneStrip({ horizontal = false }: { horizontal?: boolean }) {
  return horizontal ? (
    <div className="flex h-6 w-[min(100%,24rem)] shrink-0 items-center justify-center rounded-lg bg-[#5a5462]">
      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-bone/70">lane · gate</span>
    </div>
  ) : (
    <div className="flex w-6 shrink-0 items-center justify-center rounded-lg bg-[#5a5462]">
      <span className="rotate-180 font-mono text-[9px] uppercase tracking-[0.2em] text-bone/70 [writing-mode:vertical-rl]">lane · gate</span>
    </div>
  )
}
