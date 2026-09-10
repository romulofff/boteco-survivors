// Helper de testes: InputFrame com overrides (mesmo literal do jogo).
import type { InputFrame } from '../src/types'
import { makeInputFrame } from '../src/core/inputframe'

export function makeFrame(over?: Partial<InputFrame>): InputFrame {
  const f = makeInputFrame()
  if (over) Object.assign(f, over)
  return f
}
