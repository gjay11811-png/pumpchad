import { AnimatePresence, LazyMotion, MotionConfig, domAnimation } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { audio } from './audio'
import { runAchievements, xpFor, type RunState } from './chadpress'
import { preloadModel } from './character/character'
import type { Appearance } from './character/types'
import { DIALOGUE, PUMPKIN_LINES, type Dialogue, type DialogueOption } from './dialogue'
import { Engine } from './engine/Engine'
import { Input } from './input'
import { ACHIEVEMENTS, defaultSave, levelFor, loadSave, writeSave, type SaveData, type Settings } from './save'
import { STAT_FOR, levelsGained, rollDaily, setRewards } from './progression'
import { Gym, type GymMode } from './scenes/Gym'
import { STATIONS, setXp, type SetState, type StationId } from './workout'
import { WorkoutPanel } from './ui/WorkoutPanel'
import { RushPanel, type RushResult } from './ui/RushPanel'
import { rushXp, type RushStats } from './minigames/pumpkinRush'
import { Showroom } from './scenes/Showroom'
import { World, type Interactable } from './scenes/World'
import { ChadPress } from './ui/ChadPress'
import { Creator } from './ui/Creator'
import { DialoguePanel } from './ui/DialoguePanel'
import { Loading, Portal, Title } from './ui/Entrance'
import { Hud, LevelUpBanner, Toasts, type Toast } from './ui/Hud'
import { Joystick } from './ui/Joystick'
import { AchievementsMenu, NoticeBoardMenu, PauseMenu, ProfileMenu, SettingsMenu, WellToss } from './ui/Menus'

type Phase = 'boot' | 'title' | 'creator' | 'world' | 'gym' | 'error'
type Overlay = null | 'pause' | 'settings' | 'achievements' | 'profile' | 'board' | 'welltoss'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const ACH_XP = 25

