# 🍻 Boteco Survivors

Bullet heaven 2D estilo *Vampire Survivors*, ambientado num boteco brasileiro.
Sobreviva ao happy hour do inferno por 20 minutos: hordas de moscas, baratas,
bêbados, cunhados palpiteiros — e a Sogra no final.

## Como jogar

**▶️ [Jogue no navegador](https://romulofff.github.io/boteco-survivors/)** — nada pra instalar.

**Offline:** rode `npm install && npm run build` e abra `dist/index.html` (duplo clique).
O build é um arquivo único, auto-contido, sem servidor nem internet.

**Modo dev:**

```bash
npm install
npm run dev      # http://localhost:5173
```

### Controles

| Tecla | Ação |
|---|---|
| WASD / setas | mover (ataques são automáticos) |
| 1 / 2 / 3 ou clique | escolher upgrade no level-up |
| P ou Esc | pausar |
| M | som liga/desliga |
| **Celular** | toque e arraste em qualquer lugar → mover; ⏸/🔊 no canto → pausa/som; toque nos botões |

### No celular

- **Paisagem obrigatória** — em retrato o jogo mostra "Vire o celular" e pausa a run (o rotation lock do aparelho precisa estar desligado).
- iPhone: Safari → Compartilhar → **Adicionar à Tela de Início** tira a barra do navegador e usa a tela inteira.
- A **chave de silêncio** do iPhone silencia o jogo (WebAudio respeita o modo silencioso).
- Android/Chrome: ao tocar em JOGAR o jogo pede tela cheia e trava a paisagem.
- **Sair da página no meio da run perde o ouro** da run (só é bancado ao morrer/vencer/desistir).
- "Desistir" na pausa pede um segundo toque de confirmação.

### O loop

- Inimigos dropam **amendoins 🥜 (XP)** → level-up → escolha 1 de 3 upgrades.
- 8 armas temáticas (Tampinha Voadora, Bandeja Bumerangue, Bafo de Cachaça...),
  cada uma com **evolução** ao atingir nível 8 com o passivo par equipado.
- Elites dropam **Marmita 📦**; chefes a cada 5 minutos; **Saideira 🍻** limpa a tela.
- Ouro persiste entre runs → gaste na **📒 Caderneta** (upgrades permanentes).
- Sobreviveu até 20:00 → **Fechou o bar!**

## Desenvolvimento

TypeScript strict + Canvas 2D puro, zero dependências de runtime.
Visuais são placeholders (emoji) aguardando os sprites do time de arte.

```bash
npm run test       # suíte completa (inclui partida de 20min simulada headless)
npm run sim        # só a simulação de balanceamento
npm run typecheck
npm run build      # gera dist/index.html (single-file)
npm run smoke          # smoke test visual via playwright (desktop, teclado+mouse)
npm run smoke:deep     # fotografa todas as telas via hook de debug
npm run smoke:mobile   # emula iPhone paisagem: stick, ⏸/🔊, desistir, retrato, fps
node scripts/icon.mjs  # regera public/apple-touch-icon.png
```

Documentação: `docs/GDD.md` (design), `docs/ARCHITECTURE.md` (contratos de
módulos), `docs/BALANCE.md` (números e sweep), `docs/KANBAN.md` (histórico).

Dicas de debug: `?seed=N` na URL fixa o RNG; `window.__boteco` expõe
`{ state, ctx, save, input }` no console.
