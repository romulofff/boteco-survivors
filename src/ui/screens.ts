// Telas: menu, seleção de personagem, loja, level-up, pausa, fim.
// Só LÊ o GameState. Math.random()/performance.now() permitidos (efeito visual).
// fillText de emoji é aceitável aqui (telas estáticas), mas sprites são preferidos.

import type { Btn, GameState, SaveData, StatKey, UpgradeOption } from '../types'
import type { SpriteCache } from '../core/sprites'
import { VIEW_W, VIEW_H, COLOR_BG, COLOR_GOLD, COLOR_HP } from '../constants'
import { menuRects, charSelectRects, shopRects, levelupRects, pauseRects, endRects } from './layout'
import { CHARACTERS } from '../data/characters'
import { weaponById } from '../data/weapons'
import { META_UPGRADES } from '../data/meta'
import { fmtTime } from './hud'

const FONT = 'system-ui, sans-serif'
const CX = VIEW_W / 2
const TAU = Math.PI * 2

// strings constantes (sem concat por frame)
const HINT_MENU_KEYS = 'WASD/setas mover · ataque automático · P pausa · M som'
const HINT_MENU_TOUCH = 'Toque e arraste pra mover · ataque automático · ⏸ pausa · 🔊 som'
const HINT_LEVELUP_KEYS = '1/2/3 ou clique'
const HINT_LEVELUP_TOUCH = 'Toque num card pra escolher'
const LABEL_QUIT = 'Desistir e voltar'
const LABEL_QUIT_ARMED = 'Tem certeza? Toque de novo'

// ---------- estado visual local (animações por performance.now) ----------

let prevMode = ''
let levelupStart = 0

interface Conf {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  idx: number
  size: number
  phase: number
}
const CONFETTI_EMOJI = ['🍻', '🥳', '🎉', '🍺', '🎊']
const CONFETTI_N = 90
const confetti: Conf[] = []
let confettiLast = 0

function initConfetti(): void {
  confetti.length = 0
  for (let i = 0; i < CONFETTI_N; i++) {
    confetti.push({
      x: Math.random() * VIEW_W,
      y: -Math.random() * VIEW_H, // começa espalhado acima da tela
      vx: (Math.random() - 0.5) * 40,
      vy: 40 + Math.random() * 120,
      rot: Math.random() * TAU,
      vr: (Math.random() - 0.5) * 5,
      idx: (Math.random() * CONFETTI_EMOJI.length) | 0,
      size: 16 + ((Math.random() * 16) | 0),
      phase: Math.random() * TAU,
    })
  }
  confettiLast = performance.now()
}

// ---------- helpers ----------

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** botão padrão: fundo #2a2126, borda dourada se selecionado */
function drawBtn(ctx: CanvasRenderingContext2D, b: Btn, label: string, selected: boolean): void {
  rr(ctx, b.x, b.y, b.w, b.h, 10)
  ctx.fillStyle = '#2a2126'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = selected ? COLOR_GOLD : '#555'
  ctx.stroke()
  ctx.font = '18px ' + FONT
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = selected ? COLOR_GOLD : '#ddd'
  ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 1)
  ctx.textBaseline = 'alphabetic'
}

/** card sem texto (charselect/shop/levelup); glow dourado opcional (UI estática) */
function cardFrame(ctx: CanvasRenderingContext2D, b: Btn, selected: boolean, glow = false): void {
  rr(ctx, b.x, b.y, b.w, b.h, 12)
  if (glow && selected) {
    ctx.save()
    ctx.shadowColor = 'rgba(242,193,78,0.85)'
    ctx.shadowBlur = 24
    ctx.fillStyle = '#332a30'
    ctx.fill()
    ctx.restore()
    ctx.lineWidth = 3
    ctx.strokeStyle = COLOR_GOLD
    ctx.stroke()
    return
  }
  ctx.fillStyle = '#2a2126'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = selected ? COLOR_GOLD : '#555'
  ctx.stroke()
}

const wrapBuf: string[] = []
/** quebra manual por nº aproximado de caracteres */
function wrapText(text: string, maxChars: number): string[] {
  wrapBuf.length = 0
  const words = text.split(' ')
  let line = ''
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    if (line.length === 0) line = w
    else if (line.length + 1 + w.length <= maxChars) line += ' ' + w
    else {
      wrapBuf.push(line)
      line = w
    }
  }
  if (line.length > 0) wrapBuf.push(line)
  return wrapBuf
}

