// Loop principal: requestAnimationFrame + timestep fixo 1/60 com acumulador.

import { FIXED_DT } from '../constants'

export function startLoop(update: (dt: number) => void, render: () => void): void {
  let last = performance.now()
  let acc = 0

  const tick = (now: number): void => {
    let dt = (now - last) / 1000
    last = now
    if (dt > 0.25) dt = 0.25 // aba oculta / hiccup grande
    acc += dt

    let steps = 0
    while (acc >= FIXED_DT && steps < 5) {
      update(FIXED_DT)
      acc -= FIXED_DT
      steps++
    }
    if (acc >= FIXED_DT) acc = 0 // atrasado demais: descarta o excedente

    render()
    requestAnimationFrame(tick)
  }

  requestAnimationFrame(tick)
}
