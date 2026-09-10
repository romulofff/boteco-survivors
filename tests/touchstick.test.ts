import { describe, expect, it } from 'vitest'
import type { GameState } from '../src/types'
import { PLAYER_BASE_SPEED } from '../src/constants'
import { makePointerLogic } from '../src/core/pointers'
import { makeGameState, startRun } from '../src/game/state'
import { updateStick } from '../src/game/touchstick'
import { updatePlayer } from '../src/game/player'
import { hudRects } from '../src/ui/layout'
import { defaultSave } from '../src/save/storage'
import { makeFrame } from './_input'

function setup(): GameState {
  const s = makeGameState(1)
  startRun(s, 'garcom', defaultSave())
  s.mode = 'playing'
  s.ui.touchMode = true
  return s
}

function press(f: ReturnType<typeof makeFrame>, i: number, id: number, x: number, y: number): void {
  const t = f.touches[i]
  t.active = true
  t.id = id
  t.startX = x
  t.startY = y
  t.x = x
  t.y = y
  t.moved = false
  t.stick = false
}

describe('touchstick', () => {
  it('sem slots → inativo', () => {
    const s = setup()
    const f = makeFrame()
    updateStick(s, f)
    expect(s.ui.stick.active).toBe(false)
    expect(s.ui.stick.id).toBe(-1)
    expect(s.ui.stick.mx).toBe(0)
    expect(s.ui.stick.my).toBe(0)
  })

  it('histerese: engaja a 10, mantém a 7, solta a 4', () => {
    const s = setup()
    const f = makeFrame()
    press(f, 0, 1, 200, 200)
    updateStick(s, f)
    expect(s.ui.stick.active).toBe(true)
    expect(s.ui.stick.engaged).toBe(false)
    expect(s.ui.stick.mx).toBe(0)
    f.touches[0].x = 209
    updateStick(s, f)
    expect(s.ui.stick.engaged).toBe(false)
    expect(s.ui.stick.mx).toBe(0)
    f.touches[0].x = 210
    updateStick(s, f)
    expect(s.ui.stick.engaged).toBe(true)
    expect(s.ui.stick.mx).toBe(1)
    expect(s.ui.stick.my).toBe(0)
    expect(s.ui.stick.kx).toBe(s.ui.stick.ox + 10)
    f.touches[0].x = 207
    updateStick(s, f)
    expect(s.ui.stick.engaged).toBe(true)
    expect(s.ui.stick.mx).toBe(1)
    f.touches[0].x = 204
    updateStick(s, f)
    expect(s.ui.stick.engaged).toBe(false)
    expect(s.ui.stick.mx).toBe(0)
  })

  it('diagonal normalizada e digital (|v| = 1)', () => {
    const s = setup()
    const f = makeFrame()
    press(f, 0, 1, 200, 200)
    f.touches[0].x = 240
    f.touches[0].y = 240
    updateStick(s, f)
    const st = s.ui.stick
    expect(Math.hypot(st.mx, st.my)).toBeCloseTo(1, 5)
    expect(st.mx).toBeCloseTo(0.7071, 3)
    expect(st.my).toBeCloseTo(0.7071, 3)
    f.touches[0].x = 230
    f.touches[0].y = 200
    updateStick(s, f)
    expect(Math.hypot(st.mx, st.my)).toBeCloseTo(1, 5)
  })

  it('follow: âncora segue o dedo além de STICK_FULL; inversão imediata', () => {
    const s = setup()
    const f = makeFrame()
    press(f, 0, 1, 200, 200)
    f.touches[0].x = 300
    updateStick(s, f)
    expect(s.ui.stick.ox).toBeCloseTo(244, 5)
    expect(s.ui.stick.kx).toBeCloseTo(300, 5)
    expect(s.ui.stick.mx).toBe(1)
    // dedo no centro da âncora = parado (d=0 desengaja)
    f.touches[0].x = 244
    updateStick(s, f)
    expect(s.ui.stick.mx).toBe(0)
    // 10px à esquerda da âncora que seguiu: inversão imediata (sem follow seria +1)
    f.touches[0].x = 234
    updateStick(s, f)
    expect(s.ui.stick.mx).toBe(-1)
  })

  it('início no HUD não vira stick em touchMode; vira sem touchMode', () => {
    const s = setup()
    const f = makeFrame()
    const h = hudRects()[0]
    press(f, 0, 1, h.x + 10, h.y + 10)
    updateStick(s, f)
    expect(s.ui.stick.active).toBe(false)
    expect(f.touches[0].stick).toBe(false)
    s.ui.touchMode = false
    updateStick(s, f)
    expect(s.ui.stick.active).toBe(true)
  })

  it('slot.stick = true após o 1º update; slot livre → inativo', () => {
    const s = setup()
    const f = makeFrame()
    press(f, 0, 5, 100, 100)
    updateStick(s, f)
    expect(f.touches[0].stick).toBe(true)
    expect(s.ui.stick.id).toBe(5)
    f.touches[0].active = false
    f.touches[0].id = -1
    updateStick(s, f)
    expect(s.ui.stick.active).toBe(false)
    expect(s.ui.stick.id).toBe(-1)
  })

  it('continuidade: 2º dedo não rouba o stick', () => {
    const s = setup()
    const f = makeFrame()
    // stick no slot 1 e dedo novo no slot 0: sem o passo 1 o fallback pegaria o 0
    press(f, 1, 1, 100, 100)
    updateStick(s, f)
    press(f, 0, 2, 500, 300)
    updateStick(s, f)
    expect(s.ui.stick.id).toBe(1)
    expect(f.touches[0].stick).toBe(false)
    expect(f.touches[1].stick).toBe(true)
    expect(s.ui.stick.ox).toBe(100)
    expect(s.ui.stick.oy).toBe(100)
  })

  it('id reutilizado: dedo novo com o mesmo pointerId re-ancora (não herda a âncora)', () => {
    const s = setup()
    const f = makeFrame()
    const p = makePointerLogic(f)
    p.down(1, 100, 100, 'touch', 0)
    p.move(1, 160, 100, 'touch')
    updateStick(s, f)
    expect(s.ui.stick.engaged).toBe(true)
    expect(s.ui.stick.mx).toBe(1)
    // stick congelado (paused/levelup): dedo sobe e outro desce com o mesmo id
    p.up(1, 160, 100, 'touch')
    p.down(1, 500, 300, 'touch', 0)
    updateStick(s, f)
    expect(s.ui.stick.active).toBe(true)
    expect(s.ui.stick.id).toBe(1)
    expect(s.ui.stick.ox).toBe(500)
    expect(s.ui.stick.oy).toBe(300)
    expect(s.ui.stick.engaged).toBe(false)
    expect(s.ui.stick.mx).toBe(0)
    expect(s.ui.stick.my).toBe(0)
    expect(f.touches[0].stick).toBe(true)
    // slot reiniciado com o mesmo id cujo início caiu no HUD também não é continuidade
    p.up(1, 500, 300, 'touch')
    const h = hudRects()[0]
    p.down(1, h.x + 10, h.y + 10, 'touch', 0)
    updateStick(s, f)
    expect(s.ui.stick.active).toBe(false)
    expect(f.touches[0].stick).toBe(false)
  })

  it('updatePlayer: stick move o player; teclado vence', () => {
    const s = setup()
    const f = makeFrame()
    press(f, 0, 1, 200, 200)
    f.touches[0].x = 260
    const x0 = s.player.x
    for (let i = 0; i < 60; i++) {
      updateStick(s, f)
      updatePlayer(s, f, 1 / 60)
    }
    const expected = PLAYER_BASE_SPEED * s.player.stats.speed
    expect(Math.abs(s.player.x - x0 - expected)).toBeLessThan(2)

    // teclado pra direita + stick pra esquerda → anda pra direita
    f.touches[0].x = 140
    f.moveX = 1
    const x1 = s.player.x
    updateStick(s, f)
    expect(s.ui.stick.mx).toBe(-1)
    updatePlayer(s, f, 1 / 60)
    expect(s.player.x).toBeGreaterThan(x1)
  })
})
