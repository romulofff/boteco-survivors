// XP, level-ups, pool de upgrades e evoluções.
import type { GameState, UpgradeOption, WeaponDef } from '../types'
import { COLOR_GOLD, MAX_PASSIVES, MAX_WEAPONS, MAX_WEAPON_LEVEL, XP_BASE, XP_GROWTH } from '../constants'
import { WEAPONS, weaponById } from '../data/weapons'
import { PASSIVES, passiveById } from '../data/passives'
import { recalcStats } from './weaponsSys'
import { addText } from './fx'

export function xpForLevel(level: number): number {
  // expoente 2.2: níveis altos custam caro — amortece "saltos" quando um bloco
  // grande de XP chega de uma vez (merge de gems, imã, saideira)
  return XP_BASE + (level - 1) * XP_GROWTH + Math.floor(Math.pow(level, 2.2) * 0.5)
}

export function gainXP(s: GameState, v: number): void {
  const p = s.player
  p.xp += v
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext
    p.level++
    p.xpNext = xpForLevel(p.level)
    s.pendingLevelUps++
  }
}

function hasPassive(s: GameState, id: string): boolean {
  for (let i = 0; i < s.passives.length; i++) {
    if (s.passives[i].defId === id) return true
  }
  return false
}

function findWeaponIdx(s: GameState, defId: string): number {
  for (let i = 0; i < s.weapons.length; i++) {
    if (s.weapons[i].defId === defId) return i
  }
  return -1
}

/** índice da 1ª arma equipada elegível a evolução, ou -1 */
export function findEvolution(s: GameState): number {
  for (let i = 0; i < s.weapons.length; i++) {
    const w = s.weapons[i]
    if (w.level < MAX_WEAPON_LEVEL) continue
    const def = weaponById(w.defId)
    if (!def.evolution || def.evolved) continue
    if (!hasPassive(s, def.evolution.requires)) continue
    return i
  }
  return -1
}

/** troca a arma base pela evoluída (nível 1, cooldown 0) */
export function evolveWeapon(s: GameState, weaponIdx: number): void {
  const w = s.weapons[weaponIdx]
  const def = weaponById(w.defId)
  if (!def.evolution) return
  const into = weaponById(def.evolution.into)
  w.defId = into.id
  w.level = 1
  w.cooldown = 0
  w.volleyLeft = 0
  w.volleyTimer = 0
  w.side = 1
  recalcStats(s)
  s.sounds.push('evolve')
  addText(s, s.player.x, s.player.y - 28, into.name + '!', COLOR_GOLD)
}

/** resumo do delta do próximo nível da arma */
function deltaDesc(def: WeaponDef, level: number): string {
  const d = def.perLevel[level - 1]
  if (!d) return def.desc
  const parts: string[] = []
  if (d.damage) parts.push('+dano')
  if (d.amount) parts.push('+' + d.amount + (d.amount > 1 ? ' projéteis' : ' projétil'))
  if (d.cooldown && d.cooldown < 0) parts.push('-recarga')
  if (d.area) parts.push('+área')
  if (d.speed) parts.push('+velocidade')
  if (d.duration) parts.push('+duração')
  if (d.pierce) parts.push('+perfuração')
  if (d.knockback) parts.push('+impacto')
  return parts.length > 0 ? parts.join(', ') : def.desc
}

function weaponEquippedOrEvolved(s: GameState, def: WeaponDef): boolean {
  for (let i = 0; i < s.weapons.length; i++) {
    const id = s.weapons[i].defId
    if (id === def.id) return true
    if (def.evolution && id === def.evolution.into) return true
  }
  return false
}

