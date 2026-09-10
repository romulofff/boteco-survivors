// HUD durante a partida: barra de XP, timer, ícones, HP, barra/aviso de chefe.
// Só LÊ o GameState.

import type { GameState } from '../types'
import type { SpriteCache } from '../core/sprites'
import {
  VIEW_W, VIEW_H, COLOR_XP, COLOR_HP, COLOR_GOLD,
  MAX_WEAPONS, MAX_PASSIVES, PLAYER_IFRAMES, WIN_TIME, HUD_RIGHT_TOUCH,
} from '../constants'
import { weaponById } from '../data/weapons'
import { passiveById } from '../data/passives'
import { ENEMIES } from '../data/enemies'
import { CHARACTERS } from '../data/characters'
import { EVENTS } from '../data/waves'

const FONT = 'system-ui, sans-serif'

/** MM:SS (interno-extra; screens.ts reutiliza) */
export function fmtTime(t: number): string {
  const m = Math.floor(t / 60)
  const s = Math.floor(t - m * 60)
  return (m < 10 ? '0' + m : '' + m) + ':' + (s < 10 ? '0' + s : '' + s)
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

// emoji do personagem (cache local por charId)
let hudCharId = ''
let hudCharEmoji = '🙂'
function hudChar(charId: string): string {
  if (charId !== hudCharId) {
    hudCharId = charId
    hudCharEmoji = '🙂'
    for (let i = 0; i < CHARACTERS.length; i++) {
      if (CHARACTERS[i].id === charId) {
        hudCharEmoji = CHARACTERS[i].emoji
        break
      }
    }
  }
  return hudCharEmoji
}

// banner de chefe (string cacheada por nome)
let bannerName = ''
let bannerText = ''
function bossBanner(name: string): string {
  if (name !== bannerName) {
    bannerName = name
    bannerText = '⚠️ ' + name + ' ⚠️'
  }
  return bannerText
}

/** valor com ícone (emoji via cache), alinhado à direita em rightX */
function iconStat(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteCache,
  emoji: string,
  text: string,
  rightX: number,
  y: number,
  color: string,
): void {
  ctx.font = '16px ' + FONT
  ctx.textAlign = 'right'
  ctx.fillStyle = color
  ctx.fillText(text, rightX, y)
  const w = ctx.measureText(text).width
  const img = sprites.get(emoji, 16)
  ctx.drawImage(img, rightX - w - img.width - 5, y - 5 - img.height / 2)
}

/** slot vazio 26×26 (mostra que o espaço existe) */
function emptySlot(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fillRect(x, y, 26, 26)
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, y + 0.5, 25, 25)
}

/** slot 26×26 com emoji e nível no canto */
function iconSlot(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteCache,
  emoji: string,
  level: number,
  x: number,
  y: number,
  golden: boolean,
): void {
  ctx.fillStyle = golden ? 'rgba(242,193,78,0.8)' : 'rgba(0,0,0,0.45)'
  ctx.fillRect(x, y, 26, 26)
  const img = sprites.get(emoji, 22)
  ctx.drawImage(img, x + 13 - img.width / 2, y + 13 - img.height / 2)
  ctx.font = 'bold 10px ' + FONT
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(0,0,0,0.85)'
  ctx.fillText('' + level, x + 26, y + 26)
  ctx.fillStyle = '#fff'
  ctx.fillText('' + level, x + 25, y + 25)
}

