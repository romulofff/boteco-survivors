// Dispatcher por mode: menus, run, level-up, pausa, fim de run (banking).
import type { Btn, GameContext, GameState, InputFrame } from '../types'
import { QUIT_ARM_TIME, WIN_TIME } from '../constants'
import { CHARACTERS } from '../data/characters'
import { META_UPGRADES } from '../data/meta'
import {
  HUD_MUTE, HUD_PAUSE, charSelectRects, endRects, hitTest, hudRects, levelupRects,
  menuRects, pauseRects, shopRects,
} from '../ui/layout'
import { startRun } from './state'
import { updatePlayer } from './player'
import { updateStick } from './touchstick'
import { updateSpawner } from './spawner'
import { updateEnemies } from './enemyAI'
import { updateWeapons } from './weaponsSys'
import { updateProjectiles } from './projectiles'
import { updateCollisions } from './collide'
import { updateFx } from './fx'
import { applyUpgrade, openLevelUp } from './leveling'

function wrap(v: number, len: number): number {
  return ((v % len) + len) % len
}

/** hover define sel; click/confirm retornam o id ativado (ou null) */
function pointerAct(s: GameState, input: InputFrame, rects: Btn[]): string | null {
  if (input.mouseMoved) {
    s.ui.usingMouse = true
    const i = hitTest(rects, input.mouseX, input.mouseY)
    if (i >= 0) s.ui.sel = i
  }
  if (input.click) {
    const i = hitTest(rects, input.mouseX, input.mouseY)
    if (i >= 0) {
      s.ui.sel = i
      return rects[i].id
    }
    return null
  }
  if (input.confirm) {
    const b = rects[s.ui.sel]
    if (b) return b.id
  }
  return null
}

/** banca ouro/recordes no save — chamada UMA vez na transição de fim de run */
function bank(s: GameState, ctx: GameContext): void {
  ctx.save.gold += Math.floor(s.player.gold)
  ctx.save.runs++
  if (s.result === 'win') ctx.save.wins++
  if (s.player.kills > ctx.save.bestKills) ctx.save.bestKills = s.player.kills
  if (s.time > ctx.save.bestTime) ctx.save.bestTime = s.time
  ctx.persist()
}

function updatePlaying(s: GameState, input: InputFrame, dt: number, ctx: GameContext, hudHit: number): void {
  if (input.pause || hudHit === HUD_PAUSE) {
    s.mode = 'paused'
    s.ui.sel = 0
    s.ui.quitArmed = 0
    s.sounds.push('click')
    return
  }

  s.time += dt
  s.frame++
  updateStick(s, input) // antes do player: escreve ui.stick
  updatePlayer(s, input, dt)
  if (!s.ui.moved && (input.moveX !== 0 || input.moveY !== 0 || s.ui.stick.engaged)) s.ui.moved = true
  updateSpawner(s, dt)
  updateEnemies(s, dt)
  updateWeapons(s, dt)
  updateProjectiles(s, dt)
  updateCollisions(s, dt)
  updateFx(s, dt)
  s.camera.x = s.player.x
  s.camera.y = s.player.y

  if (s.player.hp <= 0) {
    s.result = 'dead'
    bank(s, ctx)
    s.mode = 'gameover'
    s.ui.sel = 0
    s.sounds.push('death')
    return
  }
  if (s.time >= WIN_TIME) {
    s.result = 'win'
    bank(s, ctx)
    s.mode = 'win'
    s.ui.sel = 0
    s.sounds.push('win')
    return
  }
  if (s.pendingLevelUps > 0) openLevelUp(s)
}

