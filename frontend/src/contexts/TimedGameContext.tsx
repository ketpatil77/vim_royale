import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react'
import type { Difficulty } from '../utils/challenges'
import { getRandomChallenge } from '../utils/challenges'
import { polluteCode } from '../utils/polluteCode'

const TOTAL_TIME = 120

interface TimedGameState {
  status: 'idle' | 'playing' | 'completed' | 'timeout'
  difficulty: Difficulty | null
  targetCode: string
  pollutedCode: string
  timeLeft: number
  startTime: number | null
  endTime: number | null
  challengeName: string
}

interface BestScore {
  time: number
  completedAt: number
}

interface TimedGameContextValue extends TimedGameState {
  startGame: (difficulty: Difficulty) => void
  checkCompletion: (content: string) => boolean
  resetGame: () => void
  getBestScore: (difficulty: Difficulty) => BestScore | null
  getTimeTaken: () => number | null
  totalTime: number
}

const TimedGameContext = createContext<TimedGameContextValue | null>(null)

const STORAGE_KEY = 'vim_royale_timed_best_scores'

function loadBestScores(): Record<Difficulty, BestScore | null> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { beginner: null, intermediate: null, advanced: null, expert: null }
    return JSON.parse(raw)
  } catch {
    return { beginner: null, intermediate: null, advanced: null, expert: null }
  }
}

function saveBestScore(difficulty: Difficulty, time: number) {
  const scores = loadBestScores()
  const existing = scores[difficulty]
  if (!existing || time < existing.time) {
    scores[difficulty] = { time, completedAt: Date.now() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores))
  }
}

const initialState: TimedGameState = {
  status: 'idle',
  difficulty: null,
  targetCode: '',
  pollutedCode: '',
  timeLeft: TOTAL_TIME,
  startTime: null,
  endTime: null,
  challengeName: '',
}

export function TimedGameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TimedGameState>(initialState)
  const timerRef = useRef<number | null>(null)
  const completedRef = useRef(false)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const stopGame = useCallback(() => {
    clearTimer()
  }, [clearTimer])

  useEffect(() => {
    return () => clearTimer()
  }, [clearTimer])

  const startGame = useCallback((difficulty: Difficulty) => {
    stopGame()
    completedRef.current = false

    const challenge = getRandomChallenge(difficulty)
    const polluted = polluteCode(challenge.code, difficulty)

    setState({
      status: 'playing',
      difficulty,
      targetCode: challenge.code,
      pollutedCode: polluted,
      timeLeft: TOTAL_TIME,
      startTime: Date.now(),
      endTime: null,
      challengeName: challenge.name,
    })

    timerRef.current = window.setInterval(() => {
      setState(prev => {
        if (prev.status !== 'playing') return prev
        if (prev.timeLeft <= 1) {
          clearTimer()
          return { ...prev, timeLeft: 0, status: 'timeout', endTime: Date.now() }
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 }
      })
    }, 1000)
  }, [stopGame, clearTimer])

  const checkCompletion = useCallback((content: string) => {
    if (completedRef.current) return false
    let isCompleted = false
    setState(prev => {
      if (prev.status !== 'playing') return prev
      if (content === prev.targetCode) {
        completedRef.current = true
        isCompleted = true
        clearTimer()
        const endTime = Date.now()
        const timeTaken = prev.startTime ? Math.round((endTime - prev.startTime) / 1000) : TOTAL_TIME - prev.timeLeft
        saveBestScore(prev.difficulty!, timeTaken)
        return { ...prev, status: 'completed' as const, endTime, timeLeft: TOTAL_TIME - timeTaken }
      }
      return prev
    })
    return isCompleted
  }, [clearTimer])

  const resetGame = useCallback(() => {
    stopGame()
    completedRef.current = false
    setState(initialState)
  }, [stopGame])

  const getBestScore = useCallback((difficulty: Difficulty): BestScore | null => {
    return loadBestScores()[difficulty] ?? null
  }, [])

  const getTimeTaken = useCallback((): number | null => {
    if (!state.startTime || !state.endTime) return null
    return Math.round((state.endTime - state.startTime) / 1000)
  }, [state.startTime, state.endTime])

  const value: TimedGameContextValue = {
    ...state,
    startGame,
    checkCompletion,
    resetGame,
    getBestScore,
    getTimeTaken,
    totalTime: TOTAL_TIME,
  }

  return (
    <TimedGameContext.Provider value={value}>
      {children}
    </TimedGameContext.Provider>
  )
}

export function useTimedGame(): TimedGameContextValue {
  const context = useContext(TimedGameContext)
  if (!context) {
    throw new Error('useTimedGame must be used within a TimedGameProvider')
  }
  return context
}