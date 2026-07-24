# Kanban — Boteco Survivors

> Memória de orquestração. Atualizado pelo orquestrador a cada milestone.
> Fluxo: Backlog → Em andamento → Feito. Bloqueios anotados inline.

## Em andamento

- (F1) Fundação: GDD ✅, ARCHITECTURE ✅, types.ts ✅, constants.ts ✅ — falta commit

## Backlog

- (F2) Workflow implementação paralela: core/ · data/ · game/ · ui/+save/ (4 agentes, contratos fixos)
- (F3) Integração: main.ts + typecheck + build + dev server ok
- (F4) Testes vitest + sim/headless.ts (partida 20min sem crash)
- (F5) Workflow polish: áudio, game feel/FX, loja meta, balanceamento via sim
- (F6) Workflow QA: revisões (bugs/perf/UX/balance) + verificação adversarial + fixes
- (F7) Smoke test browser real (playwright) + screenshots inspecionados
- (F8) Build final single-file + README + entrega

## Feito

- (F0) Scaffold: git, package.json, tsconfig, vite(+singlefile), index.html, npm install

## Decisões

- Stack: TS + Vite + Canvas 2D puro, zero deps de runtime → build final = 1 HTML auto-contido.
- Placeholders: emoji pré-renderizados (SpriteCache) + formas.
- Lógica 100% headless (game/ sem DOM) → simulação de partidas em teste automatizado.
- Determinismo: RNG semeado (mulberry32) em todo gameplay.
- Run de 20min, 4 chefes (5/10/15/19min), vitória às 20:00.
- 8 armas + 8 evoluções, 9 passivos, 10 inimigos + 4 chefes, 3 personagens, loja meta com 6 upgrades.

## Riscos / watchlist

- Integração entre módulos escritos em paralelo → mitigado por types.ts/ARCHITECTURE detalhados + agente integrador.
- Performance com hordas grandes → pools + spatial hash + sprites cacheados; validar no smoke test.
- Balanceamento → sim headless com bot; tuning por agente na F5.
