// Render do mundo + orquestra HUD e telas. Só LÊ o GameState.
// Math.random() permitido aqui apenas para jitter/efeito visual.
// Emojis de entidade SEMPRE via SpriteCache (nunca fillText por frame).

import type { GameState, PickupKind, SaveData } from '../types'
import type { SpriteCache } from '../core/sprites'
import {
  VIEW_W, VIEW_H, COLOR_BG, COLOR_FLOOR_A, COLOR_FLOOR_B, PLAYER_IFRAMES,
} from '../constants'
import { ENEMIES } from '../data/enemies'
import { CHARACTERS } from '../data/characters'
import { weaponById } from '../data/weapons'
import { effectiveStats } from '../game/weaponsSys'
import { drawHUD } from './hud'
import { drawScreens } from './screens'
import { loadSave } from '../save/storage'

const TAU = Math.PI * 2
const TILE = 64
const DECOR = ['🍺', '🪑', '🧉', '🐾']

const PICKUP_EMOJI: Record<PickupKind, string> = {
  caldinho: '🍲',
  dinheiro: '💰',
  ima: '🧲',
  saideira: '🍻',
  marmita: '📦',
}

// cor temática de morte por emoji de inimigo (fallback bege)
const DEATH_COLOR: Record<string, string> = {
  '🪰': '#8a5a33', // mosca — marrom
  '🪳': '#8a5a33', // barata — marrom
  '🐀': '#9aa0a6', // rato — cinza
  '🍺': '#e8a33d', // bêbado — âmbar
  '🐦': '#7d93a8', // pombo — cinza-azulado
  '🦅': '#7d93a8', // urubu — cinza-azulado
  '😡': '#e14040', // torcedor — vermelho
  '🗣️': '#f07830', // cunhado — laranja
  '💪': '#4a7fe1', // segurança — azul
  '🦟': '#2f6b35', // barata voadora — verde-escuro
  '📋': '#f2c14e', // chefes — dourado
  '🧾': '#f2c14e',
  '🦍': '#f2c14e',
  '👵': '#f2c14e',
}
const DEATH_FALLBACK = '#c9b8a8'

// cache de strings de fonte (evita concat por texto por frame)
const fontCache = new Map<number, string>()
function textFont(size: number): string {
  let f = fontCache.get(size)
  if (f === undefined) {
    f = 'bold ' + size + 'px system-ui, sans-serif'
    fontCache.set(size, f)
  }
  return f
}

// emoji do personagem (cache por charId)
let lastCharId = ''
let lastCharEmoji = '🙂'
function charEmoji(charId: string): string {
  if (charId !== lastCharId) {
    lastCharId = charId
    lastCharEmoji = '🙂'
    for (let i = 0; i < CHARACTERS.length; i++) {
      if (CHARACTERS[i].id === charId) {
        lastCharEmoji = CHARACTERS[i].emoji
        break
      }
    }
  }
  return lastCharEmoji
}

// Fallback de save para as telas: render() não recebe SaveData no contrato,
// então recarrega do storage com throttle quando o integrador não passa `save`.
let cachedSave: SaveData | null = null
let cachedSaveAt = 0
function resolveSave(save?: SaveData): SaveData {
  if (save) return save
  const now = Date.now()
  if (cachedSave === null || now - cachedSaveAt > 250) {
    cachedSave = loadSave()
    cachedSaveAt = now
  }
  return cachedSave
}

// ---------------------------------------------------------------------------
// FX visuais locais do render (puramente cosméticos, Math.random permitido).
// Pool fixo de ~40 partículas + 12 anéis: caps estruturais, zero alloc/frame.
// ---------------------------------------------------------------------------

interface VisP {
  x: number; y: number; vx: number; vy: number
  age: number; ttl: number; size: number; color: string
  /** true = chama de fogo (sobe e encolhe); false = faísca de morte */
  flame: boolean
}
interface VisRing {
  x: number; y: number; age: number; ttl: number
  r0: number; r1: number; color: string; width: number
}

