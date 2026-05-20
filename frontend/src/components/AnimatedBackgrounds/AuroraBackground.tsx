import { useEffect, useRef, type CSSProperties } from 'react'

interface AuroraBackgroundProps {
  className?: string
  style?: CSSProperties
}

interface Dot {
  x: number
  y: number
  vx: number
  vy: number
  a: number
  phase: number
}

class Orb {
  x = 0
  y = 0

  #ox: number
  #oy: number
  #r: number
  #speed: number
  #phase: number
  #t: number
  #getW: () => number
  #getH: () => number

  constructor(
    ox: number,
    oy: number,
    r: number,
    speed: number,
    phase: number,
    getW: () => number,
    getH: () => number,
  ) {
    this.#ox = ox
    this.#oy = oy
    this.x = ox
    this.y = oy
    this.#r = r
    this.#speed = speed
    this.#phase = phase
    this.#t = Math.random() * Math.PI * 2
    this.#getW = getW
    this.#getH = getH
  }

  update() {
    this.#t += this.#speed
    const W = this.#getW()
    const H = this.#getH()
    this.x = this.#ox + Math.sin(this.#t + this.#phase) * W * 0.12
    this.y = this.#oy + Math.cos(this.#t * 0.7 + this.#phase) * H * 0.1
  }

  draw(ctx: CanvasRenderingContext2D) {
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.#r)
    g.addColorStop(0, 'rgba(0,255,90,0.13)')
    g.addColorStop(0.4, 'rgba(0,200,70,0.07)')
    g.addColorStop(1, 'rgba(0,100,40,0)')
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.#r, 0, Math.PI * 2)
    ctx.fillStyle = g
    ctx.fill()
  }
}

const COLS = 14
const ROWS = 9
const DOT_COUNT = 18

export default function AuroraBackground({
  className = '',
  style = {},
}: AuroraBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio ?? 1
    let W = 0
    let H = 0

    const setSize = () => {
      const rect = canvas.getBoundingClientRect()
      W = rect.width
      H = rect.height
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)
    }
    setSize()

    // ── Orbs ─────────────────────────────────────────────────────────────────
    const getW = () => W
    const getH = () => H
    const minDim = () => Math.min(W, H)

    const orbs = [
      new Orb(W * 0.25, H * 0.4,  minDim() * 0.22, 0.004,  0,   getW, getH),
      new Orb(W * 0.75, H * 0.55, minDim() * 0.20, 0.005,  1.2, getW, getH),
      new Orb(W * 0.5,  H * 0.3,  minDim() * 0.16, 0.006,  2.4, getW, getH),
      new Orb(W * 0.2,  H * 0.7,  minDim() * 0.15, 0.0035, 3.6, getW, getH),
      new Orb(W * 0.8,  H * 0.25, minDim() * 0.13, 0.007,  4.8, getW, getH),
    ]

    // ── Dots ──────────────────────────────────────────────────────────────────
    const dots: Dot[] = Array.from({ length: DOT_COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      a: 0.04 + Math.random() * 0.12,
      phase: Math.random() * Math.PI * 2,
    }))

    // ── Draw helpers ──────────────────────────────────────────────────────────
    const drawGrid = (t: number) => {
      for (let i = 0; i <= COLS; i++) {
        const x = (i / COLS) * W
        const wave = Math.sin(t * 0.4 + i * 0.5) * 3
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x + wave, H)
        ctx.strokeStyle = 'rgba(0,180,70,0.055)'
        ctx.lineWidth = 0.5
        ctx.stroke()
      }
      for (let j = 0; j <= ROWS; j++) {
        const y = (j / ROWS) * H
        const wave = Math.sin(t * 0.3 + j * 0.7) * 3
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(W, y + wave)
        ctx.strokeStyle = 'rgba(0,180,70,0.055)'
        ctx.lineWidth = 0.5
        ctx.stroke()
      }
    }

    const drawDots = (t: number) => {
      for (const d of dots) {
        d.x += d.vx
        d.y += d.vy
        if (d.x < 0) d.x = W
        if (d.x > W) d.x = 0
        if (d.y < 0) d.y = H
        if (d.y > H) d.y = 0
        const alpha = d.a * (0.6 + 0.4 * Math.sin(t * 0.02 + d.phase))
        ctx.beginPath()
        ctx.arc(d.x, d.y, 1.2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(0,255,80,${alpha})`
        ctx.fill()
      }
    }

    

    // ── Events ────────────────────────────────────────────────────────────────
    const onResize = () => {
      setSize()
    }

    window.addEventListener('resize', onResize)

    // ── Loop ──────────────────────────────────────────────────────────────────
    let t = 0
    let rafId: number

    const animate = () => {
      rafId = requestAnimationFrame(animate)
      t += 0.016
      ctx.clearRect(0, 0, W, H)
      drawGrid(t)
      for (const o of orbs) { o.update(); o.draw(ctx) }
      drawDots(t)
    }
    animate()

    // ── Cleanup ───────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        cursor: 'default',
        ...style,
      }}
    >
      {/* Main canvas */}
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {/* CRT scanlines */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'repeating-linear-gradient(0deg,rgba(0,0,0,0.10) 0px,rgba(0,0,0,0.10) 1px,transparent 1px,transparent 4px)',
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
            'radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,0.55) 100%)',
        }}
      />
    </div>
  )
}