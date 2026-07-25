// Stats derivados, cooldowns/volleys e criação de projéteis por behavior.
import type { EquippedWeapon, GameState, Projectile, WeaponBehavior, WeaponDef, WeaponStats } from '../types'
import { weaponById } from '../data/weapons'
import { passiveById } from '../data/passives'

const TAU = Math.PI * 2
const VOLLEY_GAP = 0.07
const NEAREST_RANGE_SQ = 500 * 500
const LOB_RANGE_SQ = 380 * 380
const BOOMERANG_REACH = 260

// scratch interno (hot path sem alocação)
const SCRATCH: WeaponStats = {
  damage: 0, cooldown: 0, amount: 0, speed: 0, area: 0, duration: 0, pierce: 0, knockback: 0,
}
const lobCand: number[] = []

/** player.stats = baseStats + passivos */
export function recalcStats(s: GameState): void {
  const b = s.player.baseStats
  const st = s.player.stats
  st.might = b.might
  st.armor = b.armor
  st.maxHp = b.maxHp
  st.regen = b.regen
  st.speed = b.speed
  st.area = b.area
  st.projSpeed = b.projSpeed
  st.duration = b.duration
  st.amount = b.amount
  st.cooldown = b.cooldown
  st.magnet = b.magnet
  st.greed = b.greed
  for (let i = 0; i < s.passives.length; i++) {
    const pv = s.passives[i]
    const def = passiveById(pv.defId)
    st[def.stat] += def.perLevel * pv.level
  }
  if (s.player.hp > st.maxHp) s.player.hp = st.maxHp
}

/** variante sem alocação: preenche `out` e retorna (uso interno/hot path) */
export function effInto(s: GameState, w: EquippedWeapon, out: WeaponStats): WeaponStats {
  const def = weaponById(w.defId)
  const b = def.base
  out.damage = b.damage
  out.cooldown = b.cooldown
  out.amount = b.amount
  out.speed = b.speed
  out.area = b.area
  out.duration = b.duration
  out.pierce = b.pierce
  out.knockback = b.knockback
  for (let lv = 2; lv <= w.level; lv++) {
    const d = def.perLevel[lv - 2]
    if (!d) continue
    if (d.damage !== undefined) out.damage += d.damage
    if (d.cooldown !== undefined) out.cooldown += d.cooldown
    if (d.amount !== undefined) out.amount += d.amount
    if (d.speed !== undefined) out.speed += d.speed
    if (d.area !== undefined) out.area += d.area
    if (d.duration !== undefined) out.duration += d.duration
    if (d.pierce !== undefined) out.pierce += d.pierce
    if (d.knockback !== undefined) out.knockback += d.knockback
  }
  const st = s.player.stats
  out.damage *= st.might
  out.cooldown = Math.max(0.08, out.cooldown * st.cooldown)
  out.area *= st.area
  out.speed *= st.projSpeed
  out.duration *= st.duration
  // amount do player só em behaviors de projétil múltiplo (whip/aura não)
  const beh = def.behavior
  if (beh !== 'whip' && beh !== 'aura') out.amount += st.amount
  return out
}

export function effectiveStats(s: GameState, w: EquippedWeapon): WeaponStats {
  return effInto(s, w, {
    damage: 0, cooldown: 0, amount: 0, speed: 0, area: 0, duration: 0, pierce: 0, knockback: 0,
  })
}

function findNearest(s: GameState, x: number, y: number, maxDistSq: number): number {
  const en = s.enemies.items
  let best = -1
  let bestSq = maxDistSq
  for (let i = 0; i < en.length; i++) {
    const e = en[i]
    if (!e.active) continue
    const dx = e.x - x
    const dy = e.y - y
    const dSq = dx * dx + dy * dy
    if (dSq < bestSq) { bestSq = dSq; best = i }
  }
  return best
}

function allocProj(s: GameState, wi: number, kind: WeaponBehavior, eff: WeaponStats): Projectile | null {
  const p = s.projectiles.alloc()
  if (!p) return null
  p.active = true
  p.kind = kind
  p.weaponIdx = wi
  p.x = s.player.x
  p.y = s.player.y
  p.vx = 0
  p.vy = 0
  p.damage = eff.damage
  p.radius = eff.area
  p.pierce = eff.pierce
  p.knockback = eff.knockback
  p.ttl = eff.duration
  p.age = 0
  p.angle = 0
  p.reach = 0
  p.tx = 0
  p.ty = 0
  p.ox = 0
  p.oy = 0
  p.hitMap.clear()
  return p
}

