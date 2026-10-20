import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AuthProvider } from '../src/features/auth/AuthProvider'
import { AUTH_TOKEN_STORAGE_KEY } from '../src/features/auth/AuthContext'
import { useAuth } from '../src/features/auth/useAuth'
import { apiClient } from '../src/lib/api-client'
import type { LoginRequest, User } from '../src/types/auth'

interface CapturedRequest {
  url: string
  method: string
  headers: Headers
  body: unknown
}

interface TestResult {
  name: string
  passed: boolean
  error?: string
}

const testUser: User = {
  id: 17,
  username: 'jordan',
  email: 'jordan@example.com',
  role: 'HR',
  is_active: true,
  created_at: '2026-10-01T12:00:00Z',
  updated_at: '2026-10-01T12:00:00Z',
}

const capturedRequests: CapturedRequest[] = []
let loginResponseToken = 'new-access-token'
let meStatus = 200
let currentUser: User | null = testUser
let authValue: ReturnType<typeof useAuth> | undefined
let root: Root | undefined

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function setFetchStub(): void {
  capturedRequests.length = 0
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = init?.method ?? 'GET'
    const headers = new Headers(init?.headers)
    let body: unknown

    if (typeof init?.body === 'string') {
      body = JSON.parse(init.body) as unknown
    }

    capturedRequests.push({ url, method, headers, body })

    if (url.endsWith('/api/v1/auth/login')) {
      return jsonResponse({ access_token: loginResponseToken, token_type: 'bearer' })
    }
    if (url.endsWith('/api/v1/auth/me')) {
      return meStatus === 200
        ? jsonResponse(currentUser)
        : jsonResponse({ detail: 'Could not validate credentials' }, meStatus)
    }
    return jsonResponse({ ok: true })
  }
}

function AuthProbe() {
  const value = useAuth()
  useEffect(() => {
    authValue = value
  }, [value])
  return null
}

function getAuth(): ReturnType<typeof useAuth> {
  if (!authValue) {
    throw new Error('AuthProvider has not rendered yet.')
  }
  return authValue
}

async function mountProvider(): Promise<void> {
  const container = document.getElementById('root')
  if (!container) {
    throw new Error('Test root element is missing.')
  }

  root = createRoot(container)
  await act(async () => {
    root?.render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )
    await new Promise((resolve) => window.setTimeout(resolve, 0))
  })
}

async function waitForLoadingToFinish(): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (!getAuth().isLoading) {
      return
    }
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 10))
    })
  }
  throw new Error('Authentication state did not finish loading.')
}

async function unmountProvider(): Promise<void> {
  if (root) {
    await act(async () => root?.unmount())
  }
  root = undefined
  authValue = undefined
}

async function resetState(token?: string): Promise<void> {
  await unmountProvider()
  sessionStorage.clear()
  if (token) {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token)
  }
  loginResponseToken = 'new-access-token'
  meStatus = 200
  currentUser = testUser
  setFetchStub()
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

async function testNoStoredToken(): Promise<void> {
  await resetState()
  await mountProvider()

  assert(getAuth().user === null, 'user should start null')
  assert(getAuth().token === null, 'token should start null')
  assert(!getAuth().isAuthenticated, 'session should start unauthenticated')
  assert(!getAuth().isLoading, 'loading should finish without a stored token')
  assert(
    !capturedRequests.some((request) => request.url.endsWith('/api/v1/auth/me')),
    '/auth/me should not be requested without a token',
  )
}

async function testRestoreValidToken(): Promise<void> {
  await resetState('existing-access-token')
  await mountProvider()
  await waitForLoadingToFinish()

  const profileRequest = capturedRequests.find((request) =>
    request.url.endsWith('/api/v1/auth/me'),
  )
  assert(getAuth().token === 'existing-access-token', 'stored token should be restored')
  assert(profileRequest, '/auth/me should be requested')
  assert(
    profileRequest.headers.get('Authorization') === 'Bearer existing-access-token',
    'profile request should include the stored bearer token',
  )
  assert(getAuth().user?.id === testUser.id, 'profile user should be restored')
  assert(getAuth().isAuthenticated, 'restored user should be authenticated')
}

