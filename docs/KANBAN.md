# Kanban — Boteco Survivors

> Memória de orquestração. Atualizado pelo orquestrador a cada milestone.
> Fluxo: Backlog → Em andamento → Feito. Bloqueios anotados inline.

## Em andamento

(vazio — v1 entregue em 2026-07-24; F9 mobile em 2026-09-10)

## Backlog (pós-v1, se o cliente pedir)

- Saideira dropando de elites (hoje: garantida 1/chefe — mudaria stream de RNG das sims)
- Revisitar dificuldade por seed (1337 ruidoso vence; 7 ruidoso morre aos 8:03)
- Sprites do time de arte no lugar dos emoji
- Mobile (pós-F9): rotação forçada em retrato (hoje só overlay); haptics; persistir mute; PWA manifest/offline; escala global de fontes em touch; DPR 1,5 em phones (medir antes); **checklist em aparelho real**: iPhone Safari + standalone ("Adicionar à Tela de Início"), Android Chrome, Samsung Internet

## Feito

- (F0) Scaffold: git, package.json, tsconfig, vite(+singlefile), index.html, npm install
- (F1) Fundação: GDD, ARCHITECTURE, types.ts, constants.ts, ui/layout.ts, kanban — commit 801bf73
- (F2/3/4) Implementação + integração via workflow: 39 testes verdes, build 60KB, sim vence run 20min — commit c3b9150
- (F7a) Smoke playwright inicial: 0 erros console, ~121fps, screenshots ok (menus/HUD/pausa/gameplay). Achados → alimentaram o F5.
- (F5) Polish via workflow: balance por sim multi-seed (BALANCE.md), game feel, música forró 8-bit procedural, hook __boteco/?seed — commit e3c77c1. Incidente: agente de balance não entregou relatório/doc; verificador cobriu, orquestrador escreveu BALANCE.md.
- (F6) QA workflow (15 agentes): 20 achados → 9 confirmados adversarialmente → 15 correções (destaques: Rodada da Casa inundava pool de projéteis; marmita sem fallback de upgrade; saideira perdia XP no cap de gems; canvas borrado em janela grande; auto-pausa em blur; confirmação antes de fechar aba no meio da run) — commit c8ac7cd.
- (F7b/F8) Verificação independente final: typecheck ✅ 40/40 ✅ build 74KB ✅ smoke 0 erros ✅ + inspeção visual. README. ENTREGUE.
- (F9) Mobile/touch (spec de painel 3×3): Pointer Events only (`core/pointers.ts` puro + `core/input.ts` adaptador), stick flutuante digital com histerese (`game/touchstick.ts`), HUD ⏸/🔊 em touchMode, mute como estado (`ui.muted`), botões 68 e nenhum alvo abaixo de y=508, desistir em 2 toques, overlay de retrato, fullscreen Android, wake lock, back trap, ícone iOS. 68/68 testes; smoke + deepsmoke + mobilesmoke (iPhone emulado via CDP) 0 erros, ~120 fps.

## Decisões

- Stack: TS + Vite + Canvas 2D puro, zero deps de runtime → build final = 1 HTML auto-contido.
- Placeholders: emoji pré-renderizados (SpriteCache) + formas.
- Lógica 100% headless (game/ sem DOM) → simulação de partidas em teste automatizado.
- Determinismo: RNG semeado (mulberry32) em todo gameplay.
- Run de 20min, 4 chefes (5/10/15/19min), vitória às 20:00.
- 8 armas + 8 evoluções, 9 passivos, 10 inimigos + 4 chefes, 3 personagens, loja meta com 6 upgrades.
- (F9) Só Pointer Events (sem mousemove/mousedown/touch* como fonte; touchend só como rede de segurança).
- (F9) Stick flutuante, follow da âncora, **digital** com histerese (10 engaja / 5 solta); `STICK_ANALOG=false` deixa a rampa atrás de flag.
- (F9) **Sem reset de ponteiros em transição de mode** — o dedo do stick sobrevive a level-up/pausa; tap acidental evitado por `slot.stick`.
- (F9) Um layout só: botões 68 de altura para todos os dispositivos; cards inalterados.
- (F9) Desistir com confirmação em 2 toques (3 s), também no teclado.
- (F9) Retrato = overlay DOM que absorve toques + pausa; rotação forçada fica no backlog.
- (F9) Achado do smoke: Chromium headless ACEITA `requestFullscreen` (a spec previa rejeição) — o mobilesmoke sai do fullscreen antes de redimensionar; e no CDP `touchEnd` solta os pontos LISTADOS (não os ausentes).

## Riscos / watchlist

- Integração entre módulos escritos em paralelo → mitigado por types.ts/ARCHITECTURE detalhados + agente integrador.
- Performance com hordas grandes → pools + spatial hash + sprites cacheados; validar no smoke test.
- Balanceamento → sim headless com bot; tuning por agente na F5.
