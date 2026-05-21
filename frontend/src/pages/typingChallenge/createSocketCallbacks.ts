import type {
  GameStartPayload,
  BotGameStartPayload,
  GameOverPayload,
  MatchState,
  BufferDelta,
} from './types'

type Setters = {
  setMatchState: (state: MatchState | ((prev: MatchState) => MatchState)) => void
  setViewState: (state: 'idle' | 'matchmaking' | 'playing' | 'finished' | 'error' | 'countdown') => void
  setStatusText: (text: string) => void
  setResultText: (text: string) => void
  setVimMode: (mode: string) => void
  setGameOverPayload: (payload: GameOverPayload | null) => void
  playSound: (type: 'win' | 'lose') => void
}

type Refs = {
  targetCodeRef: { current: string }
  pollutedCodeRef: { current: string }
  finishSentRef: { current: boolean }
}

export function createSocketCallbacks(
  setters: Setters,
  refs: Refs,
  matchState: { playerId: string },
  replaceOpponentContent: (content: string) => void,
  applyDelta: (delta: BufferDelta) => void,
  recordReceivedKeystroke: (delta: BufferDelta) => void,
  onMatchStart: () => void,
  getViewState: () => string
) {
  const {
    setMatchState,
    setViewState,
    setStatusText,
    setResultText,
    setVimMode,
    setGameOverPayload,
    playSound,
  } = setters

  const {
    targetCodeRef,
    pollutedCodeRef,
    finishSentRef,
  } = refs

  return {
    onHelloAck: (playerId: string) => {
      setMatchState({ playerId, opponentId: '', opponentName: '', opponentAvatar: '', opponentRating: 0, opponentIsBot: false, matchId: '' })
      setStatusText('Finding an opponent...')
    },

    onGameStart: (payload: GameStartPayload) => {
      targetCodeRef.current = payload.targetCode
      pollutedCodeRef.current = payload.pollutedCode
      finishSentRef.current = false

      setMatchState({
        playerId: matchState.playerId,
        opponentId: payload.opponentId,
        opponentName: payload.opponentName,
        opponentAvatar: payload.opponentAvatar,
        opponentRating: payload.opponentRating,
        opponentIsBot: false,
        matchId: payload.matchId,
      })
      setVimMode('NORMAL')
      setResultText('')
      setStatusText('Match started')
      setViewState('countdown')
    },

    onBotGameStart: (payload: BotGameStartPayload) => {
      targetCodeRef.current = payload.targetCode
      pollutedCodeRef.current = payload.pollutedCode
      finishSentRef.current = false

      setMatchState({
        playerId: matchState.playerId,
        opponentId: `bot_${payload.botId}`,
        opponentName: payload.botName,
        opponentAvatar: payload.botAvatar,
        opponentRating: payload.botRating,
        opponentIsBot: true,
        matchId: payload.matchId,
      })
      setVimMode('NORMAL')
      setResultText('')
      setStatusText('Bot duel started')
      setViewState('countdown')
    },

    onBufferUpdate: (content: string | undefined, delta: BufferDelta | undefined) => {
      if (delta) {
        applyDelta(delta)
        recordReceivedKeystroke(delta)
      } else if (content) {
        replaceOpponentContent(content)
      }
    },

    onGameOver: (payload: GameOverPayload, playerId: string) => {
      const youWon = payload.winnerId === playerId
      const reason = payload.reason === 'opponent_disconnected'
        ? 'Opponent disconnected'
        : youWon
          ? 'You finished first'
          : 'Opponent finished first'

      setResultText(youWon ? `You won. ${reason}.` : `You lost. ${reason}.`)
      setGameOverPayload(payload)
      playSound(youWon ? 'win' : 'lose')
      setStatusText('Match finished')
      setViewState('finished')
    },

    onError: (code: string, message: string) => {
      if (code === 'duplicate_player') {
        setStatusText('Resolving duplicate player id...')
        onMatchStart()
        return
      }
      setStatusText(`${code}: ${message}`)
      setViewState('error')
    },

    onConnecting: () => {
      setStatusText('Connecting to matchmaking server...')
    },

    onConnected: () => {
      setStatusText('Connected. Joining matchmaking queue...')
    },

    onConnectionClosed: () => {
      const viewState = getViewState()
      if (viewState === 'finished' || viewState === 'idle') {
        return
      }
      setStatusText('Connection closed')
      setViewState('error')
    },
  }
}
