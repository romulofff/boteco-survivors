// Colisões: grid espacial, projétil→inimigo, aura, zonas, inimigo→player, separação.
import type { GameState, WeaponStats } from '../types'
import {
  AURA_TICK, CAP_TEXTS, COLOR_DMG, COLOR_HP, PLAYER_IFRAMES, REHIT_INTERVAL,
} from '../constants'
import { SpatialHash } from '../core/spatial'
import { weaponById } from '../data/weapons'
import { effInto } from './weaponsSys'
import { killEnemy } from './drops'
import { addText, shake, spawnBurst } from './fx'

/** knockback stat → impulso em px/s */
const KB_SCALE = 30
const TEXT_CAP = Math.floor(CAP_TEXTS * 0.8)

const grid = new SpatialHash(64)
const qout: number[] = []
const AURA_SCRATCH: WeaponStats = {
  damage: 0, cooldown: 0, amount: 0, speed: 0, area: 0, duration: 0, pierce: 0, knockback: 0,
}
let hitSoundFrame = -1
let textBudget = 0

/** grid do último rebuild (frame corrente após updateCollisions) */
export function getGrid(): SpatialHash {
  return grid
}

function damageEnemy(s: GameState, idx: number, dmg: number, nx: number, ny: number, kb: number): void {
  const e = s.enemies.items[idx]
  e.hp -= dmg
  e.hitFlash = 0.08
  if (!e.boss && kb > 0) {
    e.kbx += nx * kb
    e.kby += ny * kb
  }
  s.damageDealt += dmg
  if (textBudget > 0) {
    textBudget--
    addText(s, e.x, e.y - e.radius - 4, String(Math.round(dmg)), COLOR_DMG)
  }
  if (hitSoundFrame !== s.frame) {
    hitSoundFrame = s.frame
    s.sounds.push('hit')
  }
  if (e.hp <= 0) killEnemy(s, idx)
}

/** explosão em área (lob/marmita etc.) — consulta a grid corrente */
export function explodeAt(
  s: GameState, x: number, y: number, radius: number,
  damage: number, knockback: number, weaponIdx: number,
): void {
  textBudget = Math.max(textBudget, TEXT_CAP - s.texts.count())
  grid.query(x, y, radius + 48, qout)
  const en = s.enemies.items
  for (let q = 0; q < qout.length; q++) {
    const idx = qout[q]
    const e = en[idx]
    if (!e.active) continue
    const dx = e.x - x
    const dy = e.y - y
    const rr = radius + e.radius
    const dSq = dx * dx + dy * dy
    if (dSq > rr * rr) continue
    const d = Math.sqrt(dSq) || 1
    damageEnemy(s, idx, damage, dx / d, dy / d, knockback * KB_SCALE)
  }
  spawnBurst(s, x, y, '#ffa447', 12)
  shake(s, 4)
  if (hitSoundFrame !== s.frame) {
    hitSoundFrame = s.frame
    s.sounds.push('hit')
  }
}

