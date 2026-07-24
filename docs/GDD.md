# Boteco Survivors — Game Design Document

> Gênero: bullet heaven / "vampire survivors-like". Single-player, 2D, browser (canvas).
> Fantasia: você é um funcionário de um boteco brasileiro sobrevivendo ao happy hour do inferno.
> Visuais: PLACEHOLDERS (emoji pré-renderizados + formas). Time de arte substitui depois.
> Idioma da UI: pt-BR.

## 1. Loop central (referência: Vampire Survivors)

- O jogador **só controla o movimento** (WASD/setas). Todas as armas atacam automaticamente.
- Hordas crescentes de inimigos convergem para o jogador. Encostar causa dano.
- Inimigos mortos dropam **amendoins (XP)**. Coletar XP sobe de nível.
- A cada nível: pausa e escolha de **1 entre 3 upgrades** (arma nova, passivo novo, ou upgrade dos existentes).
- Armas no nível máximo + passivo par correto → **evolução** (versão suprema da arma).
- Chefes em marcos de tempo. **Sobreviver até 20:00 = vitória** ("Fechou o bar!").
- Ouro coletado persiste entre runs → loja meta ("Caderneta") com upgrades permanentes.
- Morte é esperada e rápida no começo; a curva de poder vira o jogo em "reverse bullet hell" no fim.

## 2. Controles

- Mover: WASD / setas.
- Menus e level-up: mouse (hover+clique) E teclado (setas/WASD + Enter/Espaço; 1-3 no level-up).
- Pausa: Esc ou P. Mudo: M.

## 3. Personagens (3)

| id | Nome | Emoji | Arma inicial | Bônus |
|---|---|---|---|---|
| `garcom` | Zé Garçom | 🤵 | Bandeja Bumerangue | +10% velocidade de movimento |
| `cozinheira` | Dona Cida | 👩‍🍳 | Cachaça Flamejante | +20% área |
| `dono` | Seu Otávio | 🧓 | Tampinha Voadora | +30% ganância (ouro), −10% dano |

## 4. Armas (8 base + 8 evoluções; máx. 6 equipadas, nível 1–8)

| id | Nome | Emoji | Comportamento | Evolução (passivo par) |
|---|---|---|---|---|
| `tampinha` | Tampinha Voadora | 🍾 (tampa) | `nearest`: projétil no inimigo mais próximo | **Metralha de Tampinhas** (🧲 Imã de Geladeira) — cooldown mínimo, rajada |
| `pano` | Pano de Prato | 🧻 | `whip`: golpe instantâneo alternando lados | **Toalha do Freguês** (🥓 Torresmo) — golpe dos dois lados, gigante |
| `espeto` | Espeto de Churrasco | 🍢 | `directional`: dispara na direção do movimento, perfura | **Espetão do Chefe** (🍋 Limão) — leque triplo perfurante |
| `garrafa` | Garrafa Arremessada | 🍾 | `lob`: arco até inimigo aleatório, explode em área | **Chuva de Garrafas** (🥛 Copo Americano) — múltiplas explosões grandes |
| `bandeja` | Bandeja Bumerangue | 🥏 | `boomerang`: vai e volta, perfura tudo | **Bandejaço** (🩴 Chinelo Veloz) — 2 bandejas enormes velozes |
| `bafo` | Bafo de Cachaça | 🌬️ | `aura`: dano contínuo ao redor | **Hálito de Dragão** (🍲 Caldinho) — aura enorme que empurra |
| `copos` | Copos Giratórios | 🥃 | `orbit`: copos orbitando o jogador | **Rodada da Casa** (🧊 Gelo) — mais copos, sempre ativos |
| `molotov` | Cachaça Flamejante | 🔥 | `zone`: arremesso que deixa poça de fogo | **Fogueira de São João** (🍗 Coxinha) — poças maiores e duradouras |

Regras de evolução (estilo VS simplificado): arma no nível 8 + passivo par em qualquer nível → a evolução aparece como opção no level-up (prioridade) e ao abrir Marmita 📦. Evolução substitui a arma base.

## 5. Passivos (9; máx. 6 equipados, nível 1–5)

| id | Nome | Emoji | Efeito/nível |
|---|---|---|---|
| `coxinha` | Coxinha | 🍗 | +20% HP máximo |
| `chinelo` | Chinelo Veloz | 🩴 | +8% velocidade |
| `caldinho` | Caldinho de Feijão | 🍲 | +0.4 HP/s regeneração |
| `limao` | Limão | 🍋 | +10% dano (might) |
| `torresmo` | Torresmo | 🥓 | +12% área |
| `gelo` | Gelo | 🧊 | −7% cooldown |
| `copo` | Copo Americano | 🥛 | +1 projétil (máx. nível 2) |
| `ima` | Imã de Geladeira | 🧲 | +30% raio de coleta |
| `fiado` | Cartão de Fiado | 💳 | +15% ouro |

## 6. Inimigos