/** false = tiro não gastado (nearest sem alvo) */
function fireOne(s: GameState, wi: number, w: EquippedWeapon, def: WeaponDef, eff: WeaponStats, k: number): boolean {
  const px = s.player.x
  const py = s.player.y
  switch (def.behavior) {
    case 'nearest': {
      const ti = findNearest(s, px, py, NEAREST_RANGE_SQ)
      if (ti < 0) return false
      const p = allocProj(s, wi, 'nearest', eff)
      if (!p) return true
      const e = s.enemies.items[ti]
      const dx = e.x - px
      const dy = e.y - py
      const d = Math.sqrt(dx * dx + dy * dy) || 1
      p.vx = (dx / d) * eff.speed
      p.vy = (dy / d) * eff.speed
      s.sounds.push('shoot')
      return true
    }
    case 'directional': {
      const p = allocProj(s, wi, 'directional', eff)
      if (!p) return true
      // leque de ±10° por projétil extra do volley
      const step = Math.PI / 18
      const off = k === 0 ? 0 : ((k + 1) >> 1) * step * (k % 2 === 1 ? 1 : -1)
      const a = Math.atan2(s.player.dirY, s.player.dirX) + off
      p.vx = Math.cos(a) * eff.speed
      p.vy = Math.sin(a) * eff.speed
      s.sounds.push('shoot')
      return true
    }
    case 'lob':
    case 'zone': {
      // alvo: inimigo aleatório próximo (até 8 candidatos) ou ponto aleatório
      lobCand.length = 0
      const en = s.enemies.items
      for (let i = 0; i < en.length && lobCand.length < 8; i++) {
        const e = en[i]
        if (!e.active) continue
        const dx = e.x - px
        const dy = e.y - py
        if (dx * dx + dy * dy <= LOB_RANGE_SQ) lobCand.push(i)
      }
      let tx: number
      let ty: number
      if (lobCand.length > 0) {
        const e = en[lobCand[s.rng.int(0, lobCand.length - 1)]]
        tx = e.x
        ty = e.y
      } else {
        const a = s.rng.next() * TAU
        const r = s.rng.range(80, 300)
        tx = px + Math.cos(a) * r
        ty = py + Math.sin(a) * r
      }
      const p = allocProj(s, wi, def.behavior, eff)
      if (!p) return true
      const dx = tx - px
      const dy = ty - py
      const d = Math.sqrt(dx * dx + dy * dy)
      p.ox = px
      p.oy = py
      p.tx = tx
      p.ty = ty
      p.ttl = Math.min(1.4, Math.max(0.25, d / Math.max(1, eff.speed))) // tempo de voo
      p.reach = eff.duration // zone: duração da poça
      s.sounds.push('shoot')
      return true
    }
    case 'boomerang': {
      const p = allocProj(s, wi, 'boomerang', eff)
      if (!p) return true
      const ti = findNearest(s, px, py, Infinity)
      let ux = s.player.dirX
      let uy = s.player.dirY
      if (ti >= 0) {
        const e = s.enemies.items[ti]
        const dx = e.x - px
        const dy = e.y - py
        const d = Math.sqrt(dx * dx + dy * dy) || 1
        ux = dx / d
        uy = dy / d
      }
      const v0 = Math.max(60, eff.speed)
      const outT = (2 * BOOMERANG_REACH) / v0 // desacelera linearmente até reach
      p.vx = ux
      p.vy = uy
      p.ox = v0 // ida: velocidade inicial | volta: velocidade corrente
      p.oy = outT
      p.reach = BOOMERANG_REACH
      p.angle = 0 // fase 0 = ida
      p.pierce = 999
      p.ttl = Math.max(eff.duration, 2 * outT + 0.5)
      s.sounds.push('shoot')
      return true
    }
    case 'whip': {
      w.side = -w.side
      const p = allocProj(s, wi, 'whip', eff)
      if (!p) return true
      p.x = px + w.side * eff.area * 0.9
      p.y = py
      p.ttl = 0.12
      p.pierce = 999
      s.sounds.push('shoot')
      return true
    }
    default:
      return true
  }
}

function fireOrbit(s: GameState, wi: number, w: EquippedWeapon, eff: WeaponStats): void {
  // desativa o conjunto anterior DESTA arma: o anel é sempre `amount` copos,
  // recriados a cada cooldown ("sempre ativos" sem gap). Sem isso, a evoluída
  // (duration 999) acumularia +amount copos por volley até saturar o pool e
  // matar de fome todas as outras armas de projétil.
  const items = s.projectiles.items
  for (let i = 0; i < items.length; i++) {
    const prev = items[i]
    if (prev.active && prev.kind === 'orbit' && prev.weaponIdx === wi) prev.active = false
  }
  const n = Math.max(1, Math.round(eff.amount))
  const orbitR = 85 * s.player.stats.area
  for (let i = 0; i < n; i++) {
    const p = allocProj(s, wi, 'orbit', eff)
    if (!p) break
    p.angle = w.side + (i * TAU) / n
    p.reach = orbitR
    p.vx = eff.speed / 85 // rad/s
    p.pierce = 999
    p.x = s.player.x + Math.cos(p.angle) * orbitR
    p.y = s.player.y + Math.sin(p.angle) * orbitR
  }
  w.side += 0.35 // varia o ângulo base por volley
  s.sounds.push('shoot')
}

export function updateWeapons(s: GameState, dt: number): void {
  for (let wi = 0; wi < s.weapons.length; wi++) {
    const w = s.weapons[wi]
    const def = weaponById(w.defId)
    if (def.behavior === 'aura') continue // aura: tick em collide.ts

    const eff = effInto(s, w, SCRATCH)
    w.cooldown -= dt

    if (def.behavior === 'orbit') {
      if (w.cooldown <= 0) {
        fireOrbit(s, wi, w, eff)
        w.cooldown = eff.cooldown
      }
      continue
    }

    if (w.volleyLeft <= 0 && w.cooldown <= 0) {
      w.volleyLeft = Math.max(1, Math.round(eff.amount))
      w.volleyTimer = 0
      w.cooldown = eff.cooldown
    }

    if (w.volleyLeft > 0) {
      w.volleyTimer -= dt
      let guard = 0
      while (w.volleyLeft > 0 && w.volleyTimer <= 0 && guard < 16) {
        const total = Math.max(1, Math.round(eff.amount))
        const k = Math.max(0, total - w.volleyLeft)
        const ok = fireOne(s, wi, w, def, eff, k)
        if (!ok) {
          // nearest sem alvo: não gasta o tiro, retry curto
          w.volleyLeft = 0
          w.cooldown = 0.2
          break
        }
        w.volleyLeft--
        w.volleyTimer += VOLLEY_GAP
        guard++
      }
    }
  }
}
