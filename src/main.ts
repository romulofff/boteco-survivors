// Integração: canvas + DPR/letterbox, input, áudio, save, loop fixo.
import type { GameContext } from './types'
import { VIEW_W, VIEW_H } from './constants'
import { makeInput } from './core/input'
import { SpriteCache } from './core/sprites'
import { AudioSys } from './core/audio'
import { startLoop } from './core/loop'
import { loadSave, persistSave } from './save/storage'
import { makeGameState } from './game/state'
import { updateGame } from './game/update'
import { render as render2d } from './ui/render'

const canvas = document.getElementById('game') as HTMLCanvasElement
const maybeCtx = canvas.getContext('2d')
if (!maybeCtx) throw new Error('Canvas 2D não suportado')
const ctx2d: CanvasRenderingContext2D = maybeCtx

// ---- resize: DPR + letterbox 16:9 ----
function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = VIEW_W * dpr
  canvas.height = VIEW_H * dpr
  // escala CSS: cabe na janela mantendo 16:9
  const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H)
  canvas.style.width = Math.floor(VIEW_W * scale) + 'px'
  canvas.style.height = Math.floor(VIEW_H * scale) + 'px'
  // todo o código de render usa coords lógicas 960×540
  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
}
window.addEventListener('resize', resize)
resize()

// ---- sistemas ----
const sprites = new SpriteCache()
const audio = new AudioSys()
const input = makeInput(canvas)
const save = loadSave()
const ctx: GameContext = { save, persist: () => persistSave(save) }
const state = makeGameState(Date.now())

// autoplay policy: inicia o AudioContext no 1º gesto do usuário
const onFirstGesture = (): void => {
  audio.ensureStarted()
}
window.addEventListener('pointerdown', onFirstGesture)
window.addEventListener('keydown', onFirstGesture)

startLoop(
  (dt) => {
    const f = input.frame()
    if (f.mute) audio.toggleMute()
    updateGame(state, f, dt, ctx)
    // drena os sons emitidos pelo gameplay neste step
    for (let i = 0; i < state.sounds.length; i++) audio.play(state.sounds[i])
    state.sounds.length = 0
    input.endFrame()
  },
  () => {
    render2d(ctx2d, state, sprites, save)
  },
)
