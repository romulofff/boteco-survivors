// Áudio 100% sintetizado via WebAudio (osciladores + envelopes). Sem assets.
// ensureStarted() deve ser chamado no 1º gesto do usuário (autoplay policy).
// Música procedural estilo forró/xote 8-bit: baixo triangle (baião I-IV-V),
// zabumba/caxixi via noise buffer, melodia pentatônica aleatorizada por compasso.
// Agendamento via clock do AudioContext (lookahead 100ms, tick de 25ms).

import type { SoundId } from '../types'

const MASTER_VOL = 0.25
const THROTTLE_SHOOT = 0.06
const THROTTLE_HIT = 0.05
const THROTTLE_PICKUP = 0.04

// ---- música ----
const MUSIC_VOL = 0.1 // volume efetivo da música (bem abaixo dos SFX)
const LOOKAHEAD = 0.1 // s à frente do clock que agendamos
const TICK_MS = 25
const BPM = 108
const STEP = 60 / BPM / 4 // semicolcheia (~0.139s)
const BAR = 8 // compasso 2/4 de xote = 8 semicolcheias
// progressão I-IV-I-V em Lá maior (raízes do baixo e respectivas quintas)
const ROOTS = [110, 146.83, 110, 164.81]
const FIFTHS = [164.81, 220, 164.81, 246.94]
// pentatônica maior de Lá pra melodia
const MEL = [440, 493.88, 554.37, 659.25, 739.99, 880]

export class AudioSys {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicGain: GainNode | null = null // bus da música → master (mute pega tudo)
  private noiseBuf: AudioBuffer | null = null
  private muted = false
  private lastShoot = -1
  private lastHit = -1
  private lastPickup = -1
  // estado do sequenciador
  private musicTimer: ReturnType<typeof setInterval> | null = null
  private nextNoteTime = 0
  private step = 0
  private intensity = 0
  private melPattern = [-1, -1, -1, -1, -1, -1, -1, -1]
  private melIdx = 2

  ensureStarted(): void {
    if (!this.ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : MASTER_VOL
      this.master.connect(this.ctx.destination)
      // bus da música dentro do master → efetivo MUSIC_VOL pós-master
      this.musicGain = this.ctx.createGain()
      this.musicGain.gain.value = MUSIC_VOL / MASTER_VOL
      this.musicGain.connect(this.master)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  /** silencia TUDO (SFX + música); a música continua agendando e retoma no unmute */
  toggleMute(): boolean {
    this.muted = !this.muted
    if (this.master) this.master.gain.value = this.muted ? 0 : MASTER_VOL
    return this.muted
  }

  // ---- música procedural ----

  startMusic(): void {
    const ctx = this.ctx
    if (!ctx || this.musicTimer !== null) return
    this.step = 0
    this.nextNoteTime = ctx.currentTime + 0.06
    this.musicTimer = setInterval(() => this.musicTick(), TICK_MS)
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer)
      this.musicTimer = null
    }
  }

  /** 0 = calma (menu) .. 1 = densa (gameplay): mais percussão e melodia */
  setMusicIntensity(v: number): void {
    this.intensity = v < 0 ? 0 : v > 1 ? 1 : v
  }

  private musicTick(): void {
    const ctx = this.ctx
    if (!ctx) return
    // stall/throttle da main thread (drag de janela, GC, aba oculta): descarta
    // o backlog perdido em vez de agendar dezenas de notas no passado de uma vez
    if (this.nextNoteTime < ctx.currentTime) this.nextNoteTime = ctx.currentTime
    while (this.nextNoteTime < ctx.currentTime + LOOKAHEAD) {
      this.scheduleStep(this.step, this.nextNoteTime)
      this.nextNoteTime += STEP
      this.step = (this.step + 1) % (BAR * ROOTS.length)
    }
  }

  private scheduleStep(globalStep: number, t: number): void {
    const bar = Math.floor(globalStep / BAR)
    const s = globalStep % BAR
    const k = this.intensity
    if (s === 0) this.rollMelody(k)
    // baixo (triangle), padrão baião: tônica no 1, quinta na síncope, oitava no 2&
    if (s === 0) this.noteAt(ROOTS[bar], t, STEP * 2.2, 'triangle', 0.55)
    if (s === 3) this.noteAt(FIFTHS[bar], t, STEP * 1.6, 'triangle', 0.45)
    if (s === 6) this.noteAt(ROOTS[bar] * 2, t, STEP * 1.4, 'triangle', 0.4)
    if (s === 4 && k > 0.6) this.noteAt(ROOTS[bar], t, STEP * 1.2, 'triangle', 0.35)
    // zabumba: surdo no 1 e na síncope do 2; ghost extra com intensidade
    if (s === 0) this.zabumba(t, 0.9)
    if (s === 6) this.zabumba(t, 0.7)
    if (s === 3 && k > 0.5) this.zabumba(t, 0.35)
    // caxixi: colcheias, engrossa com a intensidade
    if (k > 0.15 && (s & 1) === 0) this.caxixi(t, 0.16 + 0.12 * k)
    if (k > 0.7 && (s === 3 || s === 7)) this.caxixi(t, 0.1)
    // melodia pentatônica (padrão sorteado por compasso — Math.random ok, é só estética)
    const m = this.melPattern[s]
    if (m >= 0) this.noteAt(MEL[m], t, STEP * 1.7, 'square', 0.14 + 0.1 * k)
  }