function overlay(ctx: CanvasRenderingContext2D, alpha: number): void {
  ctx.fillStyle = 'rgba(0,0,0,' + alpha + ')'
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)
}

const STAT_LABEL: Record<StatKey, string> = {
  might: 'dano',
  armor: 'armadura',
  maxHp: 'HP máx',
  regen: 'regen',
  speed: 'velocidade',
  area: 'área',
  projSpeed: 'vel. de projétil',
  duration: 'duração',
  amount: 'projéteis',
  cooldown: 'cooldown',
  magnet: 'coleta',
  greed: 'ouro',
}

/** stats exibidos como % (delta sobre multiplicador 1) */
function isPercentStat(k: StatKey): boolean {
  return (
    k === 'might' || k === 'speed' || k === 'area' || k === 'projSpeed' ||
    k === 'duration' || k === 'cooldown' || k === 'greed'
  )
}

function bonusText(k: StatKey, v: number): string {
  const sign = v > 0 ? '+' : ''
  if (isPercentStat(k)) return sign + Math.round(v * 100) + '% ' + STAT_LABEL[k]
  return sign + v + ' ' + STAT_LABEL[k]
}

/** nível atual do item equipado (0 se não equipado) */
function equippedLevel(s: GameState, opt: UpgradeOption): number {
  if (opt.kind === 'weapon') {
    for (let i = 0; i < s.weapons.length; i++) {
      if (s.weapons[i].defId === opt.id) return s.weapons[i].level
    }
  } else if (opt.kind === 'passive') {
    for (let i = 0; i < s.passives.length; i++) {
      if (s.passives[i].defId === opt.id) return s.passives[i].level
    }
  }
  return 0
}

// ---------- telas ----------

function drawMenu(ctx: CanvasRenderingContext2D, s: GameState, save: SaveData, sprites: SpriteCache): void {
  // véu de COLOR_BG (deixa o padrão do fundo aparecer de leve)
  ctx.globalAlpha = 0.7
  ctx.fillStyle = COLOR_BG
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)
  ctx.globalAlpha = 1

  // 🍺 pixelado gigante de fundo (sprite pequeno ampliado sem smoothing)
  const beer = sprites.get('🍺', 24)
  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.globalAlpha = 0.06
  ctx.drawImage(beer, CX - 210, 80, 420, 420)
  ctx.restore()
  ctx.globalAlpha = 1

  ctx.textAlign = 'center'
  ctx.font = 'bold 44px ' + FONT
  ctx.fillStyle = COLOR_GOLD
  ctx.fillText('🍻 BOTECO SURVIVORS', CX, 175)
  ctx.font = '16px ' + FONT
  ctx.fillStyle = '#9a8f94'
  ctx.fillText('Sobreviva ao happy hour do inferno', CX, 210)

  const rects = menuRects()
  drawBtn(ctx, rects[0], '▶ JOGAR', s.ui.sel === 0)
  drawBtn(ctx, rects[1], '📒 CADERNETA', s.ui.sel === 1)

  ctx.textAlign = 'center'
  ctx.font = '14px ' + FONT
  ctx.fillStyle = '#8a8288'
  ctx.fillText(
    'Melhor tempo ' + fmtTime(save.bestTime) + '  ·  ' + save.bestKills + ' kills  ·  ' +
      save.wins + (save.wins === 1 ? ' vitória' : ' vitórias') + '  ·  💰 ' + save.gold,
    CX, 482,
  )
  ctx.font = (s.ui.touchMode ? '16px ' : '13px ') + FONT
  ctx.fillStyle = '#6f676c'
  ctx.fillText(s.ui.touchMode ? HINT_MENU_TOUCH : HINT_MENU_KEYS, CX, 508)
  ctx.font = '11px ' + FONT
  ctx.fillStyle = '#524b50'
  ctx.fillText('© Boteco Survivors v0.9', CX, 530)
}

