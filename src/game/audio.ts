/**
 * Synthesised audio — every sound is generated with the Web Audio API at runtime,
 * so there are no audio files and nothing copyrighted. The context is only created
 * after a user gesture (required by iOS/Chrome autoplay rules).
 */
export type Sfx = 'click' | 'select' | 'confirm' | 'step' | 'interact' | 'rep' | 'perfect' | 'miss' | 'achievement' | 'portal' | 'boing' | 'clank' | 'thud'
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

    this.amb = {
      stop: () => {
        const t = ctx.currentTime
        out.gain.cancelScheduledValues(t)
        out.gain.setValueAtTime(out.gain.value, t)
        out.gain.linearRampToValueAtTime(0, t + 0.8)
        nodes.forEach((x) => x.stop(t + 0.85))
        setTimeout(() => out.disconnect(), 1000)
      },
    }
  }

  dispose() {
    this.amb?.stop()
    document.removeEventListener('visibilitychange', this.onVis)
    void this.ctx?.close()
    this.ctx = null
  }
}

export const audio = new AudioEngine()
