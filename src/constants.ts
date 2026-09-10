import type { PlayerStats } from './types'

// ---------- vista ----------
export const VIEW_W = 960
export const VIEW_H = 540

// ---------- run ----------
/** duração da run em segundos (20:00) */
export const WIN_TIME = 1200
export const FIXED_DT = 1 / 60

// ---------- caps de pool ----------
export const CAP_ENEMIES = 900
/** acima desta fração do cap o spawner degrada com elegância (spawner.ts) */
export const SPAWN_SOFT_CAP = 0.9
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
export const PLAYER_IFRAMES = 0.75
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
  magnet: 100,
  greed: 1,
}

// ---------- XP / nível ----------
export const XP_BASE = 5
export const XP_GROWTH = 8
/** tiers de amendoim (valor mínimo p/ usar o tier) */
export const GEM_TIERS = [1, 5, 25, 100]

// ---------- spawn ----------
/** distância além da borda da tela para spawnar */
export const SPAWN_MARGIN = 60
/** s entre elites (a partir de ELITE_START) */
export const ELITE_INTERVAL = 90
export const ELITE_START = 240
/** 6× (não 8×): elite precisa morrer p/ build mediano também — é dele que sai
 * marmita + ouro do late game; com 8× builds sem evolução nunca matavam os tardios */
export const ELITE_HP_MULT = 6
export const ELITE_SIZE_MULT = 1.6
/** escala global de HP dos inimigos com o tempo (min 0 → 1x, min 20 → ~3.2x) */
export function enemyHpScale(time: number): number {
  const m = time / 60
  return 1 + m * 0.07 + Math.max(0, m - 10) * 0.08
}

// ---------- drops ----------
export const DROP_CALDINHO = 0.015
export const DROP_DINHEIRO = 0.007
export const DROP_DINHEIRO_MIN = 4
export const DROP_DINHEIRO_MAX = 8
export const DROP_IMA = 0.001
export const CALDINHO_HEAL = 30
export const SAIDEIRA_DAMAGE = 500
export const MARMITA_GOLD_MIN = 12
export const MARMITA_GOLD_MAX = 26
/** ouro direto (sem pickup) ao matar elite/chefe — garante economia mesmo kitando.
 * Elite: escala com o xp do elite (cresce ao longo da run → vitória paga bem
 * mais que morte no min 12, sem inflar o early game). */
export const GOLD_ELITE_PER_XP = 0.35
export const GOLD_ELITE_MIN = 10
/** ouro direto do chefe = xp do chefe × este fator (50..200 xp → 20..80 ouro) */
export const GOLD_BOSS_PER_XP = 0.4

// ---------- combate ----------
/** s entre ticks de aura */
export const AURA_TICK = 0.4
/** s entre rehits de projéteis persistentes (orbit/boomerang) */
export const REHIT_INTERVAL = 0.5
/** s entre hits de toque do mesmo inimigo (via iframes do player) */
export const ZONE_TICK = 0.5

// ---------- touch / HUD ----------
/** engaja o stick (px lógicos) */
export const STICK_DEAD_IN = 10
/** solta o stick (histerese) */
export const STICK_DEAD_OUT = 5
/** raio do anel; além disso a âncora segue o dedo */
export const STICK_FULL = 56
export const STICK_KNOB_R = 22
/** true → magnitude proporcional entre DEAD_IN e FULL (digital por padrão) */
export const STICK_ANALOG = false
/** deslocamento máximo (px lógicos) pra um toque contar como tap */
export const TAP_SLOP = 12
export const MAX_TOUCHES = 2
/** hit-box dos botões ⏸/🔊 do HUD touch */
export const HUD_BTN = 72
/** raio visual (círculo) dos botões do HUD touch */
export const HUD_BTN_R = 24
/** borda direita dos stats (Nv/💰/💀) quando o HUD touch está visível */
export const HUD_RIGHT_TOUCH = 788
/** altura dos botões de menu/pausa/fim/voltar (alvo ≥ 43 pt no pior caso) */
export const BTN_H = 68
/** s que "Desistir" fica armado esperando o 2º toque */
export const QUIT_ARM_TIME = 3

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
