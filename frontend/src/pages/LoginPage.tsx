import { useRef, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'

interface ReturnLocation {
  pathname: string
  search: string
  hash: string
}

function getReturnLocation(state: unknown): ReturnLocation | null {
  if (typeof state !== 'object' || state === null || !('from' in state)) {
    return null
  }

  const from = state.from
  if (typeof from !== 'object' || from === null || !('pathname' in from)) {
    return null
  }

  const pathname = from.pathname
  if (
    typeof pathname !== 'string' ||
    !pathname.startsWith('/') ||
    pathname.startsWith('//')
  ) {
    return null
  }

  return {
    pathname,
    search: 'search' in from && typeof from.search === 'string' ? from.search : '',
    hash: 'hash' in from && typeof from.hash === 'string' ? from.hash : '',
  }
}

export function LoginPage() {
  const { isAuthenticated, isLoading, login, sessionExpired } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const submitLock = useRef(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (isLoading && !isSubmitting) {
    return (
      <p className="placeholder-frame" role="status" aria-live="polite">
        Restoring session...
      </p>
    )
  }

  if (isAuthenticated) {
    return <Navigate to={getReturnLocation(location.state) ?? '/employees'} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitLock.current || isLoading) {
      return
    }

    submitLock.current = true
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await login({ username, password })
      setPassword('')
      navigate(getReturnLocation(location.state) ?? '/employees', { replace: true })
    } catch {
      setErrorMessage('We could not sign you in. Check your username and password and try again.')
    } finally {
      submitLock.current = false
      setIsSubmitting(false)
    }
  }

  const isFormDisabled = isSubmitting || isLoading

  return (
    <section className="login-page" aria-labelledby="login-title">
      <div className="login-heading">
        <p className="eyebrow">Account</p>
        <h1 id="login-title">Sign in</h1>
        <p className="login-description">Use your employee account to continue.</p>
      </div>

      {sessionExpired && (
        <p className="login-session-expired" role="status">
          Your session expired. Please sign in again.
        </p>
      )}

      <form className="login-form" onSubmit={handleSubmit} aria-busy={isFormDisabled}>
        <div className="login-field">
          <label htmlFor="username">Username</label>
          <input
            autoComplete="username"
            autoFocus
            disabled={isFormDisabled}
            id="username"
            name="username"
            onChange={(event) => setUsername(event.currentTarget.value)}
            required
            type="text"
            value={username}
          />
        </div>

        <div className="login-field">
          <label htmlFor="password">Password</label>
          <input
            autoComplete="current-password"
            disabled={isFormDisabled}
            id="password"
            name="password"
            onChange={(event) => setPassword(event.currentTarget.value)}
            required
            type="password"
            value={password}
          />
        </div>

        {errorMessage && (
          <p className="login-error" role="alert">
            {errorMessage}
          </p>
        )}

        {isSubmitting && (
          <p className="login-status" role="status" aria-live="polite">
            Signing in…
          </p>
        )}

        <button className="login-submit" disabled={isFormDisabled} type="submit">
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </section>
  )
}