export function drawHUD(ctx: CanvasRenderingContext2D, s: GameState, sprites: SpriteCache): void {
  const p = s.player

  // ---- barra de XP no topo ----
  ctx.fillStyle = '#0d0a0c'
  ctx.fillRect(0, 0, VIEW_W, 10)
  const xpPct = p.xpNext > 0 ? clamp01(p.xp / p.xpNext) : 0
  ctx.fillStyle = COLOR_XP
  ctx.fillRect(0, 0, VIEW_W * xpPct, 10)
  // pulso dourado quando > 90% do nível
  if (xpPct > 0.9) {
    ctx.globalAlpha = 0.35 + 0.3 * Math.sin(s.time * 12)
    ctx.fillStyle = COLOR_GOLD
    ctx.fillRect(0, 0, VIEW_W * xpPct, 10)
    ctx.globalAlpha = 1
  }

  // nível + personagem escolhido (direita; em touchMode desloca p/ dar lugar a ⏸/🔊)
  const rightX = s.ui.touchMode ? HUD_RIGHT_TOUCH : VIEW_W - 8
  ctx.font = 'bold 13px ' + FONT
  ctx.textAlign = 'right'
  ctx.fillStyle = '#fff'
  const lvlText = 'Nv ' + p.level
  ctx.fillText(lvlText, rightX, 24)
  const lvlW = ctx.measureText(lvlText).width
  const cimg = sprites.get(hudChar(s.charId), 16)
  ctx.drawImage(cimg, rightX - lvlW - cimg.width - 5, 24 - 4 - cimg.height / 2)

  // ---- timer central (dourado no minuto final; vermelho piscando nos últimos 10s) ----
  const t = fmtTime(s.time)
  const remain = WIN_TIME - s.time
  let timerColor = '#fff'
  if (remain <= 10) timerColor = (Math.floor(s.time * 3) & 1) === 0 ? '#ff5252' : '#ffd9d9'
  else if (remain <= 60) timerColor = COLOR_GOLD
  ctx.font = 'bold 28px ' + FONT
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(0,0,0,0.65)'
  ctx.fillText(t, VIEW_W / 2 + 2, 40)
  ctx.fillStyle = timerColor
  ctx.fillText(t, VIEW_W / 2, 38)

  // ---- ícones de armas e passivos (esquerda): 6 slots visíveis por fileira ----
  for (let i = 0; i < MAX_WEAPONS; i++) emptySlot(ctx, 8 + i * 30, 16)
  for (let i = 0; i < MAX_PASSIVES; i++) emptySlot(ctx, 8 + i * 30, 46)
  for (let i = 0; i < s.weapons.length; i++) {
    const w = s.weapons[i]
    const def = weaponById(w.defId)
    iconSlot(ctx, sprites, def.emoji, w.level, 8 + i * 30, 16, def.evolved === true)
  }
  for (let i = 0; i < s.passives.length; i++) {
    const pv = s.passives[i]
    const def = passiveById(pv.defId)
    iconSlot(ctx, sprites, def.emoji, pv.level, 8 + i * 30, 46, false)
  }

  // ---- ouro / kills (direita) ----
  iconStat(ctx, sprites, '💰', '' + p.gold, rightX, 48, COLOR_GOLD)
  iconStat(ctx, sprites, '💀', '' + p.kills, rightX, 70, '#d8ccd2')

  // ---- HP bar sobre o player (screen space; flash branco logo após o hit) ----
  const sx = p.x - s.camera.x + VIEW_W / 2
  const sy = p.y - s.camera.y + VIEW_H / 2
  const hpPct = clamp01(p.hp / p.stats.maxHp)
  const justHit = p.iframes > PLAYER_IFRAMES - 0.15
  const bx = sx - 20
  const by = sy - p.radius - 16
  if (justHit) {
    ctx.fillStyle = 'rgba(255,80,80,0.9)'
    ctx.fillRect(bx - 3, by - 3, 46, 12)
  }
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(bx - 1, by - 1, 42, 8)
  ctx.fillStyle = justHit ? '#fff' : 'hsl(' + ((hpPct * 120) | 0) + ',65%,50%)'
  ctx.fillRect(bx, by, 40 * hpPct, 6)

  // ---- barra + aviso de chefe ----
  const bi = s.spawn.bossIdx
  if (bi >= 0) {
    const b = s.enemies.items[bi]
    if (b && b.active && b.boss) {
      // barra imponente: painel escuro, borda dourada, emoji + nome
      const w = 460
      const h = 16
      const x = (VIEW_W - w) / 2
      const y = VIEW_H - 36
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(x - 12, y - 28, w + 24, h + 38)
      ctx.strokeStyle = COLOR_GOLD
      ctx.lineWidth = 2
      ctx.strokeRect(x - 12.5, y - 28.5, w + 25, h + 39)
      const bimg = sprites.get(ENEMIES[b.defIndex].emoji, 22)
      ctx.font = 'bold 15px ' + FONT
      ctx.textAlign = 'center'
      ctx.fillStyle = 'rgba(0,0,0,0.7)'
      ctx.fillText(b.bossName, VIEW_W / 2 + 1, y - 8)
      ctx.fillStyle = '#fff'
      ctx.fillText(b.bossName, VIEW_W / 2, y - 9)
      const nameW = ctx.measureText(b.bossName).width
      ctx.drawImage(bimg, VIEW_W / 2 - nameW / 2 - bimg.width - 6, y - 15 - bimg.height / 2)
      ctx.fillStyle = '#3a1010'
      ctx.fillRect(x, y, w, h)
      const hpFrac = clamp01(b.hp / b.maxHp)
      ctx.fillStyle = COLOR_HP
      ctx.fillRect(x, y, w * hpFrac, h)
      // brilho na metade de cima da barra
      ctx.fillStyle = 'rgba(255,255,255,0.16)'
      ctx.fillRect(x, y, w * hpFrac, h / 2)
      ctx.strokeStyle = 'rgba(0,0,0,0.8)'
      ctx.lineWidth = 1
      ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1)

      // banner central pulsante nos primeiros ~2.5s (derivado do evento + hp alto)
      if (b.hp > b.maxHp * 0.92) {
        let spawnAt = -1
        for (let i = 0; i < EVENTS.length; i++) {
          if (EVENTS[i].kind === 'boss' && EVENTS[i].at <= s.time) spawnAt = EVENTS[i].at
        }
        const elapsed = spawnAt >= 0 ? s.time - spawnAt : 99
        if (elapsed < 2.5) {
          const alpha = Math.min(1, elapsed * 5, (2.5 - elapsed) * 2)
          const pulse = 0.75 + 0.25 * Math.sin(elapsed * 9)
          const size = (30 + 5 * Math.sin(elapsed * 9)) | 0
          const text = bossBanner(b.bossName)
          ctx.globalAlpha = alpha * pulse
          ctx.font = 'bold ' + size + 'px ' + FONT
          ctx.textAlign = 'center'
          ctx.lineJoin = 'round'
          ctx.lineWidth = 6
          ctx.strokeStyle = 'rgba(120,10,10,0.9)'
          ctx.strokeText(text, VIEW_W / 2, 158)
          ctx.fillStyle = COLOR_GOLD
          ctx.fillText(text, VIEW_W / 2, 158)
          ctx.lineJoin = 'miter'
          ctx.globalAlpha = 1
        }
      }
    }
  }
}
