// Timeline da run (0..1200s). WAVES contíguas e ordenadas por `from`
// (from de uma = to da anterior); a última estende além de WIN_TIME
// por segurança de borda. EVENTS ordenados por `at`.

import type { WaveDef, EventDef } from '../types'

export const WAVES: WaveDef[] = [
  { from: 0, to: 60, enemies: ['mosca'], interval: 1.0, batch: 2, minCount: 20 },
  { from: 60, to: 120, enemies: ['mosca', 'barata'], interval: 1.0, batch: 2, minCount: 22 },
  { from: 120, to: 180, enemies: ['barata', 'mosca', 'rato'], interval: 0.9, batch: 3, minCount: 30 },
  { from: 180, to: 240, enemies: ['barata', 'rato'], interval: 0.85, batch: 3, minCount: 38 },
  { from: 240, to: 300, enemies: ['rato', 'bebado', 'barata'], interval: 0.8, batch: 3, minCount: 45 },
  { from: 300, to: 390, enemies: ['bebado', 'pombo', 'rato'], interval: 0.75, batch: 3, minCount: 55 },
  { from: 390, to: 480, enemies: ['pombo', 'bebado', 'torcedor'], interval: 0.7, batch: 4, minCount: 65 },
  { from: 480, to: 570, enemies: ['torcedor', 'pombo', 'cunhado'], interval: 0.7, batch: 4, minCount: 70 },
  { from: 570, to: 660, enemies: ['cunhado', 'torcedor', 'bebado'], interval: 0.65, batch: 4, minCount: 78 },
  { from: 660, to: 750, enemies: ['cunhado', 'urubu', 'torcedor'], interval: 0.6, batch: 4, minCount: 85 },
  { from: 750, to: 840, enemies: ['urubu', 'cunhado', 'seguranca'], interval: 0.55, batch: 4, minCount: 95 },
  { from: 840, to: 930, enemies: ['seguranca', 'urubu', 'cunhado'], interval: 0.55, batch: 4, minCount: 105 },
  { from: 930, to: 1020, enemies: ['seguranca', 'barata_voadora', 'urubu'], interval: 0.5, batch: 4, minCount: 115 },
  { from: 1020, to: 1110, enemies: ['barata_voadora', 'seguranca', 'urubu'], interval: 0.4, batch: 5, minCount: 140 },
  { from: 1110, to: 1260, enemies: ['barata_voadora', 'seguranca', 'urubu', 'torcedor'], interval: 0.35, batch: 5, minCount: 160 },
]

export const EVENTS: EventDef[] = [
  { at: 240, kind: 'ring', enemy: 'pombo', count: 24 },
  { at: 300, kind: 'boss', enemy: 'boss_fiscal', bossName: 'Fiscal da Prefeitura', bossHp: 1100 },
  { at: 420, kind: 'burst', enemy: 'rato', count: 16 },
  { at: 480, kind: 'ring', enemy: 'torcedor', count: 15 },
  { at: 600, kind: 'boss', enemy: 'boss_cobrador', bossName: 'Cobrador do Fiado', bossHp: 3400 },
  { at: 690, kind: 'ring', enemy: 'urubu', count: 16 },
  { at: 780, kind: 'burst', enemy: 'urubu', count: 18 },
  { at: 840, kind: 'ring', enemy: 'seguranca', count: 12 },
  { at: 900, kind: 'boss', enemy: 'boss_seguranca', bossName: 'Segurança-Chefe', bossHp: 9000 },
  { at: 975, kind: 'ring', enemy: 'barata_voadora', count: 18 },
  { at: 1050, kind: 'ring', enemy: 'barata_voadora', count: 22 },
  { at: 1080, kind: 'burst', enemy: 'seguranca', count: 16 },
  { at: 1140, kind: 'boss', enemy: 'boss_sogra', bossName: 'A Sogra', bossHp: 22000 },
  { at: 1170, kind: 'ring', enemy: 'barata_voadora', count: 12 },
]
