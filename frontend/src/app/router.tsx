import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { ProtectedRoute } from '../components/ProtectedRoute'
import { EmployeesPage } from '../pages/EmployeesPage'
import { LoginPage } from '../pages/LoginPage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/employees" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppShell>
                <Outlet />
              </AppShell>
            </ProtectedRoute>
          }
        >
          <Route path="/employees" element={<EmployeesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}