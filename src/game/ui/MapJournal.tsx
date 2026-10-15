import { SUMMIT_WORLD, castleRoadWorld } from '../scenes/world/mountain'
import { DESCENT } from '../scenes/world/descent'
import { MANOR_PAD, inLakeWater } from '../scenes/world/valley'
import { useMemo, useState } from 'react'
import { LANDMARKS, canTravel, isLockedLandmark, journal, objectiveTarget, type Landmark, type MapKind } from '../atlas'
import type { SaveData } from '../save'
import { BRIDGES, CANAL, CORE_R, DISTRICTS, LAKE, PIER } from '../scenes/world/city'
import { LANTERNS } from '../scenes/world/lanterns'
import { Btn, Segmented } from './kit'
import { EXPANSION_OPEN, GATE_LINE_Z } from '../launch'
import { Header, Overlay, useEsc } from './Menus'

/** world bounds drawn by the map (x right = east, z down = south, so north is up) */
/** the lake as rows of 4 m cells (built once): [x, z, width] runs where the water is */
const LAKE_RUNS: [number, number, number][] = (() => {
  const out: [number, number, number][] = []
  for (let z = 360; z < 620; z += 4) {
    let x0: number | null = null
    for (let x = -110; x <= 150; x += 4) {
      const w = inLakeWater(x + 2, z + 2)
      if (w && x0 === null) x0 = x
      if ((!w || x === 150) && x0 !== null) {
        out.push([x0, z, x - x0])
        x0 = null
      }
    }
  }
  return out
})()
const VB_FULL = { x: -150, z: -100, w: 320, h: 720 }
/** the first release shows the village only; the veiled strip below the gate stands for the closed expansion */
const VB_VILLAGE = { x: -112, z: -76, w: 250, h: 232 }
const VB = EXPANSION_OPEN ? VB_FULL : VB_VILLAGE
const KIND_COLOR: Record<MapKind, string> = { place: '#e9e4da', shop: '#ffd25a', quest: '#ff9a3c', activity: '#7affb0' }

/**
 * Map + journal. The map is drawn from the same layout the world is built from (walkable districts, the canal,
 * the lake + pier), with your position and facing, the tracked objective, and filters for places / shops / quest
 * markers. Places you've reached on foot offer fast travel. The journal lists quests and collections with steps.
 */
