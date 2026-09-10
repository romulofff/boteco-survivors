// Smoke mobile: emula iPhone paisagem (844×390, touch, DPR 3) em Chromium
// headless, dirige o jogo por toques/CDP e valida stick, HUD ⏸/🔊, desistir
// em 2 toques, overlay de retrato e FPS. Screenshot a cada passo.
// Uso: node scripts/mobilesmoke.mjs [dirDeSaida]
import { chromium, devices } from 'playwright'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const OUT = process.argv[2] || '.mobilesmoke'
mkdirSync(OUT, { recursive: true })
const url = 'file://' + resolve('dist/index.html') + '?seed=42'

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: devices['iPhone 14'].userAgent,
})
const page = await context.newPage()
const cdp = await context.newCDPSession(page)
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text())
})

const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` })
const wait = (ms) => page.waitForTimeout(ms)

function fail(msg) {
  console.error('FALHA: ' + msg)
  errors.push('assert: ' + msg)
}
function assert(cond, msg) {
  if (!cond) fail(msg)
}

/** lógico (960×540) → CSS px via bounding rect do canvas */
async function L(lx, ly) {
  return page.evaluate(([x, y]) => {
    const r = document.getElementById('game').getBoundingClientRect()
    return { x: r.left + (x / 960) * r.width, y: r.top + (y / 540) * r.height }
  }, [lx, ly])
}
async function tap(lx, ly) {
  const p = await L(lx, ly)
  await page.touchscreen.tap(p.x, p.y)
}
/** eventos de toque multi-dedo via CDP: points = [[lx,ly,id?], ...] (id default = índice).
 * Semântica do Chromium: touchStart/touchMove = pontos ativos (novos ids → pointerdown;
 * ids ausentes NÃO são soltos); touchEnd = pontos LISTADOS são soltos ([] = todos). */
async function touch(type, points) {
  const touchPoints = []
  for (let i = 0; i < points.length; i++) {
    const p = await L(points[i][0], points[i][1])
    touchPoints.push({ x: p.x, y: p.y, id: points[i][2] ?? i })
  }
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints })
}
const st = () =>
  page.evaluate(() => {
    const s = window.__boteco.state
    return {
      mode: s.mode, x: s.player.x, y: s.player.y,
      ui: { touchMode: s.ui.touchMode, muted: s.ui.muted, moved: s.ui.moved, stick: { ...s.ui.stick } },
    }
  })
const fpsFor = (ms) =>
  page.evaluate(
    (ms) =>
      new Promise((res) => {
        let n = 0
        const t0 = performance.now()
        const loop = () => {
          n++
          if (performance.now() - t0 < ms) requestAnimationFrame(loop)
          else res(Math.round(n / (ms / 1000)))
        }
        requestAnimationFrame(loop)
      }),
    ms,
  )

// ---- 1. higiene ----
await page.goto(url)
await wait(1000)
{
  const h = await page.evaluate(() => {
    const c = document.getElementById('game')
    const r = c.getBoundingClientRect()
    return {
      touchAction: getComputedStyle(c).touchAction,
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      rotate: getComputedStyle(document.getElementById('rotate')).display,
      left: c.style.left, top: c.style.top, w: r.width, h: r.height,
    }
  })
  assert(h.touchAction === 'none', 'canvas touch-action deveria ser none, veio ' + h.touchAction)
  assert(h.scrollW <= h.innerW, 'página rola horizontalmente: ' + h.scrollW + ' > ' + h.innerW)
  assert(h.rotate === 'none', '#rotate deveria estar oculto em paisagem, veio ' + h.rotate)
  assert(/^-?\d+px$/.test(h.left) && /^-?\d+px$/.test(h.top), 'canvas left/top não inteiros: ' + h.left + ' ' + h.top)
  assert(h.w >= 690 && h.w <= 696, 'canvas width esperado ~693, veio ' + h.w)
}
await shot('m-01-menu')

// ---- 2. menu → seleção → run (touchMode) ----
await tap(480, 324)
await wait(400)
{
  const s = await st()
  assert(s.mode === 'charselect', 'tap em JOGAR deveria abrir charselect, veio ' + s.mode)
  assert(s.ui.touchMode === true, 'ui.touchMode deveria ser true após toque')
}
await tap(230, 270)
await wait(500)
{
  const s = await st()
  assert(s.mode === 'playing', 'tap no card 0 deveria iniciar a run, veio ' + s.mode)
  assert(s.ui.moved === false, 'onboarding: ui.moved deveria ser false antes de mover')
}
await shot('m-02-onboarding')

// ---- 3. stick: arrasta 120px pra direita, depois pra cima, solta ----
{
  const s0 = await st()
  await touch('touchStart', [[300, 300]])
  for (let i = 1; i <= 20; i++) {
    await touch('touchMove', [[300 + 6 * i, 300]])
    await wait(16)
  }
  await wait(1000)
  const s1 = await st()
  assert(s1.ui.stick.active, 'stick deveria estar ativo durante o arraste')
  assert(s1.ui.stick.mx > 0.9, 'stick.mx deveria ser > 0.9, veio ' + s1.ui.stick.mx)
  assert(s1.x - s0.x >= 100, 'player deveria ter andado ≥100px pra direita, andou ' + (s1.x - s0.x))
  assert(s1.ui.moved === true, 'ui.moved deveria ser true após mover')
  await shot('m-03-stick')
  await touch('touchMove', [[300, 200]])
  await wait(500)
  const s2 = await st()
  assert(s2.y < s1.y, 'player deveria ter subido (y menor), ' + s1.y + ' → ' + s2.y)
  await touch('touchEnd', [])
  await wait(300)
  const s3 = await st()
  assert(!s3.ui.stick.active, 'stick deveria soltar após touchEnd')
  await wait(300)
  const s4 = await st()
  assert(Math.abs(s4.x - s3.x) < 2, 'player não deveria continuar andando após soltar: ' + s3.x + ' → ' + s4.x)
}

// ---- 4. dois dedos: stick no dedo 1, dedo 2 tapa ⏸ ----
{
  await touch('touchStart', [[300, 300, 0]])
  await touch('touchMove', [[380, 300, 0]])
  await wait(300)
  await touch('touchStart', [[380, 300, 0], [916, 44, 1]]) // 2º dedo desce no ⏸
  await wait(50)
  await touch('touchEnd', [[916, 44, 1]]) // só o 2º dedo sobe
  await wait(300)
  const s = await st()
  assert(s.mode === 'paused', 'tap do 2º dedo em ⏸ deveria pausar, veio ' + s.mode)
  // (em paused o updateStick não roda: ui.stick fica congelado — o assert real é o de retomada)
  assert(s.ui.stick.active === true, 'stick do dedo 1 deveria continuar vivo na pausa')
  await shot('m-04-paused')
  // continuidade real: dedo 1 ainda no chão, dedo 2 tapa ▶ → volta a andar SEM re-toque
  await touch('touchStart', [[380, 300, 0], [916, 44, 1]])
  await wait(50)
  await touch('touchEnd', [[916, 44, 1]])
  await wait(300)
  const r = await st()
  assert(r.mode === 'playing', 'tap do 2º dedo em ▶ deveria retomar, veio ' + r.mode)
  assert(r.ui.stick.active && r.ui.stick.id === s.ui.stick.id, 'stick deveria retomar o mesmo slot (id ' + s.ui.stick.id + '), veio ' + JSON.stringify(r.ui.stick))
  assert(r.x - s.x >= 30, 'player deveria voltar a andar com o dedo 1 preso (≥30px), andou ' + (r.x - s.x))
  // pausa de novo e solta o dedo do stick na pausa: não pode virar tap (slot.stick)
  await touch('touchStart', [[380, 300, 0], [916, 44, 1]])
  await wait(50)
  await touch('touchEnd', [[916, 44, 1]])
  await wait(300)
  assert((await st()).mode === 'paused', '2º tap do dedo 2 em ⏸ deveria pausar de novo')
  await touch('touchEnd', [])
  await wait(200)
  assert((await st()).mode === 'paused', 'soltar o dedo do stick na pausa não pode gerar tap')
}

// ---- 5. ▶ retoma; 🔊 alterna mute ----
await tap(916, 44)
await wait(300)
assert((await st()).mode === 'playing', 'tap em ▶ deveria retomar')
await tap(836, 44)
await wait(300)
assert((await st()).ui.muted === true, 'tap em 🔊 deveria mutar')
await tap(836, 44)
await wait(300)
assert((await st()).ui.muted === false, '2º tap em 🔊 deveria desmutar')

// ---- 6. desistir em 2 toques ----
await tap(916, 44)
await wait(300)
assert((await st()).mode === 'paused', 'tap em ⏸ deveria pausar (desistir)')
await tap(480, 354)
await wait(300)
assert((await st()).mode === 'paused', '1º tap em Desistir só arma (continua paused)')
await shot('m-05-quit-armed')
await tap(480, 354)
await wait(400)
assert((await st()).mode === 'menu', '2º tap em Desistir deveria voltar ao menu')

// ---- 7. loja e volta ----
await tap(480, 408)
await wait(400)
assert((await st()).mode === 'shop', 'tap em CADERNETA deveria abrir a loja')
await shot('m-05b-shop')
await tap(100, 474)
await wait(400)
assert((await st()).mode === 'menu', 'tap em Voltar deveria voltar ao menu')

// ---- 8. retrato: overlay DOM ----
// o headless ACEITA requestFullscreen (Android path): sai antes de redimensionar
await page.evaluate(() => (document.fullscreenElement ? document.exitFullscreen() : null))
await wait(300)
await page.setViewportSize({ width: 390, height: 844 })
await wait(400)
{
  const d = await page.evaluate(() => getComputedStyle(document.getElementById('rotate')).display)
  assert(d === 'flex', '#rotate deveria aparecer em retrato, veio ' + d)
}
await shot('m-06-portrait')
await page.setViewportSize({ width: 844, height: 390 })
await wait(400)
{
  const d = await page.evaluate(() => getComputedStyle(document.getElementById('rotate')).display)
  assert(d === 'none', '#rotate deveria sumir em paisagem, veio ' + d)
}

// ---- 9. FPS em playing ----
await tap(480, 324)
await wait(400)
await tap(230, 270)
await wait(500)
assert((await st()).mode === 'playing', 'segunda run deveria iniciar')
const fps = await fpsFor(2000)
assert(fps >= 30, 'fps < 30: ' + fps)
await shot('m-08-fps')

// ---- 10. Safari com barra (750×342) ----
const ctx2 = await browser.newContext({
  viewport: { width: 750, height: 342 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: devices['iPhone 14'].userAgent,
})
const page2 = await ctx2.newPage()
page2.on('pageerror', (e) => errors.push('pageerror(safari): ' + e.message))
page2.on('console', (m) => {
  if (m.type() === 'error') errors.push('console(safari): ' + m.text())
})
await page2.goto(url)
await wait(800)
{
  const h = await page2.evaluate(() => document.getElementById('game').getBoundingClientRect().height)
  assert(Math.abs(h - 342) <= 2, 'canvas height esperado ≈342 no Safari c/ barra, veio ' + h)
}
await page2.screenshot({ path: `${OUT}/m-07-safari-bar.png` })

console.log(JSON.stringify({ fps, errors }, null, 2))
await browser.close()
process.exit(errors.length ? 1 : 0)
