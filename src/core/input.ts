// Adaptador DOM de entrada: teclado no window, ponteiros (mouse/toque/caneta)
// via Pointer Events no window. A lógica de ponteiros é pura (core/pointers.ts).
// frame() retorna SEMPRE o mesmo objeto InputFrame (sem alocação por frame);
// endFrame() limpa as flags "pressed this frame" (chamar após o update).

import type { InputFrame, InputSource } from '../types'
import { VIEW_W, VIEW_H } from '../constants'
import { makeInputFrame, clearFrameFlags } from './inputframe'
import { makePointerLogic } from './pointers'

export interface InputSys {
  frame(): InputFrame
  endFrame(): void
  /** solta teclas e toques (blur, aba oculta, retrato) */
  reset(): void
}

const DIAG = 0.7071067811865476 // 1/sqrt(2)

export function makeInput(canvas: HTMLCanvasElement): InputSys {
  const f = makeInputFrame()
  // boot: aparelho sem hover e com ponteiro grosso = touch (HUD ⏸/🔊 e dicas certas já no menu)
  if (typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
    f.lastInput = 'touch'
  }
  const logic = makePointerLogic(f)
  const held = { up: false, down: false, left: false, right: false }

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    const k = e.key
    if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight' || k === ' ') {
      e.preventDefault()
    }
    let handled = true
    switch (k) {
      case 'w':
      case 'W':
      case 'ArrowUp':
        held.up = true
        if (!e.repeat) f.navY = -1
        break
      case 's':
      case 'S':
      case 'ArrowDown':
        held.down = true
        if (!e.repeat) f.navY = 1
        break
      case 'a':
      case 'A':
      case 'ArrowLeft':
        held.left = true
        if (!e.repeat) f.navX = -1
        break
      case 'd':
      case 'D':
      case 'ArrowRight':
        held.right = true
        if (!e.repeat) f.navX = 1
        break
      case 'Enter':
      case ' ':
        if (!e.repeat) f.confirm = true
        break
      case 'Escape':
      case 'p':
      case 'P':
        if (!e.repeat) f.pause = true
        break
      case 'm':
      case 'M':
        if (!e.repeat) f.mute = true
        break
      default:
        if (!e.repeat && k.length === 1 && k >= '1' && k <= '9') {
          f.num = k.charCodeAt(0) - 48
        } else {
          handled = false
        }
    }
    if (handled) f.lastInput = 'keyboard'
  })

  window.addEventListener('keyup', (e: KeyboardEvent) => {
    switch (e.key) {
      case 'w':
      case 'W':
      case 'ArrowUp':
        held.up = false
        break
      case 's':
      case 'S':
      case 'ArrowDown':
        held.down = false
        break
      case 'a':
      case 'A':
      case 'ArrowLeft':
        held.left = false
        break
      case 'd':
      case 'D':
      case 'ArrowRight':
        held.right = false
        break
    }
  })

  function reset(): void {
    held.up = held.down = held.left = held.right = false
    logic.cancelAll()
  }

  // evita tecla/dedo preso ao trocar de aba/janela
  window.addEventListener('blur', reset)

  // ---- ponteiros: coords lógicas SEM clamp (toque no letterbox vale; o stick
  // flutuante traz o anel pra dentro via follow) ----
  let lx = 0
  let ly = 0
  function toLogical(e: PointerEvent): boolean {
    const r = canvas.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) return false
    lx = ((e.clientX - r.left) / r.width) * VIEW_W
    ly = ((e.clientY - r.top) / r.height) * VIEW_H
    return true
  }
  function kindOf(e: PointerEvent): InputSource {
    return e.pointerType === 'mouse' ? 'mouse' : 'touch' // caneta conta como toque
  }

  window.addEventListener('pointerdown', (e: PointerEvent) => {
    // overlay de retrato absorve o toque (não vira gesto do jogo)
    if (e.target instanceof Element && e.target.closest('#rotate')) return
    if (e.pointerType !== 'mouse') e.preventDefault()
    if (!toLogical(e)) return
    logic.down(e.pointerId, lx, ly, kindOf(e), e.button)
  })
  window.addEventListener('pointermove', (e: PointerEvent) => {
    if (!toLogical(e)) return
    logic.move(e.pointerId, lx, ly, kindOf(e))
  })
  window.addEventListener('pointerup', (e: PointerEvent) => {
    if (!toLogical(e)) return
    logic.up(e.pointerId, lx, ly, kindOf(e))
  })
  window.addEventListener('pointercancel', (e: PointerEvent) => {
    logic.cancel(e.pointerId)
  })
  // rede extra: Safari às vezes não entrega pointerup/cancel do último dedo
  const onTouchEnd = (e: TouchEvent): void => {
    if (e.touches.length === 0) logic.cancelAll()
  }
  window.addEventListener('touchend', onTouchEnd, { passive: true })
  window.addEventListener('touchcancel', onTouchEnd, { passive: true })

  // higiene: sem menu de contexto no canvas (long-press / botão direito)
  canvas.addEventListener('contextmenu', (e) => e.preventDefault())

  return {
    frame(): InputFrame {
      let mx = (held.right ? 1 : 0) - (held.left ? 1 : 0)
      let my = (held.down ? 1 : 0) - (held.up ? 1 : 0)
      if (mx !== 0 && my !== 0) {
        mx *= DIAG
        my *= DIAG
      }
      f.moveX = mx
      f.moveY = my
      return f
    },
    endFrame(): void {
      clearFrameFlags(f)
    },
    reset,
  }
}
