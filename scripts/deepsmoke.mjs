// Deep smoke: usa o hook window.__boteco (main.ts) para fotografar telas que
// o smoke normal não alcança: level-up real, chefe (banner+barra), horda ~500,
// gameover, Caderneta com ouro e vitória. Mede FPS sob stress via rAF.
// Uso: node scripts/deepsmoke.mjs [dirDeSaida]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const OUT = process.argv[2] || '.deepsmoke'
mkdirSync(OUT, { recursive: true })
// seed fixa → run determinística (main.ts lê ?seed=N)
const url = 'file://' + resolve('dist/index.html') + '?seed=42'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text())
})

const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` })

// clique em coords LÓGICAS (960×540, ui/layout.ts) → coords de página via
// bounding rect do canvas (mesma conta do core/input.ts, invertida).
// move + espera 1 frame antes do click: hover define ui.sel, click ativa.
async function clickLogical(lx, ly) {
  const pt = await page.evaluate(([x, y]) => {
    const r = document.getElementById('game').getBoundingClientRect()
    return [r.left + (x / 960) * r.width, r.top + (y / 540) * r.height]
  }, [lx, ly])
  await page.mouse.move(pt[0], pt[1])
  await page.waitForTimeout(150)
  await page.mouse.click(pt[0], pt[1])
}

// fecha telas de level-up que abrirem sozinhas (matar horda gera XP): o jogo
// congela em 'levelup' e a medição de FPS/gameover só vale em 'playing'
async function drainLevelups() {
  for (let i = 0; i < 12; i++) {
    const mode = await page.evaluate(() => window.__boteco.state.mode)
    if (mode !== 'levelup') break
    await page.keyboard.press('1')
    await page.waitForTimeout(200)
  }
}

// ---- a) menu → seleção → gameplay ----
await page.goto(url)
await page.waitForTimeout(900)
await page.keyboard.press('Enter') // menu → charselect (sel 0 = JOGAR)
await page.waitForTimeout(400)
await page.keyboard.press('Enter') // char 0 (garçom) → playing
await page.waitForTimeout(800)

// ---- b) level-up REAL via caminho seguro do gameplay ----
await page.evaluate(() => {
  const b = window.__boteco
  b.state.player.xp = 0
  b.state.pendingLevelUps = 1 // update.ts abre a tela no próximo frame
})
await page.waitForTimeout(300)
await shot('deep-01-levelup')

// ---- c) confirma e força o chefe 1 (EVENTS at=300, "Fiscal da Prefeitura") ----
await page.keyboard.press('1')
await page.waitForTimeout(300)
await page.evaluate(() => { window.__boteco.state.time = 299 })
await page.waitForTimeout(300)
await page.keyboard.press('1') // no-op em playing; destrava se caiu em levelup
await page.waitForTimeout(1700) // spawna em t=300; banner dura 2.5s → ~1.0s de vida
await shot('deep-02-boss')

// ---- d) stress: ~500+ inimigos ativos ----
await page.evaluate(() => {
  const s = window.__boteco.state
  // sobrevive à horda: FPS precisa ser medido em 'playing', não no gameover
  s.player.stats.maxHp = 100000
  s.player.hp = 100000
  // sem level-up no meio do stress: a tela congelaria a simulação
  s.player.xp = 0
  s.player.xpNext = 1e12
  s.pendingLevelUps = 0
  s.time = 610 // dispara eventos 420/480/600 (chefe 2) no próximo frame
})
await page.waitForTimeout(2500) // spawns naturais da onda do min 10 + eventos
await drainLevelups() // se um level-up abriu antes do bloqueio acima
// completa até ~520 direto no pool (alloc = scan de inativos: seguro ativar na mão)
const aliveSeeded = await page.evaluate(() => {
  const s = window.__boteco.state
  const items = s.enemies.items
  let tpl = null
  for (const e of items) if (e.active && !e.boss && !e.elite) { tpl = e; break }
  let alive = s.enemies.count()
  if (tpl) {
    for (const e of items) {
      if (alive >= 520) break
      if (e.active) continue
      e.active = true
      e.defIndex = tpl.defIndex
      const a = Math.random() * Math.PI * 2
      const r = 180 + Math.random() * 420
      e.x = s.player.x + Math.cos(a) * r
      e.y = s.player.y + Math.sin(a) * r
      e.hp = tpl.maxHp
      e.maxHp = tpl.maxHp
      e.speed = tpl.speed
      e.radius = tpl.radius
      e.damage = tpl.damage
      e.xp = tpl.xp
      e.hitFlash = 0
      e.kbx = 0
      e.kby = 0
      e.elite = false
      e.boss = false
      e.bossName = ''
      e.phase = 0
      e.t = Math.random()
      alive++
    }
  }
  return alive
})
await page.waitForTimeout(600) // um respiro pra IA/separação assentarem
await drainLevelups()
const modeAtFps = await page.evaluate(() => window.__boteco.state.mode)
const fps = await page.evaluate(
  () =>
    new Promise((res) => {
      let n = 0
      const t0 = performance.now()
      const loop = () => {
        n++
        if (performance.now() - t0 < 3000) requestAnimationFrame(loop)
        else res(Math.round(n / 3))
      }
      requestAnimationFrame(loop)
    }),
)
const aliveAtShot = await page.evaluate(() => window.__boteco.state.enemies.count())
await shot('deep-03-horda')

// ---- e) gameover (hp<=0 só é checado em 'playing') ----
await drainLevelups()
await page.evaluate(() => { window.__boteco.state.player.hp = 0 })
await page.waitForTimeout(500)
await shot('deep-04-gameover')

// ---- f) Caderneta com ouro (gold ANTES de abrir a tela) ----
await page.goto(url)
await page.waitForTimeout(900)
await page.evaluate(() => { window.__boteco.save.gold = 500 })
await clickLogical(480, 402) // menuRects 'shop': (330,374,300,68) → dentro
await page.waitForTimeout(500)
await shot('deep-05-shop')

// ---- g) vitória ----
await clickLogical(90, 498) // shopRects 'back': (20,440,160,68)
await page.waitForTimeout(400)
await clickLogical(480, 332) // menuRects 'play': (330,290,300,68)
await page.waitForTimeout(400)
await page.keyboard.press('Enter') // charselect: sel resetado → char 0
await page.waitForTimeout(800)
await page.evaluate(() => {
  const s = window.__boteco.state
  // t=1199 despeja TODOS os eventos pendentes num frame (4 chefes + rings);
  // hp alto garante chegar vivo ao win (t>=1200) 1s depois; xpNext bloqueia
  // level-up no caminho (a tela congelaria o relógio antes do win)
  s.player.stats.maxHp = 100000
  s.player.hp = 100000
  s.player.xp = 0
  s.player.xpNext = 1e12
  s.pendingLevelUps = 0
  s.time = 1199
})
await page.waitForTimeout(2000)
await shot('deep-06-win')

console.log(JSON.stringify({ fps, modeAtFps, aliveSeeded, aliveAtShot, errors }, null, 2))
await browser.close()
process.exit(errors.length ? 1 : 0)