function drawCharSelect(ctx: CanvasRenderingContext2D, s: GameState, sprites: SpriteCache): void {
  ctx.globalAlpha = 0.55
  ctx.fillStyle = COLOR_BG
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)
  ctx.globalAlpha = 1

  ctx.textAlign = 'center'
  ctx.font = 'bold 26px ' + FONT
  ctx.fillStyle = '#fff'
  ctx.fillText('Escolha seu guerreiro do balcão', CX, 90)

  const rects = charSelectRects(CHARACTERS.length)
  for (let i = 0; i < CHARACTERS.length; i++) {
    const c = CHARACTERS[i]
    const b = rects[i]
    const cx = b.x + b.w / 2
    cardFrame(ctx, b, s.ui.sel === i)

    const img = sprites.get(c.emoji, 64)
    ctx.drawImage(img, cx - img.width / 2, b.y + 62 - img.height / 2)

    ctx.textAlign = 'center'
    ctx.font = 'bold 20px ' + FONT
    ctx.fillStyle = '#fff'
    ctx.fillText(c.name, cx, b.y + 124)

    ctx.font = '13px ' + FONT
    ctx.fillStyle = '#b5aab0'
    const lines = wrapText(c.desc, 28)
    let y = b.y + 148
    for (let l = 0; l < lines.length && l < 3; l++) {
      ctx.fillText(lines[l], cx, y)
      y += 17
    }

    const wdef = weaponById(c.startWeapon)
    ctx.font = '13px ' + FONT
    ctx.fillStyle = '#d8ccd2'
    ctx.fillText('Arma: ' + wdef.emoji + ' ' + wdef.name, cx, b.y + 216)

    ctx.fillStyle = '#7ae582'
    y = b.y + 240
    for (const k in c.bonuses) {
      const key = k as StatKey
      const v = c.bonuses[key]
      if (v === undefined || v === 0) continue
      ctx.fillText(bonusText(key, v), cx, y)
      y += 17
    }
  }

  const back = rects[rects.length - 1]
  drawBtn(ctx, back, '← Voltar', s.ui.sel === rects.length - 1)
}

function drawShop(ctx: CanvasRenderingContext2D, s: GameState, sprites: SpriteCache, save: SaveData): void {
  ctx.globalAlpha = 0.55
  ctx.fillStyle = COLOR_BG
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)
  ctx.globalAlpha = 1

  ctx.textAlign = 'center'
  ctx.font = 'bold 28px ' + FONT
  ctx.fillStyle = COLOR_GOLD
  ctx.fillText('📒 A Caderneta', CX, 62)
  ctx.font = '18px ' + FONT
  ctx.fillText('💰 ' + save.gold, CX, 96)

  const rects = shopRects(META_UPGRADES.length)
  for (let i = 0; i < META_UPGRADES.length; i++) {
    const def = META_UPGRADES[i]
    const b = rects[i]
    const level = save.meta[def.id] ?? 0
    cardFrame(ctx, b, s.ui.sel === i)

    const img = sprites.get(def.emoji, 40)
    ctx.drawImage(img, b.x + 30 - img.width / 2, b.y + 36 - img.height / 2)

    ctx.textAlign = 'left'
    ctx.font = 'bold 16px ' + FONT
    ctx.fillStyle = '#fff'
    ctx.fillText(def.name, b.x + 58, b.y + 30)
    ctx.font = '12px ' + FONT
    ctx.fillStyle = '#b5aab0'
    ctx.fillText(def.desc, b.x + 58, b.y + 50)

    // pips de nível
    for (let j = 0; j < def.maxLevel; j++) {
      const px = b.x + 62 + j * 16
      const py = b.y + 70
      ctx.beginPath()
      ctx.arc(px, py, 4.5, 0, Math.PI * 2)
      if (j < level) {
        ctx.fillStyle = COLOR_GOLD
        ctx.fill()
      } else {
        ctx.strokeStyle = '#555'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
    }

    // custo do próximo nível
    ctx.textAlign = 'right'
    ctx.font = 'bold 14px ' + FONT
    if (level >= def.maxLevel) {
      ctx.fillStyle = '#7ae582'
      ctx.fillText('MÁX', b.x + b.w - 12, b.y + b.h - 12)
    } else {
      const cost = def.cost(level + 1)
      ctx.fillStyle = save.gold >= cost ? COLOR_GOLD : '#6f676c'
      ctx.fillText('💰 ' + cost, b.x + b.w - 12, b.y + b.h - 12)
    }
  }

  const back = rects[rects.length - 1]
  drawBtn(ctx, back, '← Voltar', s.ui.sel === rects.length - 1)
}