const VIS_MAX = 40
const RING_MAX = 12
const visParts: VisP[] = []
const visRings: VisRing[] = []
for (let i = 0; i < VIS_MAX; i++) {
  visParts.push({ x: 0, y: 0, vx: 0, vy: 0, age: 1, ttl: 0, size: 0, color: '#fff', flame: false })
}
for (let i = 0; i < RING_MAX; i++) {
  visRings.push({ x: 0, y: 0, age: 1, ttl: 0, r0: 0, r1: 0, color: '#fff', width: 2 })
}
let visCursor = 0
let ringCursor = 0
let visLastNow = 0

/** aloca sobrescrevendo o mais antigo (faíscas de morte: sempre entram) */
function visAlloc(): VisP {
  const p = visParts[visCursor]
  visCursor = (visCursor + 1) % VIS_MAX
  return p
}

/** aloca só se houver slot livre (chamas: nunca roubam faíscas de morte) */
function visAllocSoft(): VisP | null {
  for (let i = 0; i < VIS_MAX; i++) {
    const p = visParts[(visCursor + i) % VIS_MAX]
    if (p.age >= p.ttl) return p
  }
  return null
}

function ringAlloc(): VisRing {
  const r = visRings[ringCursor]
  ringCursor = (ringCursor + 1) % RING_MAX
  return r
}

function spawnDeathFx(x: number, y: number, radius: number, color: string, boss: boolean): void {
  // anel branco de "pop" (0.15s) — chefes ganham anel dourado maior
  const ring = ringAlloc()
  ring.x = x
  ring.y = y
  ring.age = 0
  ring.ttl = boss ? 0.32 : 0.15
  ring.r0 = radius * 0.6
  ring.r1 = radius * (boss ? 3.2 : 2.2)
  ring.color = boss ? '#f2c14e' : '#ffffff'
  ring.width = boss ? 5 : 3

  const n = boss ? 8 : 4
  for (let i = 0; i < n; i++) {
    const p = visAlloc()
    const a = Math.random() * TAU
    const spd = 60 + Math.random() * 160
    p.x = x
    p.y = y
    p.vx = Math.cos(a) * spd
    p.vy = Math.sin(a) * spd - 20
    p.age = 0
    p.ttl = 0.3 + Math.random() * 0.25
    p.size = 2.5 + Math.random() * 3
    p.color = color
    p.flame = false
  }
}

function spawnFlame(x: number, y: number): void {
  const p = visAllocSoft()
  if (p === null) return
  p.x = x
  p.y = y
  p.vx = (Math.random() - 0.5) * 22
  p.vy = -(45 + Math.random() * 55)
  p.age = 0
  p.ttl = 0.4 + Math.random() * 0.35
  p.size = 3 + Math.random() * 3.5
  const r = Math.random()
  p.color = r < 0.35 ? '#ffd166' : r < 0.7 ? '#ff9a3d' : '#ff6e28'
  p.flame = true
}

function updateVisFx(dt: number): void {
  for (let i = 0; i < VIS_MAX; i++) {
    const p = visParts[i]
    if (p.age >= p.ttl) continue
    p.age += dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    if (!p.flame) {
      p.vx *= 1 - 3.5 * dt
      p.vy += 70 * dt
    }
  }
  for (let i = 0; i < RING_MAX; i++) {
    const r = visRings[i]
    if (r.age < r.ttl) r.age += dt
  }
}

function clearVisFx(): void {
  for (let i = 0; i < VIS_MAX; i++) { visParts[i].age = 1; visParts[i].ttl = 0 }
  for (let i = 0; i < RING_MAX; i++) { visRings[i].age = 1; visRings[i].ttl = 0 }
}

// ---------------------------------------------------------------------------
// Detecção de morte de inimigo (snapshot ativo→inativo entre frames de render)
// ---------------------------------------------------------------------------

let prevActive: Uint8Array = new Uint8Array(0)
let prevX: Float32Array = new Float32Array(0)
let prevY: Float32Array = new Float32Array(0)
let prevRadius: Float32Array = new Float32Array(0)
let prevDef: Int16Array = new Int16Array(0)
let prevBoss: Uint8Array = new Uint8Array(0)
let lastRunTime = 0

