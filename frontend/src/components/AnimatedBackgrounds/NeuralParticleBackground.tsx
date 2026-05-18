import { useEffect, useRef, useCallback, type CSSProperties } from 'react'

interface NeuralParticleBackgroundProps {
  count?: number
  connectDist?: number
  color?: [number, number, number]
  speed?: number
  className?: string
  style?: CSSProperties
}

interface MouseState {
  x: number
  y: number
  active: boolean
}

interface Pulse {
  x: number
  y: number
  r: number
  life: number
}

class Particle {
  x = 0
  y = 0
  vx = 0
  vy = 0
  baseR = 0
  r = 0
  pulse = 0
  life = 0
  age = 0
  opacity = 0

  #w: number
  #h: number
  #speed: number

  constructor(w: number, h: number, speed: number, init = false) {
    this.#w = w
    this.#h = h
    this.#speed = speed
    this.reset(init)
  }

  // Called after canvas resize so particles spread across new dimensions
  resize(w: number, h: number) {
    this.#w = w
    this.#h = h
  }

  reset(init = false) {
    this.x = Math.random() * this.#w
    this.y = Math.random() * this.#h
    this.vx = (Math.random() - 0.5) * 0.5 * this.#speed
    this.vy = (Math.random() - 0.5) * 0.5 * this.#speed
    this.baseR = Math.random() * 2.2 + 0.8
    this.r = this.baseR
    this.pulse = 0
    this.life = Math.random() * 200 + 100
    this.age = init ? Math.random() * this.life : 0
    this.opacity = 0
  }

  update(mouse: MouseState) {
    this.age++

    const half = this.life / 2
    this.opacity =
      this.age < half
        ? this.age / half
        : (this.life - this.age) / half
    this.opacity = Math.max(0, Math.min(1, this.opacity))

    if (mouse.active) {
      const dx = mouse.x - this.x
      const dy = mouse.y - this.y
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < 200 && d > 0) {
        this.vx += (dx / d) * 0.015
        this.vy += (dy / d) * 0.015
      }
    }

    this.vx *= 0.99
    this.vy *= 0.99
    this.x += this.vx
    this.y += this.vy

    if (this.pulse > 0) {
      this.r = this.baseR + this.pulse * 3
      this.pulse *= 0.85
    } else {
      this.r = this.baseR
    }

    if (this.age >= this.life) this.reset(false)
  }

  draw(ctx: CanvasRenderingContext2D, rgba: (alpha: number) => string) {
    const a = this.opacity * 0.9

    // Core dot
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2)
    ctx.fillStyle = rgba(a)
    ctx.fill()

    // Soft glow halo
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.r * 2.5, 0, Math.PI * 2)
    ctx.fillStyle = rgba(a * 0.08)
    ctx.fill()
  }
}

