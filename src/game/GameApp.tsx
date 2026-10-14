import { AnimatePresence, LazyMotion, MotionConfig, domAnimation } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { audio } from './audio'
import { runAchievements, xpFor, type RunState } from './chadpress'
import { preloadModel } from './character/character'
import type { Appearance } from './character/types'
import { DIALOGUE, PUMPKIN_LINES, QUEST2_GRIM, QUEST2_GRIM_REMIND, QUEST2_OAK, QUEST2_OAK_IDLE, QUEST2_STONE, QUEST2_STONE_IDLE, QUEST_COLD_LANTERN, QUEST_GOLDIE, QUEST_GOLDIE_REMIND, QUEST_SIGIL, type Dialogue, type DialogueOption } from './dialogue'
import { LANTERNS } from './scenes/world/lanterns'
import { Engine } from './engine/Engine'
import { Input } from './input'
import { ACHIEVEMENTS, defaultSave, levelFor, loadSave, writeSave, type SaveData, type Settings } from './save'
import { STAT_FOR, levelsGained, rollDaily, setRewards } from './progression'
import { Gym, type GymMode } from './scenes/Gym'
import { Interior } from './scenes/Interior'
import { HOUSE, HOUSES, doorSpot } from './scenes/interiors/houses'
import type { SpawnAt } from './scenes/World'
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
import { IntroOverlay, PhotoMode } from './ui/PhotoMode'
import { ChallengePanel } from './ui/Challenges'
import { ShopPanel } from './ui/Shop'
import { MapJournal } from './ui/MapJournal'
import { FishingPanel, type FishingResult } from './ui/FishingPanel'
import { fishingXp, type Catch } from './minigames/fishing'
import { ITEM, coinsForXp } from './economy'

type Phase = 'boot' | 'title' | 'creator' | 'world' | 'gym' | 'interior' | 'error'
type Overlay = null | 'pause' | 'settings' | 'achievements' | 'profile' | 'board' | 'welltoss' | 'photo' | 'intro' | 'shop' | 'map' | 'fishing'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const ACH_XP = 25
/** Discover Chad City: the five places (discovery ids) */
export const CITY_STEPS = ['visit_square', 'visit_gym', 'visit_arcade', 'visit_citadel', 'visit_rides']

