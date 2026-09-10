// Layout dos botões de cada tela — PURO (sem DOM).
// Contrato compartilhado: game/update.ts usa para hit-test/navegação;
// ui/screens.ts usa para desenhar. Os ids são estáveis.
//
// Convenção de navegação: state.ui.sel indexa o array retornado pela função
// da tela corrente. Teclado (navX/navY) move sel; hover do mouse define sel
// (quando mouseMoved); confirm/click ativam o botão rects[sel].

import type { Btn } from '../types'
import { VIEW_W, BTN_H, HUD_BTN } from '../constants'

const CX = VIEW_W / 2
/** y máximo (borda inferior) de qualquer botão — home indicator do iPhone */
const SAFE_BOTTOM = 508

/** índice do 1º rect contendo (x,y), -1 se nenhum (borda direita/inferior exclusiva) */
export function hitTest(rects: readonly Btn[], x: number, y: number): number {
  for (let i = 0; i < rects.length; i++) {
    const b = rects[i]
    if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return i
  }
  return -1
}

// ---------- HUD touch (⏸ / 🔊) ----------
export const HUD_PAUSE = 0
export const HUD_MUTE = 1
const HUD_RECTS: readonly Btn[] = [
  { x: VIEW_W - 8 - HUD_BTN, y: 8, w: HUD_BTN, h: HUD_BTN, id: 'pause' }, // centro (916,44)
  { x: VIEW_W - 8 - HUD_BTN * 2 - 8, y: 8, w: HUD_BTN, h: HUD_BTN, id: 'mute' }, // centro (836,44)
]
/** ids 'pause','mute' — ARRAY CACHEADO (mesma referência sempre; não mutar) */
export function hudRects(): readonly Btn[] {
  return HUD_RECTS
}

/** ids: 'play', 'shop' */
export function menuRects(): Btn[] {
  const w = 300
  const h = BTN_H
  const x = CX - w / 2
  return [
    { x, y: 290, w, h, id: 'play' },
    { x, y: 374, w, h, id: 'shop' },
  ]
}

/** ids: 'char0'..'charN-1', 'back' */
export function charSelectRects(n: number): Btn[] {
  const w = 220
  const h = 280
  const gap = 30
  const total = n * w + (n - 1) * gap
  const x0 = CX - total / 2
  const btns: Btn[] = []
  for (let i = 0; i < n; i++) {
    btns.push({ x: x0 + i * (w + gap), y: 130, w, h, id: 'char' + i })
  }
  btns.push({ x: 20, y: SAFE_BOTTOM - BTN_H, w: 160, h: BTN_H, id: 'back' })
  return btns
}

/** ids: 'meta0'..'metaN-1', 'back' — grid 3 colunas */
export function shopRects(n: number): Btn[] {
  const cols = 3
  const w = 280
  const h = 110
  const gapX = 20
  const gapY = 16
  const x0 = CX - (cols * w + (cols - 1) * gapX) / 2
  const y0 = 120
  const btns: Btn[] = []
  for (let i = 0; i < n; i++) {
    const c = i % cols
    const r = Math.floor(i / cols)
    btns.push({ x: x0 + c * (w + gapX), y: y0 + r * (h + gapY), w, h, id: 'meta' + i })
  }
  btns.push({ x: 20, y: SAFE_BOTTOM - BTN_H, w: 160, h: BTN_H, id: 'back' })
  return btns
}

/** ids: 'opt0'..'optN-1' — cards horizontais centralizados */
export function levelupRects(n: number): Btn[] {
  const w = 260
  const h = 290
  const gap = 24
  const total = n * w + (n - 1) * gap
  const x0 = CX - total / 2
  const btns: Btn[] = []
  for (let i = 0; i < n; i++) {
    btns.push({ x: x0 + i * (w + gap), y: 120, w, h, id: 'opt' + i })
  }
  return btns
}

/** ids: 'resume', 'quit' */
export function pauseRects(): Btn[] {
  const w = 260
  const h = BTN_H
  const x = CX - w / 2
  return [
    { x, y: 236, w, h, id: 'resume' },
    { x, y: 320, w, h, id: 'quit' },
  ]
}

/** ids: 'menu' — tela de gameover/vitória */
export function endRects(): Btn[] {
  return [{ x: CX - 130, y: 408, w: 260, h: BTN_H, id: 'menu' }]
}
