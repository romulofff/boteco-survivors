// Persistência do save (localStorage, chave 'boteco-survivors-v1').
// Funciona em Node sem localStorage: fallback silencioso.

import type { SaveData } from '../types'

const KEY = 'boteco-survivors-v1'

export function defaultSave(): SaveData {
  return { gold: 0, bestKills: 0, bestTime: 0, wins: 0, runs: 0, meta: {} }
}

export function loadSave(): SaveData {
  const d = defaultSave()
  try {
    if (typeof localStorage === 'undefined') return d
    const raw = localStorage.getItem(KEY)
    if (!raw) return d
    const p = JSON.parse(raw) as Partial<SaveData>
    // merge campo a campo: save antigo/corrompido não quebra
    if (typeof p.gold === 'number') d.gold = p.gold
    if (typeof p.bestKills === 'number') d.bestKills = p.bestKills
    if (typeof p.bestTime === 'number') d.bestTime = p.bestTime
    if (typeof p.wins === 'number') d.wins = p.wins
    if (typeof p.runs === 'number') d.runs = p.runs
    if (p.meta && typeof p.meta === 'object') {
      const meta = p.meta as Record<string, unknown>
      for (const k in meta) {
        const v = meta[k]
        if (typeof v === 'number') d.meta[k] = v
      }
    }
  } catch {
    // JSON inválido ou storage indisponível: usa default
  }
  return d
}

export function persistSave(s: SaveData): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // quota/modo privado/Node: ignora
  }
}
