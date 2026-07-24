import { describe, expect, it } from 'vitest'
import { gainXP, xpForLevel } from '../src/game/leveling'
import { makeGameState, startRun } from '../src/game/state'
import { defaultSave } from '../src/save/storage'

describe('leveling', () => {
  it('xpForLevel é monotônica crescente', () => {
    let prev = xpForLevel(1)
    expect(prev).toBeGreaterThan(0)
    for (let l = 2; l <= 60; l++) {
      const v = xpForLevel(l)
      expect(v, `nível ${l}`).toBeGreaterThan(prev)
      prev = v
    }
  })

  it('gainXP pequeno acumula xp sem subir de nível', () => {
    const s = makeGameState(1)
    startRun(s, 'garcom', defaultSave())
    const level0 = s.player.level
    gainXP(s, 1)
    expect(s.player.level).toBe(level0)
    expect(s.pendingLevelUps).toBe(0)
    expect(s.player.xp).toBeGreaterThan(0)
  })

  it('gainXP acumula múltiplos level-ups de uma vez (pendingLevelUps)', () => {
    const s = makeGameState(2)
    startRun(s, 'garcom', defaultSave())
    const l0 = s.player.level
    // soma generosa de 4 patamares consecutivos: cobre >= 3 level-ups em
    // qualquer convenção de xpForLevel (limiar do nível atual vs do próximo)
    const total =
      xpForLevel(l0) + xpForLevel(l0 + 1) + xpForLevel(l0 + 2) + xpForLevel(l0 + 3)
    gainXP(s, total - s.player.xp)
    expect(s.pendingLevelUps).toBeGreaterThanOrEqual(3)
  })

  it('gainXP em duas doses também cascateia', () => {
    const s = makeGameState(3)
    startRun(s, 'garcom', defaultSave())
    const l0 = s.player.level
    gainXP(s, xpForLevel(l0) + xpForLevel(l0 + 1)) // garante >= 1 level-up
    expect(s.pendingLevelUps).toBeGreaterThanOrEqual(1)
  })
})
