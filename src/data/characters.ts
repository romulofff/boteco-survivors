// Personagens jogáveis — bônus são deltas ADITIVOS sobre BASE_STATS.

import type { CharacterDef } from '../types'

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'garcom',
    name: 'Zé Garçom',
    emoji: '🤵',
    desc: 'Ligeiro entre as mesas. +10% velocidade de movimento.',
    startWeapon: 'bandeja',
    bonuses: { speed: 0.1 },
  },
  {
    id: 'cozinheira',
    name: 'Dona Cida',
    emoji: '👩‍🍳',
    desc: 'Mão pesada no tempero. +20% área de efeito.',
    startWeapon: 'molotov',
    bonuses: { area: 0.2 },
  },
  {
    id: 'dono',
    name: 'Seu Otávio',
    emoji: '🧓',
    desc: 'De olho no caixa. +30% ouro, −10% dano.',
    startWeapon: 'tampinha',
    bonuses: { greed: 0.3, might: -0.1 },
  },
]
