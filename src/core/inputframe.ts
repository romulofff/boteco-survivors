// InputFrame: única fonte do literal (input.ts, headless.ts e testes usam daqui).
// Sem DOM. clearFrameFlags = limpeza das flags "pressed this frame".

import type { InputFrame, TouchSlot } from '../types'
import { MAX_TOUCHES } from '../constants'

function makeSlot(): TouchSlot {
  return { active: false, id: -1, startX: 0, startY: 0, x: 0, y: 0, moved: false, stick: false }
}

export function makeInputFrame(): InputFrame {
  const touches: TouchSlot[] = []
  for (let i = 0; i < MAX_TOUCHES; i++) touches.push(makeSlot())
  return {
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
    touches,
    lastInput: 'keyboard',
  }
}

/** zera nav/confirm/pause/num/mute/click/mouseMoved; NÃO toca touches, lastInput, mouseX/Y, moveX/Y */
export function clearFrameFlags(f: InputFrame): void {
  f.navX = 0
  f.navY = 0
  f.confirm = false
  f.pause = false
  f.num = 0
  f.mute = false
  f.click = false
  f.mouseMoved = false
}
