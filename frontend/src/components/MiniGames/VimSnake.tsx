import { useEffect, useRef, useState } from 'react'

type Direction = 'up' | 'down' | 'left' | 'right'
type Phase = 'playing' | 'game_over'
type Point = { x: number; y: number }

const GRID = 20
const SIZE = 360
const BASE_TICK = 170
const MIN_TICK = 90

const DELTA: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

const KEY_TO_DIRECTION: Record<string, Direction> = {
  h: 'left',
  j: 'down',
  k: 'up',
  l: 'right',
  ArrowLeft: 'left',
  ArrowDown: 'down',
  ArrowUp: 'up',
  ArrowRight: 'right',
}

const isOpposite = (a: Direction, b: Direction) =>
  (a === 'up' && b === 'down') ||
  (a === 'down' && b === 'up') ||
  (a === 'left' && b === 'right') ||
  (a === 'right' && b === 'left')

const spawnFood = (snake: Point[]): Point => {
  const occupied = new Set(snake.map((p) => `${p.x}:${p.y}`))
  while (true) {
    const point = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) }
    if (!occupied.has(`${point.x}:${point.y}`)) return point
  }
}

const initialSnake = (): Point[] => {
  const mid = Math.floor(GRID / 2)
  return [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
    { x: mid - 3, y: mid },
  ]
}

export function VimSnake() {
  const [snake, setSnake] = useState<Point[]>(() => initialSnake())
  const [food, setFood] = useState<Point>(() => spawnFood(initialSnake()))
  const [direction, setDirection] = useState<Direction>('right')
  const [queuedDirection, setQueuedDirection] = useState<Direction | null>(null)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [phase, setPhase] = useState<Phase>('playing')

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const stateRef = useRef({ snake, food, direction, queuedDirection, score, phase })

  useEffect(() => {
    stateRef.current = { snake, food, direction, queuedDirection, score, phase }
  }, [snake, food, direction, queuedDirection, score, phase])

  const restart = () => {
    const nextSnake = initialSnake()
    setSnake(nextSnake)
    setFood(spawnFood(nextSnake))
    setDirection('right')
    setQueuedDirection(null)
    setScore(0)
    setPhase('playing')
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement | null
      const tagName = target?.tagName
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || target?.isContentEditable) return

      if ((event.key === 'r' || event.key === 'R' || event.key === ' ') && stateRef.current.phase === 'game_over') {
        event.preventDefault()
        restart()
        return
      }

      const next = KEY_TO_DIRECTION[event.key]
      if (!next || stateRef.current.phase !== 'playing') return

      const active = stateRef.current.queuedDirection ?? stateRef.current.direction
      if (isOpposite(active, next) || active === next) return

      event.preventDefault()
      setQueuedDirection(next)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (phase !== 'playing') return

    const tickMs = Math.max(MIN_TICK, BASE_TICK - Math.floor(score / 5) * 12)

    const timer = window.setInterval(() => {
      setSnake((prevSnake) => {
        const activeDirection = queuedDirection ?? direction
        const delta = DELTA[activeDirection]
        const head = prevSnake[0]
        const nextHead = {
          x: (head.x + delta.x + GRID) % GRID,
          y: (head.y + delta.y + GRID) % GRID,
        }

        const isEating = nextHead.x === food.x && nextHead.y === food.y
        const body = isEating ? prevSnake : prevSnake.slice(0, -1)
        const hitsSelf = body.some((segment) => segment.x === nextHead.x && segment.y === nextHead.y)

        if (hitsSelf) {
          setPhase('game_over')
          setBest((prevBest) => Math.max(prevBest, stateRef.current.score))
          return prevSnake
        }

        const nextSnake = isEating
          ? [nextHead, ...prevSnake]
          : [nextHead, ...prevSnake.slice(0, -1)]

        if (isEating) {
          const nextScore = stateRef.current.score + 1
          setScore(nextScore)
          setBest((prevBest) => Math.max(prevBest, nextScore))
          setFood(spawnFood(nextSnake))
        }

        setDirection(activeDirection)
        setQueuedDirection(null)
        return nextSnake
      })
    }, tickMs)

    return () => window.clearInterval(timer)
  }, [phase, direction, queuedDirection, food, score])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = SIZE * dpr
    canvas.height = SIZE * dpr
    canvas.style.width = `${SIZE}px`
    canvas.style.height = `${SIZE}px`

    const context = canvas.getContext('2d')
    if (!context) return

    context.setTransform(dpr, 0, 0, dpr, 0, 0)

    const cell = SIZE / GRID
    context.clearRect(0, 0, SIZE, SIZE)
    context.fillStyle = '#080808'
    context.fillRect(0, 0, SIZE, SIZE)

    context.strokeStyle = 'rgba(57, 255, 20, 0.08)'
    context.lineWidth = 1

    for (let i = 1; i < GRID; i += 1) {
      const pos = i * cell
      context.beginPath()
      context.moveTo(pos, 0)
      context.lineTo(pos, SIZE)
      context.stroke()

      context.beginPath()
      context.moveTo(0, pos)
      context.lineTo(SIZE, pos)
      context.stroke()
    }

    context.fillStyle = 'rgba(255, 176, 0, 0.95)'
    context.shadowColor = 'rgba(255, 176, 0, 0.55)'
    context.shadowBlur = 8
    context.fillRect(food.x * cell + 2, food.y * cell + 2, cell - 4, cell - 4)

    context.shadowBlur = 0
    snake.forEach((segment, index) => {
      context.fillStyle = index === 0 ? '#7cff61' : '#39ff14'
      context.fillRect(segment.x * cell + 1, segment.y * cell + 1, cell - 2, cell - 2)
    })

    if (phase === 'game_over') {
      context.fillStyle = 'rgba(0, 0, 0, 0.72)'
      context.fillRect(0, 0, SIZE, SIZE)
      context.fillStyle = '#39ff14'
      context.textAlign = 'center'
      context.font = 'bold 32px JetBrains Mono, monospace'
      context.fillText('GAME OVER', SIZE / 2, SIZE / 2 - 10)
      context.font = '14px JetBrains Mono, monospace'
      context.fillStyle = '#c5dfc9'
      context.fillText('press r or space to restart', SIZE / 2, SIZE / 2 + 18)
    }
  }, [snake, food, phase])

  return (
    <section className="snake-panel" role="application" aria-label="Vim Snake mini game">
      <div className="snake-head">
        <p className="snake-title">VIM SNAKE</p>
        <p className="snake-hint">move with h j k l</p>
      </div>
      <div className="snake-hud">
        <span>score: {score}</span>
        <span>best: {best}</span>
      </div>
      <div className="snake-board-wrap">
        <canvas ref={canvasRef} className="snake-canvas" aria-hidden="true" />
      </div>
      <p className="snake-footer">
        {phase === 'playing' ? 'wrap through walls, avoid yourself' : 'press r or space to restart'}
      </p>
    </section>
  )
}
