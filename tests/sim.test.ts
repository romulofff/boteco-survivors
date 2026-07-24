import { describe, expect, it } from 'vitest'
import { runHeadless } from '../src/sim/headless'

// Asserções FROUXAS de propósito: sanidade, não balanceamento.
describe('sim headless', () => {
  it(
    'garcom sobrevive um começo de run decente (seed 42, 20min)',
    () => {
      const r = runHeadless({ seed: 42, charId: 'garcom', maxMinutes: 20 })
      expect(['dead', 'win', 'timeout']).toContain(r.result)
      expect(r.survivedSec).toBeGreaterThan(120)
      expect(r.level).toBeGreaterThanOrEqual(4)
      expect(r.kills).toBeGreaterThanOrEqual(30)
      expect(r.minutes.length).toBeGreaterThanOrEqual(2)
      // snapshots coerentes
      for (let i = 0; i < r.minutes.length; i++) {
        expect(r.minutes[i].minute).toBe(i + 1)
        expect(r.minutes[i].weapons.length).toBeGreaterThan(0)
      }
    },
    240_000,
  )

  it(
    'cozinheira roda sem lançar (seed 7, 8min)',
    () => {
      expect(() => runHeadless({ seed: 7, charId: 'cozinheira', maxMinutes: 8 })).not.toThrow()
    },
    240_000,
  )
})