function drawLevelUp(ctx: CanvasRenderingContext2D, s: GameState, sprites: SpriteCache): void {
  overlay(ctx, 0.65)
  const now = performance.now()

  ctx.textAlign = 'center'
  ctx.font = 'bold 32px ' + FONT
  ctx.fillStyle = COLOR_GOLD
  ctx.fillText('NÍVEL ' + s.player.level + '!', CX, 92)

  const opts = s.upgradeChoices
  const rects = levelupRects(opts.length)
  for (let i = 0; i < opts.length; i++) {
    const opt = opts[i]
    const b = rects[i]
    const cx = b.x + b.w / 2
    const cy = b.y + b.h / 2

    // zoom-in ao aparecer (stagger leve por card, ease-out)
    const k = Math.min(1, Math.max(0, (now - levelupStart - i * 45) / 170))
    const ease = 1 - (1 - k) * (1 - k) * (1 - k)
    const scale = 0.86 + 0.14 * ease
    ctx.save()
    ctx.globalAlpha = ease
    ctx.translate(cx, cy)
    ctx.scale(scale, scale)
    ctx.translate(-cx, -cy)

    cardFrame(ctx, b, s.ui.sel === i, true)

    const img = sprites.get(opt.emoji, 48)
    ctx.drawImage(img, cx - img.width / 2, b.y + 52 - img.height / 2)

    ctx.textAlign = 'center'
    ctx.font = 'bold 18px ' + FONT
    ctx.fillStyle = '#fff'
    const nameLines = wrapText(opt.name, 22)
    let ny = b.y + 100
    for (let l = 0; l < nameLines.length && l < 2; l++) {
      ctx.fillText(nameLines[l], cx, ny)
      ny += 22
    }

    // tag
    if (opt.kind === 'evolution') {
      // pílula dourada pulsante (relógio real: s.time congela no level-up)
      const pulse = 0.8 + 0.2 * Math.sin(now * 0.009)
      const pw = 108 * pulse
      const ph = 24 * pulse
      rr(ctx, cx - pw / 2, b.y + 148 - 16 * pulse, pw, ph, ph / 2)
      ctx.globalAlpha = ease * (0.75 + 0.25 * Math.sin(now * 0.009))
      ctx.fillStyle = COLOR_GOLD
      ctx.fill()
      ctx.globalAlpha = ease
      ctx.font = 'bold ' + ((13 * pulse) | 0) + 'px ' + FONT
      ctx.fillStyle = '#2a1c08'
      ctx.fillText('EVOLUÇÃO!', cx, b.y + 148)
    } else if (opt.isNew && (opt.kind === 'weapon' || opt.kind === 'passive')) {
      ctx.font = 'bold 14px ' + FONT
      ctx.fillStyle = '#7ae582'
      ctx.fillText('NOVO!', cx, b.y + 148)
    } else if (opt.kind === 'weapon' || opt.kind === 'passive') {
      const l = equippedLevel(s, opt)
      ctx.font = 'bold 14px ' + FONT
      ctx.fillStyle = '#58c1e8'
      ctx.fillText('Nv ' + l + ' → ' + (l + 1), cx, b.y + 148)
    }

    ctx.font = '13px ' + FONT
    ctx.fillStyle = '#b5aab0'
    const lines = wrapText(opt.desc, 24)
    let y = b.y + 178
    for (let l = 0; l < lines.length && l < 5; l++) {
      ctx.fillText(lines[l], cx, y)
      y += 18
    }

    ctx.restore()
  }

  ctx.globalAlpha = 1
  ctx.textAlign = 'center'
  ctx.font = (s.ui.touchMode ? '16px ' : '14px ') + FONT
  ctx.fillStyle = '#8a8288'
  ctx.fillText(s.ui.touchMode ? HINT_LEVELUP_TOUCH : HINT_LEVELUP_KEYS, CX, 462)
}

