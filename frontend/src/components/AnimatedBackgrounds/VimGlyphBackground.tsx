import { useEffect, useRef, useCallback, type CSSProperties } from 'react'

interface VimGlyphBackgroundProps {
  count?: number
  color?: string
  className?: string
  style?: CSSProperties
}

interface MouseState {
  x: number
  y: number
}

const VIM_COMMANDS = [
  ':w', ':q', 'dd', 'yy', 'gg', 'ci"', 'u', '>>', 'ZZ',
  'dw', 'vip', 'yiw', 'p', '.', '%', '*', '0', '$', 'f',
  'n', 'G', 'V', 'x', 'o', 'r', 'J', 'A', 'I', 'b', 'e', 'w',
]

class Glyph {
  x = 0
  y = 0
  #vx = 0
  #vy = 0
  #drift = 0
  #baseAlpha = 0
  alpha = 0
  #size = 0
  #age = 0
  #maxLife = 0
  #twinkleSpeed = 0
  #twinklePhase = 0
  text = ''

  #w: number
  #h: number
  #speed: number

  constructor(w: number, h: number, speed: number, scatter = false) {
    this.#w = w
    this.#h = h
    this.#speed = speed
    this.#init(scatter)
  }

  resize(w: number, h: number) {
    this.#w = w
    this.#h = h
  }

  #init(scatter = false) {
    this.x = Math.random() * this.#w
    this.y = scatter ? Math.random() * this.#h : this.#h + 30
    this.#vy = -(0.18 + Math.random() * 0.35) * this.#speed
    this.#vx = (Math.random() - 0.5) * 0.08
    this.text = VIM_COMMANDS[Math.floor(Math.random() * VIM_COMMANDS.length)]
    this.#baseAlpha = 0.22 + Math.random() * 0.38
    this.alpha = this.#baseAlpha
    this.#size = 11 + Math.floor(Math.random() * 8)
    this.#maxLife = 280 + Math.random() * 300
    this.#age = scatter ? Math.random() * this.#maxLife : 0
    this.#drift = (Math.random() - 0.5) * 0.0015
    this.#twinkleSpeed = 0.01 + Math.random() * 0.02
    this.#twinklePhase = Math.random() * Math.PI * 2
  }

  update(t: number, mouse: MouseState) {
    this.#age++
    this.x += this.#vx
    this.#vy += this.#drift * 0.5
    this.y += this.#vy

    const fade = Math.min(
      1,
      Math.min(this.#age / 40, (this.#maxLife - this.#age) / 40),
    )
    const twinkle =
      0.7 + 0.3 * Math.sin(t * this.#twinkleSpeed + this.#twinklePhase)

    const dx = this.x - mouse.x
    const dy = this.y - mouse.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const proximity = dist < 160 ? (1 - dist / 160) * 0.9 : 0

    this.alpha = (this.#baseAlpha + proximity) * fade * twinkle

    if (this.#age >= this.#maxLife || this.y < -30) this.#init(false)
  }

  draw(ctx: CanvasRenderingContext2D, primaryColor: string, bloomColor: string) {
    ctx.globalAlpha = Math.max(0, this.alpha)
    ctx.font = `${this.#size}px monospace`
    ctx.fillStyle = primaryColor
    ctx.fillText(this.text, this.x, this.y)

    if (this.alpha > 0.08) {
      ctx.globalAlpha = this.alpha * 0.35
      ctx.font = `${this.#size + 2}px monospace`
      ctx.fillStyle = bloomColor
      ctx.fillText(this.text, this.x - 0.5, this.y)
    }
  }
}

export default function VimGlyphBackground({
  count = 55,
  color = '#00ff55',
  className = '',
  style = {},
}: VimGlyphBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Derive a slightly shifted bloom color from the base color
  const bloomColor = useCallback(() => {
    // Lighten toward white a bit for the phosphor bloom
    // If custom color passed, just use a brighter variant
    if (color === '#00ff55') return '#00ff88'
    return color
  }, [color])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const setSize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.round(rect.width)
      canvas.height = Math.round(rect.height)
    }
    setSize()

    const glyphs = Array.from(
      { length: count },
      () => new Glyph(canvas.width, canvas.height, 1, true),
    )

    const mouse: MouseState = { x: -999, y: -999 }

    const onResize = () => {
      setSize()
      for (const g of glyphs) g.resize(canvas.width, canvas.height)
    }
    window.addEventListener('resize', onResize)

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
    }
    const onMouseLeave = () => {
      mouse.x = -999
      mouse.y = -999
    }
    const onTouchMove = (e: TouchEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = e.touches[0].clientX - rect.left
      mouse.y = e.touches[0].clientY - rect.top
    }
    const onTouchEnd = () => {
      mouse.x = -999
      mouse.y = -999
    }

    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseleave', onMouseLeave)
    canvas.addEventListener('touchmove', onTouchMove, { passive: true })
    canvas.addEventListener('touchend', onTouchEnd)

    const bloom = bloomColor()

    const drawConnections = () => {
      for (let i = 0; i < glyphs.length; i++) {
        // Glyph-to-glyph connections
        for (let j = i + 1; j < glyphs.length; j++) {
          const a = glyphs[i]
          const b = glyphs[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const d = Math.sqrt(dx * dx + dy * dy)

          if (d < 90) {
            const str = (1 - d / 90) * Math.min(a.alpha, b.alpha) * 0.35
            ctx.globalAlpha = str
            ctx.strokeStyle = '#00cc44'
            ctx.lineWidth = 0.4
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }

        // Glyph-to-mouse connections
        const g = glyphs[i]
        const dx = g.x - mouse.x
        const dy = g.y - mouse.y
        const d = Math.sqrt(dx * dx + dy * dy)

        if (d < 130) {
          ctx.globalAlpha = (1 - d / 130) * g.alpha * 0.5
          ctx.strokeStyle = color
          ctx.lineWidth = 0.5
          ctx.beginPath()
          ctx.moveTo(g.x, g.y)
          ctx.lineTo(mouse.x, mouse.y)
          ctx.stroke()
        }
      }
    }

    let t = 0
    let rafId: number

    const animate = () => {
      rafId = requestAnimationFrame(animate)
      t++
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.textAlign = 'left'
      drawConnections()
      for (const g of glyphs) {
        g.update(t, mouse)
        g.draw(ctx, color, bloom)
      }
      ctx.globalAlpha = 1
    }

    animate()

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseleave', onMouseLeave)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
    }
  }, [count, color, bloomColor])

  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        cursor: 'crosshair',
        ...style,
      }}
    >
      {/* Canvas layer */}
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {/* CRT scanlines overlay */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'repeating-linear-gradient(0deg,rgba(0,0,0,0.12) 0px,rgba(0,0,0,0.12) 1px,transparent 1px,transparent 4px)',
        }}
      />

      {/* Phosphor vignette */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse at 50% 60%, transparent 40%, rgba(0,0,0,0.6) 100%)',
        }}
      />
    </div>
  )
}