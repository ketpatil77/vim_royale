import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

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
  const { user, checkAuth } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const verifyAuth = async () => {
      // Small delay to ensure cookie is set
      await new Promise(resolve => setTimeout(resolve, 500))

      // Check if cookie exists
      const token = getCookie('token')
      if (!token) {
        setError('Authentication failed. No token found.')
        return
      }

      try {
        await checkAuth()
        navigate('/')
      } catch {
        setError('Authentication failed. Please try again.')
      }
    }

    verifyAuth()
  }, [checkAuth, navigate])

  // If already logged in (from AuthContext), redirect
  useEffect(() => {
    if (user) {
      navigate('/')
    }
  }, [user, navigate])

  if (error) {
    return (
      <div style={styles.container}>
        <p style={styles.error}>{error}</p>
        <button onClick={() => navigate('/login')} style={styles.button}>
          Back to Login
        </button>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <p>Authenticating...</p>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#1a1a2e',
    color: '#fff',
  },
  error: {
    color: '#ff6b6b',
    marginBottom: '1rem',
  },
  button: {
    padding: '0.75rem 1.5rem',
    cursor: 'pointer',
    backgroundColor: '#16213e',
    color: '#fff',
    border: '1px solid #0f3460',
    borderRadius: '8px',
  },
}