// Inimigos: 10 regulares + 4 defs de chefe (usados só via EVENTS de waves.ts;
// hp do chefe é sobrescrito por bossHp no spawner).
// Referência: velocidade do player = 150 px/s.

import type { EnemyDef } from '../types'

export const ENEMIES: EnemyDef[] = [
  { id: 'mosca', name: 'Mosca', emoji: '🪰', hp: 3, speed: 45, damage: 4, radius: 10, xp: 1, behavior: 'chase' },
  { id: 'barata', name: 'Barata', emoji: '🪳', hp: 8, speed: 50, damage: 6, radius: 11, xp: 1, behavior: 'chase' },
  { id: 'rato', name: 'Rato', emoji: '🐀', hp: 14, speed: 85, damage: 8, radius: 11, xp: 2, behavior: 'dart' },
  { id: 'bebado', name: 'Bêbado', emoji: '🍺', hp: 40, speed: 32, damage: 12, radius: 16, xp: 3, behavior: 'drunk' },
  { id: 'pombo', name: 'Pombo', emoji: '🐦', hp: 18, speed: 75, damage: 8, radius: 12, xp: 2, behavior: 'swoop' },
  { id: 'torcedor', name: 'Torcedor Nervoso', emoji: '😡', hp: 30, speed: 70, damage: 12, radius: 13, xp: 4, behavior: 'chase' },
  { id: 'cunhado', name: 'Cunhado', emoji: '🗣️', hp: 55, speed: 55, damage: 14, radius: 14, xp: 5, behavior: 'chase' },
  { id: 'urubu', name: 'Urubu', emoji: '🦅', hp: 45, speed: 90, damage: 14, radius: 13, xp: 6, behavior: 'swoop' },
  { id: 'seguranca', name: 'Segurança', emoji: '💪', hp: 150, speed: 45, damage: 18, radius: 18, xp: 10, behavior: 'chase' },
  { id: 'barata_voadora', name: 'Barata Voadora', emoji: '🦟', hp: 90, speed: 95, damage: 16, radius: 12, xp: 8, behavior: 'dart' },
  // ---------- chefes (spawnados por EVENTS; nunca em WAVES) ----------
  { id: 'boss_fiscal', name: 'Fiscal da Prefeitura', emoji: '📋', hp: 900, speed: 60, damage: 20, radius: 26, xp: 50, behavior: 'chase' },
  { id: 'boss_cobrador', name: 'Cobrador do Fiado', emoji: '🧾', hp: 2600, speed: 95, damage: 24, radius: 26, xp: 80, behavior: 'chase' },
  { id: 'boss_seguranca', name: 'Segurança-Chefe', emoji: '🦍', hp: 6500, speed: 40, damage: 32, radius: 34, xp: 120, behavior: 'chase' },
  { id: 'boss_sogra', name: 'A Sogra', emoji: '👵', hp: 16000, speed: 105, damage: 40, radius: 30, xp: 200, behavior: 'chase' },
]

const indexById: Record<string, number> = {}
for (let i = 0; i < ENEMIES.length; i++) indexById[ENEMIES[i].id] = i

export function enemyIndexById(id: string): number {
  const idx = indexById[id]
  if (idx === undefined) throw new Error(`Inimigo desconhecido: "${id}"`)
  return idx
}
