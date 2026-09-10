import { describe, expect, it } from 'vitest'
import { makePointerLogic } from '../src/core/pointers'
import { clearFrameFlags } from '../src/core/inputframe'
import { makeFrame } from './_input'

describe('pointers (lógica pura)', () => {
  it('mouse: move escreve mouseX/Y + mouseMoved; down botão 0 = click, botão 2 não', () => {
    const f = makeFrame()
    const p = makePointerLogic(f)
    p.move(1, 100, 200, 'mouse')
    expect(f.mouseX).toBe(100)
    expect(f.mouseY).toBe(200)
    expect(f.mouseMoved).toBe(true)
    expect(f.lastInput).toBe('mouse')
    p.down(1, 100, 200, 'mouse', 0)
    expect(f.click).toBe(true)
    clearFrameFlags(f)
    p.down(1, 100, 200, 'mouse', 2)
    expect(f.click).toBe(false)
    // mouse não ocupa slot
    expect(f.touches[0].active).toBe(false)
  })

  it('touch down: ocupa slots em ordem, 3º dedo ignorado, up do 3º é no-op', () => {
    const f = makeFrame()
    const p = makePointerLogic(f)
    p.down(10, 50, 60, 'touch', 0)
    expect(f.touches[0].active).toBe(true)
    expect(f.touches[0].id).toBe(10)
    expect(f.touches[0].startX).toBe(50)
    expect(f.touches[0].startY).toBe(60)
    expect(f.mouseMoved).toBe(true)
    expect(f.mouseX).toBe(50)
    expect(f.mouseY).toBe(60)
    expect(f.lastInput).toBe('touch')
    p.down(11, 70, 80, 'touch', 0)
    expect(f.touches[1].active).toBe(true)
    expect(f.touches[1].id).toBe(11)
    p.down(12, 90, 90, 'touch', 0)
    expect(f.touches[0].id).toBe(10)
    expect(f.touches[1].id).toBe(11)
    clearFrameFlags(f)
    p.up(12, 90, 90, 'touch')
    expect(f.click).toBe(false)
    expect(f.touches[0].active).toBe(true)
    expect(f.touches[1].active).toBe(true)
  })

  it('touch move NÃO altera mouseX/Y nem mouseMoved', () => {
    const f = makeFrame()
    const p = makePointerLogic(f)
    p.down(1, 100, 100, 'touch', 0)
    clearFrameFlags(f)
    p.move(1, 300, 300, 'touch')
    expect(f.mouseX).toBe(100)
    expect(f.mouseY).toBe(100)
    expect(f.mouseMoved).toBe(false)
    expect(f.touches[0].x).toBe(300)
    expect(f.touches[0].y).toBe(300)
    expect(f.touches[0].moved).toBe(true)
  })

  it('tap: down → up a 8px gera click no ponto do up e libera o slot (sem limite de tempo)', () => {
    const f = makeFrame()
    const p = makePointerLogic(f)
    p.down(1, 100, 100, 'touch', 0)
    clearFrameFlags(f)
    p.move(1, 108, 100, 'touch')
    expect(f.touches[0].moved).toBe(false)
    p.up(1, 108, 100, 'touch')
    expect(f.click).toBe(true)
    expect(f.mouseX).toBe(108)
    expect(f.mouseY).toBe(100)
    expect(f.touches[0].active).toBe(false)
    expect(f.touches[0].id).toBe(-1)
    // "5 s depois" (a lógica não tem noção de tempo): ainda é tap
    clearFrameFlags(f)
    p.down(2, 10, 10, 'touch', 0)
    for (let i = 0; i < 300; i++) clearFrameFlags(f)
    p.up(2, 10, 10, 'touch')
    expect(f.click).toBe(true)
  })

  it('não-tap: move 13px marca moved e up não gera click; slot stick também não', () => {
    const f = makeFrame()
    const p = makePointerLogic(f)
    p.down(1, 100, 100, 'touch', 0)
    clearFrameFlags(f)
    p.move(1, 113, 100, 'touch')
    expect(f.touches[0].moved).toBe(true)
    p.up(1, 113, 100, 'touch')
    expect(f.click).toBe(false)
    expect(f.touches[0].active).toBe(false)

    p.down(2, 100, 100, 'touch', 0)
    clearFrameFlags(f)
    f.touches[0].stick = true
    p.up(2, 100, 100, 'touch')
    expect(f.click).toBe(false)
    expect(f.touches[0].stick).toBe(false)
  })

  it('cancel/cancelAll liberam sem click; down com id ativo reinicia o slot', () => {
    const f = makeFrame()
    const p = makePointerLogic(f)
    p.down(1, 100, 100, 'touch', 0)
    clearFrameFlags(f)
    p.cancel(1)
    expect(f.click).toBe(false)
    expect(f.touches[0].active).toBe(false)

    p.down(1, 100, 100, 'touch', 0)
    p.down(2, 200, 200, 'touch', 0)
    clearFrameFlags(f)
    p.cancelAll()
    expect(f.click).toBe(false)
    expect(f.touches[0].active).toBe(false)
    expect(f.touches[1].active).toBe(false)

    p.down(7, 100, 100, 'touch', 0)
    p.move(7, 150, 150, 'touch')
    f.touches[0].stick = true
    p.down(7, 300, 300, 'touch', 0) // iOS reutiliza ids
    expect(f.touches[0].active).toBe(true)
    expect(f.touches[0].id).toBe(7)
    expect(f.touches[0].startX).toBe(300)
    expect(f.touches[0].moved).toBe(false)
    expect(f.touches[0].stick).toBe(false)
    expect(f.touches[1].active).toBe(false)
  })

  it('clearFrameFlags limpa flags de frame e preserva touches/lastInput/mouse/move', () => {
    const f = makeFrame({
      navX: 1, navY: -1, confirm: true, pause: true, num: 3, mute: true,
      click: true, mouseMoved: true, mouseX: 11, mouseY: 22, moveX: 0.5, moveY: -0.5,
      lastInput: 'touch',
    })
    f.touches[0].active = true
    f.touches[0].id = 9
    clearFrameFlags(f)
    expect(f.navX).toBe(0)
    expect(f.navY).toBe(0)
    expect(f.confirm).toBe(false)
    expect(f.pause).toBe(false)
    expect(f.num).toBe(0)
    expect(f.mute).toBe(false)
    expect(f.click).toBe(false)
    expect(f.mouseMoved).toBe(false)
    expect(f.mouseX).toBe(11)
    expect(f.mouseY).toBe(22)
    expect(f.moveX).toBe(0.5)
    expect(f.moveY).toBe(-0.5)
    expect(f.lastInput).toBe('touch')
    expect(f.touches[0].active).toBe(true)
    expect(f.touches[0].id).toBe(9)
  })
})
