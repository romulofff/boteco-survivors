// Comportamentos dos inimigos + knockback/hitFlash decay + teleporte de pressão.
// Separação entre vizinhos ficou em collide.ts (grid fresca do frame).
import type { GameState } from '../types'
import { ENEMIES } from '../data/enemies'
import { SPAWN_RADIUS } from './spawner'

const TELEPORT_SQ = 1400 * 1400

export function updateEnemies(s: GameState, dt: number): void {
  const px = s.player.x
  const py = s.player.y
  const kbDecay = Math.pow(0.0001, dt)
  const en = s.enemies.items

  for (let i = 0; i < en.length; i++) {
    const e = en[i]
    if (!e.active) continue
    if (e.hitFlash > 0) e.hitFlash -= dt

    const dxp = px - e.x
    const dyp = py - e.y
    const dSq = dxp * dxp + dyp * dyp

    // longe demais: teleporta para o anel de spawn do lado oposto (mantém pressão)
    if (!e.boss && dSq > TELEPORT_SQ) {
      const a = Math.atan2(dyp, dxp)
      e.x = px + Math.cos(a) * SPAWN_RADIUS
      e.y = py + Math.sin(a) * SPAWN_RADIUS
      e.kbx = 0
      e.kby = 0
      continue
    }

    const d = Math.sqrt(dSq) || 1
    const ux = dxp / d
    const uy = dyp / d
    let vx = 0
    let vy = 0
    const beh = ENEMIES[e.defIndex].behavior

    if (beh === 'chase') {
      vx = ux * e.speed
      vy = uy * e.speed
    } else if (beh === 'dart') {
      // 0.9s mirando (25% speed) + 0.45s dash a 2.6x no ângulo guardado
      e.t += dt
      if (e.t >= 1.35) e.t -= 1.35
      if (e.t < 0.9) {
        e.phase = Math.atan2(dyp, dxp)
        vx = ux * e.speed * 0.25
        vy = uy * e.speed * 0.25
      } else {
        vx = Math.cos(e.phase) * e.speed * 2.6
        vy = Math.sin(e.phase) * e.speed * 2.6
      }
    } else if (beh === 'swoop') {
      // ~2s orbitando a ~180px + ~1.2s de mergulho reto
      const prev = e.t
      e.t += dt
      if (e.t >= 3.2) e.t -= 3.2
      if (e.t < 2) {
        const err = Math.max(-e.speed, Math.min(e.speed, (d - 180) * 1.2))
        vx = -uy * e.speed + ux * err
        vy = ux * e.speed + uy * err
        const vl = Math.sqrt(vx * vx + vy * vy) || 1
        vx = (vx / vl) * e.speed
        vy = (vy / vl) * e.speed
      } else {
        if (prev < 2) e.phase = Math.atan2(dyp, dxp) // trava o ângulo do mergulho
        vx = Math.cos(e.phase) * e.speed * 2.5
        vy = Math.sin(e.phase) * e.speed * 2.5
      }
    } else { // drunk: persegue cambaleando
      e.t += dt
      const wob = Math.sin(e.t * 3) * 0.4
      vx = (ux - uy * wob) * e.speed
      vy = (uy + ux * wob) * e.speed
    }

    e.x += (vx + e.kbx) * dt
    e.y += (vy + e.kby) * dt
    e.kbx *= kbDecay
    e.kby *= kbDecay
  }
}
