// Entrada de teclado/mouse. Teclado no window, mouse no canvas.
// frame() retorna SEMPRE o mesmo objeto InputFrame (sem alocação por frame);
// endFrame() limpa as flags "pressed this frame" (chamar após o update).

import type { InputFrame } from '../types'
import { VIEW_W, VIEW_H } from '../constants'

export interface InputSys {
  frame(): InputFrame
  endFrame(): void
}

const DIAG = 0.7071067811865476 // 1/sqrt(2)

export function makeInput(canvas: HTMLCanvasElement): InputSys {
  const f: InputFrame = {
    moveX: 0,
    moveY: 0,
    navX: 0,
    navY: 0,
    confirm: false,
    pause: false,
    num: 0,
    mute: false,
    mouseX: 0,
    mouseY: 0,
    click: false,
    mouseMoved: false,
  }

  const held = { up: false, down: false, left: false, right: false }

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    const k = e.key
    if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight' || k === ' ') {
      e.preventDefault()
    }
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
        }
    }
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

  // evita tecla presa ao trocar de aba/janela
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = false
  })

  canvas.addEventListener('mousemove', (e: MouseEvent) => {
    const r = canvas.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) {
      f.mouseX = ((e.clientX - r.left) / r.width) * VIEW_W
      f.mouseY = ((e.clientY - r.top) / r.height) * VIEW_H
    }
    f.mouseMoved = true
  })

  canvas.addEventListener('mousedown', (e: MouseEvent) => {
    if (e.button === 0) f.click = true
  })

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
      f.navX = 0
      f.navY = 0
      f.confirm = false
      f.pause = false
      f.num = 0
      f.mute = false
      f.click = false
      f.mouseMoved = false
    },
  }
}
