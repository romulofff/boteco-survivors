import { describe, expect, it } from 'vitest'
import type { Btn } from '../src/types'
import {
  charSelectRects, endRects, hitTest, hudRects, levelupRects, menuRects, pauseRects, shopRects,
} from '../src/ui/layout'

function overlaps(a: Btn, b: Btn): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

describe('layout', () => {
  it('hudRects: cacheado, 72×72, sem colidir com timer/barra de chefe/ícones', () => {
    const h = hudRects()
    expect(hudRects()).toBe(h)
    expect(h.map((b) => b.id)).toEqual(['pause', 'mute'])
    for (const b of h) {
      expect(b.w).toBe(72)
      expect(b.h).toBe(72)
    }
    expect(overlaps(h[0], h[1])).toBe(false)
    const timer: Btn = { x: 430, y: 8, w: 100, h: 40, id: 'timer' }
    const boss: Btn = { x: 238, y: 476, w: 484, h: 54, id: 'boss' }
    const icons: Btn = { x: 0, y: 10, w: 200, h: 64, id: 'icons' }
    for (const b of h) {
      expect(overlaps(b, timer)).toBe(false)
      expect(overlaps(b, boss)).toBe(false)
      expect(overlaps(b, icons)).toBe(false)
    }
    // centros esperados pela spec
    expect(h[0].x + h[0].w / 2).toBe(916)
    expect(h[1].x + h[1].w / 2).toBe(836)
  })

  it('telas: rects dentro de 960×540, sem sobreposição; botões ≥ 68 e acima de y=508', () => {
    const screens = [
      menuRects(), pauseRects(), endRects(), charSelectRects(3), shopRects(6), levelupRects(3),
    ]
    const BUTTON_IDS = ['play', 'shop', 'back', 'resume', 'quit', 'menu']
    for (const rects of screens) {
      for (let i = 0; i < rects.length; i++) {
        const b = rects[i]
        expect(b.x).toBeGreaterThanOrEqual(0)
        expect(b.y).toBeGreaterThanOrEqual(0)
        expect(b.x + b.w).toBeLessThanOrEqual(960)
        expect(b.y + b.h).toBeLessThanOrEqual(540)
        for (let j = i + 1; j < rects.length; j++) {
          expect(overlaps(b, rects[j]), b.id + ' × ' + rects[j].id).toBe(false)
        }
        if (BUTTON_IDS.includes(b.id)) {
          expect(b.h, b.id).toBeGreaterThanOrEqual(68)
          expect(b.y + b.h, b.id).toBeLessThanOrEqual(508)
        }
      }
    }
  })

  it('hitTest: borda esquerda inclusiva, direita exclusiva, fora = -1', () => {
    const rects = menuRects()
    const b = rects[1]
    expect(hitTest(rects, b.x, b.y)).toBe(1)
    expect(hitTest(rects, b.x + b.w, b.y)).toBe(-1)
    expect(hitTest(rects, b.x + 1, b.y + b.h)).toBe(-1)
    expect(hitTest(rects, 1, 1)).toBe(-1)
  })
})
