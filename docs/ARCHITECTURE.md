# Boteco Survivors — Arquitetura

> Contrato de engenharia. Agentes: sigam EXATAMENTE as assinaturas públicas daqui e de `src/types.ts`.
> Stack: TypeScript strict + Vite + Canvas 2D. **Zero dependências de runtime.** Testes: vitest.

## Princípios

1. **Lógica headless**: `src/game`, `src/data`, `src/sim` e `src/core` (exceto os arquivos DOM listados) NÃO podem tocar DOM/`window`/`document`. Toda a partida deve rodar em Node puro (testes/simulação).
2. **Render só lê**: `src/ui` desenha a partir do `GameState`, nunca muta gameplay (pode mutar `state.camera`... não — camera é atualizada em `game/update.ts`; ui não muta nada).
3. **Determinismo**: TODA aleatoriedade de gameplay via `state.rng`. `Math.random()` só para efeito visual (partículas) dentro de `ui/` — nunca em `game/`.
4. **Pools, não GC**: inimigos/projéteis/gems/partículas vêm de pools pré-alocados (`core/pool.ts`), flag `active`. Hot paths com `for` clássico, sem alocar por frame (sem `.map/.filter`, sem closures novas, sem spread).
5. **Sons sem DOM**: gameplay empurra `SoundId` em `state.sounds`; `main.ts` drena e toca via `core/audio.ts`.
6. **UI em pt-BR**, código/comentários em pt-BR curtos, nomes de símbolos em inglês.
7. **Input touch**: o gesto é decidido em código puro (`core/pointers.ts` → slots; `game/touchstick.ts` → stick). Um slot que virou stick **nunca gera tap** (`slot.stick`). Ponteiros NÃO são resetados em transição de mode (o dedo do stick sobrevive a level-up/pausa); reset só em `blur`, aba oculta e retrato. `main.ts` sincroniza mute (`ui.muted` → `AudioSys.setMuted`), wake lock, fullscreen e back trap.

## Resolução lógica

Canvas lógico **960×540** (`VIEW_W`/`VIEW_H`), escalado ao tamanho da janela com DPR em `main.ts` (letterbox, `left/top` inteiros). Todo código de UI usa coordenadas lógicas; `InputFrame.mouseX/Y` e `touches[i].x/y` já vêm em coordenadas lógicas (sem clamp: toque no letterbox vale). Nenhum botão fica abaixo de **y = 508** (home indicator do iPhone); botões de menu/pausa/fim/voltar têm **68** de altura (`BTN_H`).

## Mapa de módulos e APIs públicas

### `src/types.ts` — todos os tipos compartilhados (SEM imports, SEM lógica)
### `src/constants.ts` — números de tuning e caps (SEM imports além de types)

### `src/core/` (infra genérica)

