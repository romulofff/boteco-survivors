// Gera public/apple-touch-icon.png (180×180: 🍻 sobre #0d0b0e) via Playwright.
// Uso: node scripts/icon.mjs
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

mkdirSync('public', { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 180, height: 180 }, deviceScaleFactor: 1 })
await page.setContent(`<!doctype html><html><body style="margin:0;width:180px;height:180px;background:#0d0b0e;display:flex;align-items:center;justify-content:center">
  <div style="font:120px system-ui,'Apple Color Emoji','Segoe UI Emoji',sans-serif;line-height:1">🍻</div></body></html>`)
await page.waitForTimeout(300)
await page.screenshot({ path: 'public/apple-touch-icon.png', clip: { x: 0, y: 0, width: 180, height: 180 } })
await browser.close()
console.log('public/apple-touch-icon.png gerado')
