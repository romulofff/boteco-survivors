// UI de toque: anel/knob do stick, botões ⏸(▶)/🔊 e onboarding. Só LÊ o GameState.
// Desenhado por último (acima dos overlays de pausa/level-up).

import type { GameState } from '../types'
import type { SpriteCache } from '../core/sprites'
import { HUD_BTN_R, STICK_FULL, STICK_KNOB_R } from '../constants'
import { hudRects, HUD_MUTE, HUD_PAUSE } from './layout'

const TAU = Math.PI * 2
const FONT = 'bold 20px system-ui, sans-serif'
const ONBOARDING = 'Toque e arraste em qualquer lugar pra mover'

export function drawTouchUI(ctx: CanvasRenderingContext2D, s: GameState, sprites: SpriteCache): void {
  const mode = s.mode
  const st = s.ui.stick

  // ---- stick flutuante (só durante o jogo) ----
  if (mode === 'playing' && st.active) {
    ctx.beginPath()
    ctx.arc(st.ox, st.oy, STICK_FULL, 0, TAU)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(st.kx, st.ky, STICK_KNOB_R, 0, TAU)
    ctx.fillStyle = st.engaged ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.45)'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'
    ctx.stroke()
  }

  if (!s.ui.touchMode || (mode !== 'playing' && mode !== 'paused')) {
    ctx.lineWidth = 1
    return
  }

  // ---- botões ⏸/▶ e 🔊/🔇 ----
  const rects = hudRects()
  for (let i = 0; i < rects.length; i++) {
    const b = rects[i]
    const cx = b.x + b.w / 2
    const cy = b.y + b.h / 2
    ctx.beginPath()
    ctx.arc(cx, cy, HUD_BTN_R, 0, TAU)
    ctx.fillStyle = 'rgba(0,0,0,0.62)'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.stroke()
    if (i === HUD_PAUSE) {
      ctx.fillStyle = '#fff'
      if (mode === 'playing') {
        // duas barras 7×22, gap 6
        ctx.fillRect(cx - 10, cy - 11, 7, 22)
        ctx.fillRect(cx + 3, cy - 11, 7, 22)
      } else {
        // ▶ (retomar)
        ctx.beginPath()
        ctx.moveTo(cx - 8, cy - 12)
        ctx.lineTo(cx + 12, cy)
        ctx.lineTo(cx - 8, cy + 12)
        ctx.closePath()
        ctx.fill()
      }
    } else if (i === HUD_MUTE) {
      const img = sprites.get(s.ui.muted ? '🔇' : '🔊', 26)
      ctx.drawImage(img, cx - img.width / 2, cy - img.height / 2)
    }
  }

  // ---- onboarding: some no 1º movimento da run ----
  if (mode === 'playing' && !s.ui.moved) {
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(s.time * 4)
    ctx.font = FONT
    ctx.textAlign = 'center'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 4
    ctx.strokeStyle = 'rgba(15,8,10,0.85)'
    ctx.strokeText(ONBOARDING, 480, 430)
    ctx.fillStyle = '#fff'
    ctx.fillText(ONBOARDING, 480, 430)
    ctx.lineJoin = 'miter'
    ctx.globalAlpha = 1
  }

  ctx.textAlign = 'left'
  ctx.lineWidth = 1
}