  /** sorteia o padrão melódico do compasso; passeio aleatório soa mais "frase" */
  private rollMelody(k: number): void {
    const density = 0.15 + 0.5 * k
    for (let i = 0; i < BAR; i++) {
      if (Math.random() < density) {
        const stepJump = ((Math.random() * 5) | 0) - 2
        this.melIdx = Math.min(MEL.length - 1, Math.max(0, this.melIdx + stepJump))
        this.melPattern[i] = this.melIdx
      } else {
        this.melPattern[i] = -1
      }
    }
  }

  private zabumba(t: number, vol: number): void {
    const dest = this.musicGain
    if (!dest) return
    this.toneAt(t, 110, 42, 0.12, 'sine', vol, dest)
    this.noiseAt(t, 0.05, vol * 0.3, 'lowpass', 220, dest)
  }

  private caxixi(t: number, vol: number): void {
    const dest = this.musicGain
    if (!dest) return
    this.noiseAt(t, 0.035, vol, 'highpass', 6000, dest)
  }

  private noteAt(f: number, t: number, dur: number, type: OscillatorType, vol: number): void {
    const dest = this.musicGain
    if (!dest) return
    this.toneAt(t, f, f, dur, type, vol, dest)
  }

  // ---- SFX ----

  play(id: SoundId): void {
    const ctx = this.ctx
    if (!ctx || !this.master || this.muted) return
    const now = ctx.currentTime

    if (id === 'shoot') {
      if (now - this.lastShoot < THROTTLE_SHOOT) return
      this.lastShoot = now
    } else if (id === 'hit') {
      if (now - this.lastHit < THROTTLE_HIT) return
      this.lastHit = now
    } else if (id === 'pickup') {
      if (now - this.lastPickup < THROTTLE_PICKUP) return
      this.lastPickup = now
    }

    switch (id) {
      case 'shoot': // thup bem curto e grave (square + sub triangle)
        this.tone(140, 85, 0.045, 'square', 0.2)
        this.tone(70, 60, 0.05, 'triangle', 0.28)
        break
      case 'hit': // tick macio
        this.tone(750, 520, 0.03, 'triangle', 0.35)
        break
      case 'hurt': // baque com corpo, menos áspero que serra
        this.tone(300, 80, 0.2, 'square', 0.35)
        this.tone(150, 55, 0.16, 'sine', 0.5)
        break
      case 'pickup': // blip doce
        this.tone(900, 1300, 0.05, 'sine', 0.22)
        break
      case 'gold': // ding duplo cristalino
        this.tone(1046.5, 1046.5, 0.07, 'sine', 0.35)
        this.tone(1567.98, 1567.98, 0.1, 'sine', 0.35, 0.07)
        break
      case 'levelup': // arpejo maior (C) em duas oitavas
        this.arp([523.25, 659.25, 783.99, 1046.5], 0.09, 'square', 0.28)
        this.arp([261.63, 329.63, 392, 523.25], 0.09, 'triangle', 0.3)
        break
      case 'boss': // fanfarra menor ameaçadora: stabs em lá menor + pedal grave detunado
        this.stab(110, 0.16, 0.38, 0)
        this.stab(110, 0.16, 0.38, 0.22)
        this.stab(130.81, 0.16, 0.38, 0.44)
        this.stab(82.41, 0.8, 0.42, 0.66)
        this.tone(164.81, 164.81, 0.8, 'square', 0.14, 0.66)
        break
      case 'death': // lamento descendente
        this.tone(392, 60, 1.1, 'sawtooth', 0.32)
        this.tone(196, 40, 1.3, 'triangle', 0.5)
        break
      case 'evolve': // arpejo maior brilhante + faísca no topo
        this.arp([523.25, 659.25, 783.99, 1046.5, 1318.51], 0.08, 'triangle', 0.42)
        this.tone(2093, 2093, 0.25, 'sine', 0.18, 0.4)
        break
      case 'chest': // dlin-dlin em terças
        this.tone(880, 880, 0.06, 'triangle', 0.35)
        this.tone(1318.51, 1318.51, 0.1, 'triangle', 0.35, 0.05)
        this.tone(1760, 1760, 0.14, 'triangle', 0.3, 0.1)
        break
      case 'saideira': // sweep épico: serras subindo + sub + shimmer + splash de ruído
        this.tone(70, 1800, 0.9, 'sawtooth', 0.5)
        this.tone(35, 900, 0.9, 'sawtooth', 0.3)
        this.tone(880, 3520, 0.7, 'sine', 0.15, 0.2)
        this.noiseSfx(0.55, 0.4, 0.35, 'highpass', 3000)
        break
      case 'win': { // fanfarra completa (~2.2s): C-C-C-E-G-E-G-C' + acorde final
        const N: ReadonlyArray<readonly [number, number, number]> = [
          [523.25, 0, 0.14],
          [523.25, 0.16, 0.14],
          [523.25, 0.32, 0.14],
          [659.25, 0.48, 0.3],
          [783.99, 0.8, 0.3],
          [659.25, 1.12, 0.14],
          [783.99, 1.28, 0.3],
          [1046.5, 1.6, 0.6],
        ]
        for (let i = 0; i < N.length; i++) {
          const [f, at, dur] = N[i]
          this.tone(f, f, dur, 'square', 0.32, at)
          this.tone(f / 2, f / 2, dur, 'triangle', 0.28, at)
        }
        this.tone(523.25, 523.25, 0.6, 'triangle', 0.28, 1.6)
        this.tone(659.25, 659.25, 0.6, 'triangle', 0.22, 1.6)
        this.tone(783.99, 783.99, 0.6, 'triangle', 0.22, 1.6)
        break
      }
      case 'heal': // subida suave com brilho
        this.tone(523.25, 783.99, 0.14, 'sine', 0.28)
        this.tone(1046.5, 1567.98, 0.12, 'sine', 0.12, 0.05)
        break
      case 'click': // tick seco
        this.tone(500, 470, 0.025, 'square', 0.22)
        break
    }
  }