Escalonamento global de HP com o tempo da run (multiplicador definido em `constants.ts`).
Elites: a cada ~90s após 4:00, versão elite do inimigo mais forte da onda (8× HP, 1.6× tamanho, dropa Marmita 📦).

| id | Nome | Emoji | Comportamento | Perfil |
|---|---|---|---|---|
| `mosca` | Mosca | 🪰 | `chase` | fraquíssima, enxame |
| `barata` | Barata | 🪳 | `chase` | básica |
| `rato` | Rato | 🐀 | `dart` (investidas) | rápida, frágil |
| `bebado` | Bêbado | 🍺 | `drunk` (zigue-zague lento) | tanque lento |
| `pombo` | Pombo | 🐦 | `swoop` (círculo + mergulho) | rápida, irregular |
| `torcedor` | Torcedor Nervoso | 😡 | `chase` | rápido, dano alto |
| `cunhado` | Cunhado | 🗣️ | `chase` | médio, insistente |
| `urubu` | Urubu | 🦅 | `swoop` | veloz, tardio |
| `seguranca` | Segurança | 💪 | `chase` | tanque forte |
| `barata_voadora` | Barata Voadora | 🦟 | `dart` | pesadelo do fim |

### Chefes (barra de HP no topo, dropam Marmita + Saideira)

| Minuto | Nome | Emoji | Perfil |
|---|---|---|---|
| 5:00 | Fiscal da Prefeitura | 📋 | médio, persistente |
| 10:00 | Cobrador do Fiado | 🧾 | rápido, muito HP |
| 15:00 | Segurança-Chefe | 🦍 | lento, tanque brutal |
| 19:00 | A Sogra | 👵 | final: rápida, HP enorme |

Sobreviveu até 20:00 → vitória.

## 7. Drops e coletáveis

- **Amendoim 🥜 (XP)**: tiers 1 / 5 / 25 / 100 (cor/tamanho diferentes). Atraído no raio de coleta.
- **Caldinho 🍲**: cura 30 HP (chance em inimigos médios+).
- **Dinheiro 💰**: ouro (chance pequena; valor × ganância).
- **Imã 🧲**: atrai TODOS os amendoins do mapa (raro).
- **Saideira 🍻**: limpa a tela — dano massivo em todos os inimigos não-chefe (raro, chefes/elites).
- **Marmita 📦**: "baú" — ouro + upgrade instantâneo de arma (evolução se elegível). Dropada por elites/chefes.

## 8. Progressão da run

- Curva de XP: `xpForLevel` em `game/leveling.ts` (base 6, crescimento suave; ver constants).
- Level-up: 3 opções. Pool: armas novas (se slot livre), passivos novos (se slot livre), upgrades dos equipados, evolução elegível (prioridade). Sem opção válida → "Caldinho" (cura 30) / "Gorjeta" (+25 ouro).
- Timeline de ondas em `data/waves.ts`: composição muda a cada ~60–90s, intensidade cresce, bursts e anéis de spawn em momentos-chave (ver tabela no arquivo).

## 9. Meta-progressão — "A Caderneta" (loja no menu)

Ouro da run é bancado no save ao morrer/vencer. Upgrades permanentes (custo crescente por nível):

| id | Nome | Emoji | Efeito/nível | Máx |
|---|---|---|---|---|
| `m_forca` | Tempero da Casa | 🌶️ | +5% dano | 5 |
| `m_hp` | Feijoada Completa | 🍛 | +10% HP máx | 5 |
| `m_veloc` | Havaianas Novas | 🩴 | +4% velocidade | 3 |
| `m_ima` | Imã Industrial | 🧲 | +15% coleta | 3 |
| `m_sorte` | Patuá | 🍀 | +8% ouro | 3 |
| `m_regen` | Água de Coco | 🥥 | +0.2 HP/s | 3 |

Save em localStorage: ouro, upgrades, recordes (kills, tempo, vitórias).

## 10. Game feel (obrigatório, mesmo com placeholders)

- Números de dano flutuantes; flash branco no inimigo atingido; knockback.
- Partículas em morte/explosão/coleta; screen shake curto em explosões/dano no jogador/chefe.
- SFX sintetizados (WebAudio, sem assets): tiro (throttle), hit, dano no player, coleta, level-up, fanfarra de chefe, evolução, saideira, vitória/derrota. Música: loop procedural simples estilo "forró 8-bit" (nice-to-have).
- HUD: barra de XP no topo, timer central grande, HP sobre o jogador, ouro/kills, ícones de armas/passivos com nível.

## 11. Vitória/derrota

- Morte: tela "Fim de expediente" — estatísticas da run (tempo, nível, kills, ouro bancado) → menu.
- Vitória (20:00): "FECHOU O BAR!" — mesmas estatísticas + confete de emoji → menu.

## 12. Fora de escopo v1

Mapas múltiplos, desbloqueio de personagens, curse/luck, achievements, gamepad, mobile/touch, save de run no meio.
