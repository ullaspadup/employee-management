export const EMPLOYEE_SORT_FIELDS = [
  { value: 'id', label: 'ID' },
  { value: 'employee_code', label: 'Employee code' },
  { value: 'first_name', label: 'First name' },
  { value: 'last_name', label: 'Last name' },
  { value: 'department', label: 'Department' },
  { value: 'designation', label: 'Designation' },
  { value: 'joining_date', label: 'Joining date' },
  { value: 'salary', label: 'Salary' },
] as const

export type EmployeeSortField = (typeof EMPLOYEE_SORT_FIELDS)[number]['value']

export const EMPLOYEE_SORT_ORDERS = [
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' },
] as const

export type EmployeeSortOrder = (typeof EMPLOYEE_SORT_ORDERS)[number]['value']

export const EMPLOYEE_STATUSES = [
  { value: 'active', label: 'Active employees' },
  { value: 'inactive', label: 'Inactive employees' },
] as const

export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number]['value'] | 'all'
export type EmployeeListStatus = Extract<EmployeeStatus, 'active' | 'inactive'>

export function isEmployeeSortField(value: string): value is EmployeeSortField {
  return EMPLOYEE_SORT_FIELDS.some((field) => field.value === value)
}

export function isEmployeeSortOrder(value: string): value is EmployeeSortOrder {
  return EMPLOYEE_SORT_ORDERS.some((order) => order.value === value)
}

export interface EmployeeResponse {
  id: number
  employee_code: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  department: string
  designation: string
  joining_date: string
  salary: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface EmployeeEditableFields {
  employee_code: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  department: string
  designation: string
  joining_date: string
  salary: string
}

export interface EmployeeCreateRequest extends EmployeeEditableFields {
  is_active: boolean
}

export interface EmployeeUpdateRequest {
  employee_code?: string
  first_name?: string
  last_name?: string
  email?: string
  phone?: string | null
  department?: string
  designation?: string
  joining_date?: string
  salary?: string
}

export interface EmployeeListResponse {
  items: EmployeeResponse[]
  total: number
  skip: number
  limit: number
}