async function testExpiredTokenIsCleared(): Promise<void> {
  await resetState('expired-access-token')
  meStatus = 401
  await mountProvider()
  await waitForLoadingToFinish()

  assert(sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY) === null, '401 should remove stored token')
  assert(getAuth().token === null, '401 should clear context token')
  assert(getAuth().user === null, '401 should leave user unauthenticated')
  assert(!getAuth().isAuthenticated, '401 should clear authenticated state')
}

async function testLogin(): Promise<void> {
  await resetState()
  await mountProvider()
  const credentials: LoginRequest = { username: 'jordan', password: 'not-stored' }

  await act(async () => getAuth().login(credentials))

  const loginRequest = capturedRequests.find((request) =>
    request.url.endsWith('/api/v1/auth/login'),
  )
  const profileRequest = capturedRequests.find((request) =>
    request.url.endsWith('/api/v1/auth/me'),
  )
  assert(loginRequest?.method === 'POST', 'login should use POST')
  assert(
    JSON.stringify(loginRequest.body) === JSON.stringify(credentials),
    'login should submit the supplied credentials',
  )
  assert(
    sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY) === loginResponseToken,
    'login should store the access token',
  )
  assert(
    profileRequest?.headers.get('Authorization') === `Bearer ${loginResponseToken}`,
    'profile request should use the new bearer token',
  )
  assert(getAuth().user?.id === testUser.id, 'login should store the returned user')
  assert(getAuth().isAuthenticated, 'successful login should authenticate the user')
}

async function testLogout(): Promise<void> {
  await resetState('existing-access-token')
  await mountProvider()
  await waitForLoadingToFinish()

  await act(async () => getAuth().logout())

  assert(sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY) === null, 'logout should remove stored token')
  assert(getAuth().token === null, 'logout should clear context token')
  assert(getAuth().user === null, 'logout should clear user')
  assert(!getAuth().isAuthenticated, 'logout should clear authenticated state')
}

async function testApiClientBearerHeader(): Promise<void> {
  await resetState()

  await apiClient.get<unknown>('/client-check')
  assert(
    capturedRequests[0]?.headers.has('Authorization') === false,
    'API client should omit Authorization when no token is supplied',
  )

  await apiClient.get<unknown>('/client-check', { token: 'explicit-token' })
  assert(
    capturedRequests[1]?.headers.get('Authorization') === 'Bearer explicit-token',
    'API client should send the exact bearer header when a token is supplied',
  )
}

async function runTests(): Promise<void> {
  const results = document.getElementById('results')
  if (!results) {
    throw new Error('Test results element is missing.')
  }

  const tests = [
    ['no stored token initializes unauthenticated', testNoStoredToken],
    ['valid stored token restores user with bearer request', testRestoreValidToken],
    ['401 removes invalid token and clears user', testExpiredTokenIsCleared],
    ['login stores token and profile', testLogin],
    ['logout clears token and user', testLogout],
    ['API client conditionally sends bearer header', testApiClientBearerHeader],
  ] as const
  const testResults: TestResult[] = []

  for (const [name, run] of tests) {
    try {
      await run()
      testResults.push({ name, passed: true })
    } catch (error) {
      testResults.push({
        name,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  await unmountProvider()
  sessionStorage.clear()
  results.textContent = testResults
    .map((result) => `${result.passed ? 'PASS' : 'FAIL'} ${result.name}${result.error ? `: ${result.error}` : ''}`)
    .join('\n')
  results.dataset.status = testResults.every((result) => result.passed) ? 'passed' : 'failed'
}

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
setFetchStub()
void runTests()
