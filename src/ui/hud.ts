// HUD durante a partida: barra de XP, timer, ícones, HP, barra de chefe.
// Só LÊ o GameState.

import type { GameState } from '../types'
import type { SpriteCache } from '../core/sprites'
import { VIEW_W, VIEW_H, COLOR_XP, COLOR_HP, COLOR_GOLD } from '../constants'
import { weaponById } from '../data/weapons'
import { passiveById } from '../data/passives'

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

  // nível à direita
  ctx.font = 'bold 13px ' + FONT
  ctx.textAlign = 'right'
  ctx.fillStyle = '#fff'
  ctx.fillText('Nv ' + p.level, VIEW_W - 8, 24)

  // ---- timer central ----
  const t = fmtTime(s.time)
  ctx.font = 'bold 28px ' + FONT
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(0,0,0,0.65)'
  ctx.fillText(t, VIEW_W / 2 + 2, 40)
  ctx.fillStyle = '#fff'
  ctx.fillText(t, VIEW_W / 2, 38)

  // ---- ícones de armas e passivos (esquerda) ----
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
  iconStat(ctx, sprites, '💰', '' + p.gold, VIEW_W - 8, 48, COLOR_GOLD)
  iconStat(ctx, sprites, '💀', '' + p.kills, VIEW_W - 8, 70, '#d8ccd2')

  // ---- HP bar sobre o player (screen space) ----
  const sx = p.x - s.camera.x + VIEW_W / 2
  const sy = p.y - s.camera.y + VIEW_H / 2
  const hpPct = clamp01(p.hp / p.stats.maxHp)
  const bx = sx - 20
  const by = sy - p.radius - 16
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(bx - 1, by - 1, 42, 8)
  ctx.fillStyle = 'hsl(' + ((hpPct * 120) | 0) + ',65%,50%)'
  ctx.fillRect(bx, by, 40 * hpPct, 6)

  // ---- barra do chefe ----
  const bi = s.spawn.bossIdx
  if (bi >= 0) {
    const b = s.enemies.items[bi]
    if (b && b.active && b.boss) {
      const w = 400
      const h = 14
      const x = (VIEW_W - w) / 2
      const y = VIEW_H - 34
      ctx.font = 'bold 14px ' + FONT
      ctx.textAlign = 'center'
      ctx.fillStyle = 'rgba(0,0,0,0.7)'
      ctx.fillText(b.bossName, VIEW_W / 2 + 1, y - 5)
      ctx.fillStyle = '#fff'
      ctx.fillText(b.bossName, VIEW_W / 2, y - 6)
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(x - 2, y - 2, w + 4, h + 4)
      ctx.fillStyle = '#3a1010'
      ctx.fillRect(x, y, w, h)
      ctx.fillStyle = COLOR_HP
      ctx.fillRect(x, y, w * clamp01(b.hp / b.maxHp), h)
    }
  }
}
