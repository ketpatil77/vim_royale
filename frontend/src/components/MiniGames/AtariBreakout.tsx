import { useEffect, useRef, useState } from 'react'

type Phase = 'playing' | 'game_over' | 'won'

type Brick = { alive: boolean }

type GameState = {
  phase: Phase
  score: number
  lives: number
  paddleX: number
  ballX: number
  ballY: number
  ballVx: number
  ballVy: number
  bricks: Brick[]
}

const BASE_WIDTH = 720
const BASE_HEIGHT = 480
const PADDLE_WIDTH = 120
const PADDLE_HEIGHT = 14
const PADDLE_Y = BASE_HEIGHT - 34
const PADDLE_SPEED = 520
const BALL_RADIUS = 7
const BALL_SPEED = 320
const BRICK_ROWS = 6
const BRICK_COLS = 10
const BRICK_GAP = 8
const BRICK_MARGIN_X = 36
const BRICK_TOP = 64
const BRICK_HEIGHT = 20
const START_LIVES = 3

const BRICK_WIDTH =
  (BASE_WIDTH - BRICK_MARGIN_X * 2 - BRICK_GAP * (BRICK_COLS - 1)) / BRICK_COLS

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))

const makeBricks = (): Brick[] => Array.from({ length: BRICK_ROWS * BRICK_COLS }, () => ({ alive: true }))

const makeInitialState = (): GameState => ({
  phase: 'playing',
  score: 0,
  lives: START_LIVES,
  paddleX: (BASE_WIDTH - PADDLE_WIDTH) / 2,
  ballX: BASE_WIDTH / 2,
  ballY: PADDLE_Y - BALL_RADIUS - 10,
  ballVx: BALL_SPEED * 0.55,
  ballVy: -BALL_SPEED,
  bricks: makeBricks(),
})

const brickRectAt = (index: number) => {
  const row = Math.floor(index / BRICK_COLS)
  const col = index % BRICK_COLS
  return {
    x: BRICK_MARGIN_X + col * (BRICK_WIDTH + BRICK_GAP),
    y: BRICK_TOP + row * (BRICK_HEIGHT + BRICK_GAP),
    w: BRICK_WIDTH,
    h: BRICK_HEIGHT,
  }
}