export function GameApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engine = useRef<Engine | null>(null)
  const input = useRef<Input | null>(null)
  const showroom = useRef<Showroom | null>(null)
  const world = useRef<World | null>(null)
  const gym = useRef<Gym | null>(null)
  const pokes = useRef(0)
  const toastQueue = useRef<Toast[]>([])
  const toastBusy = useRef(false)

  const [save, setSaveState] = useState<SaveData>(() => loadSave())
  const saveRef = useRef(save)
  const [phase, setPhase] = useState<Phase>('boot')
  const [boot, setBoot] = useState({ pct: 5, label: 'Igniting renderer' })
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [settingsFrom, setSettingsFrom] = useState<Overlay>(null)
  const [dialogue, setDialogue] = useState<Dialogue | null>(null)
  const [prompt, setPrompt] = useState<Interactable | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [portal, setPortal] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [gymMode, setGymMode] = useState<GymMode>('free')
  const [error, setError] = useState('')
  const [touch] = useState(() => window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window)
  const [levelUp, setLevelUp] = useState<number | null>(null)
  const [sprint, setSprint] = useState(false)
  const toggleSprint = () =>
    setSprint((v) => {
      if (input.current) input.current.sprint = !v
      return !v
    })
  /** Pumpkin Rush: null = not playing; 'ready' / 'done' cards pause the world, 'run' lets you move */
  const [rush, setRush] = useState<null | 'ready' | 'run' | 'done'>(null)
  const rushRef = useRef(rush)
  rushRef.current = rush
  const lastXp = useRef(save.progress.xp)
  // level-up moment: fires for every XP source (sets, Chad Press, achievements, mini-games)
  useEffect(() => {
    const gained = levelsGained(lastXp.current, save.progress.xp, levelFor)
    lastXp.current = save.progress.xp
    if (!gained.length) return
    setLevelUp(gained[gained.length - 1])
    audio.play('achievement')
    const t = setTimeout(() => setLevelUp(null), 3000)
    return () => clearTimeout(t)
  }, [save.progress.xp])

  const pumpToasts = () => {
    const t = toastQueue.current.shift()
    if (!t) return void (toastBusy.current = false)
    toastBusy.current = true
    if (t.kind === 'achievement') audio.play('achievement')
    setToasts([t])
    setTimeout(() => {
      setToasts([])
      setTimeout(pumpToasts, 350)
    }, 2600)
  }

  /** Single write path: updates React state + localStorage together. */
  const setSave = useCallback((fn: (s: SaveData) => SaveData) => {
    const next = fn(saveRef.current)
    saveRef.current = next
    setSaveState(next)
    writeSave(next)
  }, [])

  /* ── boot ── */
  useEffect(() => {
    const canvas = canvasRef.current!
    let e: Engine
    try {
      e = new Engine(canvas)
    } catch {
      setError('Your browser could not start WebGL, which the Chadverse needs. Try a recent Safari, Chrome or Firefox, or turn on hardware acceleration.')
      setPhase('error')
      return
    }
    engine.current = e
    input.current = new Input(canvas)
    const s = saveRef.current.settings
    e.setQuality(s.quality, s.reducedEffects)
    audio.configure(s)
    setBoot({ pct: 35, label: 'Loading fonts' })
    const room = new Showroom(e, canvas)
    showroom.current = room
    e.setScene(room)
    e.start()
    const app = saveRef.current.character?.appearance
    if (app) preloadModel(app.species)
    let cancelled = false
    void (async () => {
      await Promise.race([document.fonts?.ready, sleep(2500)])
      if (cancelled) return
      setBoot({ pct: 70, label: 'Building the stage' })
      await room.setAppearance(app ?? { species: 'pumpkin', skin: '#e8741c', outfit: '#141216', glow: '#ffb347', top: 'shirtless', headwear: 'crown', eyewear: 'shades', chain: true })
      if (cancelled) return
      setBoot({ pct: 100, label: 'Ready' })
      await sleep(350)
      if (!cancelled) setPhase('title')
    })()
    return () => {
      cancelled = true
      input.current?.dispose()
      e.dispose()
      audio.dispose()
    }
  }, [])

  /* ── achievements / discoveries ── */
  const unlock = useCallback(
    (id: string) => {
      if (saveRef.current.progress.achievements.includes(id) || !ACHIEVEMENTS[id]) return
      setSave((s) => ({ ...s, progress: { ...s.progress, achievements: [...s.progress.achievements, id], xp: s.progress.xp + ACH_XP } }))
      toastQueue.current.push({ id: `${id}-${Date.now()}`, title: ACHIEVEMENTS[id].name, desc: `${ACHIEVEMENTS[id].desc}  +${ACH_XP} XP`, kind: 'achievement' })
      if (!toastBusy.current) pumpToasts()
    },
    [setSave],
  )
  const discover = useCallback(
    (id: string) => {
      if (saveRef.current.progress.discoveries.includes(id)) return
      setSave((s) => ({ ...s, progress: { ...s.progress, discoveries: [...s.progress.discoveries, id] } }))
      const d = saveRef.current.progress.discoveries
      if (d.includes('talk_coach') && d.includes('talk_hodl')) unlock('socialite')
    },
    [setSave, unlock],
  )

  /** Non-achievement toast (collectibles etc.), queued with achievements so they never stack. */
  const notify = (title: string, desc: string) => {
    toastQueue.current.push({ id: `n-${Date.now()}`, title, desc, kind: 'collect' })
    if (!toastBusy.current) pumpToasts()
  }

  /* ── world interactions ── */
  const handleInteractRef = useRef<(id: string) => void>(() => {})
  const handleGymRef = useRef<(id: string) => void>(() => {})

  /* ── scene transitions ── */
  const go = useCallback(async (next: 'creator' | 'world' | 'gym', opts: { spawn?: 'start' | 'gym'; label?: string } = {}) => {
    const e = engine.current!
    const canvas = canvasRef.current!
    audio.play('portal')
    setPortal(opts.label ?? 'Entering')
    setPrompt(null)
    setDialogue(null)
    setOverlay(null)
    input.current?.clear()
    await sleep(470)
    const app = saveRef.current.character?.appearance
    world.current = null
    gym.current = null
    if (next === 'creator') {
      const room = new Showroom(e, canvas)
      showroom.current = room
      e.setScene(room)
      audio.setAmbience('menu')
    } else if (next === 'world' && app) {
      showroom.current = null
      const w = new World(e, input.current!, { onPrompt: setPrompt, onInteract: (id) => handleInteractRef.current(id) }, saveRef.current.settings.quality)
      w.cameraSensitivity = saveRef.current.settings.cameraSensitivity
      // load + compile behind the portal overlay; the previous scene keeps rendering until the swap
      await w.populate(app, opts.spawn ?? 'start', saveRef.current.progress.discoveries)
      await e.precompile(w)
      e.setScene(w)
      if (saveRef.current.progress.discoveries.includes('stash')) w.revealStash()
      world.current = w
      audio.setAmbience('square')
    } else if (next === 'gym' && app) {
      showroom.current = null
      const g = new Gym(e, input.current, { onPrompt: setPrompt, onInteract: (id) => handleGymRef.current(id) })
      g.cameraSensitivity = saveRef.current.settings.cameraSensitivity
      await g.populate(app)
      await e.precompile(g)
      e.setScene(g)
      gym.current = g
      setGymMode('free')
      audio.setAmbience('gym')
    }
    setPhase(next)
    await sleep(120)
    setPortal(null)
  }, [])

  handleInteractRef.current = (id: string) => {
    const w = world.current
    if (!w) return
    if (rushRef.current === 'run') return // mid-sprint: nothing else steals the E key
    switch (id) {
      case 'rush':
        input.current?.clear()
        setRush('ready')
        break
      case 'coach':
      case 'hodl':
      case 'barkeep':
      case 'smith':
      case 'potion':
      case 'captain':
      case 'guide':
        discover(`talk_${id}`)
        w.faceNpcToPlayer(id)
        w.markTalked(id)
        setDialogue(DIALOGUE[id])
        break
      case 'statue':
        // first read of the plaque is a lore discovery
        if (!saveRef.current.progress.discoveries.includes('lore_fountain')) {
          discover('lore_fountain')
          notify('Lore discovered', 'The Pump Fountain — read the plaque in full.')
        }
        setDialogue(DIALOGUE.statue)
        break
      case 'board':
        input.current?.clear()
        setOverlay('board')
        break
      case 'gourd_1':
      case 'gourd_2':
      case 'gourd_3': {
        setDialogue(DIALOGUE[id])
        w.gourdFound(id)
        if (!saveRef.current.progress.discoveries.includes(id)) {
          discover(id)
          audio.play('perfect')
          const n = saveRef.current.progress.discoveries.filter((x) => x.startsWith('gourd_')).length
          notify(`Talking pumpkin ${n}/3`, n === 3 ? 'The whole Gourd Council. They will never stop talking now.' : 'More of them are hiding around the kingdom.')
          if (n >= 3) unlock('gourd_council')
        }
        break
      }
      case 'gate':
      case 'citygate':
      case 'lookout':
      case 'wardrobe':
      case 'well':
      case 'window':
      case 'arcade':
        if (id === 'well') discover('wish')
        if (id === 'lookout') discover('lookout')
        setDialogue(DIALOGUE[id])
        break
      case 'seed_1':
      case 'seed_2':
      case 'seed_3':
      case 'seed_4':
      case 'seed_5': {
        w.collect(id, true)
        discover(id)
        audio.play('perfect')
        const n = saveRef.current.progress.discoveries.filter((x) => x.startsWith('seed_')).length
        notify(`Golden seed ${n}/5`, n === 5 ? 'The whole set. The King would be proud.' : 'Hidden around Chad Square.')
        if (n >= 5) unlock('seed_collector')
        break
      }
      case 'pumpkin': {
        w.boing()
        pokes.current++
        discover('poke_pumpkin')
        setDialogue({ speaker: 'Suspicious Pumpkin', role: 'Definitely just a pumpkin', lines: [PUMPKIN_LINES[Math.min(pokes.current - 1, PUMPKIN_LINES.length - 1)]] })
        if (pokes.current >= 3) unlock('gourd_whisperer')
        break
      }
      case 'rune':
        if (!w.stashFound) {
          w.revealStash()
          discover('stash')
          unlock('kings_stash')
          setDialogue(DIALOGUE.rune)
        } else setDialogue(DIALOGUE.rune_again)
        break
      case 'gym':
        void go('gym', { label: 'Entering Chad Gym' })
        break
    }
  }

  /* ── gym floor: stations + the door back out ── */
  handleGymRef.current = (id: string) => {
    const g = gym.current
    if (!g) return
    if (id === 'exit') return void go('world', { spawn: 'gym', label: 'Back to Chad Square' })
    if (id === 'press' || id in STATIONS) {
      input.current?.clear()
      g.startStation(id as 'press' | StationId)
      setGymMode(id as GymMode)
    }
  }
  const leaveStation = useCallback(() => {
    gym.current?.stopStation()
    input.current?.clear()
    setGymMode('free')
  }, [])

  const closeDialogue = (action: DialogueOption['action']) => {
    setDialogue(null)
    world.current?.cooldown()
    if (action === 'gym') void go('gym', { label: 'Entering Chad Gym' })
    if (action === 'welltoss') setOverlay('welltoss')
    if (action === 'wardrobe') {
      setEditing(true)
      void go('creator', { label: 'Opening the wardrobe' })
    }
  }

  /* ── pause world while any UI is up ── */
  useEffect(() => {
    const blocked = !!overlay || !!dialogue || !!portal || rush === 'ready' || rush === 'done'
    if (world.current) world.current.paused = blocked
    if (gym.current) gym.current.paused = blocked
    if (input.current) {
      input.current.enabled = !blocked
      if (blocked) input.current.clear()
    }
  }, [overlay, dialogue, portal, phase, rush])

  /* ── keyboard: Esc opens pause in the world ── */
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (phase === 'world' || (phase === 'gym' && gymMode === 'free')) && !overlay && !dialogue && !portal && !rushRef.current) setOverlay('pause')
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [phase, overlay, dialogue, portal, gymMode])

  /* ── settings ── */
  const changeSettings = (patch: Partial<Settings>) => {
    const prev = saveRef.current.settings
    const next = { ...prev, ...patch }
    if (patch.muted === false) audio.unlock()
    setSave((s) => ({ ...s, settings: next }))
    audio.configure(next)
    if (next.quality !== prev.quality || next.reducedEffects !== prev.reducedEffects) engine.current?.setQuality(next.quality, next.reducedEffects)
    if (world.current) world.current.cameraSensitivity = next.cameraSensitivity
    if (gym.current) gym.current.cameraSensitivity = next.cameraSensitivity
  }

  const enterFromTitle = (sound: boolean) => {
    if (sound) audio.unlock()
    changeSettings({ muted: !sound })
    if (saveRef.current.character) void go('world', { label: 'Entering Chad Square' })
    else {
      setEditing(false)
      setPhase('creator')
      audio.setAmbience('menu')
    }
  }

  const confirmCharacter = (name: string, appearance: Appearance) => {
    const isNew = !saveRef.current.character
    setSave((s) => ({ ...s, character: { name, appearance } }))
    if (isNew) unlock('welcome')
    void go('world', { label: 'Entering Chad Square' })
  }

  const finishRun = (run: RunState) => {
    const xp = xpFor(run)
    setSave((s) => ({ ...s, progress: { ...s.progress, xp: s.progress.xp + xp, gymBest: Math.max(s.progress.gymBest, run.score), gymRuns: s.progress.gymRuns + 1 } }))
    runAchievements(run).forEach(unlock)
    return xp
  }

  const finishSet = useCallback(
    (station: StationId, set: SetState) => {
      // daily fatigue: the first sets at a station pay in full, repeats pay less (stops XP farming)
      const r = setRewards(setXp(set, STATIONS[station]), set.strength, rollDaily(saveRef.current.progress.daily).sets[station] ?? 0)
      const stat = STAT_FOR[station]
      setSave((s) => {
        const d = rollDaily(s.progress.daily)
        const p = s.progress
        return {
          ...s,
          progress: {
            ...p,
            xp: p.xp + r.xp,
            strength: p.strength + (stat === 'strength' ? r.stat : 0),
            stamina: p.stamina + (stat === 'stamina' ? r.stat : 0),
            reps: { ...p.reps, [station]: (p.reps[station] ?? 0) + set.reps },
            stats: { sets: p.stats.sets + 1, clean: p.stats.clean + set.clean, bestCombo: Math.max(p.stats.bestCombo, set.maxCombo) },
            daily: { day: d.day, sets: { ...d.sets, [station]: (d.sets[station] ?? 0) + 1 } },
          },
        }
      })
      const reps = saveRef.current.progress.reps
      if ((Object.keys(STATIONS) as StationId[]).every((k) => (reps[k] ?? 0) >= STATIONS[k].reps)) unlock('full_circuit')
      if (Object.values(reps).reduce((a, b) => a + b, 0) >= 100) unlock('century')
      return r
    },
    [setSave, unlock],
  )

  /** a finished Pumpkin Rush: XP (with daily fatigue), personal best, achievement */
  const finishRush = (st: RushStats): RushResult => {
    const p0 = saveRef.current.progress
    const r = setRewards(rushXp(st.score), 0, rollDaily(p0.daily).sets.pumpkin_rush ?? 0)
    const prev = p0.records.pumpkin_rush ?? 0
    setSave((s) => {
      const d = rollDaily(s.progress.daily)
      return {
        ...s,
        progress: {
          ...s.progress,
          xp: s.progress.xp + r.xp,
          records: { ...s.progress.records, pumpkin_rush: Math.max(s.progress.records.pumpkin_rush ?? 0, st.score) },
          daily: { day: d.day, sets: { ...d.sets, pumpkin_rush: (d.sets.pumpkin_rush ?? 0) + 1 } },
        },
      }
    })
    if (st.score >= 5000) unlock('rush_hour')
    return { xp: r.xp, mult: r.mult, best: Math.max(prev, st.score), newBest: st.score > prev }
  }

  const resetProgress = () => {
    const fresh = { ...defaultSave(), settings: saveRef.current.settings }
    setSave(() => fresh)
    setOverlay(null)
    setEditing(false)
    void go('creator', { label: 'Starting over' })
  }

  /* ── title screen framing: keep the character clear of the title panel ── */
  useEffect(() => {
    if (phase !== 'title' || !showroom.current) return
    const desktop = window.matchMedia('(min-width: 768px)').matches
    showroom.current.setInsets(desktop ? { left: 0, right: 470, bottom: 0, top: 0 } : { left: 0, right: 0, top: 40, bottom: window.innerHeight * 0.42 })
  }, [phase])

  /* ── test hook (read-only info + teleport, used by automated QA) ── */
  useEffect(() => {
    ;(window as unknown as { __chadverse: unknown }).__chadverse = {
      phase,
      save: () => saveRef.current,
      world: () => world.current?.debug() ?? null,
      teleport: (x: number, z: number, yaw?: number) => world.current?.teleport(x, z, yaw),
      stats: () => engine.current?.stats,
      integrity: () => world.current?.integrity() ?? null,
      playerInspect: () => (world.current?.player as unknown as { inspect?: () => unknown } | null)?.inspect?.() ?? null,
      gymInspect: () => (gym.current?.player as unknown as { inspect?: () => unknown } | null)?.inspect?.() ?? null,
      gym: () => (gym.current ? { mode: gym.current.mode, prompt: gym.current.interactables.length, pace: +gym.current.pace.toFixed(2) } : null),
      gymGoto: (id: string) => gym.current?.goto(id),
      gymTeleport: (x: number, z: number, yaw?: number) => gym.current?.teleport(x, z, yaw),
      gymInfo: () => gym.current?.info() ?? null,
      anim: () => world.current?.animState() ?? gym.current?.animState() ?? null,
      seat: () => world.current?.seatState() ?? null,
      rush: () => (world.current?.rush ? { phase: world.current.rush.phase, timeLeft: +world.current.rush.timeLeft.toFixed(2), combo: world.current.rush.combo, ...world.current.rush.stats, targets: world.current.rush.targetsInfo() } : null),
      rushGame: () => world.current?.rush ?? null,
      character: () => (world.current?.player ?? null)?.kind ?? null,
      showroom: () => showroom.current,
    }
  }, [phase])

  const s = save.settings
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion={s.reducedEffects ? 'always' : 'user'}>
        <div className="fixed inset-0 overflow-hidden bg-ink">
          <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" aria-label="The Chadverse 3D view" />

          <div className="absolute inset-0" style={{ zoom: s.uiScale } as React.CSSProperties}>
            {phase === 'creator' && showroom.current && (
              <Creator showroom={showroom.current} initial={save.character?.appearance ?? null} initialName={save.character?.name ?? ''} editing={editing} onConfirm={confirmCharacter} />
            )}

            {phase === 'world' && (
              <>
                {touch && !overlay && !dialogue && input.current && <Joystick input={input.current} sensitivity={s.stickSensitivity} />}
                <Hud
                  save={save}
                  prompt={dialogue || overlay || rush ? null : prompt}
                  touch={touch}
                  onPause={() => setOverlay('pause')}
                  onProfile={() => setOverlay('profile')}
                  onToggleSound={() => changeSettings({ muted: !s.muted })}
                  onAction={() => input.current?.queueAction()}
                  onEmote={(id) => world.current?.emote(id)}
                  onJump={() => input.current?.queueJump()}
                  emotesDisabled={!!overlay || !!dialogue}
                  sprint={sprint}
                  onSprint={toggleSprint}
                />
                {rush && world.current?.rush && (
                  <RushPanel
                    rush={world.current.rush}
                    best={save.progress.records.pumpkin_rush ?? 0}
                    onPhase={setRush}
                    onFinish={finishRush}
                    onClose={() => {
                      setRush(null)
                      world.current?.cooldown()
                    }}
                  />
                )}
                <AnimatePresence>{dialogue && <DialoguePanel key={dialogue.speaker + dialogue.lines[0]} d={dialogue} onDone={closeDialogue} reduced={s.reducedEffects} />}</AnimatePresence>
              </>
            )}

            {phase === 'gym' && gym.current && gymMode === 'free' && (
              <>
                {touch && !overlay && input.current && <Joystick input={input.current} sensitivity={s.stickSensitivity} />}
                <Hud
                  save={save}
                  prompt={overlay ? null : prompt}
                  touch={touch}
                  onPause={() => setOverlay('pause')}
                  onProfile={() => setOverlay('profile')}
                  onToggleSound={() => changeSettings({ muted: !s.muted })}
                  onAction={() => input.current?.queueAction()}
                  onEmote={(id) => gym.current?.emote(id)}
                  onJump={() => input.current?.queueJump()}
                  emotesDisabled={!!overlay}
                  sprint={sprint}
                  onSprint={toggleSprint}
                />
              </>
            )}
            {phase === 'gym' && gym.current && gymMode === 'press' && <ChadPress gym={gym.current} best={save.progress.gymBest} onFinish={finishRun} onExit={leaveStation} />}
            {phase === 'gym' && gym.current && gymMode !== 'free' && gymMode !== 'press' && (
              <WorkoutPanel
                key={gymMode}
                gym={gym.current}
                spec={STATIONS[gymMode]}
                lifetimeReps={save.progress.reps[gymMode] ?? 0}
                onSetDone={(set) => finishSet(gymMode, set)}
                onStop={leaveStation}
              />
            )}

            <Toasts toasts={toasts} />
            <AnimatePresence>{levelUp !== null && (phase === 'world' || phase === 'gym') && <LevelUpBanner key={levelUp} level={levelUp} />}</AnimatePresence>

            <AnimatePresence>
              {overlay === 'pause' && (
                <PauseMenu
                  key="pause"
                  save={save}
                  onResume={() => setOverlay(null)}
                  onSettings={() => {
                    setSettingsFrom('pause')
                    setOverlay('settings')
                  }}
                  onAchievements={() => setOverlay('achievements')}
                  onProfile={() => setOverlay('profile')}
                  onEditCharacter={() => {
                    setEditing(true)
                    void go('creator', { label: 'Opening the wardrobe' })
                  }}
                />
              )}
              {overlay === 'settings' && <SettingsMenu key="settings" settings={s} onChange={changeSettings} onBack={() => setOverlay(settingsFrom)} onResetProgress={resetProgress} />}
              {overlay === 'achievements' && <AchievementsMenu key="ach" save={save} onBack={() => setOverlay('pause')} />}
              {overlay === 'profile' && <ProfileMenu key="profile" save={save} onBack={() => setOverlay(null)} />}
              {overlay === 'welltoss' && (
                <WellToss
                  key="welltoss"
                  onHit={() => unlock('bucket_shot')}
                  onBack={() => {
                    setOverlay(null)
                    world.current?.cooldown()
                  }}
                />
              )}
              {overlay === 'board' && (
                <NoticeBoardMenu
                  key="board"
                  save={save}
                  onBack={() => {
                    setOverlay(null)
                    world.current?.cooldown()
                  }}
                />
              )}
            </AnimatePresence>

            <AnimatePresence>
              {phase === 'title' && (
                <Title
                  key="title"
                  save={save}
                  onEnter={enterFromTitle}
                  onWardrobe={() => {
                    audio.unlock()
                    setEditing(true)
                    setPhase('creator')
                  }}
                />
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>{phase === 'boot' && <Loading key="loading" pct={boot.pct} label={boot.label} />}</AnimatePresence>
          <Portal show={!!portal} label={portal ?? ''} />

          {phase === 'error' && (
            <div className="absolute inset-0 z-[70] flex items-center justify-center bg-ink p-6">
              <div className="panel max-w-md rounded-[24px] p-6 text-center">
                <p className="font-display text-3xl uppercase">The Chadverse can’t start</p>
                <p className="mt-3 text-[15px] text-bone/70">{error}</p>
                <a href={import.meta.env.BASE_URL} className="btn-primary mt-5 inline-flex min-h-12 items-center rounded-full px-6 font-semibold uppercase tracking-wider">
                  Back to the website
                </a>
              </div>
            </div>
          )}
        </div>
      </MotionConfig>
    </LazyMotion>
  )
}
