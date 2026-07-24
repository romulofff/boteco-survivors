// Hash espacial de buckets fixos (64×64 = 4096). Coordenadas de mundo ilimitadas:
// hash por módulo positivo da célula; colisões de hash são ok (chamador filtra
// por distância). clear() reusa os arrays (length = 0) — sem alocação por frame.

const GRID = 64
const NUM_BUCKETS = GRID * GRID

export class SpatialHash {
  private cellSize: number
  private cells: number[][]

  constructor(cellSize: number) {
    this.cellSize = cellSize
    this.cells = new Array<number[]>(NUM_BUCKETS)
    for (let i = 0; i < NUM_BUCKETS; i++) this.cells[i] = []
  }

  clear(): void {
    for (let i = 0; i < NUM_BUCKETS; i++) this.cells[i].length = 0
  }

  insert(idx: number, x: number, y: number): void {
    const cs = this.cellSize
    const cx = ((Math.floor(x / cs) % GRID) + GRID) % GRID
    const cy = ((Math.floor(y / cs) % GRID) + GRID) % GRID
    this.cells[cy * GRID + cx].push(idx)
  }

  /** preenche out (reusado pelo chamador) com candidatos das células cobertas pelo círculo */
  query(x: number, y: number, radius: number, out: number[]): number[] {
    out.length = 0
    const cs = this.cellSize
    const cx0 = Math.floor((x - radius) / cs)
    let cx1 = Math.floor((x + radius) / cs)
    const cy0 = Math.floor((y - radius) / cs)
    let cy1 = Math.floor((y + radius) / cs)
    // raio maior que a grade inteira visitaria o mesmo bucket 2×: limita o span
    if (cx1 - cx0 >= GRID) cx1 = cx0 + GRID - 1
    if (cy1 - cy0 >= GRID) cy1 = cy0 + GRID - 1
    for (let cy = cy0; cy <= cy1; cy++) {
      const ry = ((cy % GRID) + GRID) % GRID
      const row = ry * GRID
      for (let cx = cx0; cx <= cx1; cx++) {
        const rx = ((cx % GRID) + GRID) % GRID
        const bucket = this.cells[row + rx]
        for (let i = 0; i < bucket.length; i++) out.push(bucket[i])
      }
    }
    return out
  }
}