export function updateCollisions(s: GameState, dt: number): void {
  const en = s.enemies.items

  // rebuild da grid com inimigos ativos
  grid.clear()
  for (let i = 0; i < en.length; i++) {
    const e = en[i]
    if (e.active) grid.insert(i, e.x, e.y)
  }

  textBudget = Math.max(0, TEXT_CAP - s.texts.count())

  // separação barata entre vizinhos (até 5 por inimigo)
  for (let i = 0; i < en.length; i++) {
    const e = en[i]
    if (!e.active) continue
    grid.query(e.x, e.y, e.radius * 2, qout)
    let seen = 0
    for (let q = 0; q < qout.length && seen < 5; q++) {
      const j = qout[q]
      if (j === i) continue
      const o = en[j]
      if (!o.active) continue
      seen++
      const dx = e.x - o.x
      const dy = e.y - o.y
      const min = (e.radius + o.radius) * 0.8
      const dSq = dx * dx + dy * dy
      if (dSq >= min * min) continue
      if (dSq < 1e-6) { // exatamente sobrepostos: nudge determinístico
        if (!e.boss) e.x += i % 2 === 0 ? 0.5 : -0.5
        continue
      }
      const d = Math.sqrt(dSq)
      const push = (min - d) * 4 * dt
      const nx = dx / d
      const ny = dy / d
      if (!e.boss) { e.x += nx * push; e.y += ny * push }
      if (!o.boss) { o.x -= nx * push; o.y -= ny * push }
    }
  }

  // projéteis → inimigos
  const pr = s.projectiles.items
  for (let i = 0; i < pr.length; i++) {
    const p = pr[i]
    if (!p.active) continue
    const kind = p.kind
    if (kind === 'lob' || kind === 'zone' || kind === 'aura') continue // em voo / sem hitbox
    const persistent = kind === 'orbit' || kind === 'boomerang' || kind === 'whip'
    grid.query(p.x, p.y, p.radius + 48, qout)
    for (let q = 0; q < qout.length; q++) {
      const idx = qout[q]
      const e = en[idx]
      if (!e.active) continue
      const until = p.hitMap.get(idx)
      if (until !== undefined && s.time < until) continue
      const dx = e.x - p.x
      const dy = e.y - p.y
      const rr = e.radius + p.radius
      const dSq = dx * dx + dy * dy
      if (dSq > rr * rr) continue
      const d = Math.sqrt(dSq) || 1
      p.hitMap.set(idx, s.time + REHIT_INTERVAL)
      damageEnemy(s, idx, p.damage, dx / d, dy / d, p.knockback * KB_SCALE)
      // matou: solta o cooldown de rehit do slot — um inimigo novo reciclado
      // no mesmo índice do pool não pode herdar a imunidade do morto
      if (!e.active) p.hitMap.delete(idx)
      if (!persistent) {
        p.pierce -= 1
        if (p.pierce < 0) { p.active = false; break }
      }
    }
  }

  // auras (tick acumulado em volleyTimer — reuso do campo)
  const px = s.player.x
  const py = s.player.y
  for (let wi = 0; wi < s.weapons.length; wi++) {
    const w = s.weapons[wi]
    const def = weaponById(w.defId)
    if (def.behavior !== 'aura') continue
    w.volleyTimer += dt
    if (w.volleyTimer < AURA_TICK) continue
    w.volleyTimer -= AURA_TICK
    const eff = effInto(s, w, AURA_SCRATCH)
    grid.query(px, py, eff.area + 48, qout)
    for (let q = 0; q < qout.length; q++) {
      const idx = qout[q]
      const e = en[idx]
      if (!e.active) continue
      const dx = e.x - px
      const dy = e.y - py
      const rr = eff.area + e.radius
      const dSq = dx * dx + dy * dy
      if (dSq > rr * rr) continue
      const d = Math.sqrt(dSq) || 1
      damageEnemy(s, idx, eff.damage, dx / d, dy / d, eff.knockback * 12)
    }
  }

  // zonas (poças): dano por tick, sem knockback
  const zs = s.zones.items
  for (let i = 0; i < zs.length; i++) {
    const z = zs[i]
    if (!z.active || z.acc < z.tick) continue
    z.acc = 0
    grid.query(z.x, z.y, z.radius + 48, qout)
    for (let q = 0; q < qout.length; q++) {
      const idx = qout[q]
      const e = en[idx]
      if (!e.active) continue
      const dx = e.x - z.x
      const dy = e.y - z.y
      const rr = z.radius + e.radius
      if (dx * dx + dy * dy > rr * rr) continue
      damageEnemy(s, idx, z.damage, 0, 0, 0)
    }
  }

  // inimigos → player (toque)
  const pl = s.player
  if (pl.hp > 0 && pl.iframes <= 0) {
    grid.query(pl.x, pl.y, 48, qout)
    for (let q = 0; q < qout.length; q++) {
      const idx = qout[q]
      const e = en[idx]
      if (!e.active) continue
      const dx = e.x - pl.x
      const dy = e.y - pl.y
      const rr = e.radius + pl.radius
      if (dx * dx + dy * dy > rr * rr) continue
      const dmg = Math.max(1, Math.round(e.damage - pl.stats.armor))
      pl.hp -= dmg
      pl.iframes = PLAYER_IFRAMES
      s.sounds.push('hurt')
      shake(s, 6)
      addText(s, pl.x, pl.y - 24, '-' + dmg, COLOR_HP)
      break
    }
  }
}
