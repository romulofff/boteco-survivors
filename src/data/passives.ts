// Passivos — deltas ADITIVOS por nível sobre PlayerStats.
// maxHp e magnet são valores ABSOLUTOS (não multiplicadores): os deltas
// abaixo equivalem aos % do GDD sobre a base (maxHp 100, magnet 100).

import type { PassiveDef } from '../types'

export const PASSIVES: PassiveDef[] = [
  {
    id: 'coxinha',
    name: 'Coxinha',
    emoji: '🍗',
    desc: '+20% HP máximo por nível.',
    maxLevel: 5,
    stat: 'maxHp',
    perLevel: 20, // 20% de 100
  },
  {
    id: 'chinelo',
    name: 'Chinelo Veloz',
    emoji: '🩴',
    desc: '+8% velocidade por nível.',
    maxLevel: 5,
    stat: 'speed',
    perLevel: 0.08,
  },
  {
    id: 'caldinho',
    name: 'Caldinho de Feijão',
    emoji: '🍲',
    desc: '+0.4 HP/s de regeneração por nível.',
    maxLevel: 5,
    stat: 'regen',
    perLevel: 0.4,
  },
  {
    id: 'limao',
    name: 'Limão',
    emoji: '🍋',
    desc: '+10% dano por nível.',
    maxLevel: 5,
    stat: 'might',
    perLevel: 0.1,
  },
  {
    id: 'torresmo',
    name: 'Torresmo',
    emoji: '🥓',
    desc: '+12% área por nível.',
    maxLevel: 5,
    stat: 'area',
    perLevel: 0.12,
  },
  {
    id: 'gelo',
    name: 'Gelo',
    emoji: '🧊',
    desc: '−7% cooldown por nível.',
    maxLevel: 5,
    stat: 'cooldown',
    perLevel: -0.07,
  },
  {
    id: 'copo',
    name: 'Copo Americano',
    emoji: '🥛',
    desc: '+1 projétil por nível.',
    maxLevel: 2,
    stat: 'amount',
    perLevel: 1,
  },
  {
    id: 'ima',
    name: 'Imã de Geladeira',
    emoji: '🧲',
    desc: '+30% raio de coleta por nível.',
    maxLevel: 5,
    stat: 'magnet',
    perLevel: 30, // 30% de 100 px
  },
  {
    id: 'fiado',
    name: 'Cartão de Fiado',
    emoji: '💳',
    desc: '+15% ouro por nível.',
    maxLevel: 5,
    stat: 'greed',
    perLevel: 0.15,
  },
]

const byId: Record<string, PassiveDef> = {}
for (let i = 0; i < PASSIVES.length; i++) byId[PASSIVES[i].id] = PASSIVES[i]

export function passiveById(id: string): PassiveDef {
  const def = byId[id]
  if (!def) throw new Error(`Passivo desconhecido: "${id}"`)
  return def
}
