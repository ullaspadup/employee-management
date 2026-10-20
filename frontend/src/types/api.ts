export interface ApiResponse<TData> {
  data: TData | undefined
  status: number
}

export interface ApiRequestOptions {
  headers?: HeadersInit
  signal?: AbortSignal
  token?: string
}