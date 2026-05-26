import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { TerminalLayout } from '../../components/TerminalLayout/TerminalLayout'
import { useAuth } from '../../contexts/AuthContext'
import './AuthCallback.css'

function getCookie(name: string): string | null {
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [cookieName, value] = cookie.trim().split('=')
    if (cookieName === name) {
      return decodeURIComponent(value)
    }
  }
  return null
}

export default function AuthCallback() {
  const navigate = useNavigate()
  const { checkAuth } = useAuth()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const verifyAuth = async () => {
      await new Promise(resolve => setTimeout(resolve, 500))

      const token = getCookie('token')
      if (!token) {
        setError('Authentication failed. No token found.')
        return
      }

      try {
        await checkAuth()
        const next = searchParams.get('next')
        navigate(next || '/')
      } catch {
        setError('Authentication failed. Please try again.')
      }
    }

    verifyAuth()
  }, [checkAuth, navigate, searchParams])

  if (error) {
    return (
      <TerminalLayout>
        <div className="authcallback-container">
          <p className="authcallback-error">{error}</p>
          <button onClick={() => navigate('/login')} className="authcallback-button">
            Back to Login
          </button>
        </div>
      </TerminalLayout>
    )
  }

  return (
    <TerminalLayout>
      <div className="authcallback-container">
        <p className="authcallback-message">Authenticating...</p>
      </div>
    </TerminalLayout>
  )
}