export default function NeuralParticleBackground({
  count = 200,
  connectDist = 230,
  color = [0, 220, 100],
  speed = 1,
  className = '',
  style = {},
}: NeuralParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const rgba = useCallback(
    (alpha: number) => `rgba(${color[0]},${color[1]},${color[2]},${alpha})`,
    [color],
  )

  const rgbaShifted = useCallback(
    (strength: number, alpha: number) => {
      const r = Math.round(color[0] + strength * 75)
      const g = Math.round(color[1] + strength * 75)
      const b = Math.round(color[2] + strength * 40)
      return `rgba(${r},${g},${b},${alpha})`
    },
    [color],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Size canvas to its CSS container
    const setSize = () => {
      // getBoundingClientRect gives the true rendered size after CSS layout,
      // so the logical canvas resolution matches exactly — no sparse particles
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.round(rect.width)
      canvas.height = Math.round(rect.height)
    }
    setSize()

    // Create particles using current canvas dimensions
    const particles = Array.from(
      { length: count },
      () => new Particle(canvas.width, canvas.height, speed, true),
    )

    const mouse: MouseState = {
      x: canvas.width / 2,
      y: canvas.height / 2,
      active: false,
    }

    const pulses: Pulse[] = []

    // On resize: update canvas size AND tell every particle the new bounds
    const onResize = () => {
      setSize()
      for (const p of particles) p.resize(canvas.width, canvas.height)
    }
    window.addEventListener('resize', onResize)

    // ── Draw helpers ────────────────────────────────────────────────────────

    const drawConnections = () => {
      for (let i = 0; i < particles.length; i++) {
        // Particle-to-particle connections
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]
          const b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const d = Math.sqrt(dx * dx + dy * dy)

          if (d < connectDist) {
            const strength = 1 - d / connectDist
            const midX = (a.x + b.x) / 2
            const midY = (a.y + b.y) / 2
            const md = mouse.active
              ? Math.sqrt((midX - mouse.x) ** 2 + (midY - mouse.y) ** 2)
              : Infinity
            const highlight = mouse.active && md < 120 ? 1.8 : 1
            const alpha = strength * Math.min(a.opacity, b.opacity) * 0.5 * highlight

            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = rgbaShifted(strength, alpha)
            ctx.lineWidth = strength * 1.2
            ctx.stroke()
          }
        }

        // Lines from each particle to the cursor
        if (mouse.active) {
          const p = particles[i]
          const dx = p.x - mouse.x
          const dy = p.y - mouse.y
          const d = Math.sqrt(dx * dx + dy * dy)

          if (d < 150) {
            const s = (1 - d / 150) * p.opacity
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(mouse.x, mouse.y)
            ctx.strokeStyle = rgba(s * 0.4)
            ctx.lineWidth = s * 1.5
            ctx.stroke()
          }
        }
      }
    }

    const drawPulses = () => {
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i]
        p.r += 4
        p.life -= 0.025

        if (p.life <= 0) {
          pulses.splice(i, 1)
          continue
        }

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.strokeStyle = rgba(p.life * 0.6)
        ctx.lineWidth = 1.5
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r * 0.6, 0, Math.PI * 2)
        ctx.strokeStyle = rgba(p.life * 0.3)
        ctx.lineWidth = 0.8
        ctx.stroke()
      }
    }

    const drawCursor = () => {
      if (!mouse.active) return

      ctx.beginPath()
      ctx.arc(mouse.x, mouse.y, 4, 0, Math.PI * 2)
      ctx.fillStyle = rgba(0.9)
      ctx.fill()

      ctx.beginPath()
      ctx.arc(mouse.x, mouse.y, 12, 0, Math.PI * 2)
      ctx.strokeStyle = rgba(0.25)
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // ── Event listeners ─────────────────────────────────────────────────────

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
      mouse.active = true
    }

    const onMouseLeave = () => {
      mouse.active = false
    }

    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      pulses.push({ x: cx, y: cy, r: 0, life: 1 })
      for (const p of particles) {
        const dx = p.x - cx
        const dy = p.y - cy
        if (Math.sqrt(dx * dx + dy * dy) < 160) p.pulse = 1
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = e.touches[0].clientX - rect.left
      mouse.y = e.touches[0].clientY - rect.top
      mouse.active = true
    }

    const onTouchEnd = () => {
      mouse.active = false
    }

    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseleave', onMouseLeave)
    canvas.addEventListener('click', onClick)
    canvas.addEventListener('touchmove', onTouchMove, { passive: true })
    canvas.addEventListener('touchend', onTouchEnd)

    // ── Animation loop ───────────────────────────────────────────────────────

    let rafId: number

    const animate = () => {
      rafId = requestAnimationFrame(animate)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      drawConnections()
      for (const p of particles) {
        p.update(mouse)
        p.draw(ctx, rgba)
      }
      drawPulses()
      drawCursor()
    }

    animate()

    // ── Cleanup ──────────────────────────────────────────────────────────────

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseleave', onMouseLeave)
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
    }
  }, [count, connectDist, speed, rgba, rgbaShifted])

  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
    </div>
  )
}