| Arquivo | DOM? | API pública |
|---|---|---|
| `rng.ts` | não | `makeRNG(seed: number): RNG` (mulberry32) |
| `pool.ts` | não | `makePool<T extends {active:boolean}>(n: number, factory: () => T): Pool<T>` |
| `spatial.ts` | não | `class SpatialHash { constructor(cellSize: number); clear(): void; insert(idx: number, x: number, y: number): void; query(x: number, y: number, radius: number, out: number[]): number[] }` |
| `mathx.ts` | não | `dist(x1,y1,x2,y2)`, `distSq(...)`, `clamp(v,min,max)`, `lerp(a,b,t)`, `norm(x,y): [number,number]` (pode alocar tupla — usar fora de hot path — em hot path use inline) |
| `inputframe.ts` | não | `makeInputFrame(): InputFrame` (única fonte do literal; `touches` = `MAX_TOUCHES` slots pré-alocados), `clearFrameFlags(f)` (zera nav/confirm/pause/num/mute/click/mouseMoved; preserva `touches`, `lastInput`, `mouseX/Y`, `moveX/Y`) |
| `pointers.ts` | não | `makePointerLogic(f: InputFrame): PointerLogic` — `{ down(id,x,y,kind,button), move(id,x,y,kind), up(id,x,y,kind), cancel(id), cancelAll() }`. Mouse: down/move escrevem `mouseX/Y`, botão 0 → `click`. Toque: down ocupa slot + `mouseX/Y` + `mouseMoved` (press = highlight); move só atualiza o slot (`moved` se > `TAP_SLOP`); up com `!moved && !stick` → `click` + `mouseX/Y` no ponto do up |
| `input.ts` | SIM | `makeInput(canvas): InputSys` — `InputSys = { frame(): InputFrame; endFrame(): void; reset(): void }`. Adaptador **só Pointer Events** (`pointerdown/move/up/cancel` no window; `touchend/touchcancel` com 0 dedos → `cancelAll`); teclado → `moveX/Y`, navegação, `lastInput='keyboard'`; boot `lastInput='touch'` se `(hover:none) and (pointer:coarse)`. `reset()` solta teclas e toques |
| `sprites.ts` | SIM | `class SpriteCache { get(emoji: string, size: number): HTMLCanvasElement }` — pré-renderiza emoji em canvas offscreen, cacheado por `${emoji}:${size}` |
| `audio.ts` | SIM | `class AudioSys { play(id: SoundId): void; setMuted(v: boolean): void; toggleMute(): boolean; ensureStarted(): void }` — WebAudio sintetizado, sem assets; `ensureStarted()` no 1º gesto e retoma se `ctx.state !== 'running'` (cobre `'interrupted'` do iOS); `setMuted` é o espelho de `state.ui.muted`; throttle interno para 'shoot'/'hit' |
| `loop.ts` | SIM | `startLoop(update: (dt: number) => void, render: () => void): void` — timestep fixo `1/60`, acumulador, máx. 5 steps/frame |

### `src/data/` (conteúdo puro; importa apenas `types.ts` e `constants.ts`)

| Arquivo | Exporta |
|---|---|
| `characters.ts` | `CHARACTERS: CharacterDef[]` |
| `weapons.ts` | `WEAPONS: WeaponDef[]` (8 base + 8 evoluídas), `weaponById(id: string): WeaponDef` |
| `passives.ts` | `PASSIVES: PassiveDef[]`, `passiveById(id: string): PassiveDef` |
| `enemies.ts` | `ENEMIES: EnemyDef[]`, `enemyIndexById(id: string): number` |
| `waves.ts` | `WAVES: WaveDef[]` (ordenadas por `from`), `EVENTS: EventDef[]` (ordenados por `at`; inclui os 4 chefes e elites periódicos são gerados pelo spawner, não listados) |
| `meta.ts` | `META_UPGRADES: MetaUpgradeDef[]`, `metaById(id: string): MetaUpgradeDef` |

Conteúdo conforme tabelas do `docs/GDD.md`.

### `src/game/` (toda a lógica; importa core não-DOM, data, types, constants)

