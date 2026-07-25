// Spawner: ondas contínuas, mínimo de pressão, elites periódicos e eventos.
import type { Enemy, EventDef, GameState, WaveDef } from '../types'
import {
  CAP_ENEMIES, ELITE_HP_MULT, ELITE_INTERVAL, ELITE_SIZE_MULT, SPAWN_MARGIN,
  SPAWN_SOFT_CAP, VIEW_H, VIEW_W, enemyHpScale,
} from '../constants'
import { ENEMIES, enemyIndexById } from '../data/enemies'
import { EVENTS, WAVES } from '../data/waves'

const TAU = Math.PI * 2
/** anel de spawn fora da tela, centrado no player */
export const SPAWN_RADIUS = Math.hypot(VIEW_W, VIEW_H) / 2 + SPAWN_MARGIN

function currentWave(time: number): WaveDef {
  let w = WAVES[0]
  for (let i = 0; i < WAVES.length; i++) {
    if (time >= WAVES[i].from) w = WAVES[i]
    else break
  }
  return w
}

function spawnAt(s: GameState, defIdx: number, x: number, y: number): Enemy | null {
  const e = s.enemies.alloc()
  if (!e) return null // pool cheio: ignora silenciosamente
  const def = ENEMIES[defIdx]
  e.active = true
  e.defIndex = defIdx
  e.x = x
  e.y = y
  const hp = def.hp * enemyHpScale(s.time)
  e.hp = hp
  e.maxHp = hp
  e.speed = def.speed
  e.radius = def.radius
  e.damage = def.damage
  e.xp = def.xp
  e.hitFlash = 0
  e.kbx = 0
  e.kby = 0
  e.elite = false
  e.boss = false
  e.bossName = ''
  e.phase = 0
  e.t = s.rng.next() * 0.9 // dessincroniza ciclos de behavior
  return e
}

function spawnWaveEnemy(s: GameState, wave: WaveDef): void {
  const a = s.rng.next() * TAU
  const idx = enemyIndexById(s.rng.pick(wave.enemies))
  spawnAt(s, idx, s.player.x + Math.cos(a) * SPAWN_RADIUS, s.player.y + Math.sin(a) * SPAWN_RADIUS)
}

function spawnElite(s: GameState, wave: WaveDef): void {
  // inimigo mais forte (maior HP base) da onda corrente
  let best = enemyIndexById(wave.enemies[0])
  let bestHp = ENEMIES[best].hp
  for (let i = 1; i < wave.enemies.length; i++) {
    const idx = enemyIndexById(wave.enemies[i])
    if (ENEMIES[idx].hp > bestHp) { best = idx; bestHp = ENEMIES[idx].hp }
  }
  const a = s.rng.next() * TAU
  const e = spawnAt(s, best, s.player.x + Math.cos(a) * SPAWN_RADIUS, s.player.y + Math.sin(a) * SPAWN_RADIUS)
  if (!e) return
  e.hp *= ELITE_HP_MULT // sobre o hp já escalado por tempo
  e.maxHp = e.hp
  e.radius *= ELITE_SIZE_MULT
  e.damage *= 1.5
  e.xp *= 10
  e.elite = true
}

/** chefe NUNCA pode ser engolido pelo cap: abre espaço matando um comum */
function freeSlotForBoss(s: GameState): void {
  const items = s.enemies.items
  for (let i = 0; i < items.length; i++) {
    const e = items[i]
    if (e.active && !e.boss && !e.elite) {
      e.active = false
      return
    }
  }
}

function runEvent(s: GameState, ev: EventDef): void {
  const px = s.player.x
  const py = s.player.y
  const defIdx = enemyIndexById(ev.enemy)
  if (ev.kind === 'boss') {
    const a = s.rng.next() * TAU
    let e = spawnAt(s, defIdx, px + Math.cos(a) * SPAWN_RADIUS, py + Math.sin(a) * SPAWN_RADIUS)
    if (!e) {
      freeSlotForBoss(s)
      e = spawnAt(s, defIdx, px + Math.cos(a) * SPAWN_RADIUS, py + Math.sin(a) * SPAWN_RADIUS)
    }
    if (!e) return
    const def = ENEMIES[defIdx]
    e.hp = ev.bossHp ?? def.hp * 60 // boss sem escala de tempo
    e.maxHp = e.hp
    e.boss = true
    e.bossName = ev.bossName ?? def.name
    e.radius = 30
    s.spawn.bossIdx = s.enemies.items.indexOf(e)
    s.sounds.push('boss')
  } else if (ev.kind === 'ring') {
    const n = ev.count ?? 24
    const r = VIEW_W / 2 + 40
    const base = s.rng.next() * TAU
    for (let i = 0; i < n; i++) {
      const a = base + (i * TAU) / n
      spawnAt(s, defIdx, px + Math.cos(a) * r, py + Math.sin(a) * r)
    }
  } else { // burst: arco estreito de um lado aleatório
    const n = ev.count ?? 12
    const base = s.rng.next() * TAU
    for (let i = 0; i < n; i++) {
      const a = base + (s.rng.next() - 0.5) * 0.5
      spawnAt(s, defIdx, px + Math.cos(a) * SPAWN_RADIUS, py + Math.sin(a) * SPAWN_RADIUS)
    }
  }
}

export function updateSpawner(s: GameState, dt: number): void {
  const sp = s.spawn
  const wave = currentWave(s.time)
  const px = s.player.x
  const py = s.player.y
  const alive = s.enemies.count()

  // degradação elegante perto do cap: acima de SPAWN_SOFT_CAP o fluxo
  // contínuo cai pela metade e o minCount deixa de completar
  const crowded = alive >= CAP_ENEMIES * SPAWN_SOFT_CAP
  const interval = crowded ? wave.interval * 2 : wave.interval
  const batch = crowded ? Math.max(1, wave.batch >> 1) : wave.batch

  // spawn contínuo da onda
  sp.acc += dt
  let guard = 0
  while (sp.acc >= interval && guard < 20) {
    sp.acc -= interval
    for (let i = 0; i < batch; i++) spawnWaveEnemy(s, wave)
    guard++
  }

  // completa até o mínimo de pressão — em ARCO e com taxa limitada.
  // (Nunca despejar o déficit inteiro num frame como anel fechado: isso
  // cercava o jogador instantaneamente toda vez que alive caía do mínimo.)
  if (!crowded && alive < wave.minCount && s.frame % 15 === 0) {
    let need = wave.minCount - alive
    const capFill = wave.batch * 2
    if (need > capFill) need = capFill
    const base = s.rng.next() * TAU
    for (let i = 0; i < need; i++) {
      const a = base + (s.rng.next() - 0.5) * 1.2 // arco de ~70°
      const idx = enemyIndexById(s.rng.pick(wave.enemies))
      spawnAt(s, idx, px + Math.cos(a) * SPAWN_RADIUS, py + Math.sin(a) * SPAWN_RADIUS)
    }
  }

  // elites periódicos
  if (s.time >= sp.eliteTimer) {
    sp.eliteTimer += ELITE_INTERVAL
    spawnElite(s, wave)
  }

  // eventos (bosses, rings, bursts)
  while (sp.eventIdx < EVENTS.length && s.time >= EVENTS[sp.eventIdx].at) {
    runEvent(s, EVENTS[sp.eventIdx])
    sp.eventIdx++
  }

  // slot do chefe morreu/foi reusado?
  if (sp.bossIdx >= 0) {
    const b = s.enemies.items[sp.bossIdx]
    if (!b.active || !b.boss) sp.bossIdx = -1
  }
}