function scanDeaths(s: GameState, left: number, right: number, top: number, bottom: number): void {
  const items = s.enemies.items
  const n = items.length
  if (prevActive.length !== n) {
    prevActive = new Uint8Array(n)
    prevX = new Float32Array(n)
    prevY = new Float32Array(n)
    prevRadius = new Float32Array(n)
    prevDef = new Int16Array(n)
    prevBoss = new Uint8Array(n)
  }
  // run nova (tempo voltou): só re-snapshot, sem bursts
  const fresh = s.time < lastRunTime
  lastRunTime = s.time
  if (fresh) clearVisFx()

  for (let i = 0; i < n; i++) {
    const e = items[i]
    if (!fresh && prevActive[i] === 1 && !e.active) {
      const x = prevX[i]
      const y = prevY[i]
      if (x >= left && x <= right && y >= top && y <= bottom) {
        const emoji = ENEMIES[prevDef[i]].emoji
        const color = DEATH_COLOR[emoji] ?? DEATH_FALLBACK
        spawnDeathFx(x, y, prevRadius[i], color, prevBoss[i] === 1)
      }
    }
    if (e.active) {
      prevActive[i] = 1
      prevX[i] = e.x
      prevY[i] = e.y
      prevRadius[i] = e.radius
      prevDef[i] = e.defIndex
      prevBoss[i] = e.boss ? 1 : 0
    } else {
      prevActive[i] = 0
    }
  }
}

// ---------------------------------------------------------------------------
// Vinheta de dano (gradiente cacheado — criado 1x)
// ---------------------------------------------------------------------------

let hurtVignette: CanvasGradient | null = null
function getHurtVignette(ctx: CanvasRenderingContext2D): CanvasGradient {
  if (hurtVignette === null) {
    const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.34, VIEW_W / 2, VIEW_H / 2, VIEW_H * 1.02)
    g.addColorStop(0, 'rgba(225,40,40,0)')
    g.addColorStop(0.55, 'rgba(225,40,40,0.10)')
    g.addColorStop(1, 'rgba(225,40,40,0.55)')
    hurtVignette = g
  }
  return hurtVignette
}

/** hash inteiro determinístico de célula (decoração do chão) */
function cellHash(cx: number, cy: number): number {
  let h = (cx * 374761393 + cy * 668265263) | 0
  h = (((h ^ (h >>> 13)) | 0) * 1274126177) | 0
  return (h ^ (h >>> 16)) >>> 0
}

/** ladrilho xadrez + decoração esparsa, em coords de mundo (tx/ty = canto do viewport) */
function drawFloor(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteCache,
  tx: number,
  ty: number,
  decorAlpha: number,
): void {
  const cx0 = Math.floor(tx / TILE)
  const cy0 = Math.floor(ty / TILE)
  const cx1 = Math.floor((tx + VIEW_W) / TILE)
  const cy1 = Math.floor((ty + VIEW_H) / TILE)
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      ctx.fillStyle = ((cx + cy) & 1) === 0 ? COLOR_FLOOR_A : COLOR_FLOOR_B
      ctx.fillRect(cx * TILE, cy * TILE, TILE, TILE)
    }
  }
  // decoração determinística por hash da célula
  ctx.globalAlpha = decorAlpha
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const h = cellHash(cx, cy)
      if (h % 31 !== 0) continue
      const img = sprites.get(DECOR[(h >>> 5) & 3], 40)
      ctx.drawImage(img, cx * TILE + 32 - img.width / 2, cy * TILE + 32 - img.height / 2)
    }
  }
  ctx.globalAlpha = 1
}

