// Helpers matemáticos.

export function dist(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  return Math.sqrt(dx * dx + dy * dy)
}

export function distSq(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  return dx * dx + dy * dy
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** vetor unitário; (0,0) se entrada nula. Aloca tupla — evitar em hot path. */
export function norm(x: number, y: number): [number, number] {
  const len = Math.sqrt(x * x + y * y)
  if (len === 0) return [0, 0]
  return [x / len, y / len]
}
