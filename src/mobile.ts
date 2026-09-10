// Integração mobile (DOM): guardas de gesto, overlay de retrato, fullscreen
// Android, wake lock e trap do botão "voltar". Tudo com guardas — nada aqui
// pode lançar em Chromium headless. Irmão de main.ts (fora de src/game).

const noop = (): void => {}

const PORTRAIT_MQ = '(orientation: portrait) and (pointer: coarse) and (max-width: 767px)'

/** gesturestart/gesturechange preventDefault (pinça iOS), touchmove não-passivo, dblclick */
export function installMobileGuards(): void {
  const prevent = (e: Event): void => e.preventDefault()
  // pinça/zoom do Safari iOS (eventos proprietários)
  document.addEventListener('gesturestart', prevent, { passive: false })
  document.addEventListener('gesturechange', prevent, { passive: false })
  // scroll/bounce do documento durante o arraste do stick
  document.addEventListener('touchmove', prevent, { passive: false })
  // duplo toque = zoom em alguns navegadores
  document.addEventListener('dblclick', prevent)
}

/** cb(matches) no change e uma vez no init */
export function watchPortrait(cb: (portrait: boolean) => void): void {
  if (typeof window.matchMedia !== 'function') return
  const mql = window.matchMedia(PORTRAIT_MQ)
  const check = (): void => cb(mql.matches)
  if (typeof mql.addEventListener === 'function') mql.addEventListener('change', check)
  window.addEventListener('resize', check)
  check()
}

/** Android: fullscreen + trava paisagem; no-op onde não dá (iPhone) */
export function requestFullscreenLandscape(): void {
  const doc = document
  if (!doc.fullscreenEnabled || doc.fullscreenElement) return
  const el = doc.documentElement
  if (typeof el.requestFullscreen !== 'function') return
  try {
    const p = el.requestFullscreen({ navigationUI: 'hide' })
    if (p && typeof p.then === 'function') {
      p.then(() => {
        const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
        if (o && typeof o.lock === 'function') {
          const lp = o.lock('landscape')
          if (lp && typeof lp.catch === 'function') lp.catch(noop)
        }
      }).catch(noop)
    }
  } catch {
    // navegador sem suporte / sem gesto: ignora
  }
}

interface WakeLockSentinelLike {
  release(): Promise<void>
  addEventListener?(type: string, cb: () => void): void
}

/** wake lock de tela: acquire()/release() idempotentes */
export function makeWakeLock(): { acquire(): void; release(): void } {
  let sentinel: WakeLockSentinelLike | null = null
  let pending = false
  let wanted = false
  const nav = navigator as Navigator & {
    wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> }
  }
  return {
    acquire(): void {
      wanted = true
      if (sentinel !== null || pending) return
      if (!('wakeLock' in nav) || !nav.wakeLock) return
      try {
        pending = true
        nav.wakeLock.request('screen').then((s) => {
          pending = false
          if (!wanted) {
            s.release().catch(noop)
            return
          }
          sentinel = s
          // o sistema pode soltar sozinho (aba oculta): esquece a referência
          if (typeof s.addEventListener === 'function') {
            s.addEventListener('release', () => { if (sentinel === s) sentinel = null })
          }
        }).catch(() => { pending = false })
      } catch {
        pending = false
      }
    },
    release(): void {
      wanted = false
      if (sentinel === null) return
      const s = sentinel
      sentinel = null
      try {
        s.release().catch(noop)
      } catch {
        // já solto
      }
    },
  }
}

/** pushState ao entrar em run; popstate durante gameplay → onBack() + pushState de novo.
 * No máximo UMA entrada extra no histórico: fora de gameplay o popstate a consome
 * (senão cada run deixaria um "Voltar" morto no menu). */
export function installBackTrap(isGameplay: () => boolean, onBack: () => void): { enter(): void } {
  let armed = false
  const push = (): void => {
    try {
      history.pushState({ run: 1 }, '')
      armed = true
    } catch {
      // file:// ou histórico bloqueado
    }
  }
  window.addEventListener('popstate', () => {
    if (!isGameplay()) {
      armed = false // o usuário consumiu a entrada: próxima run arma de novo
      return
    }
    onBack()
    push()
  })
  return {
    enter(): void {
      if (!armed) push()
    },
  }
}
