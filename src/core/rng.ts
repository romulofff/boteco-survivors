// RNG determinístico (mulberry32). Toda aleatoriedade de gameplay passa por aqui.

import type { RNG } from '../types'

export function makeRNG(seed: number): RNG {
  let s = seed >>> 0

  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    range(min: number, max: number): number {
      return min + next() * (max - min)
    },
    int(min: number, max: number): number {
      return min + Math.floor(next() * (max - min + 1))
    },
    pick<T>(arr: readonly T[]): T {
      return arr[Math.floor(next() * arr.length)]
    },
    chance(p: number): boolean {
      return next() < p
    },
  }
}
