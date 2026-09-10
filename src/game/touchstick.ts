// Joystick virtual flutuante: nasce onde o dedo desce, âncora segue o dedo
// além de STICK_FULL (follow), digital com histerese (engaja a DEAD_IN, solta
// a DEAD_OUT). PURO: lê InputFrame.touches, escreve s.ui.stick e slot.stick.
// Sem alocação por frame.

import type { GameState, InputFrame, TouchSlot } from '../types'
import { STICK_ANALOG, STICK_DEAD_IN, STICK_DEAD_OUT, STICK_FULL } from '../constants'
import { hitTest, hudRects } from '../ui/layout'

export function updateStick(s: GameState, input: InputFrame): void {
  const st = s.ui.stick
  const touches = input.touches

  // 1. candidato: continuidade do slot atual; senão o 1º ativo fora do HUD.
  // Exige slot.stick: o stick fica congelado em paused/levelup, e um dedo NOVO
  // com pointerId reutilizado (pointers.down zera slot.stick) não é continuidade.
  let slot: TouchSlot | null = null
  if (st.active) {
    for (let i = 0; i < touches.length; i++) {
      const t = touches[i]
      if (t.active && t.stick && t.id === st.id) { slot = t; break }
    }
  }
  if (slot === null) {
    for (let i = 0; i < touches.length; i++) {
      const t = touches[i]
      if (!t.active) continue
      if (s.ui.touchMode && hitTest(hudRects(), t.startX, t.startY) >= 0) continue
      slot = t
      break
    }
  }

  // 2. sem dedo → stick solto
  if (slot === null) {
    st.active = false
    st.id = -1
    st.engaged = false
    st.mx = 0
    st.my = 0
    return
  }

  // 3. dedo novo (ou slot reiniciado com o mesmo id) → âncora no ponto de toque
  if (!st.active || st.id !== slot.id || !slot.stick) {
    st.ox = slot.startX
    st.oy = slot.startY
    st.id = slot.id
    st.active = true
    st.engaged = false
    st.mx = 0
    st.my = 0
  }

  // 4. o slot nunca mais gera tap
  slot.stick = true

  // 5. follow: além do anel a âncora avança na direção do dedo
  let dx = slot.x - st.ox
  let dy = slot.y - st.oy
  let d = Math.sqrt(dx * dx + dy * dy)
  if (d > STICK_FULL) {
    const over = d - STICK_FULL
    st.ox += (dx / d) * over
    st.oy += (dy / d) * over
    dx = (dx / d) * STICK_FULL
    dy = (dy / d) * STICK_FULL
    d = STICK_FULL
  }
  st.kx = st.ox + dx
  st.ky = st.oy + dy

  // 6. histerese
  if (!st.engaged && d >= STICK_DEAD_IN) st.engaged = true
  else if (st.engaged && d <= STICK_DEAD_OUT) st.engaged = false

  // 7. vetor de movimento (entre DEAD_OUT e DEAD_IN, engajado, mantém o anterior)
  if (!st.engaged) {
    st.mx = 0
    st.my = 0
  } else if (d >= STICK_DEAD_IN) {
    let mag = 1
    if (STICK_ANALOG) {
      mag = (d - STICK_DEAD_IN) / (STICK_FULL - STICK_DEAD_IN)
      if (mag < 0) mag = 0
      else if (mag > 1) mag = 1
    }
    st.mx = (dx / d) * mag
    st.my = (dy / d) * mag
  }
}
