// Render do mundo + orquestra HUD e telas. Só LÊ o GameState.
// Math.random() permitido aqui apenas para jitter/efeito visual.
// Emojis de entidade SEMPRE via SpriteCache (nunca fillText por frame).

import type { GameState, PickupKind, SaveData } from '../types'
import type { SpriteCache } from '../core/sprites'
import {
  VIEW_W, VIEW_H, COLOR_BG, COLOR_FLOOR_A, COLOR_FLOOR_B,
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

  // ---- zonas (poças de fogo) ----
  const zones = s.zones.items
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
    ctx.globalAlpha = 0.6
    ctx.strokeStyle = '#e13c14'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.globalAlpha = 1
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

  // ---- auras do player ----
  for (let i = 0; i < s.weapons.length; i++) {
    const w = s.weapons[i]
    const def = weaponById(w.defId)
    if (def.behavior !== 'aura') continue
    const st = effectiveStats(s, w)
    const r = st.area * (1 + 0.03 * Math.sin(s.time * 5))
    ctx.globalAlpha = 0.1
    ctx.fillStyle = '#a8e07a'
    ctx.beginPath()
    ctx.arc(player.x, player.y, r, 0, TAU)
    ctx.fill()
    ctx.globalAlpha = 0.25
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

  // ---- partículas ----
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
  ctx.globalAlpha = 1

  // ---- textos flutuantes ----
  const texts = s.texts.items
  ctx.textAlign = 'center'
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i]
    if (!t.active) continue
    if (t.x < left || t.x > right || t.y < top || t.y > bottom) continue
    const a = t.ttl > 0 ? 1 - t.age / t.ttl : 0
    if (a <= 0) continue
    const y = t.y - t.age * 28
    ctx.globalAlpha = a
    ctx.font = textFont((13 + t.size) | 0)
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.fillText(t.text, t.x + 1, y + 1)
    ctx.fillStyle = t.color
    ctx.fillText(t.text, t.x, y)
  }
  ctx.globalAlpha = 1
  ctx.textAlign = 'left'

  ctx.restore()

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
