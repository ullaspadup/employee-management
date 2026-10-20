import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <span className="app-brand">
            Employee Management
          </span>
          <div className="app-user-panel">
            <div className="app-user-identity" aria-label="Signed-in user">
              <span className="app-user-name">{user?.username}</span>
              <span className="app-user-role">{user?.role}</span>
            </div>
            <button className="app-logout" onClick={handleLogout} type="button">
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  )
}