export function render(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  sprites: SpriteCache,
  save?: SaveData,
): void {
  ctx.fillStyle = COLOR_BG
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)

  // dt visual local (só para FX cosméticos do render)
  const nowMs = performance.now()
  const visDt = visLastNow === 0 ? 0 : Math.min(0.05, (nowMs - visLastNow) / 1000)
  visLastNow = nowMs

  // telas puras (sem mundo): fundo com padrão sutil + telas
  if (s.mode === 'menu' || s.mode === 'charselect' || s.mode === 'shop') {
    drawFloor(ctx, sprites, 0, 0, 0.07)
    drawScreens(ctx, s, sprites, resolveSave(save))
    return
  }

  // ---- câmera (+shake visual) ----
  let tx = s.camera.x - VIEW_W / 2
  let ty = s.camera.y - VIEW_H / 2
  if (s.camera.shake > 0) {
    tx += (Math.random() * 2 - 1) * s.camera.shake
    ty += (Math.random() * 2 - 1) * s.camera.shake
  }
  ctx.save()
  ctx.translate(-tx, -ty)

  drawFloor(ctx, sprites, tx, ty, 0.16)

  const left = tx - 80
  const right = tx + VIEW_W + 80
  const top = ty - 80
  const bottom = ty + VIEW_H + 80
  const player = s.player

  // mortes desde o último frame → burst temático + anel de pop
  scanDeaths(s, left, right, top, bottom)
  if (s.mode !== 'paused') updateVisFx(visDt)

  // ---- zonas (poças de fogo) ----
  const zones = s.zones.items
  let flameBudget = 2 // máx. de chamas novas por frame (global)
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i]
    if (!z.active) continue
    if (z.x + z.radius < left || z.x - z.radius > right || z.y + z.radius < top || z.y - z.radius > bottom) continue
    const r = z.radius * (1 + 0.06 * Math.sin(s.time * 8 + i))
    ctx.globalAlpha = 0.25
    ctx.fillStyle = '#ff6e28'
    ctx.beginPath()
    ctx.arc(z.x, z.y, r, 0, TAU)
    ctx.fill()
    // núcleo quente
    ctx.globalAlpha = 0.18
    ctx.fillStyle = '#ffd166'
    ctx.beginPath()
    ctx.arc(z.x, z.y, r * 0.45, 0, TAU)
    ctx.fill()
    ctx.globalAlpha = 0.6
    ctx.strokeStyle = '#e13c14'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(z.x, z.y, r, 0, TAU)
    ctx.stroke()
    ctx.globalAlpha = 1
    // chamas ascendentes (visuais, poucas por frame)
    if (s.mode === 'playing' && flameBudget > 0 && Math.random() < 0.4) {
      const a = Math.random() * TAU
      const rd = Math.sqrt(Math.random()) * z.radius * 0.85
      spawnFlame(z.x + Math.cos(a) * rd, z.y + Math.sin(a) * rd)
      flameBudget--
    }
  }

  // ---- gems (amendoins de XP) ----
  const gems = s.gems.items
  for (let i = 0; i < gems.length; i++) {
    const g = gems[i]
    if (!g.active) continue
    if (g.x < left || g.x > right || g.y < top || g.y > bottom) continue
    let color: string
    let r: number
    if (g.value >= 100) {
      color = '#f2c14e'
      r = 8
      // brilho do tier máximo
      ctx.globalAlpha = 0.22
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(g.x, g.y, 14, 0, TAU)
      ctx.fill()
      ctx.globalAlpha = 1
    } else if (g.value >= 25) {
      color = '#b06ee8'
      r = 6
    } else if (g.value >= 5) {
      color = '#58c1e8'
      r = 5
    } else {
      color = '#8bd450'
      r = 4
    }
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(g.x, g.y, r, 0, TAU)
    ctx.fill()
  }

  // ---- pickups ----
  const pickups = s.pickups.items
  for (let i = 0; i < pickups.length; i++) {
    const p = pickups[i]
    if (!p.active) continue
    if (p.x < left || p.x > right || p.y < top || p.y > bottom) continue
    const bob = Math.sin(s.time * 4 + p.x * 0.05) * 3
    const img = sprites.get(PICKUP_EMOJI[p.kind], 26)
    ctx.drawImage(img, p.x - img.width / 2, p.y + bob - img.height / 2)
  }

  // ---- auras do player (borda ondulante sutil) ----
  for (let i = 0; i < s.weapons.length; i++) {
    const w = s.weapons[i]
    const def = weaponById(w.defId)
    if (def.behavior !== 'aura') continue
    const st = effectiveStats(s, w)
    const r = st.area * (1 + 0.03 * Math.sin(s.time * 5))
    const SEG = 30
    ctx.beginPath()
    for (let k = 0; k <= SEG; k++) {
      const ang = (k / SEG) * TAU
      const rr = r * (1 + 0.05 * Math.sin(ang * 5 + s.time * 4) + 0.025 * Math.sin(ang * 9 - s.time * 6))
      const px = player.x + Math.cos(ang) * rr
      const py = player.y + Math.sin(ang) * rr
      if (k === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.globalAlpha = 0.1
    ctx.fillStyle = '#a8e07a'
    ctx.fill()
    ctx.globalAlpha = 0.35
    ctx.strokeStyle = '#a8e07a'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  // ---- inimigos (cull viewport+80) ----
  const enemies = s.enemies.items
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i]
    if (!e.active) continue
    if (e.x < left || e.x > right || e.y < top || e.y > bottom) continue

    // sombra
    ctx.globalAlpha = 0.15
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.ellipse(e.x, e.y + e.radius * 0.85, e.radius * 0.8, e.radius * 0.32, 0, 0, TAU)
    ctx.fill()
    ctx.globalAlpha = 1

    // anel de elite/chefe
    if (e.boss) {
      ctx.strokeStyle = '#e11414'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(e.x, e.y, e.radius + 6, 0, TAU)
      ctx.stroke()
    } else if (e.elite) {
      ctx.strokeStyle = '#f2c14e'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(e.x, e.y, e.radius + 4, 0, TAU)
      ctx.stroke()
    }

    const img = sprites.get(ENEMIES[e.defIndex].emoji, (e.radius * 2.2) | 0)
    ctx.drawImage(img, e.x - img.width / 2, e.y - img.height / 2)

    if (e.hitFlash > 0) {
      ctx.globalAlpha = 0.8
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(e.x, e.y, e.radius, 0, TAU)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  }

  // ---- player ----
  ctx.globalAlpha = 0.15
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.ellipse(player.x, player.y + player.radius * 0.9, player.radius * 0.85, player.radius * 0.35, 0, 0, TAU)
  ctx.fill()
  ctx.globalAlpha = 1
  if (player.iframes > 0 && (s.frame & 2) === 0) ctx.globalAlpha = 0.5
  const pimg = sprites.get(charEmoji(s.charId), 34)
  ctx.drawImage(pimg, player.x - pimg.width / 2, player.y - pimg.height / 2)
  ctx.globalAlpha = 1

  // ---- projéteis ----
  const projs = s.projectiles.items
  for (let i = 0; i < projs.length; i++) {
    const p = projs[i]
    if (!p.active) continue
    if (p.x < left || p.x > right || p.y < top || p.y > bottom) continue
    const w = s.weapons[p.weaponIdx]
    if (!w) continue

    if (p.kind === 'whip') {
      // arco branco rápido em vez de emoji
      const dx = p.x - player.x
      const dy = p.y - player.y
      const a = Math.atan2(dy, dx)
      const fade = p.ttl > 0.12 ? 1 : p.ttl / 0.12
      ctx.globalAlpha = fade * 0.75
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.radius, a - 1.1, a + 1.1)
      ctx.stroke()
      ctx.globalAlpha = fade * 0.25
      ctx.lineWidth = Math.max(3, p.radius * 0.45)
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.radius * 0.7, a - 0.9, a + 0.9)
      ctx.stroke()
      ctx.globalAlpha = 1
      continue
    }

    const def = weaponById(w.defId)
    const img = sprites.get(def.emoji, (p.radius * 2.4) | 0)

    if (p.kind === 'lob' || p.kind === 'zone') {
      // voo em arco: emoji sobe e desce; sombra no chão
      const total = p.age + p.ttl
      const prog = total > 0 ? p.age / total : 0
      const yoff = -Math.sin(prog * Math.PI) * 60
      ctx.globalAlpha = 0.15
      ctx.fillStyle = '#000'
      ctx.beginPath()
      ctx.ellipse(p.x, p.y, p.radius * 0.7, p.radius * 0.3, 0, 0, TAU)
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.drawImage(img, p.x - img.width / 2, p.y + yoff - img.height / 2)
    } else if (p.kind === 'nearest' || p.kind === 'boomerang' || p.kind === 'orbit') {
      // spin
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.age * 10)
      ctx.drawImage(img, -img.width / 2, -img.height / 2)
      ctx.restore()
    } else if (p.kind === 'directional') {
      // aponta na direção do voo
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(Math.atan2(p.vy, p.vx))
      ctx.drawImage(img, -img.width / 2, -img.height / 2)
      ctx.restore()
    } else {
      ctx.drawImage(img, p.x - img.width / 2, p.y - img.height / 2)
    }
  }

  // ---- partículas (gameplay) ----
  const parts = s.particles.items
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    if (!p.active) continue
    if (p.x < left || p.x > right || p.y < top || p.y > bottom) continue
    const a = p.ttl > 0 ? 1 - p.age / p.ttl : 0
    if (a <= 0) continue
    ctx.globalAlpha = a
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
  }

  // ---- FX visuais locais: faíscas de morte + chamas ----
  for (let i = 0; i < VIS_MAX; i++) {
    const p = visParts[i]
    if (p.age >= p.ttl) continue
    const k = p.age / p.ttl
    const a = 1 - k
    ctx.globalAlpha = p.flame ? a * 0.85 : a
    ctx.fillStyle = p.color
    const sz = p.flame ? p.size * (1 - k * 0.7) : p.size
    ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz)
  }
  // anéis de "pop" de morte
  for (let i = 0; i < RING_MAX; i++) {
    const r = visRings[i]
    if (r.age >= r.ttl) continue
    const k = r.age / r.ttl
    ctx.globalAlpha = (1 - k) * 0.9
    ctx.strokeStyle = r.color
    ctx.lineWidth = r.width * (1 - k * 0.6)
    ctx.beginPath()
    ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * k, 0, TAU)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // ---- textos flutuantes (número branco cheio + contorno escuro + pop) ----
  const texts = s.texts.items
  ctx.textAlign = 'center'
  ctx.lineJoin = 'round'
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i]
    if (!t.active) continue
    if (t.x < left || t.x > right || t.y < top || t.y > bottom) continue
    const prog = t.ttl > 0 ? t.age / t.ttl : 1
    if (prog >= 1) continue
    // pleno até 55% da vida, depois some
    const a = prog < 0.55 ? 1 : (1 - prog) / 0.45
    // pop de escala no 1º décimo de segundo (1.55× → 1×)
    const pop = t.age < 0.1 ? 1.55 - 5.5 * t.age : 1
    const size = ((t.size + 9) * pop) | 0
    ctx.globalAlpha = a
    ctx.font = textFont(size)
    ctx.lineWidth = size >= 26 ? 4 : 3
    ctx.strokeStyle = 'rgba(15,8,10,0.85)'
    ctx.strokeText(t.text, t.x, t.y)
    ctx.fillStyle = t.color
    ctx.fillText(t.text, t.x, t.y)
  }
  ctx.globalAlpha = 1
  ctx.lineJoin = 'miter'
  ctx.textAlign = 'left'

  ctx.restore()

  // ---- vinheta de dano no player (screen space; alpha ∝ iframes restantes) ----
  if (player.iframes > 0 && player.hp > 0) {
    ctx.globalAlpha = Math.min(1, player.iframes / PLAYER_IFRAMES)
    ctx.fillStyle = getHurtVignette(ctx)
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)
    ctx.globalAlpha = 1
  }

  // ---- flash da saideira (screen space) ----
  if (s.saideiraFlash > 0) {
    ctx.globalAlpha = Math.min(0.85, s.saideiraFlash * 1.6)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)
    ctx.globalAlpha = 1
  }

  // modos restantes (playing/levelup/paused/gameover/win) sempre têm HUD
  drawHUD(ctx, s, sprites)
  drawScreens(ctx, s, sprites, resolveSave(save))
}