function drawPaused(ctx: CanvasRenderingContext2D, s: GameState): void {
  overlay(ctx, 0.55)

  ctx.textAlign = 'center'
  ctx.font = 'bold 36px ' + FONT
  ctx.fillStyle = '#fff'
  ctx.fillText('PAUSA', CX, 180)

  const p = s.player
  ctx.font = '16px ' + FONT
  ctx.fillStyle = '#d8ccd2'
  ctx.fillText(
    '⏱ ' + fmtTime(s.time) + '   ·   Nv ' + p.level + '   ·   💀 ' + p.kills + '   ·   💰 ' + p.gold,
    CX, 218,
  )

  const rects = pauseRects()
  drawBtn(ctx, rects[0], 'Continuar', s.ui.sel === 0)
  drawBtn(ctx, rects[1], s.ui.quitArmed > 0 ? LABEL_QUIT_ARMED : LABEL_QUIT, s.ui.sel === 1)
}

function drawEnd(ctx: CanvasRenderingContext2D, s: GameState, sprites: SpriteCache, win: boolean): void {
  overlay(ctx, 0.75)
  if (win) {
    ctx.fillStyle = 'rgba(242,193,78,0.07)'
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)

    // confete denso caindo com gravidade (estado local do módulo)
    const now = performance.now()
    const dt = Math.min(0.05, (now - confettiLast) / 1000)
    confettiLast = now
    for (let i = 0; i < confetti.length; i++) {
      const c = confetti[i]
      c.vy = Math.min(300, c.vy + 170 * dt)
      c.x += c.vx * dt + Math.sin(c.y * 0.02 + c.phase) * 26 * dt
      c.y += c.vy * dt
      c.rot += c.vr * dt
      if (c.y > VIEW_H + 30) {
        c.y = -30
        c.x = Math.random() * VIEW_W
        c.vy = 40 + Math.random() * 80
      }
      const img = sprites.get(CONFETTI_EMOJI[c.idx], c.size)
      ctx.save()
      ctx.globalAlpha = 0.85
      ctx.translate(c.x, c.y)
      ctx.rotate(c.rot)
      ctx.drawImage(img, -img.width / 2, -img.height / 2)
      ctx.restore()
    }
    ctx.globalAlpha = 1
  }

  ctx.textAlign = 'center'
  if (win) {
    ctx.font = 'bold 42px ' + FONT
    ctx.lineJoin = 'round'
    ctx.lineWidth = 6
    ctx.strokeStyle = 'rgba(20,10,4,0.85)'
    ctx.strokeText('FECHOU O BAR! 🍻', CX, 185)
    ctx.fillStyle = COLOR_GOLD
    ctx.fillText('FECHOU O BAR! 🍻', CX, 185)
    ctx.lineJoin = 'miter'
  } else {
    ctx.font = 'bold 40px ' + FONT
    ctx.fillStyle = COLOR_HP
    ctx.fillText('FIM DE EXPEDIENTE', CX, 185)
  }

  const p = s.player
  ctx.font = '20px ' + FONT
  ctx.fillStyle = '#fff'
  ctx.fillText(
    win ? 'Você fechou a conta do inferno em ' + fmtTime(s.time) : 'Você aguentou ' + fmtTime(s.time),
    CX, 235,
  )
  ctx.font = '16px ' + FONT
  ctx.fillStyle = '#d8ccd2'
  ctx.fillText(
    'Nível ' + p.level + '   ·   💀 ' + p.kills + ' kills   ·   💰 ' + p.gold + ' bancados na caderneta',
    CX, 272,
  )

  const rects = endRects()
  drawBtn(ctx, rects[0], 'Voltar ao balcão', s.ui.sel === 0)
}

// ---------- entrada ----------

export function drawScreens(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  sprites: SpriteCache,
  save: SaveData,
): void {
  // transições de modo → dispara animações locais (zoom do level-up, confete)
  if (s.mode !== prevMode) {
    if (s.mode === 'levelup') levelupStart = performance.now()
    else if (s.mode === 'win') initConfetti()
    prevMode = s.mode
  }

  switch (s.mode) {
    case 'menu':
      drawMenu(ctx, s, save, sprites)
      break
    case 'charselect':
      drawCharSelect(ctx, s, sprites)
      break
    case 'shop':
      drawShop(ctx, s, sprites, save)
      break
    case 'levelup':
      drawLevelUp(ctx, s, sprites)
      break
    case 'paused':
      drawPaused(ctx, s)
      break
    case 'gameover':
      drawEnd(ctx, s, sprites, false)
      break
    case 'win':
      drawEnd(ctx, s, sprites, true)
      break
    case 'playing':
      break
  }
  // estado padrão do contexto
  ctx.textAlign = 'left'
}