export function openLevelUp(s: GameState): void {
  const cands: UpgradeOption[] = []
  let evoFirst: UpgradeOption | null = null

  // evoluções elegíveis (a primeira SEMPRE ocupa o slot 0)
  for (let i = 0; i < s.weapons.length; i++) {
    const w = s.weapons[i]
    if (w.level < MAX_WEAPON_LEVEL) continue
    const def = weaponById(w.defId)
    if (!def.evolution || def.evolved) continue
    if (!hasPassive(s, def.evolution.requires)) continue
    const into = weaponById(def.evolution.into)
    const opt: UpgradeOption = {
      kind: 'evolution', id: def.id, name: into.name, emoji: into.emoji,
      desc: into.desc, isNew: false,
    }
    if (!evoFirst) evoFirst = opt
    else cands.push(opt)
  }

  // upgrades de armas equipadas — peso 2× (aprofundar > diversificar; é o
  // caminho das evoluções, senão o pool dilui demais no meio da run)
  for (let i = 0; i < s.weapons.length; i++) {
    const w = s.weapons[i]
    if (w.level >= MAX_WEAPON_LEVEL) continue
    const def = weaponById(w.defId)
    const opt: UpgradeOption = {
      kind: 'weapon', id: def.id, name: def.name, emoji: def.emoji,
      desc: deltaDesc(def, w.level), isNew: false,
    }
    cands.push(opt)
    cands.push(opt)
  }

  // upgrades de passivos equipados
  for (let i = 0; i < s.passives.length; i++) {
    const pv = s.passives[i]
    const def = passiveById(pv.defId)
    if (pv.level >= def.maxLevel) continue
    cands.push({
      kind: 'passive', id: def.id, name: def.name, emoji: def.emoji,
      desc: def.desc, isNew: false,
    })
  }

  // armas novas
  if (s.weapons.length < MAX_WEAPONS) {
    for (let i = 0; i < WEAPONS.length; i++) {
      const def = WEAPONS[i]
      if (def.evolved) continue
      if (weaponEquippedOrEvolved(s, def)) continue
      cands.push({
        kind: 'weapon', id: def.id, name: def.name, emoji: def.emoji,
        desc: def.desc, isNew: true,
      })
    }
  }

  // passivos novos
  if (s.passives.length < MAX_PASSIVES) {
    for (let i = 0; i < PASSIVES.length; i++) {
      const def = PASSIVES[i]
      if (hasPassive(s, def.id)) continue
      cands.push({
        kind: 'passive', id: def.id, name: def.name, emoji: def.emoji,
        desc: def.desc, isNew: true,
      })
    }
  }

  const choices: UpgradeOption[] = []
  if (evoFirst) choices.push(evoFirst)
  while (choices.length < 3 && cands.length > 0) {
    const i = s.rng.int(0, cands.length - 1)
    const c = cands[i]
    cands.splice(i, 1)
    // sem duplicatas na mesma tela (cands pode ter entradas com peso 2×)
    let dup = false
    for (let j = 0; j < choices.length; j++) {
      if (choices[j].kind === c.kind && choices[j].id === c.id) { dup = true; break }
    }
    if (!dup) choices.push(c)
  }
  if (choices.length === 0) {
    choices.push({ kind: 'heal', id: '', name: 'Caldinho', emoji: '🍲', desc: 'Recupera 30 de HP', isNew: false })
    choices.push({ kind: 'gold', id: '', name: 'Gorjeta', emoji: '💰', desc: '+25 de ouro', isNew: false })
  }

  s.upgradeChoices = choices
  s.mode = 'levelup'
  s.ui.sel = 0
  s.sounds.push('levelup')
}

export function applyUpgrade(s: GameState, opt: UpgradeOption): void {
  const p = s.player
  switch (opt.kind) {
    case 'weapon': {
      const i = findWeaponIdx(s, opt.id)
      if (i >= 0) {
        const w = s.weapons[i]
        if (w.level < MAX_WEAPON_LEVEL) w.level++
      } else if (s.weapons.length < MAX_WEAPONS) {
        s.weapons.push({ defId: opt.id, level: 1, cooldown: 0.5, volleyLeft: 0, volleyTimer: 0, side: 1 })
      }
      break
    }
    case 'passive': {
      let found = -1
      for (let i = 0; i < s.passives.length; i++) {
        if (s.passives[i].defId === opt.id) { found = i; break }
      }
      if (found >= 0) {
        const pv = s.passives[found]
        if (pv.level < passiveById(pv.defId).maxLevel) pv.level++
      } else if (s.passives.length < MAX_PASSIVES) {
        s.passives.push({ defId: opt.id, level: 1 })
      }
      break
    }
    case 'evolution': {
      const i = findWeaponIdx(s, opt.id)
      if (i >= 0) evolveWeapon(s, i)
      break
    }
    case 'gold': {
      const v = 25 * p.stats.greed
      p.gold += v
      s.goldEarned += v
      s.sounds.push('gold')
      break
    }
    case 'heal':
      p.hp = Math.min(p.stats.maxHp, p.hp + 30)
      s.sounds.push('heal')
      break
  }

  recalcStats(s)
  if (s.pendingLevelUps > 0) s.pendingLevelUps--
  s.sounds.push('click')
  if (s.pendingLevelUps > 0) {
    openLevelUp(s)
  } else {
    s.mode = 'playing'
    s.upgradeChoices = []
  }
}