export function updateGame(s: GameState, input: InputFrame, dt: number, ctx: GameContext): void {
  // touch: HUD ⏸/🔊 só existe em touchMode, nos modos playing/paused
  s.ui.touchMode = input.lastInput === 'touch'
  const hudHit = s.ui.touchMode && input.click && (s.mode === 'playing' || s.mode === 'paused')
    ? hitTest(hudRects(), input.mouseX, input.mouseY) : -1
  // mute é estado do jogo (M ou 🔊); main.ts espelha em AudioSys
  if (input.mute || hudHit === HUD_MUTE) {
    s.ui.muted = !s.ui.muted
    s.sounds.push('click')
  }

  switch (s.mode) {
    case 'menu': {
      const rects = menuRects()
      if (input.navY !== 0) {
        s.ui.usingMouse = false
        s.ui.sel = wrap(s.ui.sel + input.navY, rects.length)
      }
      const act = pointerAct(s, input, rects)
      if (act === 'play') {
        s.mode = 'charselect'
        s.ui.sel = 0
        s.sounds.push('click')
      } else if (act === 'shop') {
        s.mode = 'shop'
        s.ui.sel = 0
        s.sounds.push('click')
      }
      break
    }

    case 'charselect': {
      const rects = charSelectRects(CHARACTERS.length)
      if (input.navX !== 0) {
        s.ui.usingMouse = false
        s.ui.sel = wrap(s.ui.sel + input.navX, rects.length)
      }
      let act = pointerAct(s, input, rects)
      if (input.num >= 1 && input.num <= CHARACTERS.length) act = 'char' + (input.num - 1)
      if (act === 'back') {
        s.mode = 'menu'
        s.ui.sel = 0
        s.sounds.push('click')
      } else if (act && act.startsWith('char')) {
        const i = parseInt(act.slice(4), 10)
        if (i >= 0 && i < CHARACTERS.length) {
          s.sounds.push('click')
          startRun(s, CHARACTERS[i].id, ctx.save)
        }
      }
      break
    }

    case 'shop': {
      const n = META_UPGRADES.length
      const rects = shopRects(n)
      if (input.navX !== 0) {
        s.ui.usingMouse = false
        s.ui.sel = wrap(s.ui.sel + input.navX, n + 1)
      }
      if (input.navY !== 0) {
        s.ui.usingMouse = false
        const sel = s.ui.sel
        if (sel === n) {
          s.ui.sel = input.navY > 0 ? 0 : Math.max(0, n - 1)
        } else {
          const next = sel + input.navY * 3
          s.ui.sel = next < 0 || next >= n ? n : next
        }
      }
      const act = pointerAct(s, input, rects)
      if (act === 'back') {
        s.mode = 'menu'
        s.ui.sel = 0
        s.sounds.push('click')
      } else if (act && act.startsWith('meta')) {
        const i = parseInt(act.slice(4), 10)
        const def = META_UPGRADES[i]
        if (def) {
          const lvl = ctx.save.meta[def.id] ?? 0
          const cost = def.cost(lvl + 1)
          if (lvl < def.maxLevel && ctx.save.gold >= cost) {
            ctx.save.meta[def.id] = lvl + 1
            ctx.save.gold -= cost
            ctx.persist()
            s.sounds.push('gold')
          } else {
            s.sounds.push('click')
          }
        }
      }
      break
    }

    case 'playing':
      updatePlaying(s, input, dt, ctx, hudHit)
      break

    case 'levelup': {
      const n = s.upgradeChoices.length
      const rects = levelupRects(n)
      if (input.navX !== 0) {
        s.ui.usingMouse = false
        s.ui.sel = wrap(s.ui.sel + input.navX, n)
      }
      let act = pointerAct(s, input, rects)
      if (input.num >= 1 && input.num <= n) act = 'opt' + (input.num - 1)
      // grace period: hover/navegação funcionam, mas ativação é ignorada logo
      // após abrir a tela (evita duplo clique/spam gastando escolhas às cegas)
      if (s.ui.lockT > 0) {
        s.ui.lockT -= dt
      } else if (act && act.startsWith('opt')) {
        const i = parseInt(act.slice(3), 10)
        const opt = s.upgradeChoices[i]
        if (opt) applyUpgrade(s, opt)
      }
      break
    }

    case 'paused': {
      if (input.pause || hudHit === HUD_PAUSE) {
        s.mode = 'playing'
        s.ui.quitArmed = 0
        s.sounds.push('click')
        break
      }
      // confirmação de "Desistir" expira sozinha
      if (s.ui.quitArmed > 0) s.ui.quitArmed = Math.max(0, s.ui.quitArmed - dt)
      const rects = pauseRects()
      if (input.navY !== 0) {
        s.ui.usingMouse = false
        s.ui.sel = wrap(s.ui.sel + input.navY, rects.length)
      }
      const act = pointerAct(s, input, rects)
      if (act === 'resume') {
        s.mode = 'playing'
        s.ui.quitArmed = 0
        s.sounds.push('click')
      } else if (act === 'quit') {
        if (s.ui.quitArmed > 0) {
          // 2º toque dentro do prazo: abandona (banca como derrota) e volta ao menu
          s.result = 'dead'
          bank(s, ctx)
          s.mode = 'menu'
          s.ui.sel = 0
          s.ui.quitArmed = 0
          s.sounds.push('click')
        } else {
          // 1º toque só arma ("Tem certeza? Toque de novo")
          s.ui.quitArmed = QUIT_ARM_TIME
          s.sounds.push('click')
        }
      }
      break
    }

    case 'gameover':
    case 'win': {
      const rects = endRects()
      if (input.navY !== 0) {
        s.ui.usingMouse = false
        s.ui.sel = 0
      }
      const act = pointerAct(s, input, rects)
      if (act === 'menu') {
        s.mode = 'menu'
        s.ui.sel = 0
        s.sounds.push('click')
      }
      break
    }
  }
}
