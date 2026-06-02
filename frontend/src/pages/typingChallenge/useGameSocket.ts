import { useCallback, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useGuest } from '../../contexts/GuestContext'
import {
  parseBotGameStartPayload,
  parseBufferUpdatePayload,
  parseErrorPayload,
  parseGameOverPayload,
  parseGameStartPayload,
  parseHelloAckPayload,
  parseSpectatorCountPayload,
} from './messageParser'
import { WS_URL, getOrCreatePlayerId } from './player'
import type {
  BotGameStartPayload,
  BufferDelta,
  BufferUpdatePayload,
  Envelope,
  GameOverPayload,
  GameStartPayload,
  KeystrokeReplayMeta,
  KeystrokesData,
  MatchState,
  PlayerFinishedPayload,
  QueueJoinPayload,
  SpectatorCountPayload,
} from './types'

type GameSocketCallbacks = {
  onHelloAck: (playerId: string) => void
  onGameStart: (payload: GameStartPayload) => void
  onBotGameStart: (payload: BotGameStartPayload) => void
  onBufferUpdate: (
    content: string | undefined,
    delta: BufferDelta | undefined,
    cursor: number | undefined,
    replay: KeystrokeReplayMeta | undefined
  ) => void
  onGameOver: (payload: GameOverPayload, playerId: string) => void
  onSpectatorCount: (payload: SpectatorCountPayload) => void
  onError: (code: string, message: string) => void
  onConnecting: () => void
  onConnected: () => void
  onConnectionClosed: () => void
}

type HelloPayload = {
  token?: string
  playerId?: string
  guestSessionToken?: string
  tournamentId?: number
  tournamentSessionToken?: string
}

type ConnectOptions = {
  wsUrl?: string
  queueJoinPayload?: QueueJoinPayload
  helloOverrides?: Partial<HelloPayload>
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
  const { guest } = useGuest()
  const queueJoinPayloadRef = useRef<QueueJoinPayload>({})

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
    (content?: string, delta?: BufferDelta, cursor?: number, replay?: KeystrokeReplayMeta) => {
      const seq = seqRef.current++
      sendEnvelope({
        type: 'BUFFER_UPDATE',
        matchId: matchStateRef.current.matchId,
        seq,
        payload: { content, delta, cursor, replay } as BufferUpdatePayload,
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

  const buildHelloPayload = useCallback((overrides?: Partial<HelloPayload>) => {
    const base: HelloPayload = {}
    const isGuestTournamentSession =
      !user &&
      !!overrides?.tournamentId &&
      !!overrides?.tournamentSessionToken

    if (user) {
      base.playerId = user.provider + ':' + user.providerId
    } else if (!isGuestTournamentSession) {
      const fallbackPlayerId = getOrCreatePlayerId()
      base.playerId = guest?.guestId || fallbackPlayerId
      base.guestSessionToken = guest?.sessionToken
    }

    return { ...base, ...(overrides || {}) }
  }, [user, guest])

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
          sendEnvelope({ type: 'QUEUE_JOIN', payload: queueJoinPayloadRef.current })
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
          callbacks.onBufferUpdate(payload.content, payload.delta, payload.cursor, payload.replay)
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
        case 'SPECTATOR_COUNT': {
          const payload = parseSpectatorCountPayload(envelope.payload)
          if (!payload) {
            return
          }
          callbacks.onSpectatorCount(payload)
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
    (callbacks: GameSocketCallbacks, options?: ConnectOptions) => {
      disconnect()
      shouldIgnoreCloseRef.current = false

      queueJoinPayloadRef.current = options?.queueJoinPayload || {}

      const playerId = buildHelloPayload(options?.helloOverrides)
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
