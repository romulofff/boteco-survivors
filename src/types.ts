// Contratos compartilhados do Boteco Survivors.
// REGRA: este arquivo não importa nada e não contém lógica.

// ---------- infra ----------

export interface RNG {
  /** [0,1) */
  next(): number
  range(min: number, max: number): number
  /** inteiro inclusivo */
  int(min: number, max: number): number
  pick<T>(arr: readonly T[]): T
  chance(p: number): boolean
}

export interface Pool<T> {
  items: T[]
  /** null se cheio */
  alloc(): T | null
  /** sobrescreve o mais antigo se cheio (partículas/textos) */
  allocOverwrite(): T
  clear(): void
  count(): number
}

export type SoundId =
  | 'shoot' | 'hit' | 'hurt' | 'pickup' | 'gold' | 'levelup' | 'boss'
  | 'death' | 'evolve' | 'chest' | 'saideira' | 'win' | 'click' | 'heal'

export interface InputFrame {
  /** -1..1 (normalizado na diagonal) */
  moveX: number
  moveY: number
  /** navegação de menu, "pressed this frame": -1 | 0 | 1 */
  navX: number
  navY: number
  /** Enter/Espaço pressed this frame */
  confirm: boolean
  /** Esc/P pressed this frame */
  pause: boolean
  /** tecla numérica 1..9 pressed this frame, 0 = nenhuma */
  num: number
  /** M pressed this frame */
  mute: boolean
  /** posição do mouse em coords lógicas 960×540 */
  mouseX: number
  mouseY: number
  /** true no frame em que o botão desceu */
  click: boolean
  /** mouse se moveu neste frame (para alternar controle hover vs teclado) */
  mouseMoved: boolean
  /** slots de toque (len fixo MAX_TOUCHES, sem alocação); mouse NÃO usa slot */
  touches: TouchSlot[]
  /** última fonte de entrada; boot = 'touch' se (hover:none) and (pointer:coarse), senão 'keyboard' */
  lastInput: InputSource
}

/** um dedo, coords lógicas; InputFrame.touches tem len fixo MAX_TOUCHES */
export interface TouchSlot {
  active: boolean
  /** pointerId do DOM; -1 quando livre */
  id: number
  startX: number
  startY: number
  x: number
  y: number
  /** true assim que a distância da origem passou de TAP_SLOP (nunca vira tap) */
  moved: boolean
  /** true quando game/touchstick.ts reivindicou o slot como joystick (nunca vira tap) */
  stick: boolean
}

export type InputSource = 'keyboard' | 'mouse' | 'touch'

/** joystick virtual flutuante (game/touchstick.ts escreve; ui/touchui.ts desenha) */
export interface StickState {
  active: boolean
  /** id do TouchSlot que controla o stick; -1 se nenhum */
  id: number
  /** âncora (centro do anel) — segue o dedo além de STICK_FULL */
  ox: number
  oy: number
  /** knob (dedo clampado a STICK_FULL da âncora) */
  kx: number
  ky: number
  /** dentro da histerese (true = movendo) */
  engaged: boolean
  /** vetor de movimento (|v| = 1 quando engaged e STICK_ANALOG=false; 0 senão) */
  mx: number
  my: number
}

// ---------- stats ----------

export interface PlayerStats {
  /** multiplicador de dano (1 = 100%) */
  might: number
  /** dano fixo absorvido por hit */
  armor: number
  maxHp: number
  /** hp por segundo */
  regen: number
  /** multiplicador de velocidade de movimento */
  speed: number
  /** multiplicador de área/tamanho de efeitos */
  area: number
  /** multiplicador de velocidade de projétil */
  projSpeed: number
  /** multiplicador de duração de efeitos */
  duration: number
  /** projéteis extras (aditivo) */
  amount: number
  /** multiplicador de cooldown (0.9 = 10% mais rápido) */
  cooldown: number
  /** raio de coleta em px */
  magnet: number
  /** multiplicador de ouro */
  greed: number
}

export type StatKey = keyof PlayerStats

// ---------- defs de conteúdo (data/) ----------

export type WeaponBehavior =
  | 'nearest'      // projétil no inimigo mais próximo
  | 'directional'  // dispara na direção do movimento
  | 'whip'         // hitbox instantânea alternando lados
  | 'lob'          // arco até inimigo aleatório próximo, explode (área)
  | 'boomerang'    // vai e volta perfurando
  | 'aura'         // zona de dano contínua no jogador
  | 'orbit'        // projéteis orbitando o jogador
  | 'zone'         // arremesso que deixa poça de dano no chão

