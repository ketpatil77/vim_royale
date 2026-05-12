import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import CRTEffect from 'vault66-crt-effect'
import "vault66-crt-effect/dist/vault66-crt-effect.css"
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { CRTProvider, useCRT } from './contexts/CRTContext'
import { VimTutor } from './pages/docs/vimTutor'
import EditProfile from './pages/editProfile'
import Play from './pages/Play/Play'
import MatchPage from './pages/Play/MatchPage'
import Landing from './pages/Landing'
import Leaderboard from './pages/leaderboard'
import AuthCallback from './pages/login/AuthCallback'
import Login from './pages/login/Login'
import UserProfile from './pages/userProfile'

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
        path="/match/multiplayer"
        element={
          <ProtectedRoute>
            <MatchPage />
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
        path="/editProfile"
        element={
          <ProtectedRoute>
            <EditProfile />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

function AppContent() {
  const { crtEnabled } = useCRT()

  return (
    crtEnabled ? (
      <CRTEffect theme='green' enableScanlines={true} scanlineOpacity={0.15} scanlineThickness={2} scanlineGap={3} enableSweep={true} sweepDuration={12} sweepThickness={8} sweepStyle='classic' enableGlow={false} enableEdgeGlow={true} edgeGlowColor='rgba(91, 179, 135, 0.25)' edgeGlowSize={25} enableFlicker={true} flickerIntensity={0.03} flickerSpeed={2} enableVignette={true} vignetteIntensity={0.2} enableGlitch={false}>
        <AppRoutes />
      </CRTEffect>
    ) : (
      <AppRoutes />
    )
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
