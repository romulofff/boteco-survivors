// Criação do GameState e início de run.
import type {
  Enemy, FloatText, GameState, Gem, Particle, Pickup, Player, PlayerStats,
  Projectile, SaveData, StatKey, Zone,
} from '../types'
import {
  BASE_STATS, CAP_ENEMIES, CAP_GEMS, CAP_PARTICLES, CAP_PICKUPS,
  CAP_PROJECTILES, CAP_TEXTS, CAP_ZONES, ELITE_START, PLAYER_RADIUS,
} from '../constants'
import { makeRNG } from '../core/rng'
import { makePool } from '../core/pool'
import { CHARACTERS } from '../data/characters'
import { META_UPGRADES } from '../data/meta'
import { recalcStats } from './weaponsSys'
import { xpForLevel } from './leveling'

function cloneStats(src: PlayerStats): PlayerStats {
  return {
    might: src.might,
    armor: src.armor,
    maxHp: src.maxHp,
    regen: src.regen,
    speed: src.speed,
    area: src.area,
    projSpeed: src.projSpeed,
    duration: src.duration,
    amount: src.amount,
    cooldown: src.cooldown,
    magnet: src.magnet,
    greed: src.greed,
  }
}

function addStats(dst: PlayerStats, delta: Partial<PlayerStats>): void {
  for (const k in delta) {
    const key = k as StatKey
    const v = delta[key]
    if (v !== undefined) dst[key] += v
  }
}

function makeEnemy(): Enemy {
  return {
    active: false, defIndex: 0, x: 0, y: 0, hp: 0, maxHp: 0, speed: 0,
    radius: 0, damage: 0, xp: 0, hitFlash: 0, kbx: 0, kby: 0,
    elite: false, boss: false, bossName: '', phase: 0, t: 0,
  }
}

function makeProjectile(): Projectile {
  return {
    active: false, kind: 'nearest', weaponIdx: 0, x: 0, y: 0, vx: 0, vy: 0,
    damage: 0, radius: 0, pierce: 0, knockback: 0, ttl: 0, age: 0,
    angle: 0, reach: 0, tx: 0, ty: 0, ox: 0, oy: 0,
    hitMap: new Map<number, number>(),
  }
}

function makeZone(): Zone {
  return { active: false, x: 0, y: 0, radius: 0, damage: 0, ttl: 0, tick: 0, acc: 0, kind: 'fogo' }
}

function makeGem(): Gem {
  return { active: false, x: 0, y: 0, value: 0, magnet: false, vx: 0, vy: 0 }
}

function makePickup(): Pickup {
  return { active: false, kind: 'caldinho', x: 0, y: 0, value: 0 }
}

function makeParticle(): Particle {
  return { active: false, x: 0, y: 0, vx: 0, vy: 0, ttl: 0, age: 0, size: 2, color: '#fff' }
}

function makeText(): FloatText {
  return { active: false, x: 0, y: 0, ttl: 0, age: 0, text: '', color: '#fff', size: 13 }
}

function makePlayer(): Player {
  return {
    x: 0, y: 0, dirX: 1, dirY: 0,
    hp: BASE_STATS.maxHp, iframes: 0,
    level: 1, xp: 0, xpNext: xpForLevel(1),
    gold: 0, kills: 0, radius: PLAYER_RADIUS,
    baseStats: cloneStats(BASE_STATS),
    stats: cloneStats(BASE_STATS),
  }
}

export function makeGameState(seed: number): GameState {
  return {
    mode: 'menu',
    time: 0,
    frame: 0,
    rng: makeRNG(seed),
    charId: '',
    player: makePlayer(),
    weapons: [],
    passives: [],
    enemies: makePool(CAP_ENEMIES, makeEnemy),
    projectiles: makePool(CAP_PROJECTILES, makeProjectile),
    zones: makePool(CAP_ZONES, makeZone),
    gems: makePool(CAP_GEMS, makeGem),
    pickups: makePool(CAP_PICKUPS, makePickup),
    particles: makePool(CAP_PARTICLES, makeParticle),
    texts: makePool(CAP_TEXTS, makeText),
    camera: { x: 0, y: 0, shake: 0 },
    spawn: { acc: 0, eventIdx: 0, eliteTimer: ELITE_START, bossIdx: -1 },
    upgradeChoices: [],
    pendingLevelUps: 0,
    result: 'none',
    saideiraFlash: 0,
    sounds: [],
    ui: { sel: 0, usingMouse: false },
    damageDealt: 0,
    goldEarned: 0,
  }
}

export function startRun(s: GameState, charId: string, save: SaveData): void {
  let ch = CHARACTERS[0]
  for (let i = 0; i < CHARACTERS.length; i++) {
    if (CHARACTERS[i].id === charId) { ch = CHARACTERS[i]; break }
  }

  s.time = 0
  s.frame = 0
  s.charId = charId
  s.result = 'none'
  s.pendingLevelUps = 0
  s.upgradeChoices = []
  s.saideiraFlash = 0
  s.damageDealt = 0
  s.goldEarned = 0

  s.enemies.clear()
  s.projectiles.clear()
  s.zones.clear()
  s.gems.clear()
  s.pickups.clear()
  s.particles.clear()
  s.texts.clear()

  s.spawn.acc = 0
  s.spawn.eventIdx = 0
  s.spawn.eliteTimer = ELITE_START
  s.spawn.bossIdx = -1
  s.camera.x = 0
  s.camera.y = 0
  s.camera.shake = 0
  s.ui.sel = 0

  const p = s.player
  p.x = 0
  p.y = 0
  p.dirX = 1
  p.dirY = 0
  p.iframes = 0
  p.level = 1
  p.xp = 0
  p.xpNext = xpForLevel(1)
  p.gold = 0
  p.kills = 0
  p.radius = PLAYER_RADIUS

  // base = BASE_STATS + bônus do personagem + meta-upgrades do save
  const base = cloneStats(BASE_STATS)
  addStats(base, ch.bonuses)
  for (let i = 0; i < META_UPGRADES.length; i++) {
    const m = META_UPGRADES[i]
    const lvl = save.meta[m.id] ?? 0
    if (lvl > 0) base[m.stat] += m.perLevel * lvl
  }
  p.baseStats = base

  s.weapons = [{ defId: ch.startWeapon, level: 1, cooldown: 0, volleyLeft: 0, volleyTimer: 0, side: 1 }]
  s.passives = []
  recalcStats(s)
  p.hp = p.stats.maxHp

  s.mode = 'playing'
}
