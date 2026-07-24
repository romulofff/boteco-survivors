// Movimento dos projéteis por kind + ttl; zonas: timers.
import type { GameState } from '../types'
import { ZONE_TICK } from '../constants'
import { explodeAt } from './collide'
import { spawnBurst } from './fx'

const CULL_DIST_SQ = 1200 * 1200

export function updateProjectiles(s: GameState, dt: number): void {
  const px = s.player.x
  const py = s.player.y
  const pr = s.projectiles.items

  for (let i = 0; i < pr.length; i++) {
    const p = pr[i]
    if (!p.active) continue

    const kind = p.kind
    if (kind === 'nearest' || kind === 'directional') {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.ttl -= dt
      const dx = p.x - px
      const dy = p.y - py
      if (p.ttl <= 0 || dx * dx + dy * dy > CULL_DIST_SQ) p.active = false
    } else if (kind === 'lob' || kind === 'zone') {
      p.age += dt
      const t = p.ttl > 0 ? p.age / p.ttl : 1
      if (t >= 1) {
        if (kind === 'lob') {
          explodeAt(s, p.tx, p.ty, p.radius, p.damage, p.knockback, p.weaponIdx)
        } else {
          const z = s.zones.alloc()
          if (z) {
            z.active = true
            z.x = p.tx
            z.y = p.ty
            z.radius = p.radius
            z.damage = p.damage
            z.ttl = p.reach // duração da poça (guardada no disparo)
            z.tick = ZONE_TICK
            z.acc = 0
            z.kind = 'fogo'
          }
          spawnBurst(s, p.tx, p.ty, '#ff7733', 8)
          s.sounds.push('hit')
        }
        p.active = false
      } else {
        // arco é só visual (render); aqui interpola reto
        p.x = p.ox + (p.tx - p.ox) * t
        p.y = p.oy + (p.ty - p.oy) * t
      }
    } else if (kind === 'boomerang') {
      p.ttl -= dt
      if (p.ttl <= 0) { p.active = false; continue }
      p.age += dt
      if (p.angle === 0) {
        // ida: desacelera linearmente até o alcance
        const outT = p.oy
        const spd = p.ox * (1 - p.age / outT)
        if (p.age >= outT || spd <= 0) {
          p.angle = 1
          p.ox = 0 // velocidade de volta corrente
        } else {
          p.x += p.vx * spd * dt
          p.y += p.vy * spd * dt
        }
      } else {
        // volta: acelera em direção ao player ATUAL
        const dx = px - p.x
        const dy = py - p.y
        const d = Math.sqrt(dx * dx + dy * dy) || 1
        if (d < 20) { p.active = false; continue }
        p.ox = Math.min(p.ox + 1600 * dt, 1000)
        p.x += (dx / d) * p.ox * dt
        p.y += (dy / d) * p.ox * dt
      }
    } else if (kind === 'orbit') {
      p.ttl -= dt
      if (p.ttl <= 0) { p.active = false; continue }
      p.angle += p.vx * dt // vx = velocidade angular (rad/s)
      p.x = px + Math.cos(p.angle) * p.reach
      p.y = py + Math.sin(p.angle) * p.reach
    } else if (kind === 'whip') {
      p.ttl -= dt
      if (p.ttl <= 0) p.active = false
    } else {
      p.active = false // kind inválido para projétil (aura)
    }
  }

  const zs = s.zones.items
  for (let i = 0; i < zs.length; i++) {
    const z = zs[i]
    if (!z.active) continue
    z.ttl -= dt
    if (z.ttl <= 0) { z.active = false; continue }
    z.acc += dt // dano por tick aplicado em collide.ts
  }
}
