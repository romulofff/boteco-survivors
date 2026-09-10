// Simulação headless: roda uma partida completa em Node com um bot simples.
// Sem DOM. Determinística via seed (toda aleatoriedade de gameplay vem de state.rng;
// o ruído do bot usa um RNG PRÓPRIO derivado da seed, sem tocar o stream de gameplay).

import type { GameContext, GameState, InputFrame, Mode, SimMinute, SimReport } from '../types'
import { FIXED_DT } from '../constants'
import { weaponById } from '../data/weapons'
import { makeRNG } from '../core/rng'
import { makeInputFrame } from '../core/inputframe'
import { makeGameState, startRun } from '../game/state'
import { updateGame } from '../game/update'
import { defaultSave } from '../save/storage'

// ---------- tuning do bot ----------

/** raio de percepção de ameaça */
const THREAT_RADIUS = 260
const THREAT_RADIUS_SQ = THREAT_RADIUS * THREAT_RADIUS
/** raio de busca de gems */
const GEM_RADIUS = 280
const GEM_RADIUS_SQ = GEM_RADIUS * GEM_RADIUS
/** módulo do vetor de fuga abaixo disso = seguro pra catar gem (~1 inimigo a >125px) */
const LOW_THREAT = 0.008
/** componente perpendicular (orbita em vez de fugir em linha reta) */
const ORBIT_WEIGHT = 0.4
/** atração ao gem mais próximo (peso cheio quando seguro, decai sob pressão) */
const GEM_WEIGHT = 0.35
/** atração de volta à origem quando longe demais (arena pequena = luta de
 * verdade; com raio grande o bot só corre em círculos e nunca engaja) */
const HOME_WEIGHT = 0.7
const HOME_DIST = 800

// ---------- ruído do bot (dificuldade "humana") ----------
/** frames entre re-sorteios do desvio angular (~0.5s) */
const NOISE_REROLL_FRAMES = 30
/** frames entre recálculos do vetor de fuga (reação lenta) */
const NOISE_REACT_FRAMES = 10

/** preferência de armas novas do bot (AoE limpa horda > single-target) */
const WEAPON_TIER = ['molotov', 'garrafa', 'pano', 'bandeja', 'tampinha', 'bafo', 'espeto', 'copos']

// ---------- relatórios estendidos (sem tocar types.ts) ----------

export interface SimBossFight {
  name: string
  startSec: number
  endSec: number
  durationSec: number
  killed: boolean
}

export interface SimMinuteX extends SimMinute {
  /** ouro acumulado até o fim do minuto */
  gold: number
  /** menor HP visto dentro do minuto */
  minHp: number
}

export interface SimReportX extends SimReport {
  minutes: SimMinuteX[]
  /** menor HP da run inteira */
  minHp: number
  bossFights: SimBossFight[]
  /** nível do player aos 30s e aos 150s (alvos de ritmo do começo) */
  levelAt30s: number
  levelAt150s: number
}

export interface RunHeadlessOpts {
  seed: number
  charId: string
  maxMinutes: number
  /** 0 (default) = bot perfeito; >0 = desvio angular + reação lenta (0.35 ≈ humano mediano) */
  botNoise?: number
}

