import { useAuth } from '../../contexts/AuthContext'

export default function Login() {
  const { login } = useAuth()

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Vim Royale</h1>
      <p style={styles.subtitle}>Login to play</p>
      <div style={styles.buttons}>
        <button onClick={() => login('google')} style={styles.button}>
          Login with Google
        </button>
        <button onClick={() => login('github')} style={styles.button}>
          Login with GitHub
        </button>
      </div>
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
  title: {
    fontSize: '3rem',
    marginBottom: '0.5rem',
  },
  subtitle: {
    fontSize: '1.2rem',
    marginBottom: '2rem',
    opacity: 0.8,
  },
  buttons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  button: {
    padding: '1rem 2rem',
    fontSize: '1.1rem',
    cursor: 'pointer',
    backgroundColor: '#16213e',
    color: '#fff',
    border: '1px solid #0f3460',
    borderRadius: '8px',
    minWidth: '250px',
    transition: 'background-color 0.2s',
  },
}