| Arquivo | API pública |
|---|---|
| `state.ts` | `makeGameState(seed: number): GameState` (mode `'menu'`, pools alocados); `startRun(s: GameState, charId: string, save: SaveData): void` (aplica personagem + meta, equipa arma inicial, zera pools/timers) |
| `update.ts` | `updateGame(s: GameState, input: InputFrame, dt: number, ctx: GameContext): void` — dispatcher por `s.mode`; contém a lógica de TODOS os modos (menus, level-up, pausa, gameover/win banking de ouro via `ctx`), navegação por teclado E clique (hit-test via `ui/layout.ts`). Topo (todos os modes): `ui.touchMode = lastInput === 'touch'`; hit-test dos botões ⏸/🔊 do HUD só em touchMode + playing/paused; `input.mute` ou 🔊 alternam `ui.muted`. "Desistir" na pausa exige 2 ativações em `QUIT_ARM_TIME` s (`ui.quitArmed`). Durante `'playing'`: stick → player → spawner → enemies → weapons → projectiles → collisions → fx → camera |
| `player.ts` | `updatePlayer(s, input, dt)` — movimento (teclado; se `moveX/Y` = 0 usa `s.ui.stick.mx/my` — teclado vence), facing, regen, iframes, atração/coleta de gems e pickups, morte → `'gameover'` |
| `touchstick.ts` | `updateStick(s, input)` — joystick virtual flutuante → `s.ui.stick`. Candidato = slot atual (continuidade) ou 1º slot ativo cujo início não caiu em `hudRects()` (em touchMode); âncora nasce no `startX/Y`, segue o dedo além de `STICK_FULL` (follow), digital com histerese (`STICK_DEAD_IN`/`OUT`), `STICK_ANALOG` opcional. Marca `slot.stick = true` |
| `spawner.ts` | `updateSpawner(s, dt)` — ondas contínuas por `WAVES`, eventos de `EVENTS`, elites periódicos, spawn fora da tela (anel), aplica `enemyHpScale(time)` |
| `enemyAI.ts` | `updateEnemies(s, dt)` — comportamentos (`chase/dart/swoop/drunk`), separação barata entre vizinhos, decay de knockback/hitFlash |
| `weaponsSys.ts` | `updateWeapons(s, dt)` — cooldowns/volleys, cria projéteis/zonas por behavior; `recalcStats(s)` — player.stats = base + passivos; `effectiveStats(s, w: EquippedWeapon): WeaponStats` — stats da arma no nível × multiplicadores do player |
| `projectiles.ts` | `updateProjectiles(s, dt)` — movimento por kind (nearest/directional/lob/boomerang/orbit), ttl; zonas: tick de dano em área |
| `collide.ts` | `updateCollisions(s, dt)` — SpatialHash (célula 64) rebuild/frame com inimigos; projétil→inimigo (dano, knockback, pierce, `hitMap` com rehit), aura→inimigos (tick global), inimigo→jogador (touch, iframes) |
| `drops.ts` | `killEnemy(s: GameState, idx: number): void` — XP tiers, chance de pickups, elite→marmita, boss→marmita+saideira; `applyPickup(s, p: Pickup, ctx: GameContext): void` (marmita = ouro + upgrade/evolução instantânea) |
| `leveling.ts` | `xpForLevel(level: number): number`; `gainXP(s, v: number): void` (pode enfileirar múltiplos level-ups); `openLevelUp(s): void` (gera `s.upgradeChoices`); `applyUpgrade(s, opt: UpgradeOption): void` (equipa/sobe nível/evolui + `recalcStats`) |
| `fx.ts` | `spawnBurst(s, x, y, color: string, n: number): void`; `addText(s, x, y, text: string, color: string): void`; `shake(s, amt: number): void`; `updateFx(s, dt)` — partículas, textos, shake decay, saideiraFlash |

### `src/ui/` (render; DOM ok; importa game só para leitura de helpers puros como `effectiveStats`/`xpForLevel`)

| Arquivo | API pública |
|---|---|
| `layout.ts` | **PURO, sem DOM** (usado pelo update p/ hit-test): `hitTest(rects, x, y): number`, `menuRects(): Btn[]`, `charSelectRects(n: number): Btn[]`, `shopRects(n: number): Btn[]`, `levelupRects(n: number): Btn[]`, `pauseRects(): Btn[]`, `endRects(): Btn[]`, `hudRects(): readonly Btn[]` (⏸/🔊, 72×72, **array cacheado**) + `HUD_PAUSE = 0`, `HUD_MUTE = 1` — `Btn = { x,y,w,h, id: string }` em coords lógicas |
| `render.ts` | `render(ctx: CanvasRenderingContext2D, s: GameState, sprites: SpriteCache): void` — chão do boteco (padrão xadrez/ladrilho), zonas, gems, pickups, inimigos (flash branco), player, projéteis, aura, partículas, textos; depois `drawHUD` e `drawScreens` |
| `hud.ts` | `drawHUD(ctx, s, sprites): void` — barra XP, timer, HP bar sobre o player, ouro/kills (borda direita = `HUD_RIGHT_TOUCH` em touchMode), ícones armas/passivos, barra de chefe |
| `touchui.ts` | `drawTouchUI(ctx, s, sprites): void` — anel/knob do stick (playing), botões ⏸(▶ em paused)/🔊(🔇) (só touchMode + playing/paused), onboarding "Toque e arraste…" enquanto `!ui.moved`. Desenhado por último no ramo de jogo do `render.ts` |
| `screens.ts` | `drawScreens(ctx, s, sprites, save: SaveData): void` — menu/charselect/shop/levelup/pause/gameover/win, com hover highlight via `s.ui.sel` |