export function runHeadless(opts: RunHeadlessOpts): SimReportX {
  const state = makeGameState(opts.seed)
  const ctx: GameContext = { save: defaultSave(), persist() {} }
  startRun(state, opts.charId, ctx.save)
  state.mode = 'playing' as Mode // pula menus (cast evita narrowing de literal)

  const noise = opts.botNoise ?? 0
  // RNG separado do gameplay: mesmo seed+noise → mesma run
  const botRng = makeRNG(((opts.seed ^ 0x9e3779b9) >>> 0) + 1)
  let noiseAngle = 0
  let noiseCos = 1
  let noiseSin = 0
  let noiseTimer = 0
  let reactTimer = 0
  let heldMx = 0
  let heldMy = 0

  // InputFrame sintético, reutilizado todo frame (sem alocação no loop)
  const input: InputFrame = makeInputFrame()
  input.mouseX = 480
  input.mouseY = 270

  const minutes: SimMinuteX[] = []
  const bossFights: SimBossFight[] = []
  const openBossIdx: number[] = []
  const openBossFight: number[] = []
  const maxSec = opts.maxMinutes * 60
  // teto duro de frames: level-up/pausa não avançam o relógio da run
  const hardCap = opts.maxMinutes * 60 * 60 * 3 + 36_000
  let frame = 0
  let nextMinute = 1
  let minHpRun = state.player.hp
  let minHpMinute = state.player.hp
  let levelAt30s = 0
  let levelAt150s = 0

  // rastreio de lutas de chefe: um chefe pode continuar vivo quando o próximo
  // spawna (spawn.bossIdx só aponta pro mais novo), então seguimos cada um
  let prevBossIdx = -1
  let prevBossName = ''

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
      if (noise <= 0) {
        botMove(state, input)
      } else {
        // reação lenta: o vetor de fuga só é recalculado a cada NOISE_REACT_FRAMES
        if (reactTimer <= 0) {
          reactTimer = NOISE_REACT_FRAMES
          botMove(state, input)
          heldMx = input.moveX
          heldMy = input.moveY
        }
        reactTimer--
        // desvio angular persistente, re-sorteado a cada ~0.5s
        if (noiseTimer <= 0) {
          noiseTimer = NOISE_REROLL_FRAMES
          noiseAngle = (botRng.next() * 2 - 1) * noise * Math.PI
          noiseCos = Math.cos(noiseAngle)
          noiseSin = Math.sin(noiseAngle)
        }
        noiseTimer--
        input.moveX = heldMx * noiseCos - heldMy * noiseSin
        input.moveY = heldMx * noiseSin + heldMy * noiseCos
      }
    } else if (state.mode === 'levelup') {
      if (state.upgradeChoices.length > 0) input.num = pickUpgrade(state) + 1
      else input.confirm = true
    } else if (frame % 30 === 0) {
      // qualquer outra tela: confirma de vez em quando
      input.confirm = true
    }

    updateGame(state, input, FIXED_DT, ctx)
    state.sounds.length = 0 // drena como main.ts — senão cresce O(frames)
    frame++

    if (state.player.hp < minHpRun) minHpRun = state.player.hp
    if (state.player.hp < minHpMinute) minHpMinute = state.player.hp
    if (levelAt30s === 0 && state.time >= 30) levelAt30s = state.player.level
    if (levelAt150s === 0 && state.time >= 150) levelAt150s = state.player.level

    // nova luta de chefe? (mudança de índice OU de nome no mesmo índice)
    const curBoss = state.spawn.bossIdx
    if (curBoss >= 0) {
      const nm = state.enemies.items[curBoss].bossName
      if (curBoss !== prevBossIdx || nm !== prevBossName) {
        bossFights.push({ name: nm, startSec: state.time, endSec: -1, durationSec: -1, killed: false })
        prevBossIdx = curBoss
        prevBossName = nm
        // guarda o índice do pool na luta (endSec -1 = aberta) via mapa paralelo
        openBossIdx.push(curBoss)
        openBossFight.push(bossFights.length - 1)
      }
    }
    // fecha lutas cujo chefe morreu (slot inativo ou reusado como não-chefe)
    for (let i = openBossIdx.length - 1; i >= 0; i--) {
      const e = state.enemies.items[openBossIdx[i]]
      if (!e.active || !e.boss) {
        const f = bossFights[openBossFight[i]]
        f.endSec = state.time
        f.durationSec = f.endSec - f.startSec
        f.killed = true
        openBossIdx.splice(i, 1)
        openBossFight.splice(i, 1)
      }
    }

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
        gold: state.goldEarned,
        minHp: minHpMinute,
      })
      minHpMinute = state.player.hp
      nextMinute++
    }
  }

  // run acabou com chefe(s) vivo(s): fecha as lutas abertas como não-terminadas
  for (let i = 0; i < openBossFight.length; i++) {
    const f = bossFights[openBossFight[i]]
    f.endSec = state.time
    f.durationSec = f.endSec - f.startSec
    f.killed = false
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
    minHp: minHpRun,
    bossFights,
    levelAt30s: levelAt30s === 0 ? state.player.level : levelAt30s,
    levelAt150s: levelAt150s === 0 ? state.player.level : levelAt150s,
  }
}

