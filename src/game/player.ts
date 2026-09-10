// Movimento do player, regen, iframes, coleta de gems e pickups.
import type { GameState, InputFrame } from '../types'
import { PLAYER_BASE_SPEED } from '../constants'
import { gainXP } from './leveling'
import { applyPickup } from './drops'

export function updatePlayer(s: GameState, input: InputFrame, dt: number): void {
  const p = s.player
  const st = p.stats

  let mx = input.moveX
  let my = input.moveY
  // stick virtual só quando o teclado está em zero (teclado vence)
  if (mx === 0 && my === 0 && s.ui.stick.active) {
    mx = s.ui.stick.mx
    my = s.ui.stick.my
  }
  if (mx !== 0 || my !== 0) {
    const spd = PLAYER_BASE_SPEED * st.speed
    p.x += mx * spd * dt
    p.y += my * spd * dt
    const len = Math.sqrt(mx * mx + my * my) || 1
    p.dirX = mx / len
    p.dirY = my / len
  }

  if (st.regen > 0 && p.hp < st.maxHp) {
    p.hp = Math.min(st.maxHp, p.hp + st.regen * dt)
  }
  if (p.iframes > 0) p.iframes -= dt

  // gems: atração + coleta
  const magSq = st.magnet * st.magnet
  const collectR = p.radius + 8
  const gems = s.gems.items
  for (let i = 0; i < gems.length; i++) {
    const g = gems[i]
    if (!g.active) continue
    const dx = p.x - g.x
    const dy = p.y - g.y
    const dSq = dx * dx + dy * dy
    if (!g.magnet) {
      if (dSq >= magSq) continue
      g.magnet = true
      g.vx = 0
      g.vy = 0
    }
    const d = Math.sqrt(dSq) || 1
    // aproxima com velocidade crescente
    let spd = Math.sqrt(g.vx * g.vx + g.vy * g.vy)
    spd = Math.min(1100, Math.max(420, spd + 2400 * dt))
    g.vx = (dx / d) * spd
    g.vy = (dy / d) * spd
    g.x += g.vx * dt
    g.y += g.vy * dt
    if (d <= collectR || d <= spd * dt) {
      g.active = false
      gainXP(s, g.value)
      const ss = s.sounds
      if (ss.length === 0 || ss[ss.length - 1] !== 'pickup') ss.push('pickup')
    }
  }

  // pickups
  const pickR = p.radius + 14
  const pks = s.pickups.items
  for (let i = 0; i < pks.length; i++) {
    const pk = pks[i]
    if (!pk.active) continue
    const dx = p.x - pk.x
    const dy = p.y - pk.y
    if (dx * dx + dy * dy <= pickR * pickR) {
      pk.active = false
      applyPickup(s, pk)
    }
  }
}
