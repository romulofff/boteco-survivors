import { describe, expect, it } from 'vitest'
import { WEAPONS, weaponById } from '../src/data/weapons'
import { PASSIVES, passiveById } from '../src/data/passives'
import { CHARACTERS } from '../src/data/characters'
import { ENEMIES, enemyIndexById } from '../src/data/enemies'
import { EVENTS, WAVES } from '../src/data/waves'
import { WIN_TIME } from '../src/constants'

describe('data/weapons', () => {
  it('16 armas: 8 base (com evolução) + 8 evoluídas', () => {
    expect(WEAPONS.length).toBe(16)
    const base = WEAPONS.filter((w) => !w.evolved)
    const evolved = WEAPONS.filter((w) => w.evolved)
    expect(base.length).toBe(8)
    expect(evolved.length).toBe(8)
    for (const w of base) {
      expect(w.evolution, `arma base ${w.id} sem evolution`).toBeDefined()
      expect(w.perLevel.length, `arma base ${w.id} perLevel`).toBe(7)
    }
  })

  it('ids únicos e weaponById resolve', () => {
    const ids = new Set(WEAPONS.map((w) => w.id))
    expect(ids.size).toBe(WEAPONS.length)
    for (const w of WEAPONS) {
      expect(weaponById(w.id)).toBe(w)
    }
  })

  it('toda evolution.into existe e é evolved; todo requires existe em PASSIVES', () => {
    for (const w of WEAPONS) {
      if (!w.evolution) continue
      const into = WEAPONS.find((x) => x.id === w.evolution!.into)
      expect(into, `${w.id} -> ${w.evolution.into}`).toBeDefined()
      expect(into!.evolved, `${w.evolution.into} deveria ser evolved`).toBe(true)
      const req = PASSIVES.find((p) => p.id === w.evolution!.requires)
      expect(req, `${w.id} requer passivo ${w.evolution.requires}`).toBeDefined()
    }
  })
})

describe('data/passives', () => {
  it('9 passivos com ids únicos e passiveById resolve', () => {
    expect(PASSIVES.length).toBe(9)
    const ids = new Set(PASSIVES.map((p) => p.id))
    expect(ids.size).toBe(9)
    for (const p of PASSIVES) {
      expect(passiveById(p.id)).toBe(p)
      expect(p.maxLevel, p.id).toBeGreaterThan(0)
    }
  })
})

describe('data/characters', () => {
  it('3 personagens com startWeapon válido (arma base)', () => {
    expect(CHARACTERS.length).toBe(3)
    for (const c of CHARACTERS) {
      const w = WEAPONS.find((x) => x.id === c.startWeapon)
      expect(w, `${c.id} startWeapon ${c.startWeapon}`).toBeDefined()
      expect(w!.evolved, `${c.id} não pode começar com arma evoluída`).not.toBe(true)
    }
  })
})

describe('data/enemies', () => {
  // GDD lista 10 inimigos comuns; ENEMIES pode ter entradas extras de chefe
  // (EVENTS.enemy precisa existir em ENEMIES).
  it('contém os 10 inimigos do GDD, ids únicos, enemyIndexById resolve', () => {
    const gddIds = [
      'mosca', 'barata', 'rato', 'bebado', 'pombo',
      'torcedor', 'cunhado', 'urubu', 'seguranca', 'barata_voadora',
    ]
    expect(ENEMIES.length).toBeGreaterThanOrEqual(10)
    const ids = new Set(ENEMIES.map((e) => e.id))
    expect(ids.size).toBe(ENEMIES.length)
    for (const id of gddIds) {
      expect(ids.has(id), `inimigo do GDD ausente: ${id}`).toBe(true)
    }
    for (let i = 0; i < ENEMIES.length; i++) {
      expect(enemyIndexById(ENEMIES[i].id)).toBe(i)
    }
  })
})

describe('data/waves', () => {
  it('WAVES contíguas cobrindo 0..1200', () => {
    expect(WAVES.length).toBeGreaterThan(0)
    expect(WAVES[0].from).toBe(0)
    for (let i = 1; i < WAVES.length; i++) {
      expect(WAVES[i].from, `onda ${i} não é contígua`).toBe(WAVES[i - 1].to)
    }
    expect(WAVES[WAVES.length - 1].to).toBeGreaterThanOrEqual(WIN_TIME)
  })

  it('todo id de inimigo em WAVES/EVENTS existe em ENEMIES', () => {
    const ids = new Set(ENEMIES.map((e) => e.id))
    for (const w of WAVES) {
      expect(w.enemies.length, `onda ${w.from}s sem inimigos`).toBeGreaterThan(0)
      for (const id of w.enemies) {
        expect(ids.has(id), `onda ${w.from}s: inimigo ${id} não existe`).toBe(true)
      }
    }
    for (const ev of EVENTS) {
      expect(ids.has(ev.enemy), `evento ${ev.at}s: inimigo ${ev.enemy} não existe`).toBe(true)
    }
  })

  it('EVENTS ordenados por at, com exatamente 4 chefes', () => {
    for (let i = 1; i < EVENTS.length; i++) {
      expect(EVENTS[i].at, `evento ${i} fora de ordem`).toBeGreaterThanOrEqual(EVENTS[i - 1].at)
    }
    const bosses = EVENTS.filter((e) => e.kind === 'boss')
    expect(bosses.length).toBe(4)
    for (const b of bosses) {
      expect(b.bossName, `chefe em ${b.at}s sem bossName`).toBeTruthy()
    }
  })
})