### `src/save/storage.ts`

`defaultSave(): SaveData` · `loadSave(): SaveData` · `persistSave(s: SaveData): void` — localStorage com try/catch (fallback silencioso p/ Node), chave `boteco-survivors-v1`.

### `src/sim/headless.ts` (sem DOM)

`runHeadless(opts: { seed: number; charId: string; maxMinutes: number }): SimReport` — roda a partida a 60Hz com um bot: kita fugindo do centro de massa dos inimigos próximos com bias orbital, coleta gems, escolhe upgrades por heurística (evolução > arma nova > passivo novo > upgrade), confirma menus. Report: ver `SimReport` em types.

### `src/mobile.ts` (integração DOM, irmão de `main.ts`)

`installMobileGuards()` (pinça iOS, touchmove não-passivo, dblclick) · `watchPortrait(cb)` (media query `(orientation: portrait) and (pointer: coarse) and (max-width: 767px)`; o overlay `#rotate` do `index.html` cobre e absorve toques) · `requestFullscreenLandscape()` (Android: fullscreen + `orientation.lock`, tudo com catch) · `makeWakeLock()` (`acquire/release` idempotentes) · `installBackTrap(isGameplay, onBack)` (pushState ao entrar em run; popstate em gameplay → pausa + pushState). Nada aqui lança em headless.

### `src/main.ts` (integração)

Canvas + resize/DPR (`visualViewport`, `left/top` inteiros), `installMobileGuards`, `SpriteCache`, `AudioSys`, `InputSys`, save, `makeGameState(Date.now())`, `startLoop`: update → espelha `ui.muted` em `audio.setMuted` → transições (menu→charselect em touch: fullscreen; charselect→playing: back trap + wake lock; menu/fim: solta wake lock) → drena `state.sounds` → `endFrame`; render. Unlock de áudio em `pointerdown/pointerup/touchend/keydown`; `blur`/aba oculta/retrato → pausa + `input.reset()`.

### Campos de entrada/UI

- `InputFrame.touches: TouchSlot[]` (`{active,id,startX,startY,x,y,moved,stick}`, len `MAX_TOUCHES`) e `InputFrame.lastInput: 'keyboard'|'mouse'|'touch'`.
- `GameState.ui`: `sel`, `usingMouse`, `lockT`, `touchMode`, `muted`, `moved`, `quitArmed`, `stick: StickState` (`{active,id,ox,oy,kx,ky,engaged,mx,my}`). `startRun` zera `moved`, `quitArmed` e os campos do `stick`.

## Ordem de update em `'playing'`

```
time += dt → updateStick (escreve ui.stick) → updatePlayer → ui.moved (1º movimento)
→ updateSpawner → updateEnemies → updateWeapons
→ updateProjectiles → updateCollisions → updateFx → camera segue player (+shake decay)
→ vitória se time >= WIN_TIME
```

## Performance (alvos)

- 60fps com ~400 inimigos + ~300 projéteis + ~800 gems no viewport.
- SpatialHash rebuild por frame só com inimigos; queries por projétil/aura/player.
- Merge de gems: se pool de gems > 85%, funde os 100 mais antigos em 1 gem de valor somado.
- Sprites de emoji SEMPRE via `SpriteCache` (nunca `fillText` de emoji por frame em entidades).

## Testes (vitest, Node puro)

`tests/*.test.ts`: rng determinístico, pool, spatial hash, leveling (curva/level-ups múltiplos), weapons (effectiveStats, evolução), spawner (timeline), drops, `sim.test.ts` (partida headless completa sem crash + sanidade de balanceamento), e touch: `pointers.test.ts` (tap/slop/slots/cancel), `touchstick.test.ts` (histerese/follow/continuidade/HUD/teclado vence), `layout.test.ts` (rects, alvos ≥ 68, y ≤ 508, hudRects cacheado), `update-touch.test.ts` (touchMode, ⏸/🔊, mute, desistir em 2 toques). Smokes Playwright: `scripts/smoke.mjs` (desktop), `scripts/deepsmoke.mjs` (telas via hook), `scripts/mobilesmoke.mjs` (iPhone emulado: stick via CDP, 2 dedos, retrato, Safari com barra).