export interface WeaponStats {
  damage: number
  /** s entre disparos */
  cooldown: number
  /** nº de projéteis por disparo */
  amount: number
  /** px/s do projétil */
  speed: number
  /** raio base em px do projétil/hit/zona */
  area: number
  /** s de vida do projétil/zona/aura-tick */
  duration: number
  /** inimigos perfurados (999 = infinito) */
  pierce: number
  /** força de empurrão */
  knockback: number
}

export interface WeaponDef {
  id: string
  name: string
  emoji: string
  desc: string
  behavior: WeaponBehavior
  base: WeaponStats
  /** 7 entradas (níveis 2..8), deltas ADITIVOS sobre o nível anterior; cooldown negativo reduz */
  perLevel: Partial<WeaponStats>[]
  /** arma base: passivo par + id da evoluída */
  evolution?: { requires: string; into: string }
  /** true nas armas evoluídas (fora do pool de level-up) */
  evolved?: boolean
}

export interface PassiveDef {
  id: string
  name: string
  emoji: string
  desc: string
  maxLevel: number
  stat: StatKey
  /** delta aditivo por nível (0.1 = +10% em multiplicadores) */
  perLevel: number
}

export interface CharacterDef {
  id: string
  name: string
  emoji: string
  desc: string
  startWeapon: string
  /** deltas aditivos sobre os stats base */
  bonuses: Partial<PlayerStats>
}

export type EnemyBehavior = 'chase' | 'dart' | 'swoop' | 'drunk'

export interface EnemyDef {
  id: string
  name: string
  emoji: string
  hp: number
  /** px/s */
  speed: number
  /** dano de toque por hit */
  damage: number
  radius: number
  /** valor de XP dropado */
  xp: number
  behavior: EnemyBehavior
}

export interface WaveDef {
  /** segundos (inclusive) */
  from: number
  /** segundos (exclusive) */
  to: number
  /** ids de inimigos sorteados neste período */
  enemies: string[]
  /** s entre spawns contínuos */
  interval: number
  /** quantos por spawn */
  batch: number
  /** se vivos < minCount, completa até minCount */
  minCount: number
}

export interface EventDef {
  /** segundo da run */
  at: number
  kind: 'boss' | 'ring' | 'burst'
  enemy: string
  /** ring/burst */
  count?: number
  /** só para boss */
  bossName?: string
  bossHp?: number
}

export interface MetaUpgradeDef {
  id: string
  name: string
  emoji: string
  desc: string
  maxLevel: number
  stat: StatKey
  perLevel: number
  /** custo do nível n (1-based) */
  cost(level: number): number
}

// ---------- entidades de runtime (pooled) ----------

export interface Enemy {
  active: boolean
  /** índice em ENEMIES */
  defIndex: number
  x: number
  y: number
  hp: number
  maxHp: number
  speed: number
  radius: number
  damage: number
  xp: number
  /** s restantes de flash branco */
  hitFlash: number
  /** knockback (decai) */
  kbx: number
  kby: number
  elite: boolean
  boss: boolean
  bossName: string
  /** estado livre do behavior (fase do swoop/dart/drunk) */
  phase: number
  /** timer livre do behavior */
  t: number
}

export interface Projectile {
  active: boolean
  kind: WeaponBehavior
  /** índice em state.weapons da arma que disparou */
  weaponIdx: number
  x: number
  y: number
  vx: number
  vy: number
  damage: number
  radius: number
  pierce: number
  knockback: number
  /** s restantes */
  ttl: number
  age: number
  /** orbit: ângulo; boomerang: fase */
  angle: number
  /** orbit: raio da órbita; boomerang: alcance */
  reach: number
  /** origem/alvo (boomerang volta à posição do player; lob voa até tx,ty) */
  tx: number
  ty: number
  ox: number
  oy: number
  /** rehit: enemyIdx -> tempo (state.time) a partir do qual pode ser atingido de novo */
  hitMap: Map<number, number>
}

export interface Zone {
  active: boolean
  x: number
  y: number
  radius: number
  /** dano por tick */
  damage: number
  ttl: number
  /** s entre ticks */
  tick: number
  acc: number
  kind: 'fogo'
}

export interface Gem {
  active: boolean
  x: number
  y: number
  value: number
  /** true quando em atração até o player */
  magnet: boolean
  vx: number
  vy: number
}

export type PickupKind = 'caldinho' | 'dinheiro' | 'ima' | 'saideira' | 'marmita'

export interface Pickup {
  active: boolean
  kind: PickupKind
  x: number
  y: number
  value: number
}

export interface Particle {
  active: boolean
  x: number
  y: number
  vx: number
  vy: number
  ttl: number
  age: number
  size: number
  color: string
}

