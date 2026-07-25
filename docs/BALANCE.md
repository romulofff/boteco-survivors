# Balanceamento — estado pós-F5

> Escrito pelo orquestrador a partir do sweep do verificador (o agente de balance
> entregou as mudanças mas não o doc). Sweep: `scripts/balance.mjs`, bot headless,
> personagem garcom, 20min, seeds 42/7/1337.

## Filosofia

- Começo com pressão imediata (Nv2 aos ~30s, Nv5–7 aos 2:30), mid-game denso
  (centenas de inimigos vivos), late game letal sem evolução de arma.
- Bot perfeito (noise 0) deve vencer na maioria dos seeds com sustos; bot ruidoso
  (noise 0.35, reação lenta) deve morrer com frequência no mid/late.
- Economia: vitória banca 350–800 de ouro (≈3–5 níveis de meta); morte cedo 90–350.

## Sweep (pós-F5)

| Seed | Noise | Resultado | Nível | Kills | Ouro | min HP |
|---|---|---|---|---|---|---|
| 42 | 0 | WIN 20:00 | 58 | 15.601 | 700 | 80 |
| 7 | 0 | WIN 20:00 | 45 | 7.626 | 434 | 34 |
| 1337 | 0 | MORTE 17:56 | — | — | 526 | 0 |
| 42 | 0.35 | WIN 20:00 | — | — | — | 13 |
| 7 | 0.35 | MORTE 8:03 | — | — | 93 | 0 |
| 1337 | 0.35 | WIN 20:00 | — | — | — | 41 |

2 mortes em 6 runs; vitórias com min HP 13–41 em metade delas. Ouro no alvo.

## Principais knobs (constants.ts / data/)

- `CAP_ENEMIES` 900 + `SPAWN_SOFT_CAP` 0.9 (spawner degrada com elegância).
- `ELITE_HP_MULT` 6 (8 tornava elites tardios imortais p/ builds medianos).
- `enemyHpScale`: 1 + m×0.07 + max(0, m−10)×0.08.
- Ouro: `GOLD_ELITE_PER_XP` 0.35 (min 10) e `GOLD_BOSS_PER_XP` 0.4 direto no kill;
  dinheiro dropado raro (0.007) e pequeno; marmita 12–26.
- XP_BASE 5; magnet base 100.

## Pendências conhecidas

- Alvo "bot ruidoso morre no mid/late" não vale em todo seed (1337 ruidoso vence;
  7 ruidoso morre cedo demais aos 8:03). Aceitável para v1; revisitar com feedback.
- Limiares de `tests/sim.test.ts` recalibrados pelo verificador contra a realidade
  medida (marcados com NOTA no arquivo).
- FPS "120" nos stress tests = cap do rAF em Chromium headless; leia como
  "sem degradação mensurável com ~510 inimigos", não como teto da engine.