export function GameApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engine = useRef<Engine | null>(null)
  const input = useRef<Input | null>(null)
  const showroom = useRef<Showroom | null>(null)
  const world = useRef<World | null>(null)
  const gym = useRef<Gym | null>(null)
  const interior = useRef<Interior | null>(null)
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
  /** touch: the challenges sheet + the recent announcements it lists (newest first) */
  const [challenges, setChallenges] = useState(false)
  const [notes, setNotes] = useState<Toast[]>([])
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
    setNotes((n) => [t, ...n].slice(0, 20))
    setTimeout(() => {
      setToasts([])
      setTimeout(pumpToasts, 350)
    }, touch ? 1900 : 2600) // phones: a brief one-line notice (the full list lives in the challenges sheet)
  }

  /** Single write path: updates React state + localStorage together. */
  const setSave = useCallback((fn: (s: SaveData) => SaveData) => {
    const prevXp = saveRef.current.progress.xp
    const next0 = fn(saveRef.current)
    // Chad Coins follow XP: every XP gain pays coins at the same fixed rate (spending never touches XP)
    const gained = coinsForXp(next0.progress.xp) - coinsForXp(prevXp)
    const next = gained > 0 ? { ...next0, progress: { ...next0.progress, coins: next0.progress.coins + gained } } : next0
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
  const notify = (title: string, desc: string, kind: 'collect' | 'discover' = 'collect') => {
    toastQueue.current.push({ id: `n-${Date.now()}`, title, desc, kind })
    if (!toastBusy.current) pumpToasts()
  }

  /* ── world interactions ── */
  const handleInteractRef = useRef<(id: string) => void>(() => {})
  /** Discover Chad City: one step found (zone reached or place inspected) → toast + City Explorer at 5/5 */
  const cityStepRef = useRef<(id: string) => void>(() => {})
  cityStepRef.current = (id: string) => {
    if (saveRef.current.progress.discoveries.includes(id)) return
    discover(id)
    const wilds: Record<string, [string, string]> = {
      visit_forest: ['Enchanted Forest', 'Follow the lanterns to the Elder Oak'],
      visit_lake: ['Moonlight Lake', 'Walk the shore path · the pier reaches the middle'],
      visit_motor: ['Motor Row', 'Chad Pets · Chad Motors'],
      visit_haunted: ['Haunted Quarter', 'Mind the ghosts · the forest lies north'],
    }
    if (wilds[id]) {
      notify(`Discovered: ${wilds[id][0]}`, `${wilds[id][1]} · +25 XP`, 'discover')
      setSave((s) => ({ ...s, progress: { ...s.progress, xp: s.progress.xp + 25 } }))
      return
    }
    const names: Record<string, string> = { visit_square: 'Chad Square', visit_gym: 'Pump Gym', visit_arcade: 'Pump Arcade', visit_citadel: 'Chad Citadel', visit_rides: 'Chad Rides' }
    const n = CITY_STEPS.filter((k) => saveRef.current.progress.discoveries.includes(k) || k === id).length
    notify(`Discovered: ${names[id] ?? id}`, n >= CITY_STEPS.length ? 'Chad City explored. Every district, every landmark.' : `Discover Chad City ${n}/${CITY_STEPS.length}`, 'discover')
    if (n >= CITY_STEPS.length) unlock('city_explorer')
  }
  const handleGymRef = useRef<(id: string) => void>(() => {})
  const introPending = useRef(false)
  const finishIntro = useCallback(() => {
    world.current?.endIntro()
  }, [])

  /* ── scene transitions ── */
  const go = useCallback(async (next: 'creator' | 'world' | 'gym' | 'interior', opts: { spawn?: SpawnAt; label?: string; house?: string } = {}) => {
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
    interior.current = null
    if (next === 'creator') {
      const room = new Showroom(e, canvas)
      showroom.current = room
      e.setScene(room)
      audio.setAmbience('menu')
    } else if (next === 'world' && app) {
      showroom.current = null
      const w = new World(e, input.current!, { onPrompt: setPrompt, onInteract: (id) => handleInteractRef.current(id), onDiscover: (id) => cityStepRef.current(id) }, saveRef.current.settings.quality)
      w.cameraSensitivity = saveRef.current.settings.cameraSensitivity
      // load + compile behind the portal overlay; the previous scene keeps rendering until the swap
      await w.populate(app, opts.spawn ?? 'start', saveRef.current.progress.discoveries)
      w.setPet(petKind())
      await e.precompile(w)
      e.setScene(w)
      if (saveRef.current.progress.discoveries.includes('stash')) w.revealStash()
      world.current = w
      const forceIntro = new URLSearchParams(location.search).get('intro') === '1'
      if ((opts.spawn ?? 'start') === 'start' && !saveRef.current.progress.discoveries.includes('intro_seen') && (forceIntro || !navigator.webdriver)) introPending.current = true
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
    } else if (next === 'interior' && app && opts.house) {
      showroom.current = null
      const r = new Interior(e, opts.house, input.current, { onPrompt: setPrompt, onInteract: (id) => handleInteriorRef.current(id) })
      r.cameraSensitivity = saveRef.current.settings.cameraSensitivity
      await r.populate(app)
      r.setPet(petKind())
      await e.precompile(r)
      e.setScene(r)
      interior.current = r
      audio.setAmbience('menu')
    }
    setPhase(next)
    await sleep(120)
    setPortal(null)
  }, [])

  handleInteractRef.current = (id: string) => {
    const w = world.current
    if (!w) return
    if (id.startsWith('house:')) {
      const h = HOUSE(id.slice(6))
      if (h) void go('interior', { house: h.id, label: `Entering ${h.name}` })
      return
    }
    if (rushRef.current === 'run') return // mid-sprint: nothing else steals the E key
    if (overlay === 'photo' || overlay === 'intro') return // framing a shot / watching the intro: E does nothing
    // the opening adventure: Goldie → three Guardian Lanterns → the Golden Sigil
    const qd = saveRef.current.progress.discoveries
    if (id === 'greeter' && !qd.includes('q1_sigil')) {
      discover('talk_greeter')
      w.faceNpcToPlayer(id)
      w.markTalked(id)
      return void setDialogue(qd.includes('q1_start') ? QUEST_GOLDIE_REMIND : QUEST_GOLDIE)
    }
    if (id.startsWith('lantern:')) {
      if (!qd.includes('q1_start')) return void setDialogue(QUEST_COLD_LANTERN)
      const L = LANTERNS.find((l) => `lantern:${l.id}` === id)
      if (!L || qd.includes(`q1_lantern_${L.id}`)) return
      discover(`q1_lantern_${L.id}`)
      setSave((s) => ({ ...s, progress: { ...s.progress, xp: s.progress.xp + 10 } }))
      audio.play('achievement')
      const n = LANTERNS.filter((l) => saveRef.current.progress.discoveries.includes(`q1_lantern_${l.id}`)).length
      notify(`Guardian Lantern relit · ${n}/3`, n < 3 ? `${L.name} burns again · +10 XP` : 'The Golden Sigil has risen at the Citadel doors', 'discover')
      w.questSync(saveRef.current.progress.discoveries)
      return
    }
    if (id === 'sigil') {
      if (qd.includes('q1_sigil')) return
      discover('q1_sigil')
      // first real reward: 50 XP (which also pays 25 coins) + a 25-coin welcome purse
      setSave((s) => ({ ...s, progress: { ...s.progress, xp: s.progress.xp + 50, coins: s.progress.coins + 25 } }))
      notify('The Golden Sigil', 'Opening adventure complete · +50 XP · +50 Chad Coins', 'discover')
      w.questSync(saveRef.current.progress.discoveries)
      return void setDialogue(QUEST_SIGIL)
    }
    // chapter 2: Grim → the Elder Oak → the moonstone (opens once the sigil is claimed)
    if (id === 'gravedig' && qd.includes('q1_sigil') && !qd.includes('q2_stone')) {
      discover('talk_gravedig')
      w.faceNpcToPlayer(id)
      w.markTalked(id)
      return void setDialogue(qd.includes('q2_start') ? QUEST2_GRIM_REMIND : QUEST2_GRIM)
    }
    if (id === 'oak') {
      if (!qd.includes('q2_start') || qd.includes('q2_oak')) return void setDialogue(QUEST2_OAK_IDLE)
      discover('q2_oak')
      setSave((s) => ({ ...s, progress: { ...s.progress, xp: s.progress.xp + 20 } }))
      notify('The Elder Oak remembers', 'The moonstone lies west of the clearing · +20 XP', 'discover')
      w.questSync(saveRef.current.progress.discoveries)
      return void setDialogue(QUEST2_OAK)
    }
    if (id === 'moonstone') {
      if (!qd.includes('q2_oak') || qd.includes('q2_stone')) return void setDialogue(QUEST2_STONE_IDLE)
      discover('q2_stone')
      setSave((s) => ({ ...s, progress: { ...s.progress, xp: s.progress.xp + 60, coins: s.progress.coins + 30 } }))
      notify('Whispers in the Wood', 'Chapter 2 complete · +60 XP · +60 Chad Coins', 'discover')
      w.questSync(saveRef.current.progress.discoveries)
      return void setDialogue(QUEST2_STONE)
    }
    switch (id) {
      case 'fishing':
        input.current?.clear()
        setOverlay('fishing')
        break
      case 'rush':
        input.current?.clear()
        setRush('ready')
        break
      case 'greeter':
      case 'shakes':
      case 'coach':
      case 'hodl':
      case 'barkeep':
      case 'smith':
      case 'potion':
      case 'captain':
      case 'guide':
      case 'gravedig':
        discover(`talk_${id}`)
        w.faceNpcToPlayer(id)
        w.markTalked(id)
        setDialogue(DIALOGUE[id])
        break
      case 'statue':
        // first read of the plaque is a lore discovery
        if (!saveRef.current.progress.discoveries.includes('lore_fountain')) {
          discover('lore_fountain')
          notify('Lore discovered', 'The Pump Fountain — read the plaque in full.', 'discover')
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
      case 'hp_1':
      case 'hp_2':
      case 'hp_3':
      case 'hp_4':
      case 'hp_5':
      case 'hp_6': {
        w.collectHidden(id)
        discover(id)
        audio.play('perfect')
        const n = saveRef.current.progress.discoveries.filter((x) => x.startsWith('hp_')).length
        notify(`Hidden pumpkin ${n}/6`, n >= 6 ? 'Every hidden pumpkin in Chad City. Absolute gourd-hound.' : 'More are tucked away around the city.')
        if (n >= 6) unlock('pumpkin_hunter')
        break
      }
      case 'rides':
      case 'arcade':
        cityStepRef.current(id === 'rides' ? 'visit_rides' : 'visit_arcade')
        setDialogue(DIALOGUE[id])
        break
      case 'overlook':
        if (!saveRef.current.progress.discoveries.includes('overlook')) {
          discover('overlook')
          notify('Discovered: Chad View', 'The best view in the city. Try photo mode.', 'discover')
        }
        setDialogue(DIALOGUE.overlook)
        break
      case 'citymap':
      case 'lore_citadel':
      case 'champions':
      case 'yard':
      case 'gate':
      case 'citygate':
      case 'lookout':
      case 'wardrobe':
      case 'well':
      case 'window':
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
        void go('gym', { label: 'Entering Pump Gym' })
        break
    }
  }

  /* ── house interiors: the door back out + things to look at (first visit to each home: a small XP reward) ── */
  const handleInteriorRef = useRef<(id: string) => void>(() => {})
  handleInteriorRef.current = (id: string) => {
    const r = interior.current
    if (!r) return
    const h = r.house
    if (id === 'exit') {
      const d = doorSpot(h)
      return void go('world', { spawn: { x: d.exit.x, z: d.exit.z, yaw: d.yaw }, label: 'Back outside' })
    }
    if (id === 'keeper' && h.keeper?.shop) return void setOverlay('shop')
    if (id === 'keeper' && h.keeper) {
      setDialogue({ speaker: h.keeper.line.speaker, role: h.keeper.line.role, lines: h.keeper.line.lines })
      const key = `look_${h.id}_keeper`
      if (!saveRef.current.progress.discoveries.includes(key)) {
        discover(key)
        setSave((s) => ({ ...s, progress: { ...s.progress, xp: s.progress.xp + 10 } }))
      }
      return
    }
    if (id.startsWith('look:')) {
      const L = h.looks?.[id.slice(5)]
      if (!L) return
      setDialogue({ speaker: L.speaker, role: L.role, lines: L.lines })
      const key = `look_${h.id}_${id.slice(5)}`
      if (!saveRef.current.progress.discoveries.includes(key)) {
        discover(key)
        setSave((s) => ({ ...s, progress: { ...s.progress, xp: s.progress.xp + 10 } }))
      }
    }
  }

  const petKind = () => ITEM(saveRef.current.progress.pet ?? '')?.pet ?? null
  /** pause menu: send the companion home, or call the last one back */
  const lastPet = () => saveRef.current.progress.pet ?? [...saveRef.current.progress.owned].reverse().find((i) => ITEM(i)?.kind === 'pet') ?? null

  /** spend Chad Coins on a catalogue item: false (nothing changes) if already owned or not enough coins */
  const buy = (id: string) => {
    const it = ITEM(id)
    const p = saveRef.current.progress
    if (!it || p.owned.includes(id) || p.coins < it.price) return false
    setSave((s) => ({ ...s, progress: { ...s.progress, coins: s.progress.coins - it.price, owned: [...s.progress.owned, id] } }))
    audio.play('achievement')
    return true
  }
  /** put on an owned colour (saved, re-dressed on the spot), or bring an owned pet along / send it home */
  const wear = (id: string) => {
    const it = ITEM(id)
    const c = saveRef.current.character
    if (!it || !c || !saveRef.current.progress.owned.includes(id)) return
    if (it.kind === 'pet') {
      const pet = saveRef.current.progress.pet === id ? null : id
      setSave((s) => ({ ...s, progress: { ...s.progress, pet } }))
      world.current?.setPet(petKind())
      interior.current?.setPet(petKind())
      return
    }
    const appearance = { ...c.appearance, [it.kind]: it.color }
    setSave((s) => ({ ...s, character: { ...c, appearance } }))
    void interior.current?.restyle(appearance)
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
    if (action === 'gym') void go('gym', { label: 'Entering Pump Gym' })
    if (action === 'welltoss') setOverlay('welltoss')
    if (action === 'q2_accept') {
      discover('q2_start')
      world.current?.questSync(saveRef.current.progress.discoveries)
      notify('Whispers in the Wood', 'Find the Elder Oak · through the Haunted Quarter’s north gate', 'discover')
    }
    if (action === 'q1_accept') {
      discover('q1_start')
      world.current?.questSync(saveRef.current.progress.discoveries)
      notify('The Guardian Lanterns', 'Relight all three · follow the gold markers', 'discover')
    }
    if (action === 'wardrobe') {
      setEditing(true)
      void go('creator', { label: 'Opening the wardrobe' })
    }
  }

  /* ── first-visit flyover: starts once the world is on screen; skip or finish → control back, never repeats ── */
  useEffect(() => {
    if (phase !== 'world' || !introPending.current || !world.current) return
    introPending.current = false
    setOverlay('intro')
    world.current.startIntro(() => {
      discover('intro_seen')
      setOverlay((o) => (o === 'intro' ? null : o))
      input.current?.clear()
      world.current?.cooldown()
    })
  }, [phase, discover])

  /* ── pause world while any UI is up ── */
  useEffect(() => {
    // photo mode keeps full control (frame + move); everything else pauses the world
    const blocked = (!!overlay && overlay !== 'photo') || !!dialogue || !!portal || challenges || rush === 'ready' || rush === 'done'
    if (world.current) world.current.paused = blocked
    if (gym.current) gym.current.paused = blocked
    if (interior.current) interior.current.paused = blocked
    if (input.current) {
      input.current.enabled = !blocked
      if (blocked) input.current.clear()
    }
  }, [overlay, dialogue, portal, phase, rush, challenges])
  // any overlay opening — photo mode included, which keeps control — first drops whatever was being held
  useEffect(() => {
    if (overlay || challenges) input.current?.clear()
  }, [overlay, challenges])
  // the challenges sheet never survives a scene change
  useEffect(() => {
    if (portal) setChallenges(false)
  }, [portal])

  /* ── keyboard: Esc opens pause in the world ── */
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && challenges) return setChallenges(false)
      // M: the map + journal (in the open world, when nothing else is up)
      if ((e.key === 'm' || e.key === 'M') && phase === 'world' && !overlay && !dialogue && !portal && !challenges && !rushRef.current) return setOverlay('map')
      if (e.key === 'Escape' && (phase === 'world' || phase === 'interior' || (phase === 'gym' && gymMode === 'free')) && !overlay && !dialogue && !portal && !rushRef.current) setOverlay('pause')
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [phase, overlay, dialogue, portal, gymMode, challenges])

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
    if (interior.current) interior.current.cameraSensitivity = next.cameraSensitivity
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

  /** a finished fishing round: XP (daily fatigue like the other activities), best score, new species in the log */
  const finishFishing = (score: number, catches: Catch[]): FishingResult => {
    const p0 = saveRef.current.progress
    const r = setRewards(fishingXp(score), 0, rollDaily(p0.daily).sets.fishing ?? 0)
    const prev = p0.records.fishing ?? 0
    const fresh = [...new Set(catches.map((c) => c.species.id))].filter((id) => !p0.discoveries.includes(`fish_${id}`))
    setSave((s) => {
      const d = rollDaily(s.progress.daily)
      return {
        ...s,
        progress: {
          ...s.progress,
          xp: s.progress.xp + (score > 0 ? r.xp : 0),
          records: { ...s.progress.records, fishing: Math.max(s.progress.records.fishing ?? 0, score) },
          daily: { day: d.day, sets: { ...d.sets, fishing: (d.sets.fishing ?? 0) + 1 } },
          discoveries: [...s.progress.discoveries, ...fresh.map((id) => `fish_${id}`)],
        },
      }
    })
    for (const id of fresh) {
      const c = catches.find((k) => k.species.id === id)!
      notify(`New catch: ${c.species.name}`, `${c.species.blurb} · added to your fish log`, 'discover')
    }
    return { xp: score > 0 ? r.xp : 0, mult: r.mult, best: Math.max(prev, score), newBest: score > prev }
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
      shotCam: (o: Parameters<World['setShotCam']>[0]) => world.current?.setShotCam(o),
      stats: () => engine.current?.stats,
      integrity: () => world.current?.integrity() ?? null,
      playerInspect: () => (world.current?.player as unknown as { inspect?: () => unknown } | null)?.inspect?.() ?? null,
      gymInspect: () => (gym.current?.player as unknown as { inspect?: () => unknown } | null)?.inspect?.() ?? null,
      gym: () => (gym.current ? { mode: gym.current.mode, prompt: gym.current.interactables.length, pace: +gym.current.pace.toFixed(2) } : null),
      gymGoto: (id: string) => gym.current?.goto(id),
      gymTeleport: (x: number, z: number, yaw?: number) => gym.current?.teleport(x, z, yaw),
      gymInfo: () => gym.current?.info() ?? null,
      interior: () => interior.current?.info() ?? null,
      pet: () => {
        const pt = (world.current ?? interior.current)?.pet
        return pt ? { kind: pt.kind, x: +pt.root.position.x.toFixed(2), y: +pt.root.position.y.toFixed(2), z: +pt.root.position.z.toFixed(2) } : null
      },
      houses: () => HOUSES.map((h) => ({ id: h.id, name: h.name, door: doorSpot(h), room: h.room, looks: Object.fromEntries(Object.entries(h.looks ?? {}).map(([k, v]) => [k, { at: v.at, level: v.level ?? 0 }])) })),
      interiorTeleport: (x: number, z: number, yaw?: number, level?: 0 | 1) => interior.current?.teleport(x, z, yaw, level),
      gymPhoto: (o: Parameters<Gym['setPhoto']>[0]) => gym.current?.setPhoto(o),
      anim: () => world.current?.animState() ?? gym.current?.animState() ?? null,
      input: () => (input.current ? { stick: input.current.stick, owner: input.current.stickOwner, enabled: input.current.enabled, sprint: input.current.sprint, move: input.current.move() } : null),
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
              <Creator showroom={showroom.current} initial={save.character?.appearance ?? null} initialName={save.character?.name ?? ''} editing={editing} owned={save.progress.owned} onConfirm={confirmCharacter} />
            )}

            {phase === 'world' && (
              <>
                {touch && (!overlay || overlay === 'photo') && !dialogue && input.current && <Joystick input={input.current} sensitivity={s.stickSensitivity} />}
                {overlay === 'photo' && (
                  <PhotoMode
                    touch={touch}
                    capture={() => engine.current?.capture() ?? null}
                    onExit={() => {
                      setOverlay(null)
                      world.current?.cooldown()
                    }}
                  />
                )}
                {overlay === 'intro' && <IntroOverlay onSkip={finishIntro} />}
                {overlay !== 'photo' && overlay !== 'intro' && <Hud
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
                  onChallenges={() => setChallenges(true)}
                  onPhoto={() => setOverlay('photo')}
                  onMap={() => setOverlay('map')}
                />}
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

            {phase === 'interior' && interior.current && (
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
                  onEmote={(id) => interior.current?.emote(id)}
                  onJump={() => input.current?.queueJump()}
                  emotesDisabled={!!overlay}
                  sprint={sprint}
                  onSprint={toggleSprint}
                  onChallenges={() => setChallenges(true)}
                />
                <AnimatePresence>{dialogue && <DialoguePanel key={dialogue.speaker + dialogue.lines[0]} d={dialogue} onDone={closeDialogue} reduced={s.reducedEffects} />}</AnimatePresence>
                <AnimatePresence>
                  {overlay === 'shop' && interior.current.house.keeper?.shop && (
                    <ShopPanel
                      key="shop"
                      shop={interior.current.house.keeper.shop}
                      title={interior.current.house.name}
                      keeper={interior.current.house.keeper.line.speaker}
                      save={save}
                      onBuy={buy}
                      onWear={wear}
                      onBack={() => setOverlay(null)}
                    />
                  )}
                </AnimatePresence>
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
                  onChallenges={() => setChallenges(true)}
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

            <Toasts toasts={toasts} compact={touch} />
            {(phase === 'world' || phase === 'gym' || phase === 'interior') && <ChallengePanel open={challenges} save={save} notes={notes} onClose={() => setChallenges(false)} />}
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
                  companion={lastPet() && phase !== 'gym' ? { name: ITEM(lastPet()!)!.name, along: !!save.progress.pet } : null}
                  onMap={phase === 'world' ? () => setOverlay('map') : undefined}
                  onCompanion={() => wear(lastPet()!)}
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
              {overlay === 'map' && phase === 'world' && (
                <MapJournal
                  key="map"
                  save={save}
                  player={(() => {
                    const w = world.current?.debug()
                    return w ? { x: w.x, z: w.z, yaw: w.yaw } : null
                  })()}
                  onTravel={(l) => {
                    if (!l.spawn) return
                    setOverlay(null)
                    world.current?.teleport(l.spawn.x, l.spawn.z, l.spawn.yaw)
                    world.current?.cooldown()
                    notify(`Travelled to ${l.name}`, 'Fast travel · places you’ve reached on foot', 'discover')
                  }}
                  onBack={() => {
                    setOverlay(null)
                    world.current?.cooldown()
                  }}
                />
              )}
              {overlay === 'fishing' && phase === 'world' && (
                <FishingPanel
                  key="fishing"
                  best={save.progress.records.fishing ?? 0}
                  onFinish={finishFishing}
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
