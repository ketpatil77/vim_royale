import { useRef, useCallback } from 'react'
import type { Envelope, MatchState, GameStartPayload, BotGameStartPayload, BufferUpdatePayload, GameOverPayload, BufferDelta, KeystrokesData, PlayerFinishedPayload } from './types'
import { WS_URL, getOrCreatePlayerId } from './player'
import {
  parseHelloAckPayload,
  parseGameStartPayload,
  parseBotGameStartPayload,
  parseBufferUpdatePayload,
  parseGameOverPayload,
  parseErrorPayload,
} from './messageParser'
import { useAuth } from '../../contexts/AuthContext'

type GameSocketCallbacks = {
  onHelloAck: (playerId: string) => void
  onGameStart: (payload: GameStartPayload) => void
  onBotGameStart: (payload: BotGameStartPayload) => void
  onBufferUpdate: (content: string | undefined, delta: BufferDelta | undefined) => void
  onGameOver: (payload: GameOverPayload, playerId: string) => void
  onError: (code: string, message: string) => void
  onConnecting: () => void
  onConnected: () => void
  onConnectionClosed: () => void
}

export function useGameSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const seqRef = useRef(1)
  const shouldIgnoreCloseRef = useRef(false)
  const viewStateRef = useRef<'idle' | 'matchmaking' | 'countdown' | 'playing' | 'finished' | 'error'>('idle')
  const matchStateRef = useRef<MatchState>({
    playerId: '',
      opponentId: '',
      opponentName: '',
      opponentAvatar: '',
      opponentRating: 0,
      opponentIsBot: false,
      matchId: '',
      roundDurationSec: 180,
  })
  const { user } = useAuth()

  const setMatchStateRef = useCallback((state: Partial<MatchState>) => {
    matchStateRef.current = { ...matchStateRef.current, ...state }
  }, [])

  const sendEnvelope = useCallback((envelope: Envelope) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify(envelope))
  }, [])

  const disconnect = useCallback(() => {
    if (!wsRef.current) return
    shouldIgnoreCloseRef.current = true
    viewStateRef.current = 'idle'
    wsRef.current.onopen = null
    wsRef.current.onmessage = null
    wsRef.current.onclose = null
    wsRef.current.onerror = null
    wsRef.current.close()
    wsRef.current = null
  }, [])

  const sendBufferUpdate = useCallback(
    (content?: string, delta?: BufferDelta) => {
      const seq = seqRef.current++
      sendEnvelope({
        type: 'BUFFER_UPDATE',
        matchId: matchStateRef.current.matchId,
        seq,
        payload: { content, delta } as BufferUpdatePayload,
      })
    },
    [sendEnvelope]
  )

  const sendPlayerFinished = useCallback(() => {
    sendEnvelope({
      type: 'PLAYER_FINISHED',
      matchId: matchStateRef.current.matchId,
      payload: { finalHash: '' } as PlayerFinishedPayload,
    })
  }, [sendEnvelope])

  const sendPlayerFinishedWithKeystrokes = useCallback(
    (keystrokes: KeystrokesData) => {
      sendEnvelope({
        type: 'PLAYER_FINISHED',
        matchId: matchStateRef.current.matchId,
        payload: { finalHash: '', keystrokes } as PlayerFinishedPayload,
      })
    },
    [sendEnvelope]
  )

  const buildHelloPayload = useCallback(() => {
    if (user) {
      return { playerId: user.provider + ':' + user.providerId }
    }
    const playerId = getOrCreatePlayerId()
    return { playerId }
  }, [user])

  const handleMessage = useCallback(
    (event: MessageEvent, callbacks: GameSocketCallbacks) => {
      let envelope: Envelope
      try {
        envelope = JSON.parse(event.data) as Envelope
      } catch {
        viewStateRef.current = 'error'
        callbacks.onError('parse_error', 'Invalid message from server')
        return
      }

      switch (envelope.type) {
        case 'HELLO_ACK': {
          const payload = parseHelloAckPayload(envelope.payload)
          if (!payload) {
            viewStateRef.current = 'error'
            callbacks.onError('payload_error', 'Invalid HELLO_ACK payload')
            return
          }
          setMatchStateRef({ playerId: payload.playerId })
          callbacks.onHelloAck(payload.playerId)
          sendEnvelope({ type: 'QUEUE_JOIN', payload: {} })
          break
        }
        case 'GAME_START': {
          const payload = parseGameStartPayload(envelope.payload)
          if (!payload) {
            viewStateRef.current = 'error'
            callbacks.onError('payload_error', 'Invalid GAME_START payload')
            return
          }
          seqRef.current = 1
          setMatchStateRef({
            matchId: payload.matchId,
            opponentId: payload.opponentId,
            opponentName: payload.opponentName,
            opponentAvatar: payload.opponentAvatar,
            opponentRating: payload.opponentRating,
            roundDurationSec: payload.roundDurationSec || 180,
          })
          viewStateRef.current = 'playing'
          callbacks.onGameStart(payload)
          break
        }
        case 'BOT_GAME_START': {
          const payload = parseBotGameStartPayload(envelope.payload)
          if (!payload) {
            viewStateRef.current = 'error'
            callbacks.onError('payload_error', 'Invalid BOT_GAME_START payload')
            return
          }
          seqRef.current = 1
          setMatchStateRef({
            matchId: payload.matchId,
            opponentId: `bot_${payload.botId}`,
            opponentName: payload.botName,
            opponentAvatar: payload.botAvatar,
            opponentRating: payload.botRating,
            opponentIsBot: true,
            roundDurationSec: payload.roundDurationSec || 180,
          })
          viewStateRef.current = 'playing'
          callbacks.onBotGameStart(payload)
          break
        }
        case 'BUFFER_UPDATE': {
          const payload = parseBufferUpdatePayload(envelope.payload)
          if (!payload) {
            viewStateRef.current = 'error'
            callbacks.onError('payload_error', 'Invalid BUFFER_UPDATE payload')
            return
          }
          callbacks.onBufferUpdate(payload.content, payload.delta)
          break
        }
        case 'GAME_OVER': {
          const payload = parseGameOverPayload(envelope.payload)
          if (!payload) {
            viewStateRef.current = 'error'
            callbacks.onError('payload_error', 'Invalid GAME_OVER payload')
            return
          }
          viewStateRef.current = 'finished'
          callbacks.onGameOver(payload, matchStateRef.current.playerId)
          break
        }
        case 'ERROR': {
          const payload = parseErrorPayload(envelope.payload)
          if (!payload) {
            viewStateRef.current = 'error'
            callbacks.onError('payload_error', 'Invalid ERROR payload')
            return
          }
          viewStateRef.current = 'error'
          callbacks.onError(payload.code, payload.message)
          break
        }
      }
    },
    [setMatchStateRef, sendEnvelope]
  )

  const connect = useCallback(
    (callbacks: GameSocketCallbacks, options?: { wsUrl?: string }) => {
      disconnect()
      shouldIgnoreCloseRef.current = false

      const playerId = buildHelloPayload()
      setMatchStateRef({ playerId: playerId.playerId || 'pending', opponentId: '', opponentName: '', opponentAvatar: '', opponentRating: 0, opponentIsBot: false, matchId: '', roundDurationSec: 180 })
      seqRef.current = 1
      viewStateRef.current = 'matchmaking'

      const ws = new WebSocket(options?.wsUrl || WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        callbacks.onConnected()
        sendEnvelope({ type: 'HELLO', payload: playerId })
      }

      ws.onmessage = (event) => handleMessage(event, callbacks)

      ws.onclose = () => {
        wsRef.current = null
        if (shouldIgnoreCloseRef.current) {
          shouldIgnoreCloseRef.current = false
          return
        }
        if (viewStateRef.current !== 'finished' && viewStateRef.current !== 'idle') {
          callbacks.onConnectionClosed()
        }
      }

      ws.onerror = () => {
        viewStateRef.current = 'error'
        callbacks.onError('socket_error', 'WebSocket error')
      }

      callbacks.onConnecting()
    },
    [disconnect, buildHelloPayload, setMatchStateRef, sendEnvelope, handleMessage]
  )

  return {
    connect,
    disconnect,
    sendBufferUpdate,
    sendPlayerFinished,
    sendPlayerFinishedWithKeystrokes,
  }
}
