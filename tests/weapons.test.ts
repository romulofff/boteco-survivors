import { describe, expect, it } from 'vitest'
import { makeGameState, startRun } from '../src/game/state'
import { effectiveStats, recalcStats } from '../src/game/weaponsSys'
import { defaultSave } from '../src/save/storage'
import type { GameState } from '../src/types'

// garcom: bônus só em speed de movimento — não afeta damage/cooldown/area da arma.
function freshRun(): GameState {
  const s = makeGameState(1)
  startRun(s, 'garcom', defaultSave())
  return s
}

// effectiveStats pode reutilizar um objeto interno (hot path):
// sempre copiamos os campos ANTES de chamar de novo.
describe('effectiveStats', () => {
  it('aplica might do player no dano (limão +10%)', () => {
    const s = freshRun()
    const w = s.weapons[0]
    const baseDamage = effectiveStats(s, w).damage
    s.passives.push({ defId: 'limao', level: 1 })
    recalcStats(s)
    expect(effectiveStats(s, w).damage).toBeCloseTo(baseDamage * 1.1, 5)
  })

  it('aplica cooldown do player (gelo -7%)', () => {
    const s = freshRun()
    const w = s.weapons[0]
    const baseCooldown = effectiveStats(s, w).cooldown
    s.passives.push({ defId: 'gelo', level: 1 })
    recalcStats(s)
    expect(effectiveStats(s, w).cooldown).toBeCloseTo(baseCooldown * 0.93, 5)
  })

  it('aplica area do player (torresmo +12%)', () => {
    const s = freshRun()
    const w = s.weapons[0]
    const baseArea = effectiveStats(s, w).area
    s.passives.push({ defId: 'torresmo', level: 1 })
    recalcStats(s)
    expect(effectiveStats(s, w).area).toBeCloseTo(baseArea * 1.12, 5)
  })

  it('amount do player soma projéteis (copo +1)', () => {
    const s = freshRun()
    const w = s.weapons[0]
    const baseAmount = effectiveStats(s, w).amount
    s.passives.push({ defId: 'copo', level: 1 })
    recalcStats(s)
    expect(effectiveStats(s, w).amount).toBe(baseAmount + 1)
  })

  it('nível 2 da arma altera pelo menos um stat', () => {
    const s = freshRun()
    const w = s.weapons[0]
    const a = effectiveStats(s, w)
    const l1 = {
      damage: a.damage,
      cooldown: a.cooldown,
      amount: a.amount,
      area: a.area,
      speed: a.speed,
      duration: a.duration,
      pierce: a.pierce,
      knockback: a.knockback,
    }
    w.level = 2
    const l2 = effectiveStats(s, w)
    const changed =
      l2.damage !== l1.damage ||
      l2.cooldown !== l1.cooldown ||
      l2.amount !== l1.amount ||
      l2.area !== l1.area ||
      l2.speed !== l1.speed ||
      l2.duration !== l1.duration ||
      l2.pierce !== l1.pierce ||
      l2.knockback !== l1.knockback
    expect(changed).toBe(true)
  })

  it('passivo nível 2 dobra o delta (limão +20%)', () => {
    const s = freshRun()
    const w = s.weapons[0]
    const baseDamage = effectiveStats(s, w).damage
    s.passives.push({ defId: 'limao', level: 2 })
    recalcStats(s)
    expect(effectiveStats(s, w).damage).toBeCloseTo(baseDamage * 1.2, 5)
  })
})
