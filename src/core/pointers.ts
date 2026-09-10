// Máquina de estado de ponteiros (mouse + até MAX_TOUCHES dedos) → InputFrame.
// PURA (sem DOM): core/input.ts é o adaptador de Pointer Events.
// Sem alocação: os slots vivem em f.touches (pré-alocados por makeInputFrame).
//
// Semântica de toque:
// - down escreve mouseX/Y + mouseMoved (press = highlight/hover) e ocupa um slot
// - move só atualiza o slot (NÃO escreve mouseX/Y — fecha a race de 2 dedos)
// - up que qualificou como tap (!moved && !stick) escreve click + mouseX/Y no ponto do up
// - slot.stick é setado por game/touchstick.ts: dedo que virou joystick nunca gera tap

import type { InputFrame, InputSource, TouchSlot } from '../types'
import { TAP_SLOP } from '../constants'

export interface PointerLogic {
  down(id: number, x: number, y: number, kind: InputSource, button: number): void
  move(id: number, x: number, y: number, kind: InputSource): void
  up(id: number, x: number, y: number, kind: InputSource): void
  cancel(id: number): void
  cancelAll(): void
}

const TAP_SLOP_SQ = TAP_SLOP * TAP_SLOP

function release(slot: TouchSlot): void {
  slot.active = false
  slot.id = -1
  slot.moved = false
  slot.stick = false
}

export function makePointerLogic(f: InputFrame): PointerLogic {
  const touches = f.touches

  function find(id: number): TouchSlot | null {
    for (let i = 0; i < touches.length; i++) {
      const t = touches[i]
      if (t.active && t.id === id) return t
    }
    return null
  }

  return {
    down(id, x, y, kind, button): void {
      if (kind === 'mouse') {
        f.lastInput = 'mouse'
        f.mouseX = x
        f.mouseY = y
        if (button === 0) f.click = true
        return
      }
      f.lastInput = 'touch'
      // iOS reutiliza pointerIds: down com id já ativo reinicia o slot
      let slot = find(id)
      if (slot === null) {
        for (let i = 0; i < touches.length; i++) {
          if (!touches[i].active) { slot = touches[i]; break }
        }
      }
      if (slot === null) return // sem slot livre: ignora o 3º dedo
      slot.active = true
      slot.id = id
      slot.startX = x
      slot.startY = y
      slot.x = x
      slot.y = y
      slot.moved = false
      slot.stick = false
      // press → hover/sel (highlight do botão sob o dedo)
      f.mouseX = x
      f.mouseY = y
      f.mouseMoved = true
    },

    move(id, x, y, kind): void {
      if (kind === 'mouse') {
        f.lastInput = 'mouse'
        f.mouseX = x
        f.mouseY = y
        f.mouseMoved = true
        return
      }
      const slot = find(id)
      if (slot === null) return
      slot.x = x
      slot.y = y
      if (!slot.moved) {
        const dx = x - slot.startX
        const dy = y - slot.startY
        if (dx * dx + dy * dy > TAP_SLOP_SQ) slot.moved = true
      }
    },

    up(id, x, y, kind): void {
      if (kind === 'mouse') return
      const slot = find(id)
      if (slot === null) return
      if (!slot.moved && !slot.stick) {
        f.click = true
        f.mouseX = x
        f.mouseY = y
      }
      release(slot)
    },

    cancel(id): void {
      const slot = find(id)
      if (slot !== null) release(slot)
    },

    cancelAll(): void {
      for (let i = 0; i < touches.length; i++) release(touches[i])
    },
  }
}
