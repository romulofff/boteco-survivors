import { describe, expect, it } from 'vitest'
import { SpatialHash } from '../src/core/spatial'
import { makeRNG } from '../src/core/rng'

// query pode devolver candidatos EXTRAS (o chamador filtra),
// mas NUNCA pode omitir um ponto dentro do raio.
describe('SpatialHash', () => {
  it('query nunca omite ponto dentro do raio (vs busca bruta)', () => {
    const seeds = [1, 2, 3]
    for (const seed of seeds) {
      const rng = makeRNG(seed)
      const hash = new SpatialHash(64)
      const xs: number[] = []
      const ys: number[] = []
      for (let i = 0; i < 200; i++) {
        const x = rng.range(-1200, 1200)
        const y = rng.range(-1200, 1200)
        xs.push(x)
        ys.push(y)
        hash.insert(i, x, y)
      }
      for (let q = 0; q < 30; q++) {
        const qx = rng.range(-1200, 1200)
        const qy = rng.range(-1200, 1200)
        const radius = rng.range(20, 320)
        const got = new Set(hash.query(qx, qy, radius, []))
        for (let i = 0; i < 200; i++) {
          const dx = xs[i] - qx
          const dy = ys[i] - qy
          if (dx * dx + dy * dy <= radius * radius) {
            expect(got.has(i), `seed ${seed} query ${q}: omitiu ponto ${i}`).toBe(true)
          }
        }
      }
    }
  })

  it('clear esvazia o hash', () => {
    const hash = new SpatialHash(64)
    hash.insert(0, 10, 10)
    hash.insert(1, -30, 40)
    hash.clear()
    const res = hash.query(0, 0, 500, [])
    expect(res.length).toBe(0)
  })

  it('reinserir depois de clear funciona', () => {
    const hash = new SpatialHash(64)
    hash.insert(0, 999, 999)
    hash.clear()
    hash.insert(1, 5, 5)
    const res = hash.query(0, 0, 50, [])
    expect(res).toContain(1)
    expect(res).not.toContain(0)
  })

  it('pontos coincidentes com o centro da query são encontrados', () => {
    const hash = new SpatialHash(64)
    hash.insert(3, 100, 100)
    const res = hash.query(100, 100, 10, [])
    expect(res).toContain(3)
  })
})
