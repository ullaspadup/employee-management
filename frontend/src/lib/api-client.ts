import type { ApiRequestOptions, ApiResponse } from '../types/api'

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown) {
    super(getErrorMessage(body) ?? `Request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

function getErrorMessage(body: unknown): string | undefined {
  if (typeof body === 'string' && body.trim()) {
    return body
  }

  if (typeof body === 'object' && body !== null && 'detail' in body) {
    const detail = body.detail
    if (typeof detail === 'string') {
      return detail
    }
  }

  return undefined
}

function getRequestUrl(path: string): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL
  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL is not configured.')
  }

  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) {
    return undefined
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  if (contentType.includes('application/json') || contentType.includes('+json')) {
    try {
      return JSON.parse(text) as unknown
    } catch {
      return text
    }
  }

  return text
}

async function request<TData>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  options: ApiRequestOptions = {},
): Promise<ApiResponse<TData>> {
  const headers = new Headers(options.headers)
  const hasBody = body !== undefined
  if (hasBody) {
    headers.set('Content-Type', 'application/json')
  }
  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`)
  }

  const response = await fetch(getRequestUrl(path), {
    method,
    headers,
    signal: options.signal,
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
  })
  const data = await readResponseBody(response)

  if (!response.ok) {
    throw new ApiError(response.status, data)
  }

  return {
    data: data as TData | undefined,
    status: response.status,
  }
}

export const apiClient = {
  get<TData>(path: string, options?: ApiRequestOptions) {
    return request<TData>('GET', path, undefined, options)
  },
  post<TData>(path: string, body: unknown, options?: ApiRequestOptions) {
    return request<TData>('POST', path, body, options)
  },
  patch<TData>(path: string, body: unknown, options?: ApiRequestOptions) {
    return request<TData>('PATCH', path, body, options)
  },
  delete<TData = void>(path: string, options?: ApiRequestOptions) {
    return request<TData>('DELETE', path, undefined, options)
  },
}