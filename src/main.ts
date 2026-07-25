// Integração: canvas + DPR/letterbox, input, áudio, save, loop fixo.
import type { GameContext, Mode } from './types'
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

// ?seed=N → seed determinística p/ testes; senão Date.now()
const seedParam = new URLSearchParams(window.location.search).get('seed')
const seedNum = seedParam === null ? NaN : Number(seedParam)
const state = makeGameState(Number.isFinite(seedNum) ? seedNum : Date.now())

// hook de debug/smoke-test
;(window as any).__boteco = { state, ctx, save }

// música: intensidade 1 durante a run (playing/levelup/paused), 0 nos menus
const isGameplay = (m: Mode): boolean => m === 'playing' || m === 'levelup' || m === 'paused'
let prevMode: Mode = state.mode
let gestureDone = false

// autoplay policy: inicia o AudioContext (e a música) no 1º gesto do usuário;
// gestos seguintes só retomam o ctx se o navegador suspender
const onGesture = (): void => {
  audio.ensureStarted()
  if (!gestureDone) {
    gestureDone = true
    if (state.mode !== 'gameover' && state.mode !== 'win') {
      audio.setMusicIntensity(isGameplay(state.mode) ? 1 : 0)
      audio.startMusic()
    }
  }
}
window.addEventListener('pointerdown', onGesture)
window.addEventListener('keydown', onGesture)

startLoop(
  (dt) => {
    const f = input.frame()
    if (f.mute) audio.toggleMute()
    updateGame(state, f, dt, ctx)
    // transição de mode → música (o remate de win/gameover chega via state.sounds)
    if (state.mode !== prevMode) {
      if (state.mode === 'gameover' || state.mode === 'win') {
        audio.stopMusic()
      } else if (gestureDone) {
        audio.setMusicIntensity(isGameplay(state.mode) ? 1 : 0)
        audio.startMusic() // idempotente; religa ao voltar pro menu/nova run
      }
      prevMode = state.mode
    }
    // drena os sons emitidos pelo gameplay neste step
    for (let i = 0; i < state.sounds.length; i++) audio.play(state.sounds[i])
    state.sounds.length = 0
    input.endFrame()
  },
  () => {
    render2d(ctx2d, state, sprites, save)
  },
)
