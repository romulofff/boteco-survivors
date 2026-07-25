// Efeitos: partículas, textos flutuantes, shake, saideira flash.
// NOTA de determinismo: spawnBurst consome EXATAMENTE 4 rolls de rng por
// partícula — não mudar a contagem (alteraria o stream de gameplay).
import type { GameState } from '../types'
import { COLOR_GOLD, COLOR_HEAL, COLOR_HP } from '../constants'

const TAU = Math.PI * 2

export function spawnBurst(s: GameState, x: number, y: number, color: string, n: number): void {
  for (let i = 0; i < n; i++) {
    const p = s.particles.allocOverwrite()
    p.active = true
    p.x = x
    p.y = y
    const a = s.rng.next() * TAU
    // pop mais violento: partículas saem rápido e frenam (velDecay no update)
    const spd = 70 + s.rng.next() * 220
    p.vx = Math.cos(a) * spd
    p.vy = Math.sin(a) * spd - 30 // leve bias pra cima (celebração)
    p.ttl = 0.28 + s.rng.next() * 0.3
    p.age = 0
    p.size = 2 + s.rng.next() * 3.5
    p.color = color
  }
}

export function addText(s: GameState, x: number, y: number, text: string, color: string): void {
  const t = s.texts.allocOverwrite()
  t.active = true
  t.x = x
  t.y = y
  t.age = 0
  t.text = text
  t.color = color
  // tamanho/vida por semântica da cor (call sites de game/* não mudam):
  // dano no player = vermelho maior; cura = verde médio; ouro = destaque leve.
  if (color === COLOR_HP) {
    t.size = 19
    t.ttl = 0.9
  } else if (color === COLOR_HEAL) {
    t.size = 16
    t.ttl = 0.85
  } else if (color === COLOR_GOLD) {
    t.size = 15
    t.ttl = 0.8
  } else {
    t.size = 13
    t.ttl = 0.7
  }
}

export function shake(s: GameState, amt: number): void {
  if (amt > s.camera.shake) s.camera.shake = amt
}

export function updateFx(s: GameState, dt: number): void {
  const velDecay = Math.pow(0.02, dt)

  const ps = s.particles.items
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i]
    if (!p.active) continue
    p.age += dt
    if (p.age >= p.ttl) { p.active = false; continue }
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vx *= velDecay
    p.vy *= velDecay
    p.vy += 90 * dt // gravidade leve: faíscas caem no fim
  }

  const ts = s.texts.items
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i]
    if (!t.active) continue
    t.age += dt
    if (t.age >= t.ttl) { t.active = false; continue }
    t.y -= 46 * dt
  }

  if (s.camera.shake > 0) {
    s.camera.shake *= Math.pow(0.001, dt)
    if (s.camera.shake < 0.1) s.camera.shake = 0
  }

  if (s.saideiraFlash > 0) {
    s.saideiraFlash -= dt
    if (s.saideiraFlash < 0) s.saideiraFlash = 0
  }
}