export interface FloatText {
  active: boolean
  x: number
  y: number
  ttl: number
  age: number
  text: string
  color: string
  size: number
}

// ---------- equipamento / upgrades ----------

export interface EquippedWeapon {
  defId: string
  /** 1..8 */
  level: number
  /** s até próximo disparo */
  cooldown: number
  /** rajada em andamento: tiros restantes e timer entre eles */
  volleyLeft: number
  volleyTimer: number
  /** whip alterna 1/-1; orbit usa como ângulo base */
  side: number
}

export interface EquippedPassive {
  defId: string
  /** 1..maxLevel */
  level: number
}

export interface UpgradeOption {
  kind: 'weapon' | 'passive' | 'evolution' | 'gold' | 'heal'
  /** def id (weapon/passive); '' para gold/heal */
  id: string
  name: string
  emoji: string
  desc: string
  /** true se é item novo (não upgrade) */
  isNew: boolean
}

// ---------- player / estado ----------

export interface Player {
  x: number
  y: number
  /** última direção de movimento (unitária); default (1,0) */
  dirX: number
  dirY: number
  hp: number
  /** s de invulnerabilidade restantes */
  iframes: number
  level: number
  xp: number
  xpNext: number
  /** ouro da run (banca no save ao final) */
  gold: number
  kills: number
  radius: number
  /** base (char + meta) — não muda durante a run */
  baseStats: PlayerStats
  /** derivado: base + passivos (recalculado em recalcStats) */
  stats: PlayerStats
}

export type Mode =
  | 'menu' | 'charselect' | 'shop'
  | 'playing' | 'levelup' | 'paused'
  | 'gameover' | 'win'

export interface SpawnState {
  /** acumulador de spawn da onda corrente */
  acc: number
  /** próximo índice em EVENTS */
  eventIdx: number
  /** timer p/ próximo elite */
  eliteTimer: number
  /** índice do chefe vivo no pool de enemies, -1 se nenhum */
  bossIdx: number
}

export interface GameState {
  mode: Mode
  /** s de run */
  time: number
  frame: number
  rng: RNG
  charId: string
  player: Player
  weapons: EquippedWeapon[]
  passives: EquippedPassive[]
  enemies: Pool<Enemy>
  projectiles: Pool<Projectile>
  zones: Pool<Zone>
  gems: Pool<Gem>
  pickups: Pool<Pickup>
  particles: Pool<Particle>
  texts: Pool<FloatText>
  camera: { x: number; y: number; shake: number }
  spawn: SpawnState
  upgradeChoices: UpgradeOption[]
  /** fila de level-ups pendentes (gainXP pode subir vários níveis) */
  pendingLevelUps: number
  result: 'none' | 'dead' | 'win'
  /** flash branco da saideira (s restantes) */
  saideiraFlash: number
  /** sons emitidos neste frame; main.ts drena */
  sounds: SoundId[]
  /** estado de navegação de UI (índice selecionado na tela corrente);
   * lockT: grace period (s) que ignora clique/confirm ao abrir o level-up */
  ui: {
    sel: number
    usingMouse: boolean
    lockT: number
    /** espelho de lastInput === 'touch' → HUD ⏸/🔊, dicas, hit-test do HUD */
    touchMode: boolean
    /** fonte da verdade do som desligado (M ou 🔊); main.ts espelha em AudioSys */
    muted: boolean
    /** true após o 1º movimento da run (esconde onboarding); startRun zera */
    moved: boolean
    /** segundos restantes da confirmação de "Desistir" (0 = desarmado) */
    quitArmed: number
    stick: StickState
  }
  /** total de dano causado (relatórios) */
  damageDealt: number
  /** ouro ganho na run (para tela final) */
  goldEarned: number
}

export interface GameContext {
  save: SaveData
  /** grava o save (noop em testes) */
  persist(): void
}

// ---------- save ----------

export interface SaveData {
  gold: number
  bestKills: number
  /** s */
  bestTime: number
  wins: number
  runs: number
  /** metaUpgradeId -> nível */
  meta: Record<string, number>
}

// ---------- simulação ----------

export interface SimMinute {
  minute: number
  level: number
  kills: number
  hp: number
  enemiesAlive: number
  weapons: string[]
}

export interface SimReport {
  result: 'dead' | 'win' | 'timeout'
  survivedSec: number
  level: number
  kills: number
  goldEarned: number
  damageDealt: number
  minutes: SimMinute[]
}

// ---------- ui ----------

export interface Btn {
  x: number
  y: number
  w: number
  h: number
  id: string
}