export function MapJournal({
  save,
  player,
  onTravel,
  onBack,
}: {
  save: SaveData
  player: { x: number; z: number; yaw: number } | null
  onTravel: (l: Landmark) => void
  onBack: () => void
}) {
  useEsc(onBack)
  const [tab, setTab] = useState<'map' | 'journal'>('map')
  const [show, setShow] = useState<Record<MapKind, boolean>>({ place: true, shop: true, quest: true, activity: true })
  const [sel, setSel] = useState<Landmark | null>(null)
  const target = objectiveTarget(save)
  const entries = useMemo(() => journal(save), [save])
  const d = save.progress.discoveries
  const dist = (x: number, z: number) => (player ? Math.round(Math.hypot(x - player.x, z - player.z)) : null)

  return (
    <Overlay label="Map and journal" wide>
      <Header title={tab === 'map' ? 'Map' : 'Journal'} onBack={onBack} />
      <div className="mt-3">
        <Segmented
          label="View"
          value={tab}
          options={[
            { id: 'map', name: 'Map' },
            { id: 'journal', name: 'Journal' },
          ]}
          onChange={(v) => setTab(v)}
        />
      </div>

      {tab === 'map' ? (
        <>
          {target && (
            <p className="mt-3 text-[13px] text-bone/85" data-testid="map-tracked">
              <span className="text-[#ff9a3c]">◆ Tracking:</span> {target.label}
              {dist(target.x, target.z) !== null && <span className="font-mono text-[11px] text-ash"> · {dist(target.x, target.z)} m</span>}
            </p>
          )}
          <div className="relative mt-2 overflow-hidden rounded-2xl bg-[#14111c] ring-1 ring-bone/10">
            <svg viewBox={`${VB.x} ${VB.z} ${VB.w} ${VB.h}`} className="mx-auto block h-auto max-h-[52svh] w-full" role="img" aria-label="Map of the Chadverse" data-testid="map">
              {/* walkable ground */}
              <g fill="#2e2840">
                <circle cx={0} cy={0} r={CORE_R} />
                {Object.entries(DISTRICTS).map(([k, r]) => (
                  <rect key={k} x={r.x0} y={r.z0} width={r.x1 - r.x0} height={r.z1 - r.z0} fill={k === 'forest' ? '#24382e' : k === 'haunted' ? '#2a2e30' : k === 'downtown' || k === 'plaza' ? '#3a3560' : undefined} />
                ))}
              </g>
              {/* water + crossings */}
              <rect x={CANAL.x0} y={CANAL.z0} width={CANAL.x1 - CANAL.x0} height={CANAL.z1 - CANAL.z0} fill="#1e4a6e" />
              {BRIDGES.map((b) => (
                <rect key={b.x} x={b.x - b.w / 2} y={CANAL.z0 - 0.5} width={b.w} height={CANAL.z1 - CANAL.z0 + 1} fill="#5a5068" />
              ))}
              <ellipse cx={LAKE.x} cy={LAKE.z} rx={LAKE.rx} ry={LAKE.rz} fill="#1e4a6e" />
              <rect x={PIER.x0} y={PIER.head.z0} width={PIER.x1 - PIER.x0} height={PIER.z1 - PIER.head.z0} fill="#8a6040" />
              <rect x={PIER.head.x0} y={PIER.head.z0} width={PIER.head.x1 - PIER.head.x0} height={PIER.head.z1 - PIER.head.z0} fill="#8a6040" />
              {/* Moonmere (the lake in the valley basin) and Mooncrest Manor's hillside terrace */}
              <g fill="#1e4a6e">
                {LAKE_RUNS.map((r, i) => (
                  <rect key={i} x={r[0]} y={r[1]} width={r[2]} height={4} />
                ))}
              </g>
              <circle cx={MANOR_PAD.x} cy={MANOR_PAD.z} r={MANOR_PAD.r} fill="#3a4a3a" opacity={0.7} />
              {/* the valley road down to Chad City, and the Castle Road up the mountain beyond it */}
              <polyline points={DESCENT.pts.map((p) => `${p.x},${p.z}`).join(' ')} fill="none" stroke="#b9a98c" strokeWidth={6} strokeLinejoin="round" opacity={0.85} />
              <polyline points={castleRoadWorld().map((p) => `${p.x},${p.z}`).join(' ')} fill="none" stroke="#b9a98c" strokeWidth={5.2} strokeLinejoin="round" opacity={0.85} />
              <circle cx={SUMMIT_WORLD.x} cy={SUMMIT_WORLD.z} r={SUMMIT_WORLD.r} fill="#4a4258" />
              <circle cx={SUMMIT_WORLD.x} cy={SUMMIT_WORLD.z} r={SUMMIT_WORLD.r + 4} fill="none" stroke="#1e4a6e" strokeWidth={3} opacity={0.7} />
              <rect x={-9} y={-40} width={18} height={9} fill="#4a4258" />

              {/* quest markers: unlit lanterns while the adventure runs */}
              {show.quest &&
                d.includes('q1_start') &&
                !d.includes('q1_sigil') &&
                LANTERNS.filter((l) => !d.includes(`q1_lantern_${l.id}`)).map((l) => <rect key={l.id} x={l.x - 1.6} y={l.z - 1.6} width={3.2} height={3.2} transform={`rotate(45 ${l.x} ${l.z})`} fill="#ffd25a" />)}

              {/* the closed expansion: the valley, Chad City and the castle are drawn but veiled */}
              {!EXPANSION_OPEN && (
                <g data-testid="map-locked" pointerEvents="none">
                  <rect x={VB.x} y={GATE_LINE_Z} width={VB.w} height={VB.z + VB.h - GATE_LINE_Z} fill="#0d0b14" opacity={0.62} />
                  <line x1={VB.x} x2={VB.x + VB.w} y1={GATE_LINE_Z} y2={GATE_LINE_Z} stroke="#ffd25a" strokeWidth={0.8} strokeDasharray="4 3" />
                  <text x={VB.x + VB.w / 2} y={GATE_LINE_Z + 30} textAnchor="middle" fontSize={6.2} fill="#ffd25a" style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: 0.6 }}>
                    CHAD CITY · THE VALLEY — NEXT UPDATE
                  </text>
                </g>
              )}

              {/* landmarks */}
              {LANDMARKS.filter((l) => show[l.kind]).map((l) => {
                const open = canTravel(l, save)
                const locked = isLockedLandmark(l)
                const known = locked || !l.visit || d.includes(l.visit)
                return (
                  <g key={l.id} onClick={() => setSel(l)} className="cursor-pointer" data-landmark={l.id}>
                    <circle cx={l.x} cy={l.z} r={7} fill="transparent" />
                    {l.kind === 'shop' ? (
                      <rect x={l.x - 1.8} y={l.z - 1.8} width={3.6} height={3.6} rx={0.8} fill={KIND_COLOR.shop} />
                    ) : l.kind === 'activity' ? (
                      <path d={`M${l.x} ${l.z - 3} L${l.x + 2.6} ${l.z} L${l.x} ${l.z + 3} L${l.x - 2.6} ${l.z} Z`} fill={KIND_COLOR.activity} />
                    ) : (
                      <circle cx={l.x} cy={l.z} r={2.4} fill={locked ? 'none' : known ? KIND_COLOR.place : '#6a6478'} stroke={locked ? '#8a8498' : open && l.visit ? '#ffd25a' : 'none'} strokeWidth={locked ? 0.9 : 0.8} strokeDasharray={locked ? '1.2 1' : undefined} />
                    )}
                    <text x={l.x} y={l.below ? l.z + 7 : l.z - 4} textAnchor="middle" fontSize={4.2} fill={known ? '#e9e4da' : '#8a8498'} style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: 0.2 }}>
                      {locked ? `${l.name} · next update` : known ? l.name : '???'}
                    </text>
                  </g>
                )
              })}

              {/* tracked objective */}
              {show.quest && target && (
                <g data-testid="map-target">
                  <circle cx={target.x} cy={target.z} r={4} fill="none" stroke="#ff9a3c" strokeWidth={0.9}>
                    <animate attributeName="r" values="3;6.5;3" dur="1.8s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="1;0.2;1" dur="1.8s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={target.x} cy={target.z} r={1.5} fill="#ff9a3c" />
                </g>
              )}

              {/* you */}
              {player && (
                <g transform={`translate(${player.x} ${player.z}) rotate(${(-player.yaw * 180) / Math.PI + 180})`} data-testid="map-player">
                  <circle r={3.2} fill="#ff7a1a" opacity={0.25} />
                  <path d="M0 -3.4 L2.4 2.6 L0 1.3 L-2.4 2.6 Z" fill="#ff7a1a" stroke="#14111c" strokeWidth={0.5} />
                </g>
              )}
            </svg>
          </div>

          {/* the closed expansion, listed (it is veiled / off the cropped map): selectable, never travel targets */}
          {!EXPANSION_OPEN && (
            <div className="mt-2" data-testid="map-locked-list">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#ffd25a]">Next update · not open yet</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {LANDMARKS.filter(isLockedLandmark).map((l) => (
                  <button key={l.id} type="button" onClick={() => setSel(l)} data-landmark-locked={l.id} className="min-h-8 rounded-full px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ash ring-1 ring-bone/15 hover:bg-bone/10">
                    ◌ {l.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* filters */}
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Map filters">
            {(['place', 'shop', 'activity', 'quest'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setShow((s) => ({ ...s, [k]: !s[k] }))}
                aria-pressed={show[k]}
                data-filter={k}
                className={`min-h-9 rounded-full px-3.5 font-mono text-[11px] uppercase tracking-[0.15em] ring-1 ${show[k] ? 'bg-bone/10 text-bone ring-bone/30' : 'text-ash ring-bone/10'}`}
              >
                <span style={{ color: KIND_COLOR[k] }}>●</span> {k === 'place' ? 'Places' : k === 'shop' ? 'Shops' : k === 'activity' ? 'Activities' : 'Quest'}
              </button>
            ))}
          </div>

          {/* selected landmark */}
          {sel && (
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-bone/[0.05] p-3 ring-1 ring-bone/10" data-testid="map-selected">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">{isLockedLandmark(sel) || !sel.visit || d.includes(sel.visit) ? sel.name : 'Undiscovered'}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ash">
                  {dist(sel.x, sel.z) !== null ? `${dist(sel.x, sel.z)} m away` : ''}
                  {isLockedLandmark(sel) ? ' · opens in the next update — no travel yet' : sel.spawn && !canTravel(sel, save) ? ' · reach it on foot to unlock travel' : ''}
                  {!sel.spawn ? ' · a shop' : ''}
                </p>
              </div>
              {canTravel(sel, save) && (
                <Btn size="sm" onClick={() => onTravel(sel)} data-testid="map-travel">
                  Travel
                </Btn>
              )}
            </div>
          )}
        </>
      ) : (
        <ul className="mt-4 grid gap-2.5" data-testid="journal">
          {entries.map((e) => (
            <li key={e.id} className="rounded-2xl bg-bone/[0.04] p-3.5 ring-1 ring-bone/10" data-quest={e.id}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[15px] font-semibold">{e.title}</p>
                <span className={`font-mono text-[10px] uppercase tracking-[0.15em] ${e.status === 'done' ? 'text-[#7affb0]' : e.status === 'active' ? 'text-[#ff9a3c]' : 'text-ash'}`}>
                  {e.status === 'done' ? 'Complete' : e.status === 'active' ? 'In progress' : 'Not started'}
                </span>
              </div>
              <ul className="mt-2 grid gap-1">
                {e.steps.map((s, i) => (
                  <li key={i} className={`flex gap-2 text-[13px] ${s.done ? 'text-bone/50 line-through decoration-bone/30' : 'text-bone/85'}`}>
                    <span aria-hidden="true">{s.done ? '✓' : '○'}</span>
                    {s.label}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </Overlay>
  )
}
