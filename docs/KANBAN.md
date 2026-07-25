# Kanban — Boteco Survivors

> Memória de orquestração. Atualizado pelo orquestrador a cada milestone.
> Fluxo: Backlog → Em andamento → Feito. Bloqueios anotados inline.

## Em andamento

- (F5) Workflow `wf_4dadf6ce-656`: balance (sim multi-seed, alvos de densidade/ouro/dificuldade) · game-feel (ui/fx) · áudio+música+debug hook · verificador (deep smoke com screenshots de todas as telas).

## Backlog
- (F6) Workflow QA: revisões (bugs/perf/UX/balance) + verificação adversarial + fixes
- (F7b) Re-smoke pós-F6 + inspeção visual final minha
- (F8) Build final single-file + README + entrega

## Feito

- (F0) Scaffold: git, package.json, tsconfig, vite(+singlefile), index.html, npm install
- (F1) Fundação: GDD, ARCHITECTURE, types.ts, constants.ts, ui/layout.ts, kanban — commit 801bf73
- (F2/3/4) Implementação + integração via workflow: 39 testes verdes, build 60KB, sim vence run 20min — commit c3b9150
- (F7a) Smoke playwright inicial: 0 erros console, ~121fps, screenshots ok (menus/HUD/pausa/gameplay). Achados → alimentaram o F5.

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
