import { describe, expect, it } from 'vitest'
import { makePool } from '../src/core/pool'

interface Item {
  active: boolean
  tag: number
}

const factory = (): Item => ({ active: false, tag: 0 })

describe('makePool', () => {
  it('alloc até o cap, depois null', () => {
    const p = makePool(3, factory)
    const a = p.alloc()
    const b = p.alloc()
    const c = p.alloc()
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    expect(c).not.toBeNull()
    // objetos distintos, todos ativos
    expect(new Set([a, b, c]).size).toBe(3)
    expect(a!.active).toBe(true)
    expect(p.count()).toBe(3)
    expect(p.alloc()).toBeNull()
  })

  it('desativar (active=false) libera o slot', () => {
    const p = makePool(2, factory)
    const a = p.alloc()!
    p.alloc()
    expect(p.alloc()).toBeNull()
    a.active = false
    expect(p.count()).toBe(1)
    const c = p.alloc()
    expect(c).not.toBeNull()
    expect(p.count()).toBe(2)
    expect(p.alloc()).toBeNull()
  })

  it('allocOverwrite sobrescreve o mais antigo quando cheio', () => {
    const p = makePool(3, factory)
    const a = p.alloc()!
    const b = p.alloc()!
    const c = p.alloc()!
    a.tag = 1
    b.tag = 2
    c.tag = 3
    const o = p.allocOverwrite()
    expect(o.active).toBe(true)
    expect(o.tag).toBe(1) // devolveu o mais antigo (a)
    expect(p.count()).toBe(3)
  })

  it('allocOverwrite com espaço livre age como alloc', () => {
    const p = makePool(3, factory)
    const o = p.allocOverwrite()
    expect(o.active).toBe(true)
    expect(p.count()).toBe(1)
  })

  it('clear desativa tudo e permite realocar', () => {
    const p = makePool(4, factory)
    p.alloc()
    p.alloc()
    p.alloc()
    p.clear()
    expect(p.count()).toBe(0)
    for (let i = 0; i < p.items.length; i++) {
      expect(p.items[i].active).toBe(false)
    }
    expect(p.alloc()).not.toBeNull()
    expect(p.count()).toBe(1)
  })

  it('count reflete apenas os ativos', () => {
    const p = makePool(5, factory)
    expect(p.count()).toBe(0)
    const a = p.alloc()!
    p.alloc()
    expect(p.count()).toBe(2)
    a.active = false
    expect(p.count()).toBe(1)
  })

  it('items tem exatamente n entradas pré-alocadas', () => {
    const p = makePool(7, factory)
    expect(p.items.length).toBe(7)
  })
})
