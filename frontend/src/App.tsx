import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import CRTEffect from 'vault66-crt-effect'
import "vault66-crt-effect/dist/vault66-crt-effect.css"
import { AnalyticsRouteTracker } from './components/AnalyticsRouteTracker'
import { WalkthroughPrompt } from './components/Walkthrough/WalkthroughPrompt'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { CRTProvider, useCRT } from './contexts/CRTContext'
import { GuestProvider } from './contexts/GuestContext'
import { KeybindingsProvider } from './contexts/KeybindingsContext'
import { TimedGameProvider } from './contexts/TimedGameContext'
import { VimTutor } from './pages/docs/vimTutor'
import EditProfile from './pages/EditProfile'
import Landing from './pages/Landing'
import Leaderboard from './pages/leaderboard'
import AuthCallback from './pages/login/AuthCallback'
import Login from './pages/login/Login'
import DifficultySelect from './pages/Play/DifficultySelect'
import ComputerSelect from './pages/Play/ComputerSelect'
import MatchPage from './pages/Play/MatchPage'
import Play from './pages/Play/Play'
import TimedMatchPage from './pages/Play/TimedMatchPage'
import UserProfile from './pages/userProfile'
import MatchReplayPage from './pages/MatchReplay/MatchReplay'
import Walkthrough from './pages/Walkthrough'
import { VimiumWarningModal } from './components/VimiumWarningModal/VimiumWarningModal'
import LiveSpectate from './pages/LiveSpectate/LiveSpectate'
import TournamentCreate from './pages/Tournament/TournamentCreate'
import TournamentLobby from './pages/Tournament/TournamentLobby'
import KeybindingsSettings from './pages/KeybindingsSettings'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#1a1a2e', color: '#fff' }}>Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#1a1a2e', color: '#fff' }}>Loading...</div>
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/" element={<Landing />} />
      <Route
        path="/play"
        element={<Play />}
      />
      <Route
        path="/play/difficulty"
        element={<DifficultySelect />}
      />
      <Route
        path="/play/computer"
        element={<ComputerSelect />}
      />
      <Route
        path="/match/multiplayer"
        element={<MatchPage mode="multiplayer" />}
      />
      <Route
        path="/match/computer"
        element={<MatchPage mode="computer" />}
      />
      <Route
        path="/match/timed"
        element={<TimedMatchPage />}
      />
      <Route
        path="/match/tournament"
        element={<MatchPage mode="tournament" />}
      />
      <Route
        path="/play/tournament/create"
        element={
          <ProtectedRoute>
            <TournamentCreate />
          </ProtectedRoute>
        }
      />
      <Route
        path="/t/:slug"
        element={<TournamentLobby />}
      />
      <Route 
        path="/docs/vimtutor"
        element={<VimTutor/>}
      />
      <Route
        path="/leaderboard"
        element={
            <Leaderboard />
        }
      />
      <Route
        path="/users/:username"
        element={<UserProfile />}
      />
      <Route
        path="/editprofile"
        element={
          <ProtectedRoute>
            <EditProfile />
          </ProtectedRoute>
        }
      />
      <Route path="/settings/keybindings" element={<KeybindingsSettings />} />
      <Route
        path="/match/:matchId/replay"
        element={<MatchReplayPage />}
      />
      <Route
        path="/match/:matchId/live"
        element={<LiveSpectate />}
      />
      <Route path="/walkthrough" element={<Walkthrough />} />
    </Routes>
  )
}

function AppContent() {
  const { crtEnabled } = useCRT()
  const { user, isLoading } = useAuth()
  const location = useLocation()

  return (
      <CRTEffect theme='green' enableScanlines={crtEnabled} scanlineOpacity={0.1} scanlineThickness={2} scanlineGap={3} enableSweep={crtEnabled} sweepDuration={12} sweepThickness={8} sweepStyle='classic' enableGlow={false} enableEdgeGlow={true} edgeGlowColor='rgba(91, 179, 135, 0.25)' edgeGlowSize={25} enableFlicker={crtEnabled} flickerIntensity={0.03} flickerSpeed={2} enableVignette={true} vignetteIntensity={0.2} enableGlitch={false}>
        <GuestProvider>
          <TimedGameProvider>
            <AnalyticsRouteTracker />
            <VimiumWarningModal />
            <AppRoutes />
            {!isLoading && location.pathname !== "/walkthrough" && (
              <WalkthroughPrompt user={user} />
            )}
          </TimedGameProvider>
        </GuestProvider>
      </CRTEffect>
    )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <KeybindingsProvider>
          <CRTProvider>
            <AppContent />
          </CRTProvider>
        </KeybindingsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
