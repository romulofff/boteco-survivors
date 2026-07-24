// Pool denso pré-alocado com cursor circular. Sem alocação após a criação.

import type { Pool } from '../types'

export function makePool<T extends { active: boolean }>(n: number, factory: () => T): Pool<T> {
  const items: T[] = new Array<T>(n)
  for (let i = 0; i < n; i++) items[i] = factory()
  let cursor = 0

  function alloc(): T | null {
    for (let i = 0; i < n; i++) {
      let idx = cursor + i
      if (idx >= n) idx -= n
      const it = items[idx]
      if (!it.active) {
        it.active = true
        cursor = idx + 1 < n ? idx + 1 : 0
        return it
      }
    }
    return null
  }

  return {
    items,
    alloc,
    allocOverwrite(): T {
      const it = alloc()
      if (it) return it
      // cheio: sobrescreve o mais antigo (posição do cursor circular)
      const victim = items[cursor]
      cursor = cursor + 1 < n ? cursor + 1 : 0
      return victim
    },
    clear(): void {
      for (let i = 0; i < n; i++) items[i].active = false
      cursor = 0
    },
    count(): number {
      let c = 0
      for (let i = 0; i < n; i++) if (items[i].active) c++
      return c
    },
  }
}
