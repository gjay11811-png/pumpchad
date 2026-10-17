/**
 * Synthesised audio — every sound is generated with the Web Audio API at runtime,
 * so there are no audio files and nothing copyrighted. The context is only created
 * after a user gesture (required by iOS/Chrome autoplay rules).
 */
export type Sfx = 'click' | 'select' | 'confirm' | 'step' | 'interact' | 'rep' | 'perfect' | 'miss' | 'achievement' | 'portal' | 'boing' | 'clank' | 'thud' | 'thunder' | 'wail' | 'banish' | 'fanfare'
export type Ambience = 'menu' | 'square' | 'gym' | null

class AudioEngine {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private sfxGain!: GainNode
  private ambGain!: GainNode
  private noise!: AudioBuffer
  private amb: { stop: () => void } | null = null
  private ambName: Ambience = null
  private settings = { sfx: 0.7, ambience: 0.4, muted: true }
  private lastStep = 0

  get ready() {
    return !!this.ctx && this.ctx.state === 'running'
  }

  /** Call from a click/tap handler. Safe to call repeatedly. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.sfxGain = this.ctx.createGain()
      this.ambGain = this.ctx.createGain()
      this.sfxGain.connect(this.master)
      this.ambGain.connect(this.master)
      this.master.connect(this.ctx.destination)
      const len = this.ctx.sampleRate
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const d = this.noise.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
      this.apply()
      document.addEventListener('visibilitychange', this.onVis)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    if (this.ambName && !this.amb) this.startAmbience(this.ambName)
  }

  private onVis = () => {
    if (!this.ctx) return
    if (document.hidden) void this.ctx.suspend()
    else if (!this.settings.muted) void this.ctx.resume()
  }

  configure(s: { sfx: number; ambience: number; muted: boolean }) {
    this.settings = s
    this.apply()
  }

  private apply() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.master.gain.setTargetAtTime(this.settings.muted ? 0 : 1, t, 0.05)
    this.sfxGain.gain.setTargetAtTime(this.settings.sfx * 0.9, t, 0.05)
    this.ambGain.gain.setTargetAtTime(this.settings.ambience * 0.5, t, 0.2)
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, when = 0, slideTo?: number) {
    const ctx = this.ctx!
    const t = ctx.currentTime + when
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(this.sfxGain)
    o.start(t)
    o.stop(t + dur + 0.02)
  }

  private burst(dur: number, freq: number, vol: number, q = 1, type: BiquadFilterType = 'bandpass', when = 0) {
    const ctx = this.ctx!
    const t = ctx.currentTime + when
    const s = ctx.createBufferSource()
    s.buffer = this.noise
    s.playbackRate.value = 0.8 + Math.random() * 0.4
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    s.connect(f).connect(g).connect(this.sfxGain)
    s.start(t, Math.random() * 0.5)
    s.stop(t + dur + 0.02)
  }

  play(name: Sfx) {
    if (!this.ready || this.settings.muted) return
    const r = 1 + (Math.random() - 0.5) * 0.08 // slight variation so repeats don't grate
    switch (name) {
      case 'click':
        this.tone(660 * r, 0.06, 'triangle', 0.12)
        break
      case 'select':
        this.tone(520 * r, 0.08, 'triangle', 0.14)
        this.tone(780 * r, 0.1, 'triangle', 0.1, 0.04)
        break
      case 'confirm':
        ;[392, 523, 659].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.14, i * 0.06))
        break
      case 'step': {
        const now = performance.now()
        if (now - this.lastStep < 180) return
        this.lastStep = now
        this.burst(0.09, 350 + Math.random() * 250, 0.22, 1.2, 'lowpass')
        break
      }
      case 'interact':
        this.tone(440 * r, 0.12, 'sine', 0.16, 0, 660)
        break
      case 'rep':
        this.tone(180 * r, 0.18, 'square', 0.08, 0, 260)
        this.burst(0.12, 900, 0.12)
        break
      case 'perfect':
        this.tone(880, 0.14, 'triangle', 0.14)
        this.tone(1320, 0.22, 'triangle', 0.12, 0.06)
        break
      case 'miss':
        this.tone(220, 0.25, 'sawtooth', 0.07, 0, 110)
        break
      case 'achievement':
        ;[523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.13, i * 0.08))
        this.tone(1568, 0.6, 'sine', 0.06, 0.32)
        break
      case 'portal':
        this.tone(110, 1.1, 'sawtooth', 0.06, 0, 880)
        this.burst(1.0, 1200, 0.12, 0.6, 'highpass')
        break
      case 'boing':
        this.tone(160 * r, 0.35, 'sine', 0.22, 0, 520)
        this.tone(320 * r, 0.25, 'triangle', 0.08, 0.12, 140)
        break
      case 'clank': // iron plates settling on a rack
        this.tone(1250 * r, 0.22, 'square', 0.035)
        this.tone(1870 * r, 0.16, 'triangle', 0.05, 0.01)
        this.burst(0.08, 3200, 0.14, 2.5)
        this.burst(0.18, 420, 0.12, 0.8, 'lowpass', 0.02)
        break
      case 'thunder': // a crack, then a long low roll
        this.burst(0.12, 3200, 0.22, 1.4)
        this.burst(1.6, 150, 0.4, 0.5, 'lowpass', 0.05)
        this.tone(48, 1.5, 'sine', 0.18, 0.05, 30)
        break
      case 'wail': // a ghost slipping into the fountain's light
        this.tone(330, 0.7, 'sine', 0.1, 0, 140)
        this.tone(262, 0.7, 'triangle', 0.05, 0.05, 110)
        break
      case 'banish': // a bright pop
        this.tone(980 * r, 0.12, 'triangle', 0.14, 0, 1500)
        this.burst(0.1, 5200, 0.1, 2)
        break
      case 'fanfare':
        ;[392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.13, i * 0.1))
        break
      case 'thud': // glove into a heavy bag
        this.tone(95 * r, 0.16, 'sine', 0.32, 0, 55)
        this.burst(0.11, 600, 0.3, 0.9, 'lowpass')
        this.burst(0.05, 2400, 0.08, 1.5)
        break
    }
  }

  /** fountain splash level 0..1 (Chad Square only); follows the ambience volume + mute */
  private water: GainNode | null = null
  setWater(level: number) {
    if (!this.water || !this.ctx) return
    this.water.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * 0.22, this.ctx.currentTime, 0.25)
  }

  setAmbience(name: Ambience) {
    if (name === this.ambName && this.amb) return
    this.ambName = name
    this.amb?.stop()
    this.amb = null
    if (name && this.ctx) this.startAmbience(name)
  }

  private startAmbience(name: Exclude<Ambience, null>) {
    const ctx = this.ctx!
    const out = ctx.createGain()
    out.gain.setValueAtTime(0, ctx.currentTime)
    out.gain.linearRampToValueAtTime(1, ctx.currentTime + 2)
    out.connect(this.ambGain)
    const nodes: AudioScheduledSourceNode[] = []
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = name === 'gym' ? 420 : 300
    lp.connect(out)

    // drone: detuned oscillators, key differs per area
    const root = name === 'square' ? 55 : name === 'gym' ? 49 : 41.2
    ;[1, 1.5, 2.005].forEach((m, i) => {
      const o = ctx.createOscillator()
      o.type = i === 0 ? 'sawtooth' : 'triangle'
      o.frequency.value = root * m
      const g = ctx.createGain()
      g.gain.value = i === 0 ? 0.05 : 0.035
      o.connect(g).connect(lp)
      o.start()
      nodes.push(o)
    })
    // slow filter breathing
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lfoG = ctx.createGain()
    lfoG.gain.value = 140
    lfo.connect(lfoG).connect(lp.frequency)
    lfo.start()
    nodes.push(lfo)
    // wind for outdoors, room hum for the gym
    const n = ctx.createBufferSource()
    n.buffer = this.noise
    n.loop = true
    const nf = ctx.createBiquadFilter()
    nf.type = 'bandpass'
    nf.frequency.value = name === 'gym' ? 120 : 500
    nf.Q.value = 0.7
    const ng = ctx.createGain()
    ng.gain.value = name === 'gym' ? 0.03 : 0.05
    n.connect(nf).connect(ng).connect(out)
    n.start()
    nodes.push(n)
    // Chad Square: splashing water from the Pump Fountain (bright, flickering noise; level set by distance)
    if (name === 'square') {
      const w = ctx.createBufferSource()
      w.buffer = this.noise
      w.loop = true
      w.playbackRate.value = 0.83
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 900
      const bp = ctx.createBiquadFilter()
      bp.type = 'peaking'
      bp.frequency.value = 2600
      bp.gain.value = 6
      const flick = ctx.createGain()
      flick.gain.value = 0.8
      const lfo2 = ctx.createOscillator()
      lfo2.frequency.value = 5.3
      const lfo2g = ctx.createGain()
      lfo2g.gain.value = 0.2
      lfo2.connect(lfo2g).connect(flick.gain)
      lfo2.start()
      const wg = ctx.createGain()
      wg.gain.value = 0
      w.connect(hp).connect(bp).connect(flick).connect(wg).connect(out)
      w.start()
      nodes.push(w, lfo2)
      this.water = wg
    } else this.water = null

    // Chad City by day: the odd bird — short chirp phrases, panned, quiet (follows the ambience volume + mute)
    let birdTimer = 0
    if (name === 'square') {
      const bird = () => {
        if (this.ambName !== 'square' || !this.ctx) return
        const t0 = ctx.currentTime
        const pan = ctx.createStereoPanner()
        pan.pan.value = Math.random() * 1.6 - 0.8
        pan.connect(out)
        const notes = 2 + Math.floor(Math.random() * 3)
        const base = 2300 + Math.random() * 1500
        for (let k = 0; k < notes; k++) {
          const t = t0 + k * (0.09 + Math.random() * 0.05)
          const o = ctx.createOscillator()
          o.type = 'sine'
          o.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.25), t)
          o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.3), t + 0.07)
          const g = ctx.createGain()
          g.gain.setValueAtTime(0.0001, t)
          g.gain.exponentialRampToValueAtTime(0.018, t + 0.012)
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08)
          o.connect(g).connect(pan)
          o.start(t)
          o.stop(t + 0.1)
        }
        birdTimer = window.setTimeout(bird, 3000 + Math.random() * 7000)
      }
      birdTimer = window.setTimeout(bird, 1800)
    }

    // Chad Gym: muffled speaker music through the wall + the odd distant plate / dumbbell clank
    let clankTimer = 0
    if (name === 'gym') {
      const sr = ctx.sampleRate
      const bars = 2
      const beat = 60 / 96
      const len = Math.floor(sr * beat * 4 * bars)
      const buf = ctx.createBuffer(1, len, sr)
      const d = buf.getChannelData(0)
      const bass = [41.2, 41.2, 49, 36.7]
      for (let b = 0; b < 4 * bars; b++) {
        const t0 = Math.floor(b * beat * sr)
        // four-on-the-floor kick: pitch-dropping sine thump
        for (let i = 0; i < sr * 0.32 && t0 + i < len; i++) {
          const t = i / sr
          d[t0 + i] += Math.sin(2 * Math.PI * (48 + 90 * Math.exp(-t * 28)) * t) * Math.exp(-t * 9) * 0.55
        }
        // off-beat bass stab
        const t1 = t0 + Math.floor(beat * 0.5 * sr)
        const f = bass[Math.floor(b / 2) % 4]
        for (let i = 0; i < sr * beat * 0.45 && t1 + i < len; i++) {
          const t = i / sr
          d[t1 + i] += Math.sin(2 * Math.PI * f * t) * Math.min(1, t * 60) * Math.exp(-t * 5) * 0.3
        }
      }
      const mus = ctx.createBufferSource()
      mus.buffer = buf
      mus.loop = true
      const mlp = ctx.createBiquadFilter()
      mlp.type = 'lowpass'
      mlp.frequency.value = 170 // heard through a wall
      const mg = ctx.createGain()
      mg.gain.value = 0.16
      mus.connect(mlp).connect(mg).connect(out)
      mus.start()
      nodes.push(mus)
      const clank = () => {
        if (this.ambName !== 'gym' || !this.ctx) return
        const t = ctx.currentTime
        const g = ctx.createGain()
        const far = 0.025 + Math.random() * 0.03
        g.gain.setValueAtTime(far, t)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7)
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 900 + Math.random() * 900
        bp.Q.value = 3
        g.connect(bp).connect(out)
        for (const [fq, k] of [[380 + Math.random() * 120, 1], [1120 + Math.random() * 300, 0.5]]) {
          const o = ctx.createOscillator()
          o.type = 'triangle'
          o.frequency.value = fq
          const og = ctx.createGain()
          og.gain.value = k
          o.connect(og).connect(g)
          o.start(t)
          o.stop(t + 0.75)
        }
        // a second, softer hit sometimes (a plate settling, a dumbbell re-racked)
        if (Math.random() < 0.4) {
          const g2 = ctx.createGain()
          g2.gain.setValueAtTime(far * 0.5, t + 0.16)
          g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
          const o2 = ctx.createOscillator()
          o2.type = 'triangle'
          o2.frequency.value = 520 + Math.random() * 200
          o2.connect(g2).connect(bp)
          o2.start(t + 0.16)
          o2.stop(t + 0.62)
        }
        clankTimer = window.setTimeout(clank, 3500 + Math.random() * 7000)
      }
      clankTimer = window.setTimeout(clank, 2500)
    }

    this.amb = {
      stop: () => {
        clearTimeout(clankTimer)
        clearTimeout(birdTimer)
        const t = ctx.currentTime
        out.gain.cancelScheduledValues(t)
        out.gain.setValueAtTime(out.gain.value, t)
        out.gain.linearRampToValueAtTime(0, t + 0.8)
        nodes.forEach((x) => x.stop(t + 0.85))
        setTimeout(() => out.disconnect(), 1000)
      },
    }
  }

  /* ── riding: a procedural motor note per bike, driven by speed and load (no recorded audio is used) ── */
  private ride: { kind: 'surron' | 'street'; osc: OscillatorNode[]; gains: GainNode[]; noise: AudioBufferSourceNode; nGain: GainNode; lp: BiquadFilterNode; out: GainNode; scrape: { src: AudioBufferSourceNode; gain: GainNode; hp: BiquadFilterNode } } | null = null
  rideStart(kind: 'surron' | 'street') {
    if (!this.ctx) return
    this.rideStop()
    const ctx = this.ctx
    const out = ctx.createGain()
    out.gain.value = 0
    out.connect(this.sfxGain)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = kind === 'surron' ? 3200 : 600
    lp.connect(out)
    const mk = (type: OscillatorType, g: number) => {
      const o = ctx.createOscillator()
      o.type = type
      const gn = ctx.createGain()
      gn.gain.value = g
      o.connect(gn).connect(lp)
      o.start()
      return { o, gn }
    }
    const parts = kind === 'surron' ? [mk('sine', 0.5), mk('triangle', 0.25)] : [mk('sawtooth', 0.4), mk('square', 0.22), mk('triangle', 0.3)]
    const noise = ctx.createBufferSource()
    noise.buffer = this.noise
    noise.loop = true
    const nf = ctx.createBiquadFilter()
    nf.type = kind === 'surron' ? 'bandpass' : 'lowpass'
    nf.frequency.value = kind === 'surron' ? 900 : 500
    const nGain = ctx.createGain()
    nGain.gain.value = 0
    noise.connect(nf).connect(nGain).connect(out)
    noise.start()
    out.gain.setTargetAtTime(0.5, ctx.currentTime, 0.15)
    // a separate rasp for a part dragging on the road (silent unless something actually touches): high-passed noise whose level follows the contact
    const sSrc = ctx.createBufferSource()
    sSrc.buffer = this.noise
    sSrc.loop = true
    const sHp = ctx.createBiquadFilter()
    sHp.type = 'highpass'
    sHp.frequency.value = 1800
    const sGain = ctx.createGain()
    sGain.gain.value = 0
    sSrc.connect(sHp).connect(sGain).connect(this.sfxGain)
    sSrc.start()
    this.ride = { kind, osc: parts.map((p) => p.o), gains: parts.map((p) => p.gn), noise, nGain, lp, out, scrape: { src: sSrc, gain: sGain, hp: sHp } }
  }
  /** called every frame while riding: speed 0..1 and the engine's load shape the note, smoothly */
  rideTick(s: { kind: 'surron' | 'street'; v: number; vmax: number; thr: number; brake: number; rpm: number; gear: number; wheelie: number; touchdown: number; crashed: boolean; scrape?: number; part?: string | null; spin?: number }) {
    const r = this.ride
    const ctx = this.ctx
    if (!r || !ctx) return
    const t = ctx.currentTime
    const sf = Math.min(1, s.v / s.vmax)
    const k = 0.06
    if (s.kind === 'surron') {
      // an electric motor: a rising whine with speed, louder on load; the tyres and chain add a soft whirr
      const f = 150 + 1050 * Math.pow(sf, 0.85) + 160 * s.thr + 120 * Math.min(1, s.wheelie * 2)
      r.osc[0].frequency.setTargetAtTime(f, t, k)
      r.osc[1].frequency.setTargetAtTime(f * 2.005, t, k)
      r.out.gain.setTargetAtTime(s.crashed ? 0 : 0.16 + 0.34 * s.thr + 0.14 * sf, t, 0.08)
      r.nGain.gain.setTargetAtTime(0.01 + 0.12 * sf * sf, t, 0.1)
    } else {
      // a four-stroke: a low note that climbs through each gear (drops at the change), a rasp that opens with the throttle
      const f = 36 + 92 * s.rpm + 5 * s.gear
      r.osc[0].frequency.setTargetAtTime(f, t, k * 0.8)
      r.osc[1].frequency.setTargetAtTime(f * 0.5, t, k)
      r.osc[2].frequency.setTargetAtTime(f * 2, t, k)
      r.lp.frequency.setTargetAtTime(380 + 2600 * s.thr + 600 * s.rpm, t, 0.08)
      r.out.gain.setTargetAtTime(s.crashed ? 0 : 0.2 + 0.34 * s.thr + 0.1 * s.rpm, t, 0.08)
      r.nGain.gain.setTargetAtTime(0.01 + 0.1 * s.thr, t, 0.08)
    }
    // contact sounds: a peg / tail / plate scraping the road, and a rear tyre spinning up
    const sc = s.scrape ?? 0
    r.scrape.hp.frequency.setTargetAtTime(s.part === 'peg' ? 2600 : s.part === 'tail' ? 1200 : 900, t, 0.05)
    r.scrape.gain.gain.setTargetAtTime(sc > 0 ? 0.05 + 0.13 * sc * (0.5 + 0.5 * sf) : 0, t, sc > 0 ? 0.03 : 0.08)
    if ((s.spin ?? 0) > 0.15) r.nGain.gain.setTargetAtTime(0.05 + 0.2 * (s.spin ?? 0), t, 0.05)
    if (s.touchdown > 0.6 && this.ready) this.play('thud')
  }
  rideStop() {
    const r = this.ride
    if (!r || !this.ctx) return
    const t = this.ctx.currentTime
    r.out.gain.setTargetAtTime(0, t, 0.08)
    setTimeout(() => {
      r.osc.forEach((o) => o.stop())
      r.noise.stop()
      r.scrape.src.stop()
      r.scrape.gain.disconnect()
      r.out.disconnect()
    }, 400)
    this.ride = null
  }

  dispose() {
    this.amb?.stop()
    document.removeEventListener('visibilitychange', this.onVis)
    void this.ctx?.close()
    this.ctx = null
  }
}

export const audio = new AudioEngine()
