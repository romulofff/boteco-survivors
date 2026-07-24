import { describe, expect, it } from 'vitest'
import { makeRNG } from '../src/core/rng'

describe('makeRNG', () => {
  it('mesma seed produz a mesma sequência', () => {
    const a = makeRNG(12345)
    const b = makeRNG(12345)
    for (let i = 0; i < 200; i++) {
      expect(a.next()).toBe(b.next())
    }
  })

  it('seeds diferentes divergem', () => {
    const a = makeRNG(1)
    const b = makeRNG(2)
    let diff = false
    for (let i = 0; i < 20; i++) {
      if (a.next() !== b.next()) diff = true
    }
    expect(diff).toBe(true)
  })

  it('next fica em [0,1)', () => {
    const r = makeRNG(7)
    for (let i = 0; i < 1000; i++) {
      const v = r.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('range fica dentro dos limites', () => {
    const r = makeRNG(9)
    for (let i = 0; i < 1000; i++) {
      const v = r.range(-5, 12)
      expect(v).toBeGreaterThanOrEqual(-5)
      expect(v).toBeLessThanOrEqual(12)
    }
  })

  it('int é inteiro e inclusivo nas duas pontas', () => {
    const r = makeRNG(11)
    const seen = new Set<number>()
    for (let i = 0; i < 2000; i++) {
      const v = r.int(2, 5)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(2)
      expect(v).toBeLessThanOrEqual(5)
      seen.add(v)
    }
    // com 2000 sorteios, todos os valores 2..5 devem aparecer
    expect(seen.size).toBe(4)
  })

  it('pick devolve elemento do array e é determinístico por seed', () => {
    const arr = ['a', 'b', 'c', 'd']
    const r1 = makeRNG(13)
    const r2 = makeRNG(13)
    for (let i = 0; i < 100; i++) {
      const v = r1.pick(arr)
      expect(arr).toContain(v)
      expect(r2.pick(arr)).toBe(v)
    }
  })

  it('chance tem distribuição grosseiramente correta', () => {
    const r = makeRNG(17)
    const n = 20000
    let hits = 0
    for (let i = 0; i < n; i++) {
      if (r.chance(0.3)) hits++
    }
    const p = hits / n
    expect(p).toBeGreaterThan(0.27)
    expect(p).toBeLessThan(0.33)
  })
})
