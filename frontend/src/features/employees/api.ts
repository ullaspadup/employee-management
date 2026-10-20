import { apiClient } from '../../lib/api-client'
import type {
  EmployeeListResponse,
  EmployeeCreateRequest,
  EmployeeResponse,
  EmployeeUpdateRequest,
  EmployeeSortField,
  EmployeeSortOrder,
  EmployeeStatus,
} from './types'

export async function updateEmployee(
  token: string,
  employeeId: number,
  employee: EmployeeUpdateRequest,
): Promise<EmployeeResponse> {
  const response = await apiClient.patch<EmployeeResponse>(
    `/api/v1/employees/${employeeId}`,
    employee,
    { token },
  )

  if (!response.data) {
    throw new Error('The employee update response was empty.')
  }

  return response.data
}

export async function deactivateEmployee(
  token: string,
  employeeId: number,
): Promise<void> {
  await apiClient.delete<void>(`/api/v1/employees/${employeeId}`, { token })
}

export async function reactivateEmployee(
  token: string,
  employeeId: number,
): Promise<EmployeeResponse> {
  const response = await apiClient.patch<EmployeeResponse>(
    `/api/v1/employees/${employeeId}/activate`,
    undefined,
    { token },
  )

  if (!response.data) {
    throw new Error('The employee reactivation response was empty.')
  }

  return response.data
}

export async function createEmployee(
  token: string,
  employee: EmployeeCreateRequest,
): Promise<EmployeeResponse> {
  const response = await apiClient.post<EmployeeResponse>(
    '/api/v1/employees',
    employee,
    { token },
  )

  if (!response.data) {
    throw new Error('The employee response was empty.')
  }

  return response.data
}

export interface GetEmployeesOptions {
  skip: number
  limit: number
  sortBy: EmployeeSortField
  sortOrder: EmployeeSortOrder
  status: EmployeeStatus
  department?: string
  designation?: string
}

export interface SearchEmployeesOptions {
  search: string
  skip: number
  limit: number
  sortBy: EmployeeSortField
  sortOrder: EmployeeSortOrder
  status: EmployeeStatus
}

export async function getEmployees(
  token: string,
  options: GetEmployeesOptions,
  signal?: AbortSignal,
): Promise<EmployeeListResponse> {
  const query = new URLSearchParams({
    skip: String(options.skip),
    limit: String(options.limit),
    sort_by: options.sortBy,
    sort_order: options.sortOrder,
    status: options.status,
  })
  if (options.department) {
    query.set('department', options.department)
  }
  if (options.designation) {
    query.set('designation', options.designation)
  }
  const response = await apiClient.get<EmployeeListResponse>(
    `/api/v1/employees?${query.toString()}`,
    { token, signal },
  )

  if (!response.data) {
    throw new Error('The employee response was empty.')
  }

  return response.data
}

export async function searchEmployees(
  token: string,
  options: SearchEmployeesOptions,
  signal?: AbortSignal,
): Promise<EmployeeListResponse> {
  const query = new URLSearchParams({
    search: options.search,
    skip: String(options.skip),
    limit: String(options.limit),
    sort_by: options.sortBy,
    sort_order: options.sortOrder,
    status: options.status,
  })
  const response = await apiClient.get<EmployeeListResponse>(
    `/api/v1/employees/search?${query.toString()}`,
    { token, signal },
  )

  if (!response.data) {
    throw new Error('The employee search response was empty.')
  }

  return response.data
}
