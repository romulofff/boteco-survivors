// Meta-progressão "A Caderneta" — upgrades permanentes comprados com ouro.
// Calibração: nível 1 ≈ 40–60; uma VITÓRIA (~350–800 de ouro) financia 3–5
// níveis; uma morte mediana (~100–350) financia 1–3.
// maxHp/magnet/regen são deltas ABSOLUTOS (equivalem aos % do GDD sobre a base).

import type { MetaUpgradeDef } from '../types'

/** custo(n) = base × 1.9^(n−1), arredondado */
function costCurve(base: number): (level: number) => number {
  return (level: number) => Math.round(base * Math.pow(1.9, level - 1))
}

export const META_UPGRADES: MetaUpgradeDef[] = [
  {
    id: 'm_forca',
    name: 'Tempero da Casa',
    emoji: '🌶️',
    desc: '+5% dano por nível.',
    maxLevel: 5,
    stat: 'might',
    perLevel: 0.05,
    cost: costCurve(60),
  },
  {
    id: 'm_hp',
    name: 'Feijoada Completa',
    emoji: '🍛',
    desc: '+10% HP máximo por nível.',
    maxLevel: 5,
    stat: 'maxHp',
    perLevel: 10, // 10% de 100
    cost: costCurve(55),
  },
  {
    id: 'm_veloc',
    name: 'Havaianas Novas',
    emoji: '🩴',
    desc: '+4% velocidade por nível.',
    maxLevel: 3,
    stat: 'speed',
    perLevel: 0.04,
    cost: costCurve(45),
  },
  {
    id: 'm_ima',
    name: 'Imã Industrial',
    emoji: '🧲',
    desc: '+15% raio de coleta por nível.',
    maxLevel: 3,
    stat: 'magnet',
    perLevel: 15, // 15% de 100 px
    cost: costCurve(40),
  },
  {
    id: 'm_sorte',
    name: 'Patuá',
    emoji: '🍀',
    desc: '+8% ouro por nível.',
    maxLevel: 3,
    stat: 'greed',
    perLevel: 0.08,
    cost: costCurve(50),
  },
  {
    id: 'm_regen',
    name: 'Água de Coco',
    emoji: '🥥',
    desc: '+0.2 HP/s de regeneração por nível.',
    maxLevel: 3,
    stat: 'regen',
    perLevel: 0.2,
    cost: costCurve(45),
  },
]

const byId: Record<string, MetaUpgradeDef> = {}
for (let i = 0; i < META_UPGRADES.length; i++) byId[META_UPGRADES[i].id] = META_UPGRADES[i]

export function metaById(id: string): MetaUpgradeDef {
  const def = byId[id]
  if (!def) throw new Error(`Meta-upgrade desconhecido: "${id}"`)
  return def
}
