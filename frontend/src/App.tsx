import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import CRTEffect from 'vault66-crt-effect'
import "vault66-crt-effect/dist/vault66-crt-effect.css"
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { CRTProvider, useCRT } from './contexts/CRTContext'
import { TimedGameProvider } from './contexts/TimedGameContext'
import { VimTutor } from './pages/docs/vimTutor'
import EditProfile from './pages/EditProfile'
import Landing from './pages/Landing'
import Leaderboard from './pages/leaderboard'
import AuthCallback from './pages/login/AuthCallback'
import Login from './pages/login/Login'
import DifficultySelect from './pages/Play/DifficultySelect'
import MatchPage from './pages/Play/MatchPage'
import Play from './pages/Play/Play'
import TimedMatchPage from './pages/Play/TimedMatchPage'
import UserProfile from './pages/userProfile'
import MatchReplayPage from './pages/MatchReplay/MatchReplay'

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
        element={
          <ProtectedRoute>
            <Play />
          </ProtectedRoute>
        }
      />
      <Route
        path="/play/difficulty"
        element={
          <ProtectedRoute>
            <DifficultySelect />
          </ProtectedRoute>
        }
      />
      <Route
        path="/match/multiplayer"
        element={
          <ProtectedRoute>
            <MatchPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/match/timed"
        element={
          <ProtectedRoute>
            <TimedMatchPage />
          </ProtectedRoute>
        }
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
      <Route
        path="/match/:matchId/replay"
        element={<MatchReplayPage />}
      />
    </Routes>
  )
}

function AppContent() {
  const { crtEnabled } = useCRT()

  return (
      <CRTEffect theme='green' enableScanlines={crtEnabled} scanlineOpacity={0.1} scanlineThickness={2} scanlineGap={3} enableSweep={crtEnabled} sweepDuration={12} sweepThickness={8} sweepStyle='classic' enableGlow={false} enableEdgeGlow={true} edgeGlowColor='rgba(91, 179, 135, 0.25)' edgeGlowSize={25} enableFlicker={crtEnabled} flickerIntensity={0.03} flickerSpeed={2} enableVignette={true} vignetteIntensity={0.2} enableGlitch={false}>
        <TimedGameProvider>
          <AppRoutes />
        </TimedGameProvider>
      </CRTEffect>
    )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CRTProvider>
          <AppContent />
        </CRTProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
