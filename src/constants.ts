import type { PlayerStats } from './types'

// ---------- vista ----------
export const VIEW_W = 960
export const VIEW_H = 540

// ---------- run ----------
/** duração da run em segundos (20:00) */
export const WIN_TIME = 1200
export const FIXED_DT = 1 / 60

// ---------- caps de pool ----------
export const CAP_ENEMIES = 600
export const CAP_PROJECTILES = 800
export const CAP_ZONES = 64
export const CAP_GEMS = 1500
export const CAP_PICKUPS = 64
export const CAP_PARTICLES = 1200
export const CAP_TEXTS = 200

// ---------- slots ----------
export const MAX_WEAPONS = 6
export const MAX_PASSIVES = 6
export const MAX_WEAPON_LEVEL = 8

// ---------- player ----------
export const PLAYER_RADIUS = 14
/** px/s antes do multiplicador speed */
export const PLAYER_BASE_SPEED = 150
export const PLAYER_IFRAMES = 0.6
export const BASE_STATS: PlayerStats = {
  might: 1,
  armor: 0,
  maxHp: 100,
  regen: 0,
  speed: 1,
  area: 1,
  projSpeed: 1,
  duration: 1,
  amount: 0,
  cooldown: 1,
  magnet: 70,
  greed: 1,
}

// ---------- XP / nível ----------
export const XP_BASE = 6
export const XP_GROWTH = 8
/** tiers de amendoim (valor mínimo p/ usar o tier) */
export const GEM_TIERS = [1, 5, 25, 100]

// ---------- spawn ----------
/** distância além da borda da tela para spawnar */
export const SPAWN_MARGIN = 60
/** s entre elites (a partir de ELITE_START) */
export const ELITE_INTERVAL = 90
export const ELITE_START = 240
export const ELITE_HP_MULT = 8
export const ELITE_SIZE_MULT = 1.6
/** escala global de HP dos inimigos com o tempo (min 0 → 1x, min 20 → ~3.4x) */
export function enemyHpScale(time: number): number {
  const m = time / 60
  return 1 + m * 0.08 + Math.max(0, m - 10) * 0.08
}

// ---------- drops ----------
export const DROP_CALDINHO = 0.015
export const DROP_DINHEIRO = 0.02
export const DROP_IMA = 0.002
export const CALDINHO_HEAL = 30
export const SAIDEIRA_DAMAGE = 300
export const MARMITA_GOLD_MIN = 20
export const MARMITA_GOLD_MAX = 60

// ---------- combate ----------
/** s entre ticks de aura */
export const AURA_TICK = 0.4
/** s entre rehits de projéteis persistentes (orbit/boomerang) */
export const REHIT_INTERVAL = 0.5
/** s entre hits de toque do mesmo inimigo (via iframes do player) */
export const ZONE_TICK = 0.5

// ---------- cores (placeholders) ----------
export const COLOR_BG = '#1a1418'
export const COLOR_FLOOR_A = '#241c20'
export const COLOR_FLOOR_B = '#2a2126'
export const COLOR_HP = '#e14040'
export const COLOR_XP = '#58c1e8'
export const COLOR_GOLD = '#f2c14e'
export const COLOR_DMG = '#ffffff'
export const COLOR_DMG_CRIT = '#ffd166'
export const COLOR_HEAL = '#7ae582'
