// Morte de inimigos (XP/pickups) e efeitos de coleta.
import type { GameState, Pickup, PickupKind } from '../types'
import {
  CALDINHO_HEAL, CAP_GEMS, COLOR_GOLD, COLOR_HEAL, DROP_CALDINHO, DROP_DINHEIRO,
  DROP_DINHEIRO_MAX, DROP_DINHEIRO_MIN, DROP_IMA, GOLD_BOSS_PER_XP, GOLD_ELITE_MIN,
  GOLD_ELITE_PER_XP, MARMITA_GOLD_MAX, MARMITA_GOLD_MIN, MAX_WEAPON_LEVEL,
  SAIDEIRA_DAMAGE,
} from '../constants'
import { weaponById } from '../data/weapons'
import { addText, shake, spawnBurst } from './fx'
import { findEvolution, evolveWeapon } from './leveling'
import { recalcStats } from './weaponsSys'

let mergeCheckFrame = -1

/** funde as 100 gems ativas mais antigas (menor índice do pool) numa só */
function mergeGems(s: GameState): void {
  const items = s.gems.items
  let merged = 0
  let sum = 0
  let lastX = 0
  let lastY = 0
  for (let i = 0; i < items.length && merged < 100; i++) {
    const g = items[i]
    if (!g.active) continue
    sum += g.value
    lastX = g.x
    lastY = g.y
    g.active = false
    merged++
  }
  if (merged === 0) return
  const g = s.gems.alloc()
  if (g) {
    g.active = true
    g.x = lastX
    g.y = lastY
    g.value = sum
    g.magnet = false
    g.vx = 0
    g.vy = 0
  }
}

function dropPickup(s: GameState, kind: PickupKind, x: number, y: number, value: number): void {
  const pk = s.pickups.alloc()
  if (!pk) return
  pk.active = true
  pk.kind = kind
  pk.x = x
  pk.y = y
  pk.value = value
}

export function killEnemy(s: GameState, idx: number): void {
  const e = s.enemies.items[idx]
  if (!e.active) return
  e.active = false
  s.player.kills++
  spawnBurst(s, e.x, e.y, '#c44', e.boss ? 24 : 6)

  // merge de gems perto do cap (checa 1x por frame)
  if (s.frame !== mergeCheckFrame) {
    mergeCheckFrame = s.frame
    if (s.gems.count() > CAP_GEMS * 0.85) mergeGems(s)
  }

  let g = s.gems.alloc()
  if (!g) {
    // pool estourou no meio do frame (ex.: saideira matando centenas de uma
    // vez): merge conserva a soma de XP e libera 99 slots — retry nunca falha
    mergeGems(s)
    g = s.gems.alloc()
  }
  if (g) {
    g.active = true
    g.x = e.x
    g.y = e.y
    g.value = e.xp
    g.magnet = false
    g.vx = 0
    g.vy = 0
  }

  if (e.boss) {
    dropPickup(s, 'marmita', e.x - 20, e.y, 0)
    dropPickup(s, 'saideira', e.x + 20, e.y, 0)
    // ouro direto: recompensa garantida mesmo se o jogador estiver kitando longe
    const v = Math.round(e.xp * GOLD_BOSS_PER_XP * s.player.stats.greed)
    s.player.gold += v
    s.goldEarned += v
    s.sounds.push('gold')
    addText(s, e.x, e.y - 30, '+' + v + ' 🪙', COLOR_GOLD)
    // só limpa o rastreio se o morto for o chefe apontado; com dois chefes
    // vivos (kite longo), a barra do HUD passa a apontar pro sobrevivente
    if (s.spawn.bossIdx === idx) {
      s.spawn.bossIdx = -1
      const en = s.enemies.items
      for (let i = 0; i < en.length; i++) {
        if (en[i].active && en[i].boss) { s.spawn.bossIdx = i; break }
      }
    }
    shake(s, 8)
  } else if (e.elite) {
    dropPickup(s, 'marmita', e.x, e.y, 0)
    // e.xp do elite já vem ×10 do spawner: elite cedo ~30xp → ~10 ouro; tardio ~100xp → ~28
    const v = Math.round(Math.max(GOLD_ELITE_MIN, e.xp * GOLD_ELITE_PER_XP) * s.player.stats.greed)
    s.player.gold += v
    s.goldEarned += v
    addText(s, e.x, e.y - 20, '+' + v + ' 🪙', COLOR_GOLD)
  } else {
    if (s.rng.chance(DROP_CALDINHO)) dropPickup(s, 'caldinho', e.x, e.y, 0)
    if (s.rng.chance(DROP_DINHEIRO)) {
      dropPickup(s, 'dinheiro', e.x, e.y, s.rng.int(DROP_DINHEIRO_MIN, DROP_DINHEIRO_MAX))
    }
    if (s.rng.chance(DROP_IMA)) dropPickup(s, 'ima', e.x, e.y, 0)
  }
}

// NOTA: contrato original pedia (s, p, ctx); ctx removido — ouro de pickups
// vai para player.gold da run e só banca no save ao final (update.ts).
export function applyPickup(s: GameState, p: Pickup): void {
  const pl = s.player
  switch (p.kind) {
    case 'caldinho': {
      pl.hp = Math.min(pl.stats.maxHp, pl.hp + CALDINHO_HEAL)
      s.sounds.push('heal')
      addText(s, pl.x, pl.y - 24, '+' + CALDINHO_HEAL, COLOR_HEAL)
      break
    }
    case 'dinheiro': {
      const v = Math.round(p.value * pl.stats.greed)
      pl.gold += v
      s.goldEarned += v
      s.sounds.push('gold')
      addText(s, p.x, p.y - 10, '+' + Math.round(v), COLOR_GOLD)
      break
    }
    case 'ima': {
      const gs = s.gems.items
      for (let i = 0; i < gs.length; i++) {
        if (gs[i].active) gs[i].magnet = true
      }
      s.sounds.push('gold')
      break
    }
    case 'saideira': {
      const en = s.enemies.items
      for (let i = 0; i < en.length; i++) {
        const e = en[i]
        if (!e.active || e.boss) continue
        e.hp -= SAIDEIRA_DAMAGE
        e.hitFlash = 0.15
        s.damageDealt += SAIDEIRA_DAMAGE
        if (e.hp <= 0) killEnemy(s, i) // dropa XP normalmente
      }
      s.saideiraFlash = 0.35
      shake(s, 10)
      s.sounds.push('saideira')
      break
    }
    case 'marmita': {
      const v = Math.round(s.rng.int(MARMITA_GOLD_MIN, MARMITA_GOLD_MAX) * pl.stats.greed)
      pl.gold += v
      s.goldEarned += v
      // upgrade instantâneo de arma (GDD §7): evolução se elegível; senão
      // +1 nível na arma equipada de menor nível ainda upável
      const wi = findEvolution(s)
      if (wi >= 0) {
        evolveWeapon(s, wi)
      } else {
        let best = -1
        for (let i = 0; i < s.weapons.length; i++) {
          const w = s.weapons[i]
          if (w.level >= MAX_WEAPON_LEVEL) continue
          if (weaponById(w.defId).evolved) continue // evoluída não tem perLevel
          if (best < 0 || w.level < s.weapons[best].level) best = i
        }
        if (best >= 0) {
          const w = s.weapons[best]
          w.level++
          recalcStats(s)
          addText(s, p.x, p.y - 26, weaponById(w.defId).name + ' ⬆', COLOR_HEAL)
        }
      }
      s.sounds.push('chest')
      addText(s, p.x, p.y - 10, '+' + Math.round(v), COLOR_GOLD)
      break
    }
  }
}
