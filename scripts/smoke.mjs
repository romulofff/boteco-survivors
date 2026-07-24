// Smoke test: carrega o build (dist/index.html) em Chromium headless,
// navega menu → seleção → gameplay, captura screenshots e erros de console.
// Uso: node scripts/smoke.mjs [dirDeSaida]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const OUT = process.argv[2] || '.smoke'
mkdirSync(OUT, { recursive: true })
const url = 'file://' + resolve('dist/index.html')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text())
})

const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` })

await page.goto(url)
await page.waitForTimeout(1000)
await shot('01-menu')

// menu → charselect
await page.keyboard.press('Enter')
await page.waitForTimeout(400)
await shot('02-charselect')

// seleciona o 1º personagem → gameplay
await page.keyboard.press('Enter')
await page.waitForTimeout(600)
await shot('03-gameplay-inicio')

// joga ~45s: movimento em bursts + '1' para confirmar level-ups que aparecerem
const dirs = ['d', 'w', 'a', 's']
for (let i = 0; i < 15; i++) {
  const k = dirs[i % 4]
  await page.keyboard.down(k)
  await page.waitForTimeout(2200)
  await page.keyboard.up(k)
  await page.keyboard.press('1')
  await page.waitForTimeout(300)
  if (i === 3) await shot('04-gameplay-10s')
  if (i === 8) await shot('05-gameplay-25s')
}
await shot('06-gameplay-45s')

// deixa acumular level-up sem confirmar para fotografar a tela de upgrade
await page.keyboard.down('d')
await page.waitForTimeout(4000)
await page.keyboard.up('d')
await shot('07-provavel-levelup')

// FPS médio em 2s
const fps = await page.evaluate(
  () =>
    new Promise((res) => {
      let n = 0
      const t0 = performance.now()
      const loop = () => {
        n++
        if (performance.now() - t0 < 2000) requestAnimationFrame(loop)
        else res(Math.round(n / 2))
      }
      requestAnimationFrame(loop)
    })
)

// pausa
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
await shot('08-pausa')

console.log(JSON.stringify({ fps, errors }, null, 2))
await browser.close()
process.exit(errors.length ? 1 : 0)
