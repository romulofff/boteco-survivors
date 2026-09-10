import { describe, expect, it } from 'vitest'
import type { GameContext, GameState } from '../src/types'
import { clearFrameFlags } from '../src/core/inputframe'
import { makePointerLogic } from '../src/core/pointers'
import { makeGameState, startRun } from '../src/game/state'
import { updateGame } from '../src/game/update'
import { defaultSave } from '../src/save/storage'
import { makeFrame } from './_input'

const DT = 1 / 60

function ctx(): GameContext {
  return { save: defaultSave(), persist() {} }
}

function playing(): { s: GameState; c: GameContext } {
  const s = makeGameState(3)
  const c = ctx()
  startRun(s, 'garcom', c.save)
  return { s, c }
}

describe('update: touch / mute / desistir', () => {
  it('touchMode espelha lastInput', () => {
    const s = makeGameState(1)
    const c = ctx()
    updateGame(s, makeFrame({ lastInput: 'touch' }), DT, c)
    expect(s.ui.touchMode).toBe(true)
    updateGame(s, makeFrame({ lastInput: 'keyboard' }), DT, c)
    expect(s.ui.touchMode).toBe(false)
  })

  it('playing + touchMode: tap em ⏸ pausa, tap em 🔊 alterna mute; sem touchMode nada', () => {
    const { s, c } = playing()
    updateGame(s, makeFrame({ lastInput: 'touch', click: true, mouseX: 916, mouseY: 44 }), DT, c)
    expect(s.mode).toBe('paused')
    expect(s.sounds).toContain('click')

    const p2 = playing()
    updateGame(p2.s, makeFrame({ lastInput: 'touch', click: true, mouseX: 836, mouseY: 44 }), DT, p2.c)
    expect(p2.s.ui.muted).toBe(true)
    expect(p2.s.mode).toBe('playing')
    updateGame(p2.s, makeFrame({ lastInput: 'touch', click: true, mouseX: 836, mouseY: 44 }), DT, p2.c)
    expect(p2.s.ui.muted).toBe(false)

    const p3 = playing()
    updateGame(p3.s, makeFrame({ lastInput: 'mouse', click: true, mouseX: 916, mouseY: 44 }), DT, p3.c)
    expect(p3.s.mode).toBe('playing')
    updateGame(p3.s, makeFrame({ lastInput: 'mouse', click: true, mouseX: 836, mouseY: 44 }), DT, p3.c)
    expect(p3.s.ui.muted).toBe(false)
  })

  it('paused + touchMode: tap em ▶ retoma', () => {
    const { s, c } = playing()
    s.mode = 'paused'
    updateGame(s, makeFrame({ lastInput: 'touch', click: true, mouseX: 916, mouseY: 44 }), DT, c)
    expect(s.mode).toBe('playing')
  })

  it('pausa com 2º dedo: stick preso retoma sem re-toque; id reutilizado não anda sozinho', () => {
    const { s, c } = playing()
    const f = makeFrame()
    const p = makePointerLogic(f)
    const step = (): void => {
      updateGame(s, f, DT, c)
      clearFrameFlags(f)
    }
    // dedo 1 arrasta 80px → stick engajado
    p.down(1, 300, 300, 'touch', 0)
    p.move(1, 380, 300, 'touch')
    for (let i = 0; i < 5; i++) step()
    expect(s.ui.stick.engaged).toBe(true)
    const stickId = s.ui.stick.id
    // dedo 2 tapa ⏸ → paused (stick fica congelado, dedo 1 no chão)
    p.down(2, 916, 44, 'touch', 0)
    p.up(2, 916, 44, 'touch')
    step()
    expect(s.mode).toBe('paused')
    const xPaused = s.player.x
    for (let i = 0; i < 5; i++) step()
    expect(s.player.x).toBe(xPaused)
    // dedo 2 tapa ▶ → playing; o dedo 1 continua sendo o stick sem novo toque
    p.down(2, 916, 44, 'touch', 0)
    p.up(2, 916, 44, 'touch')
    step()
    expect(s.mode).toBe('playing')
    for (let i = 0; i < 30; i++) step()
    expect(s.ui.stick.id).toBe(stickId)
    expect(s.ui.stick.engaged).toBe(true)
    expect(s.player.x - xPaused).toBeGreaterThan(30)

    // pausa de novo; dedo 1 sobe na pausa (sem tap) e outro desce com o MESMO id, parado
    p.down(2, 916, 44, 'touch', 0)
    p.up(2, 916, 44, 'touch')
    step()
    expect(s.mode).toBe('paused')
    p.up(1, 380, 300, 'touch')
    step()
    expect(s.mode).toBe('paused') // slot.stick: soltar o stick não gera tap
    p.down(1, 700, 400, 'touch', 0)
    p.down(2, 916, 44, 'touch', 0)
    p.up(2, 916, 44, 'touch')
    step()
    expect(s.mode).toBe('playing')
    const x1 = s.player.x
    for (let i = 0; i < 30; i++) step()
    expect(s.ui.stick.active).toBe(true)
    expect(s.ui.stick.ox).toBe(700)
    expect(s.ui.stick.oy).toBe(400)
    expect(s.ui.stick.engaged).toBe(false)
    expect(s.player.x).toBe(x1)
  })

  it('tecla M alterna mute em qualquer modo', () => {
    const s = makeGameState(1)
    const c = ctx()
    updateGame(s, makeFrame({ mute: true }), DT, c)
    expect(s.ui.muted).toBe(true)
    updateGame(s, makeFrame({ mute: true }), DT, c)
    expect(s.ui.muted).toBe(false)
  })

  it('desistir em 2 toques; expira em 3 s', () => {
    const { s, c } = playing()
    s.mode = 'paused'
    updateGame(s, makeFrame({ lastInput: 'touch', click: true, mouseX: 480, mouseY: 354 }), DT, c)
    expect(s.mode).toBe('paused')
    expect(s.ui.quitArmed).toBeGreaterThan(0)
    updateGame(s, makeFrame({ lastInput: 'touch', click: true, mouseX: 480, mouseY: 354 }), DT, c)
    expect(s.mode).toBe('menu')
    expect(c.save.runs).toBe(1)
    expect(s.ui.quitArmed).toBe(0)

    const p2 = playing()
    p2.s.mode = 'paused'
    updateGame(p2.s, makeFrame({ lastInput: 'touch', click: true, mouseX: 480, mouseY: 354 }), DT, p2.c)
    expect(p2.s.ui.quitArmed).toBeGreaterThan(0)
    for (let i = 0; i < 186; i++) updateGame(p2.s, makeFrame({ lastInput: 'touch' }), DT, p2.c) // 3,1 s
    expect(p2.s.ui.quitArmed).toBe(0)
    expect(p2.s.mode).toBe('paused')
    // teclado: mesma confirmação (sel 1 = quit)
    p2.s.ui.sel = 1
    updateGame(p2.s, makeFrame({ confirm: true }), DT, p2.c)
    expect(p2.s.mode).toBe('paused')
    expect(p2.s.ui.quitArmed).toBeGreaterThan(0)
    updateGame(p2.s, makeFrame({ confirm: true }), DT, p2.c)
    expect(p2.s.mode).toBe('menu')
  })

  it('menu: tap em (480,324) abre a seleção (rects novos)', () => {
    const s = makeGameState(1)
    updateGame(s, makeFrame({ lastInput: 'touch', click: true, mouseX: 480, mouseY: 324 }), DT, ctx())
    expect(s.mode).toBe('charselect')
  })

  it('startRun zera moved/quitArmed/stick', () => {
    const { s, c } = playing()
    s.ui.moved = true
    s.ui.quitArmed = 2
    s.ui.stick.active = true
    s.ui.stick.id = 4
    const stickRef = s.ui.stick
    startRun(s, 'garcom', c.save)
    expect(s.ui.moved).toBe(false)
    expect(s.ui.quitArmed).toBe(0)
    expect(s.ui.stick.active).toBe(false)
    expect(s.ui.stick.id).toBe(-1)
    expect(s.ui.stick).toBe(stickRef)
  })

  it('regressão: teclado no menu e hover com lockT no level-up', () => {
    const s = makeGameState(1)
    const c = ctx()
    updateGame(s, makeFrame({ navY: 1 }), DT, c)
    updateGame(s, makeFrame({ confirm: true }), DT, c)
    expect(s.mode).toBe('shop')

    const { s: s2, c: c2 } = playing()
    s2.pendingLevelUps = 1
    updateGame(s2, makeFrame(), DT, c2)
    expect(s2.mode).toBe('levelup')
    expect(s2.ui.lockT).toBeGreaterThan(0)
    const n = s2.upgradeChoices.length
    expect(n).toBeGreaterThan(1)
    // hover no 2º card + click durante o grace period: sel muda, nada aplica
    updateGame(s2, makeFrame({ mouseMoved: true, click: true, mouseX: 480, mouseY: 260, lastInput: 'mouse' }), DT, c2)
    expect(s2.ui.sel).toBe(1)
    expect(s2.mode).toBe('levelup')
  })
})
