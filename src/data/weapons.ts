// Armas: 8 base + 8 evoluídas. perLevel = 7 deltas ADITIVOS (níveis 2..8).
// Evoluídas: poder ~2.2× a base no nível 8; perLevel vazio (não sobem de nível).

import type { WeaponDef, WeaponStats } from '../types'

/** 7 entradas vazias para armas evoluídas (nunca sobem de nível) */
function emptyLevels(): Partial<WeaponStats>[] {
  return [{}, {}, {}, {}, {}, {}, {}]
}

export const WEAPONS: WeaponDef[] = [
  // ---------- base ----------
  {
    id: 'tampinha',
    name: 'Tampinha Voadora',
    emoji: '🍾',
    desc: 'Peteleco certeiro no inimigo mais próximo.',
    behavior: 'nearest',
    base: { damage: 10, cooldown: 1.1, amount: 1, speed: 380, area: 9, duration: 2, pierce: 1, knockback: 10 },
    perLevel: [
      { damage: 3 },
      { amount: 1 },
      { damage: 4, cooldown: -0.1 },
      { damage: 4 },
      { amount: 1 },
      { damage: 5, cooldown: -0.1 },
      { damage: 6 },
    ],
    evolution: { requires: 'ima', into: 'metralha' },
  },
  {
    id: 'pano',
    name: 'Pano de Prato',
    emoji: '🧻',
    desc: 'Chicotada instantânea, alternando os lados.',
    behavior: 'whip',
    base: { damage: 15, cooldown: 1.3, amount: 1, speed: 0, area: 70, duration: 0.18, pierce: 999, knockback: 18 },
    perLevel: [
      { damage: 5, area: 10 },
      { area: 12 },
      { amount: 1 }, // golpe dos dois lados
      { damage: 6, area: 12 },
      { area: 14 },
      { damage: 7, cooldown: -0.15 },
      { damage: 8, area: 16 },
    ],
    evolution: { requires: 'torresmo', into: 'toalha' },
  },
  {
    id: 'espeto',
    name: 'Espeto de Churrasco',
    emoji: '🍢',
    desc: 'Dispara na direção do movimento, perfurando.',
    behavior: 'directional',
    base: { damage: 8, cooldown: 0.9, amount: 1, speed: 450, area: 8, duration: 1.6, pierce: 2, knockback: 6 },
    perLevel: [
      { damage: 2 },
      { amount: 1 },
      { damage: 3, pierce: 1 },
      { amount: 1 },
      { damage: 3, pierce: 1 },
      { amount: 1 },
      { damage: 4, pierce: 2 },
    ],
    evolution: { requires: 'limao', into: 'espetao' },
  },
  {
    id: 'garrafa',
    name: 'Garrafa Arremessada',
    emoji: '🍾',
    desc: 'Arco até um inimigo aleatório; explode em área.',
    behavior: 'lob',
    base: { damage: 20, cooldown: 2.4, amount: 1, speed: 300, area: 55, duration: 0.9, pierce: 999, knockback: 14 },
    perLevel: [
      { damage: 6, area: 5 },
      { amount: 1 },
      { damage: 8, area: 6 },
      { area: 8, cooldown: -0.2 },
      { amount: 1 },
      { damage: 10, area: 8 },
      { damage: 12, area: 10 },
    ],
    evolution: { requires: 'copo', into: 'chuva' },
  },
  {
    id: 'bandeja',
    name: 'Bandeja Bumerangue',
    emoji: '🥏',
    desc: 'Vai e volta, atropelando tudo no caminho.',
    behavior: 'boomerang',
    base: { damage: 12, cooldown: 2.0, amount: 1, speed: 350, area: 16, duration: 1.8, pierce: 999, knockback: 12 },
    perLevel: [
      { damage: 4 },
      { amount: 1, speed: 30 },
      { damage: 5 },
      { damage: 5, speed: 40 },
      { amount: 1 },
      { damage: 6, speed: 40 },
      { damage: 7, amount: 1 },
    ],
    evolution: { requires: 'chinelo', into: 'bandejaco' },
  },
  {
    id: 'bafo',
    name: 'Bafo de Cachaça',
    emoji: '🌬️',
    desc: 'Aura etílica que corrói quem chega perto.',
    behavior: 'aura',
    base: { damage: 5, cooldown: 0, amount: 1, speed: 0, area: 85, duration: 0.4, pierce: 999, knockback: 6 },
    perLevel: [
      { damage: 1, area: 8 },
      { area: 10 },
      { damage: 2 },
      { area: 10 },
      { damage: 2, area: 12 },
      { damage: 2 },
      { damage: 3, area: 14 },
    ],
    evolution: { requires: 'caldinho', into: 'halito' },
  },
  {
    id: 'copos',
    name: 'Copos Giratórios',
    emoji: '🥃',
    desc: 'Copos orbitando o jogador em alta rotação.',
    behavior: 'orbit',
    base: { damage: 9, cooldown: 2.8, amount: 2, speed: 140, area: 12, duration: 2.2, pierce: 999, knockback: 10 },
    perLevel: [
      { damage: 3 },
      { amount: 1 },
      { damage: 3, duration: 0.4 },
      { amount: 1 },
      { damage: 4, duration: 0.4 },
      { amount: 1, speed: 20 },
      { damage: 5, duration: 0.5 },
    ],
    evolution: { requires: 'gelo', into: 'rodada' },
  },
  {
    id: 'molotov',
    name: 'Cachaça Flamejante',
    emoji: '🔥',
    desc: 'Arremesso que deixa poça de fogo no chão.',
    behavior: 'zone',
    base: { damage: 7, cooldown: 2.6, amount: 1, speed: 320, area: 60, duration: 2.5, pierce: 999, knockback: 0 },
    perLevel: [
      { damage: 2, area: 6 },
      { duration: 0.4 },
      { damage: 2, area: 8 },
      { damage: 2, duration: 0.5 },
      { amount: 1 },
      { area: 10, duration: 0.5 },
      { damage: 3, area: 10 },
    ],
    evolution: { requires: 'coxinha', into: 'fogueira' },
  },

  // ---------- evoluídas ----------
  {
    id: 'metralha',
    name: 'Metralha de Tampinhas',
    emoji: '🔫',
    desc: 'Rajada incessante de tampinhas.',
    behavior: 'nearest',
    base: { damage: 14, cooldown: 0.12, amount: 2, speed: 480, area: 9, duration: 2, pierce: 2, knockback: 6 },
    perLevel: emptyLevels(),
    evolved: true,
  },
  {
    id: 'toalha',
    name: 'Toalha do Freguês',
    emoji: '🏳️',
    desc: 'Toalhada gigante dos dois lados.',
    behavior: 'whip',
    base: { damage: 85, cooldown: 1.1, amount: 2, speed: 0, area: 210, duration: 0.22, pierce: 999, knockback: 30 },
    perLevel: emptyLevels(),
    evolved: true,
  },
  {
    id: 'espetao',
    name: 'Espetão do Chefe',
    emoji: '🔱',
    desc: 'Leque de espetões perfurantes.',
    behavior: 'directional',
    base: { damage: 28, cooldown: 0.85, amount: 6, speed: 520, area: 10, duration: 1.6, pierce: 10, knockback: 8 },
    perLevel: emptyLevels(),
    evolved: true,
  },
  {
    id: 'chuva',
    name: 'Chuva de Garrafas',
    emoji: '🌧️',
    desc: 'Bombardeio de garrafas explosivas.',
    behavior: 'lob',
    base: { damage: 120, cooldown: 2.2, amount: 3, speed: 320, area: 110, duration: 0.9, pierce: 999, knockback: 18 },
    perLevel: emptyLevels(),
    evolved: true,
  },
  {
    id: 'bandejaco',
    name: 'Bandejaço',
    emoji: '🛸',
    desc: 'Duas bandejas enormes em alta velocidade.',
    behavior: 'boomerang',
    base: { damage: 140, cooldown: 1.6, amount: 2, speed: 520, area: 26, duration: 2.2, pierce: 999, knockback: 24 },
    perLevel: emptyLevels(),
    evolved: true,
  },
  {
    id: 'halito',
    name: 'Hálito de Dragão',
    emoji: '🐉',
    desc: 'Aura enorme que derrete e empurra.',
    behavior: 'aura',
    base: { damage: 33, cooldown: 0, amount: 1, speed: 0, area: 230, duration: 0.4, pierce: 999, knockback: 30 },
    perLevel: emptyLevels(),
    evolved: true,
  },
  {
    id: 'rodada',
    name: 'Rodada da Casa',
    emoji: '🥂',
    desc: 'Seis copos girando sem parar.',
    behavior: 'orbit',
    base: { damage: 53, cooldown: 0.5, amount: 6, speed: 170, area: 14, duration: 999, pierce: 999, knockback: 14 },
    perLevel: emptyLevels(),
    evolved: true,
  },
  {
    id: 'fogueira',
    name: 'Fogueira de São João',
    emoji: '🎇',
    desc: 'Poças de fogo enormes e duradouras.',
    behavior: 'zone',
    base: { damage: 35, cooldown: 2.4, amount: 2, speed: 320, area: 130, duration: 6, pierce: 999, knockback: 0 },
    perLevel: emptyLevels(),
    evolved: true,
  },
]

const byId: Record<string, WeaponDef> = {}
for (let i = 0; i < WEAPONS.length; i++) byId[WEAPONS[i].id] = WEAPONS[i]

export function weaponById(id: string): WeaponDef {
  const def = byId[id]
  if (!def) throw new Error(`Arma desconhecida: "${id}"`)
  return def
}
