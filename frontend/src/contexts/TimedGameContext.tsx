import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react'
import type { Difficulty } from '../utils/challenges'
import { getRandomChallenge } from '../utils/challenges'
import { polluteCode } from '../utils/polluteCode'
import { useAuth } from './AuthContext'
import { getTimedScoreBests, type TimedScoreBestResponse } from '../utils/timedScores'

const TOTAL_TIME = 120

interface TimedGameState {
  status: 'idle' | 'playing' | 'completed' | 'timeout'
  difficulty: Difficulty | null
  runToken: string
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
  startGame: (difficulty: Difficulty, runToken?: string) => void
  checkCompletion: (content: string) => boolean
  resetGame: () => void
  getBestScore: (difficulty: Difficulty) => BestScore | null
  getTimeTaken: () => number | null
  totalTime: number
}

const TimedGameContext = createContext<TimedGameContextValue | null>(null)

const initialState: TimedGameState = {
  status: 'idle',
  difficulty: null,
  runToken: '',
  targetCode: '',
  pollutedCode: '',
  timeLeft: TOTAL_TIME,
  startTime: null,
  endTime: null,
  challengeName: '',
}

export function TimedGameProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [state, setState] = useState<TimedGameState>(initialState)
  const [sessionBestScores, setSessionBestScores] = useState<Record<Difficulty, BestScore | null>>({
    beginner: null,
    intermediate: null,
    advanced: null,
    expert: null,
  })
  const [persistedBestScores, setPersistedBestScores] = useState<Record<Difficulty, BestScore | null>>({
    beginner: null,
    intermediate: null,
    advanced: null,
    expert: null,
  })
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

  useEffect(() => {
    let mounted = true

    const loadBests = async () => {
      if (!user) {
        if (mounted) {
          setPersistedBestScores({
            beginner: null,
            intermediate: null,
            advanced: null,
            expert: null,
          })
        }
        return
      }

      try {
        const response = await getTimedScoreBests()
        if (!mounted) return

        const mapResponse = (payload: TimedScoreBestResponse): Record<Difficulty, BestScore | null> => ({
          beginner: payload.beginner
            ? { time: payload.beginner.timeSeconds, completedAt: new Date(payload.beginner.completedAt).getTime() }
            : null,
          intermediate: payload.intermediate
            ? { time: payload.intermediate.timeSeconds, completedAt: new Date(payload.intermediate.completedAt).getTime() }
            : null,
          advanced: payload.advanced
            ? { time: payload.advanced.timeSeconds, completedAt: new Date(payload.advanced.completedAt).getTime() }
            : null,
          expert: payload.expert
            ? { time: payload.expert.timeSeconds, completedAt: new Date(payload.expert.completedAt).getTime() }
            : null,
        })

        setPersistedBestScores(mapResponse(response))
      } catch {
        if (!mounted) return
        setPersistedBestScores({
          beginner: null,
          intermediate: null,
          advanced: null,
          expert: null,
        })
      }
    }

    loadBests()

    return () => {
      mounted = false
    }
  }, [user])

  const startGame = useCallback((difficulty: Difficulty, runToken = '') => {
    stopGame()
    completedRef.current = false

    const challenge = getRandomChallenge(difficulty)
    const polluted = polluteCode(challenge.code, difficulty)

    setState({
      status: 'playing',
      difficulty,
      runToken,
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
    let completedDifficulty: Difficulty | null = null
    let completedAt = 0
    let completedTimeTaken = 0

    setState(prev => {
      if (prev.status !== 'playing') return prev
      if (content === prev.targetCode) {
        completedRef.current = true
        isCompleted = true
        clearTimer()
        const endTime = Date.now()
        const timeTaken = prev.startTime ? Math.round((endTime - prev.startTime) / 1000) : TOTAL_TIME - prev.timeLeft
        completedDifficulty = prev.difficulty!
        completedAt = endTime
        completedTimeTaken = timeTaken
        return { ...prev, status: 'completed' as const, endTime, timeLeft: TOTAL_TIME - timeTaken }
      }
      return prev
    })

    if (isCompleted && completedDifficulty) {
      setSessionBestScores((current) => {
        const best = current[completedDifficulty!]
        if (!best || completedTimeTaken < best.time) {
          return {
            ...current,
            [completedDifficulty!]: {
              time: completedTimeTaken,
              completedAt,
            },
          }
        }
        return current
      })
    }

    return isCompleted
  }, [clearTimer])

  const resetGame = useCallback(() => {
    stopGame()
    completedRef.current = false
    setState(initialState)
  }, [stopGame])

  const getBestScore = useCallback((difficulty: Difficulty): BestScore | null => {
    const sessionBest = sessionBestScores[difficulty]
    const persistedBest = persistedBestScores[difficulty]

    if (!sessionBest) return persistedBest
    if (!persistedBest) return sessionBest
    return sessionBest.time <= persistedBest.time ? sessionBest : persistedBest
  }, [sessionBestScores, persistedBestScores])

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
