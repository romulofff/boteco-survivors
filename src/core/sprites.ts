// Cache de sprites de emoji pré-renderizados em canvas offscreen.
// Nunca desenhar emoji com fillText por frame — sempre via get().

export class SpriteCache {
  private cache = new Map<string, HTMLCanvasElement>()

  get(emoji: string, size: number): HTMLCanvasElement {
    const key = emoji + ':' + size
    const hit = this.cache.get(key)
    if (hit) return hit

    const px = Math.max(1, Math.ceil(size))
    const c = document.createElement('canvas')
    c.width = px
    c.height = px
    const ctx = c.getContext('2d')
    if (ctx) {
      ctx.font = Math.round(px * 0.85) + 'px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      // leve ajuste vertical: emoji tende a ficar acima do baseline 'middle'
      ctx.fillText(emoji, px / 2, px / 2 + px * 0.03)
    }
    this.cache.set(key, c)
    return c
  }
}
