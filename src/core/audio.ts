// Áudio 100% sintetizado via WebAudio (osciladores + envelopes). Sem assets.
// ensureStarted() deve ser chamado no 1º gesto do usuário (autoplay policy).

import type { SoundId } from '../types'

const MASTER_VOL = 0.25
const THROTTLE_SHOOT = 0.06
const THROTTLE_HIT = 0.05
const THROTTLE_PICKUP = 0.04

export class AudioSys {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private muted = false
  private lastShoot = -1
  private lastHit = -1
  private lastPickup = -1

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
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  toggleMute(): boolean {
    this.muted = !this.muted
    if (this.master) this.master.gain.value = this.muted ? 0 : MASTER_VOL
    return this.muted
  }

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
      case 'shoot': // blip curto grave
        this.tone(180, 130, 0.07, 'square', 0.3)
        break
      case 'hit': // tick
        this.tone(900, 650, 0.035, 'square', 0.22)
        break
      case 'hurt': // descida áspera
        this.tone(320, 70, 0.28, 'sawtooth', 0.5)
        break
      case 'pickup': // blip agudo
        this.tone(950, 1350, 0.055, 'square', 0.2)
        break
      case 'gold': // ding duplo
        this.tone(1200, 1200, 0.08, 'sine', 0.4)
        this.tone(1600, 1600, 0.1, 'sine', 0.4, 0.08)
        break
      case 'levelup': // arpejo subindo
        this.arp([440, 554, 659, 880], 0.09, 'square', 0.35)
        break
      case 'boss': // fanfarra grave ameaçadora (pares dissonantes)
        this.tone(110, 110, 0.35, 'sawtooth', 0.45)
        this.tone(104, 104, 0.35, 'sawtooth', 0.3)
        this.tone(82, 82, 0.6, 'sawtooth', 0.45, 0.3)
        this.tone(78, 78, 0.6, 'sawtooth', 0.3, 0.3)
        break
      case 'death': // descida longa
        this.tone(440, 40, 1.2, 'sawtooth', 0.5)
        break
      case 'evolve': // arpejo maior brilhante
        this.arp([523, 659, 784, 1047, 1319], 0.08, 'triangle', 0.45)
        break
      case 'chest': // dlin
        this.tone(880, 880, 0.07, 'triangle', 0.4)
        this.tone(1320, 1320, 0.12, 'triangle', 0.4, 0.06)
        break
      case 'saideira': // sweep enorme
        this.tone(90, 1400, 0.6, 'sawtooth', 0.55)
        this.tone(45, 700, 0.6, 'sawtooth', 0.3)
        break
      case 'win': // fanfarra alegre
        this.arp([523, 523, 659, 784, 784, 1047], 0.12, 'square', 0.4)
        break
      case 'heal': // blip suave
        this.tone(600, 820, 0.12, 'sine', 0.3)
        break
      case 'click': // tick seco
        this.tone(500, 480, 0.025, 'square', 0.25)
        break
    }
  }

  /** oscilador com envelope; frequência desliza f0→f1 ao longo de dur */
  private tone(f0: number, f1: number, dur: number, type: OscillatorType, vol: number, delay = 0): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const t0 = ctx.currentTime + delay
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
    g.connect(master)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  }

  private arp(freqs: number[], step: number, type: OscillatorType, vol: number): void {
    for (let i = 0; i < freqs.length; i++) {
      this.tone(freqs[i], freqs[i], step * 1.6, type, vol, i * step)
    }
  }
}