/** kite: foge do campo de ameaça, orbita, cata gem quando seguro, volta pra origem se longe. */
function botMove(s: GameState, input: InputFrame): void {
  const px = s.player.x
  const py = s.player.y

  // vetor de fuga: soma de (player-enemy)/dist² — módulo 1/d, mais perto pesa
  // mais; chefes/elites pesam MUITO mais (dão 25-40 de dano por toque)
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
    const w = e.boss ? 3 : e.elite ? 1.5 : 1
    fx += (dx / d2) * w
    fy += (dy / d2) * w
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

  // atração ao gem ativo mais próximo — sempre ligada, decai sob pressão mas
  // com piso: jogador decente continua catando XP mesmo no campo denso,
  // senão a run entra em espiral (sem XP → sem DPS → mais inimigos → sem XP)
  let gw = GEM_WEIGHT
  if (threat > LOW_THREAT * 2) {
    gw = GEM_WEIGHT * ((LOW_THREAT * 2) / threat)
    const floor = GEM_WEIGHT * 0.35
    if (gw < floor) gw = floor
  }
  {
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
      mx += ((gems[best].x - px) / d) * gw
      my += ((gems[best].y - py) / d) * gw
    }
  }

  // pickups: caldinho quando machucado; ouro/marmita/saideira/imã quando dá
  // (jogador real faz a linha até o drop — é daí que sai cura e economia)
  const pks = s.pickups.items
  const hurt = s.player.hp < s.player.stats.maxHp * 0.65
  let pkBest = -1
  let pkBestScore = 0
  for (let i = 0; i < pks.length; i++) {
    const pk = pks[i]
    if (!pk.active) continue
    const dx = pk.x - px
    const dy = pk.y - py
    const d2 = dx * dx + dy * dy
    if (d2 > 420 * 420 || d2 < 1e-6) continue
    let wgt = 0
    if (pk.kind === 'caldinho') wgt = hurt ? 0.9 : 0.08
    else if (pk.kind === 'saideira') wgt = 0.5
    else if (pk.kind === 'marmita') wgt = 0.45
    else wgt = 0.35 // dinheiro / imã
    // sob pressão alta, só caldinho (cura) e saideira (limpa tela) valem o risco
    if (threat > LOW_THREAT * 3 && pk.kind !== 'caldinho' && pk.kind !== 'saideira') wgt *= 0.25
    const score = wgt / (1 + Math.sqrt(d2) / 200)
    if (score > pkBestScore) { pkBestScore = score; pkBest = i }
  }
  if (pkBest >= 0) {
    const pk = pks[pkBest]
    const dx = pk.x - px
    const dy = pk.y - py
    const d = Math.sqrt(dx * dx + dy * dy)
    mx += (dx / d) * pkBestScore * 2
    my += (dy / d) * pkBestScore * 2
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

/**
 * Política de um jogador competente (rush de evolução):
 * evolução > passivo par da arma mais alta (destrava evolução) > upgrade da
 * arma MAIS ALTA (foco, não spread) > arma nova (se < 3) > passivo-chave novo
 * (limão/gelo/copo) > upgrade de passivo > qualquer coisa.
 */
function pickUpgrade(s: GameState): number {
  const opts = s.upgradeChoices
  for (let i = 0; i < opts.length; i++) if (opts[i].kind === 'evolution') return i

  // arma equipada de nível mais alto ainda não evoluída
  let topIdx = -1
  let topLvl = -1
  for (let i = 0; i < s.weapons.length; i++) {
    const def = weaponById(s.weapons[i].defId)
    if (def.evolved) continue
    if (s.weapons[i].level > topLvl) { topLvl = s.weapons[i].level; topIdx = i }
  }

  // passivo par da arma top (destrava a evolução) se ofertado e ainda não temos
  if (topIdx >= 0) {
    const def = weaponById(s.weapons[topIdx].defId)
    if (def.evolution) {
      let has = false
      for (let i = 0; i < s.passives.length; i++) {
        if (s.passives[i].defId === def.evolution.requires) { has = true; break }
      }
      if (!has) {
        for (let i = 0; i < opts.length; i++) {
          if (opts[i].kind === 'passive' && opts[i].id === def.evolution.requires) return i
        }
      }
    }
  }

  // upgrade da arma mais alta primeiro; senão de qualquer arma equipada
  if (topIdx >= 0) {
    const topId = s.weapons[topIdx].defId
    for (let i = 0; i < opts.length; i++) {
      if (opts[i].kind === 'weapon' && !opts[i].isNew && opts[i].id === topId) return i
    }
  }
  for (let i = 0; i < opts.length; i++) if (opts[i].kind === 'weapon' && !opts[i].isNew) return i

  if (s.weapons.length < 4) {
    // "tier list" de um jogador que conhece o jogo: AoE primeiro; armas de
    // fundo de tier (espeto/copos são fracas kitando) só se estiver sem nada
    const maxRank = s.weapons.length < 2 ? 999 : 5
    let bestI = -1
    let bestRank = 999
    for (let i = 0; i < opts.length; i++) {
      if (opts[i].kind !== 'weapon' || !opts[i].isNew) continue
      const r = WEAPON_TIER.indexOf(opts[i].id)
      const rank = r < 0 ? 998 : r
      if (rank <= maxRank && rank < bestRank) { bestRank = rank; bestI = i }
    }
    if (bestI >= 0) return bestI
  }
  // passivos-chave (dano + sobrevivência)
  for (let i = 0; i < opts.length; i++) {
    const o = opts[i]
    if (o.kind === 'passive' && o.isNew &&
      (o.id === 'limao' || o.id === 'coxinha' || o.id === 'gelo' || o.id === 'copo' || o.id === 'caldinho')) return i
  }
  for (let i = 0; i < opts.length; i++) if (opts[i].kind === 'passive' && !opts[i].isNew) return i
  for (let i = 0; i < opts.length; i++) if (opts[i].kind === 'passive' && opts[i].isNew) return i
  for (let i = 0; i < opts.length; i++) if (opts[i].kind === 'weapon' && opts[i].isNew) return i
  return 0
}