export function AtariBreakout() {
  const [hud, setHud] = useState({ score: 0, lives: START_LIVES, phase: 'playing' as Phase })
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const gameRef = useRef<GameState>(makeInitialState())
  const keysRef = useRef({ left: false, right: false })
  const rafRef = useRef<number | null>(null)
  const lastTsRef = useRef<number | null>(null)

  const resetBall = (state: GameState) => {
    state.paddleX = (BASE_WIDTH - PADDLE_WIDTH) / 2
    state.ballX = BASE_WIDTH / 2
    state.ballY = PADDLE_Y - BALL_RADIUS - 10
    state.ballVx = BALL_SPEED * (Math.random() > 0.5 ? 0.55 : -0.55)
    state.ballVy = -BALL_SPEED
  }

  const fullReset = () => {
    gameRef.current = makeInitialState()
    setHud({ score: 0, lives: START_LIVES, phase: 'playing' })
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement | null
      const tagName = target?.tagName
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || target?.isContentEditable) return

      if (event.key === 'h' || event.key === 'ArrowLeft') {
        keysRef.current.left = true
        event.preventDefault()
      }

      if (event.key === 'l' || event.key === 'ArrowRight') {
        keysRef.current.right = true
        event.preventDefault()
      }

      if ((event.key === 'r' || event.key === 'R' || event.key === ' ') && gameRef.current.phase !== 'playing') {
        event.preventDefault()
        fullReset()
      }
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'h' || event.key === 'ArrowLeft') {
        keysRef.current.left = false
      }

      if (event.key === 'l' || event.key === 'ArrowRight') {
        keysRef.current.right = false
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      const dpr = window.devicePixelRatio || 1
      const pixelWidth = Math.floor(rect.width * dpr)
      const pixelHeight = Math.floor(rect.height * dpr)

      if (canvas.width !== pixelWidth) canvas.width = pixelWidth
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight

      const context = canvas.getContext('2d')
      if (!context) return

      const scaleX = rect.width / BASE_WIDTH
      const scaleY = rect.height / BASE_HEIGHT
      context.setTransform(dpr * scaleX, 0, 0, dpr * scaleY, 0, 0)

      context.clearRect(0, 0, BASE_WIDTH, BASE_HEIGHT)
      context.fillStyle = '#050705'
      context.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT)

      context.strokeStyle = 'rgba(57, 255, 20, 0.14)'
      context.lineWidth = 1
      for (let y = 0; y <= BASE_HEIGHT; y += 24) {
        context.beginPath()
        context.moveTo(0, y)
        context.lineTo(BASE_WIDTH, y)
        context.stroke()
      }

      const state = gameRef.current

      state.bricks.forEach((brick, index) => {
        if (!brick.alive) return
        const rectAt = brickRectAt(index)
        const hue = 90 + Math.floor(index / BRICK_COLS) * 10
        context.fillStyle = `hsla(${hue}, 90%, 58%, 0.9)`
        context.fillRect(rectAt.x, rectAt.y, rectAt.w, rectAt.h)
      })

      context.fillStyle = '#c8ffd2'
      context.fillRect(state.paddleX, PADDLE_Y, PADDLE_WIDTH, PADDLE_HEIGHT)

      context.beginPath()
      context.arc(state.ballX, state.ballY, BALL_RADIUS, 0, Math.PI * 2)
      context.fillStyle = '#ffb000'
      context.shadowColor = 'rgba(255, 176, 0, 0.7)'
      context.shadowBlur = 12
      context.fill()
      context.shadowBlur = 0

      if (state.phase !== 'playing') {
        context.fillStyle = 'rgba(0, 0, 0, 0.68)'
        context.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT)
        context.fillStyle = '#39ff14'
        context.textAlign = 'center'
        context.font = 'bold 36px JetBrains Mono, monospace'
        context.fillText(state.phase === 'won' ? 'YOU WIN' : 'GAME OVER', BASE_WIDTH / 2, BASE_HEIGHT / 2 - 16)
        context.font = '16px JetBrains Mono, monospace'
        context.fillStyle = '#c5dfc9'
        context.fillText('press r or space to restart', BASE_WIDTH / 2, BASE_HEIGHT / 2 + 18)
      }
    }

    const update = (dt: number) => {
      const state = gameRef.current
      if (state.phase !== 'playing') return

      const moveLeft = keysRef.current.left
      const moveRight = keysRef.current.right

      if (moveLeft && !moveRight) {
        state.paddleX -= PADDLE_SPEED * dt
      } else if (moveRight && !moveLeft) {
        state.paddleX += PADDLE_SPEED * dt
      }

      state.paddleX = clamp(state.paddleX, 0, BASE_WIDTH - PADDLE_WIDTH)

      state.ballX += state.ballVx * dt
      state.ballY += state.ballVy * dt

      if (state.ballX - BALL_RADIUS <= 0) {
        state.ballX = BALL_RADIUS
        state.ballVx = Math.abs(state.ballVx)
      } else if (state.ballX + BALL_RADIUS >= BASE_WIDTH) {
        state.ballX = BASE_WIDTH - BALL_RADIUS
        state.ballVx = -Math.abs(state.ballVx)
      }

      if (state.ballY - BALL_RADIUS <= 0) {
        state.ballY = BALL_RADIUS
        state.ballVy = Math.abs(state.ballVy)
      }

      if (state.ballY + BALL_RADIUS >= BASE_HEIGHT) {
        state.lives -= 1
        if (state.lives <= 0) {
          state.phase = 'game_over'
        } else {
          resetBall(state)
        }
        setHud({ score: state.score, lives: state.lives, phase: state.phase })
        return
      }

      const paddleTop = PADDLE_Y
      const paddleBottom = PADDLE_Y + PADDLE_HEIGHT
      const paddleLeft = state.paddleX
      const paddleRight = state.paddleX + PADDLE_WIDTH

      const hitsPaddle =
        state.ballVy > 0 &&
        state.ballY + BALL_RADIUS >= paddleTop &&
        state.ballY - BALL_RADIUS <= paddleBottom &&
        state.ballX >= paddleLeft &&
        state.ballX <= paddleRight

      if (hitsPaddle) {
        const hitRatio = clamp((state.ballX - (state.paddleX + PADDLE_WIDTH / 2)) / (PADDLE_WIDTH / 2), -1, 1)
        state.ballVx = BALL_SPEED * hitRatio
        const vyMagnitude = Math.sqrt(Math.max(170 * 170, BALL_SPEED * BALL_SPEED - state.ballVx * state.ballVx))
        state.ballVy = -vyMagnitude
        state.ballY = paddleTop - BALL_RADIUS
      }

      let hitBrick = false
      for (let i = 0; i < state.bricks.length; i += 1) {
        const brick = state.bricks[i]
        if (!brick.alive) continue

        const b = brickRectAt(i)
        const intersects =
          state.ballX + BALL_RADIUS >= b.x &&
          state.ballX - BALL_RADIUS <= b.x + b.w &&
          state.ballY + BALL_RADIUS >= b.y &&
          state.ballY - BALL_RADIUS <= b.y + b.h

        if (!intersects) continue

        brick.alive = false
        state.score += 10
        hitBrick = true

        const overlapLeft = state.ballX + BALL_RADIUS - b.x
        const overlapRight = b.x + b.w - (state.ballX - BALL_RADIUS)
        const overlapTop = state.ballY + BALL_RADIUS - b.y
        const overlapBottom = b.y + b.h - (state.ballY - BALL_RADIUS)
        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom)

        if (minOverlap === overlapLeft || minOverlap === overlapRight) {
          state.ballVx = -state.ballVx
        } else {
          state.ballVy = -state.ballVy
        }

        break
      }

      if (hitBrick) {
        const remaining = state.bricks.some((brick) => brick.alive)
        if (!remaining) {
          state.phase = 'won'
        }
        setHud({ score: state.score, lives: state.lives, phase: state.phase })
      }
    }

    const frame = (ts: number) => {
      if (lastTsRef.current == null) {
        lastTsRef.current = ts
      }

      const dtMs = ts - (lastTsRef.current ?? ts)
      lastTsRef.current = ts
      const dt = Math.min(0.033, Math.max(0, dtMs / 1000))

      update(dt)
      draw()
      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
      }
      rafRef.current = null
      lastTsRef.current = null
    }
  }, [])

  return (
    <section className="breakout-panel" role="application" aria-label="Atari breakout mini game">
      <div className="breakout-head">
        <p className="breakout-title">ATARI BREAKOUT</p>
        <p className="breakout-hint">move with h/l or arrows</p>
      </div>

      <div className="breakout-hud">
        <span>score: {hud.score}</span>
        <span>lives: {hud.lives}</span>
      </div>

      <div className="breakout-canvas-wrap">
        <canvas ref={canvasRef} className="breakout-canvas" aria-hidden="true" />
      </div>

      <p className="breakout-footer">
        {hud.phase === 'playing' ? 'clear all bricks to win' : 'press r or space to restart'}
      </p>
    </section>
  )
}