  // ---- helpers ----

  /** oscilador com envelope agendado em tempo absoluto do AudioContext */
  private toneAt(
    t0: number,
    f0: number,
    f1: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    dest: AudioNode,
  ): void {
    const ctx = this.ctx
    if (!ctx) return
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(Math.max(1, f0), t0)
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur)
    // ataque curtíssimo evita estalo; decay exponencial
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(vol, t0 + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g)
    g.connect(dest)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  }

  /** SFX: frequência desliza f0→f1 ao longo de dur, delay relativo a agora */
  private tone(f0: number, f1: number, dur: number, type: OscillatorType, vol: number, delay = 0): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    this.toneAt(ctx.currentTime + delay, f0, f1, dur, type, vol, master)
  }

  private arp(freqs: number[], step: number, type: OscillatorType, vol: number): void {
    for (let i = 0; i < freqs.length; i++) {
      this.tone(freqs[i], freqs[i], step * 1.6, type, vol, i * step)
    }
  }

  /** duas serras detunadas juntas — stab encorpado pros graves */
  private stab(f: number, dur: number, vol: number, delay: number): void {
    this.tone(f, f, dur, 'sawtooth', vol, delay)
    this.tone(f * 1.012, f * 1.012, dur, 'sawtooth', vol * 0.7, delay)
  }

  /** buffer de ruído branco compartilhado (percussão / splash), criado 1x */
  private getNoise(): AudioBuffer | null {
    const ctx = this.ctx
    if (!ctx) return null
    if (!this.noiseBuf) {
      const len = Math.floor(ctx.sampleRate * 0.25)
      const buf = ctx.createBuffer(1, len, ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
      this.noiseBuf = buf
    }
    return this.noiseBuf
  }

  private noiseAt(
    t0: number,
    dur: number,
    vol: number,
    filter: BiquadFilterType,
    ffreq: number,
    dest: AudioNode,
  ): void {
    const ctx = this.ctx
    const buf = this.getNoise()
    if (!ctx || !buf) return
    const src = ctx.createBufferSource()
    src.buffer = buf
    const f = ctx.createBiquadFilter()
    f.type = filter
    f.frequency.value = ffreq
    const g = ctx.createGain()
    g.gain.setValueAtTime(vol, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    src.connect(f)
    f.connect(g)
    g.connect(dest)
    src.start(t0)
    src.stop(t0 + dur + 0.02)
  }

  /** splash de ruído nos SFX (vai pro master) */
  private noiseSfx(delay: number, dur: number, vol: number, filter: BiquadFilterType, ffreq: number): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    this.noiseAt(ctx.currentTime + delay, dur, vol, filter, ffreq, master)
  }
}
