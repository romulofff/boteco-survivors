// Efeitos: partículas, textos flutuantes, shake, saideira flash.
import type { GameState } from '../types'

const TAU = Math.PI * 2

export function spawnBurst(s: GameState, x: number, y: number, color: string, n: number): void {
  for (let i = 0; i < n; i++) {
    const p = s.particles.allocOverwrite()
    p.active = true
    p.x = x
    p.y = y
    const a = s.rng.next() * TAU
    const spd = 40 + s.rng.next() * 140
    p.vx = Math.cos(a) * spd
    p.vy = Math.sin(a) * spd
    p.ttl = 0.3 + s.rng.next() * 0.2
    p.age = 0
    p.size = 2 + s.rng.next() * 2
    p.color = color
  }
}

export function addText(s: GameState, x: number, y: number, text: string, color: string): void {
  const t = s.texts.allocOverwrite()
  t.active = true
  t.x = x
  t.y = y
  t.ttl = 0.7
  t.age = 0
  t.text = text
  t.color = color
  t.size = 13
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
  }

  const ts = s.texts.items
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i]
    if (!t.active) continue
    t.age += dt
    if (t.age >= t.ttl) { t.active = false; continue }
    t.y -= 42 * dt
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
