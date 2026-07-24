// Simulação headless: roda uma partida completa em Node com um bot simples.
// Sem DOM. Determinística via seed (toda aleatoriedade de gameplay vem de state.rng).

import type { GameContext, GameState, InputFrame, Mode, SimMinute, SimReport } from '../types'
import { FIXED_DT } from '../constants'
import { makeGameState, startRun } from '../game/state'
import { updateGame } from '../game/update'
import { defaultSave } from '../save/storage'

// ---------- tuning do bot ----------

/** raio de percepção de ameaça */
const THREAT_RADIUS = 260
const THREAT_RADIUS_SQ = THREAT_RADIUS * THREAT_RADIUS
/** raio de busca de gems */
const GEM_RADIUS = 200
const GEM_RADIUS_SQ = GEM_RADIUS * GEM_RADIUS
/** módulo do vetor de fuga abaixo disso = seguro pra catar gem (~1 inimigo a >125px) */
const LOW_THREAT = 0.008
/** componente perpendicular (orbita em vez de fugir em linha reta) */
const ORBIT_WEIGHT = 0.4
/** atração fraca ao gem mais próximo */
const GEM_WEIGHT = 0.2
/** atração de volta à origem quando longe demais */
const HOME_WEIGHT = 0.5
const HOME_DIST = 2000

export function runHeadless(opts: { seed: number; charId: string; maxMinutes: number }): SimReport {
  const state = makeGameState(opts.seed)
  const ctx: GameContext = { save: defaultSave(), persist() {} }
  startRun(state, opts.charId, ctx.save)
  state.mode = 'playing' as Mode // pula menus (cast evita narrowing de literal)

  // InputFrame sintético, reutilizado todo frame (sem alocação no loop)
  const input: InputFrame = {
    moveX: 0,
    moveY: 0,
    navX: 0,
    navY: 0,
    confirm: false,
    pause: false,
    num: 0,
    mute: false,
    mouseX: 480,
    mouseY: 270,
    click: false,
    mouseMoved: false,
  }

  const minutes: SimMinute[] = []
  const maxSec = opts.maxMinutes * 60
  // teto duro de frames: level-up/pausa não avançam o relógio da run
  const hardCap = opts.maxMinutes * 60 * 60 * 3 + 36_000
  let frame = 0
  let nextMinute = 1

  while (state.mode !== 'gameover' && state.mode !== 'win' && state.time < maxSec && frame < hardCap) {
    // zera os campos pressed-this-frame
    input.moveX = 0
    input.moveY = 0
    input.navX = 0
    input.navY = 0
    input.confirm = false
    input.pause = false
    input.num = 0
    input.mute = false
    input.click = false
    input.mouseMoved = false

    if (state.mode === 'playing') {
      botMove(state, input)
    } else if (state.mode === 'levelup') {
      if (state.upgradeChoices.length > 0) input.num = pickUpgrade(state) + 1
      else input.confirm = true
    } else if (frame % 30 === 0) {
      // qualquer outra tela: confirma de vez em quando
      input.confirm = true
    }

    updateGame(state, input, FIXED_DT, ctx)
    frame++

    if (state.time >= nextMinute * 60) {
      // snapshot 1x por minuto (fora de hot path, alocação ok)
      const w: string[] = []
      for (let i = 0; i < state.weapons.length; i++) w.push(state.weapons[i].defId)
      minutes.push({
        minute: nextMinute,
        level: state.player.level,
        kills: state.player.kills,
        hp: state.player.hp,
        enemiesAlive: state.enemies.count(),
        weapons: w,
      })
      nextMinute++
    }
  }

  const result: SimReport['result'] =
    state.mode === 'win' ? 'win' : state.mode === 'gameover' ? 'dead' : 'timeout'

  return {
    result,
    survivedSec: state.time,
    level: state.player.level,
    kills: state.player.kills,
    goldEarned: state.goldEarned,
    damageDealt: state.damageDealt,
    minutes,
  }
}

/** kite: foge do campo de ameaça, orbita, cata gem quando seguro, volta pra origem se longe. */
function botMove(s: GameState, input: InputFrame): void {
  const px = s.player.x
  const py = s.player.y

  // vetor de fuga: soma de (player-enemy)/dist² — módulo 1/d, mais perto pesa mais
  let fx = 0
  let fy = 0
  const enemies = s.enemies.items
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i]
    if (!e.active) continue
    const dx = px - e.x
    const dy = py - e.y
    const d2 = dx * dx + dy * dy
    if (d2 > THREAT_RADIUS_SQ || d2 < 1e-6) continue
    fx += dx / d2
    fy += dy / d2
  }

  const threat = Math.sqrt(fx * fx + fy * fy)
  let mx = 0
  let my = 0
  if (threat > 1e-9) {
    const ux = fx / threat
    const uy = fy / threat
    // componente perpendicular: orbita a horda em vez de correr em linha reta
    mx = ux - uy * ORBIT_WEIGHT
    my = uy + ux * ORBIT_WEIGHT
  }

  // atração fraca ao gem ativo mais próximo, só com ameaça baixa
  if (threat < LOW_THREAT) {
    const gems = s.gems.items
    let best = -1
    let bestD2 = GEM_RADIUS_SQ
    for (let i = 0; i < gems.length; i++) {
      const g = gems[i]
      if (!g.active) continue
      const dx = g.x - px
      const dy = g.y - py
      const d2 = dx * dx + dy * dy
      if (d2 < bestD2) {
        bestD2 = d2
        best = i
      }
    }
    if (best >= 0 && bestD2 > 1e-6) {
      const d = Math.sqrt(bestD2)
      mx += ((gems[best].x - px) / d) * GEM_WEIGHT
      my += ((gems[best].y - py) / d) * GEM_WEIGHT
    }
  }

  // não deixa o bot fugir pro infinito
  const dHome2 = px * px + py * py
  if (dHome2 > HOME_DIST * HOME_DIST) {
    const d = Math.sqrt(dHome2)
    mx += (-px / d) * HOME_WEIGHT
    my += (-py / d) * HOME_WEIGHT
  }

  const len = Math.sqrt(mx * mx + my * my)
  if (len > 1e-9) {
    input.moveX = mx / len
    input.moveY = my / len
  }
}

/** prioridade: evolução > arma nova (se < 4 armas) > upgrade de arma > passivo novo > upgrade de passivo > primeiro. */
function pickUpgrade(s: GameState): number {
  const opts = s.upgradeChoices
  for (let i = 0; i < opts.length; i++) if (opts[i].kind === 'evolution') return i
  if (s.weapons.length < 4) {
    for (let i = 0; i < opts.length; i++) if (opts[i].kind === 'weapon' && opts[i].isNew) return i
  }
  for (let i = 0; i < opts.length; i++) if (opts[i].kind === 'weapon' && !opts[i].isNew) return i
  for (let i = 0; i < opts.length; i++) if (opts[i].kind === 'passive' && opts[i].isNew) return i
  for (let i = 0; i < opts.length; i++) if (opts[i].kind === 'passive' && !opts[i].isNew) return i
  return 0
}
