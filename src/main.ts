// Integração: canvas + DPR/letterbox, input, áudio, save, loop fixo, mobile.
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
import {
  installBackTrap, installMobileGuards, makeWakeLock, requestFullscreenLandscape, watchPortrait,
} from './mobile'

const canvas = document.getElementById('game') as HTMLCanvasElement
const maybeCtx = canvas.getContext('2d')
if (!maybeCtx) throw new Error('Canvas 2D não suportado')
const ctx2d: CanvasRenderingContext2D = maybeCtx

// ---- resize: letterbox 16:9, backing store = tamanho CSS × DPR ----
// (backing fixo em 960×540 esticado via CSS borrava o jogo em janela grande)
let dprMql: MediaQueryList | null = null
function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  // visualViewport exclui a barra do Safari iOS (innerHeight mente com ela aberta)
  const vv = window.visualViewport
  const vw = vv ? vv.width : window.innerWidth
  const vh = vv ? vv.height : window.innerHeight
  // escala CSS: cabe na janela mantendo 16:9
  const scale = Math.min(vw / VIEW_W, vh / VIEW_H)
  const cssW = Math.max(1, Math.floor(VIEW_W * scale))
  const cssH = Math.max(1, Math.floor(VIEW_H * scale))
  // fator total de render (CSS × DPR) com teto p/ perf em telas gigantes
  const factor = Math.min(3, Math.max(0.1, scale * dpr))
  canvas.width = Math.max(1, Math.round(VIEW_W * factor))
  canvas.height = Math.max(1, Math.round(VIEW_H * factor))
  canvas.style.width = cssW + 'px'
  canvas.style.height = cssH + 'px'
  // posição inteira (sem translate(-50%): meio pixel borra o canvas no celular)
  canvas.style.left = Math.round((vw - cssW) / 2) + 'px'
  canvas.style.top = Math.round((vh - cssH) / 2) + 'px'
  // todo o código de render usa coords lógicas 960×540
  ctx2d.setTransform(canvas.width / VIEW_W, 0, 0, canvas.height / VIEW_H, 0, 0)
  // troca de monitor muda o devicePixelRatio SEM evento de resize:
  // observa o valor corrente e re-executa quando ele mudar
  if (dprMql) dprMql.removeEventListener('change', resize)
  dprMql = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
  dprMql.addEventListener('change', resize)
}
window.addEventListener('resize', resize)
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize)
// rotação: o viewport só assenta alguns ms depois do evento
window.addEventListener('orientationchange', () => {
  resize()
  setTimeout(resize, 300)
})
resize()

// ---- sistemas ----
installMobileGuards()
const sprites = new SpriteCache()
const audio = new AudioSys()
const input = makeInput(canvas)
const save = loadSave()
const ctx: GameContext = { save, persist: () => persistSave(save) }
const wake = makeWakeLock()

// ?seed=N → seed determinística p/ testes; senão Date.now()
const seedParam = new URLSearchParams(window.location.search).get('seed')
const seedNum = seedParam === null ? NaN : Number(seedParam)
const state = makeGameState(Number.isFinite(seedNum) ? seedNum : Date.now())

// hook de debug/smoke-test
;(window as any).__boteco = { state, ctx, save, input }

// música: intensidade 1 durante a run (playing/levelup/paused), 0 nos menus
const isGameplay = (m: Mode): boolean => m === 'playing' || m === 'levelup' || m === 'paused'
let prevMode: Mode = state.mode
let gestureDone = false
let audioMuted = false

function pauseRun(): void {
  if (state.mode === 'playing') {
    state.mode = 'paused'
    state.ui.sel = 0
  }
}

// autoplay policy: inicia o AudioContext (e a música) no 1º gesto do usuário;
// gestos seguintes só retomam o ctx se o navegador suspender/interromper
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
window.addEventListener('pointerup', onGesture)
window.addEventListener('touchend', onGesture, { passive: true })
window.addEventListener('keydown', onGesture)

// perder o foco no meio da horda não pode matar o jogador: auto-pausa
window.addEventListener('blur', () => {
  pauseRun()
  input.reset()
})
// aba oculta: rAF congela o jogo, mas o setInterval da música continuaria —
// pausa a run e silencia; ao voltar, religa a música (o jogo fica pausado)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseRun()
    input.reset()
    wake.release()
    audio.stopMusic()
  } else {
    if (gestureDone) audio.ensureStarted() // iOS: ctx fica 'interrupted' ao voltar
    if (gestureDone && state.mode !== 'gameover' && state.mode !== 'win') {
      audio.setMusicIntensity(isGameplay(state.mode) ? 1 : 0)
      audio.startMusic()
    }
    if (state.ui.touchMode && isGameplay(state.mode)) wake.acquire()
  }
})
// F5/fechar no meio da run descartaria o ouro coletado: pede confirmação
window.addEventListener('beforeunload', (e) => {
  if (isGameplay(state.mode)) {
    e.preventDefault()
    e.returnValue = ''
  }
})
// celular em retrato: overlay DOM cobre o jogo; pausa e solta dedos/teclas
watchPortrait((portrait) => {
  if (portrait) {
    pauseRun()
    input.reset()
  }
})
// botão "voltar" do Android no meio da run = pausa, não sai da página
const backTrap = installBackTrap(() => isGameplay(state.mode), pauseRun)

startLoop(
  (dt) => {
    const f = input.frame()
    updateGame(state, f, dt, ctx)
    // mute é estado do jogo (M ou 🔊 no HUD touch); espelha no áudio
    if (state.ui.muted !== audioMuted) {
      audioMuted = state.ui.muted
      audio.setMuted(audioMuted)
    }
    // transição de mode → música (o remate de win/gameover chega via state.sounds)
    if (state.mode !== prevMode) {
      if (state.mode === 'gameover' || state.mode === 'win') {
        audio.stopMusic()
      } else if (gestureDone) {
        audio.setMusicIntensity(isGameplay(state.mode) ? 1 : 0)
        audio.startMusic() // idempotente; religa ao voltar pro menu/nova run
      }
      // Android: tela cheia + paisagem no 1º toque em JOGAR (precisa de gesto)
      if (prevMode === 'menu' && state.mode === 'charselect' && state.ui.touchMode) {
        requestFullscreenLandscape()
      }
      if (prevMode === 'charselect' && state.mode === 'playing') {
        backTrap.enter()
        if (state.ui.touchMode) wake.acquire()
      }
      if (state.mode === 'menu' || state.mode === 'gameover' || state.mode === 'win') wake.release()
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
