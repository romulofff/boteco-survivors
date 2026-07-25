// Sweep de balanceamento: roda runHeadless em várias seeds/noises e imprime
// o relatório minuto a minuto. Uso:
//   npx vite-node scripts/balance.mjs -- --seeds 42,7,1337 --noise 0,0.35 --char garcom --minutes 20
// Flags opcionais: --json (imprime JSON cru no final), --quiet (só resumo).

import { runHeadless } from '../src/sim/headless'

function parseArgs(argv) {
  const out = { seeds: [42, 7, 1337], noise: [0], char: 'garcom', minutes: 20, json: false, quiet: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--seeds') out.seeds = argv[++i].split(',').map(Number)
    else if (a === '--noise') out.noise = argv[++i].split(',').map(Number)
    else if (a === '--char') out.char = argv[++i]
    else if (a === '--minutes') out.minutes = Number(argv[++i])
    else if (a === '--json') out.json = true
    else if (a === '--quiet') out.quiet = true
  }
  return out
}

const args = parseArgs(process.argv.slice(2))
const results = []

for (const noise of args.noise) {
  for (const seed of args.seeds) {
    const t0 = Date.now()
    const r = runHeadless({ seed, charId: args.char, maxMinutes: args.minutes, botNoise: noise })
    const wall = ((Date.now() - t0) / 1000).toFixed(1)
    results.push({ seed, noise, wall: Number(wall), report: r })

    const mm = Math.floor(r.survivedSec / 60)
    const ss = Math.floor(r.survivedSec % 60)
    console.log(
      `\n=== seed ${seed} · noise ${noise} · ${args.char} → ${r.result.toUpperCase()} @ ${mm}:${String(ss).padStart(2, '0')} ` +
      `| lvl ${r.level} (30s: ${r.levelAt30s} · 2:30: ${r.levelAt150s}) | kills ${r.kills} | gold ${Math.round(r.goldEarned)} | ` +
      `minHP ${r.minHp.toFixed(0)} | wall ${wall}s ===`,
    )
    if (!args.quiet) {
      console.log('min | lvl | kills | hp(min) | alive | gold | weapons')
      let prevLvl = 1
      for (const m of r.minutes) {
        const jump = m.level - prevLvl
        prevLvl = m.level
        console.log(
          `${String(m.minute).padStart(3)} | ${String(m.level).padStart(3)}${jump >= 10 ? '!' : ' '}| ` +
          `${String(m.kills).padStart(5)} | ${String(Math.round(m.hp)).padStart(3)}(${String(Math.round(m.minHp)).padStart(3)}) | ` +
          `${String(m.enemiesAlive).padStart(5)} | ${String(Math.round(m.gold)).padStart(4)} | ${m.weapons.join(',')}`,
        )
      }
      for (const b of r.bossFights) {
        console.log(
          `  boss ${b.name}: ${b.startSec.toFixed(0)}s → ${b.endSec.toFixed(0)}s (${b.durationSec.toFixed(1)}s) ${b.killed ? 'morto' : 'VIVO'}`,
        )
      }
    }
  }
}

// resumo compacto
console.log('\n--- RESUMO ---')
console.log('noise | seed | result | t | lvl | kills | gold | minHP')
for (const x of results) {
  const r = x.report
  const mm = Math.floor(r.survivedSec / 60)
  const ss = Math.floor(r.survivedSec % 60)
  console.log(
    `${String(x.noise).padStart(5)} | ${String(x.seed).padStart(4)} | ${r.result.padEnd(6)} | ${mm}:${String(ss).padStart(2, '0')} | ` +
    `${String(r.level).padStart(3)} | ${String(r.kills).padStart(5)} | ${String(Math.round(r.goldEarned)).padStart(4)} | ${r.minHp.toFixed(0)}`,
  )
}

if (args.json) {
  console.log('\nJSON:' + JSON.stringify(results.map((x) => ({
    seed: x.seed, noise: x.noise, wall: x.wall,
    result: x.report.result, survivedSec: x.report.survivedSec, level: x.report.level,
    kills: x.report.kills, gold: Math.round(x.report.goldEarned), minHp: x.report.minHp,
  }))))
}
