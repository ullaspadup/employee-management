import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'
import { ApiError } from '../lib/api-client'
import { useAuth } from '../features/auth/useAuth'
import { createEmployee, deactivateEmployee, getEmployees, reactivateEmployee, searchEmployees, updateEmployee } from '../features/employees/api'
import { EmployeeFormFields } from '../features/employees/EmployeeFormFields'
import {
  EMPLOYEE_SORT_FIELDS,
  EMPLOYEE_SORT_ORDERS,
  EMPLOYEE_STATUSES,
  isEmployeeSortField,
  isEmployeeSortOrder,
  type EmployeeListResponse,
  type EmployeeListStatus,
  type EmployeeCreateRequest,
  type EmployeeEditableFields,
  type EmployeeResponse,
  type EmployeeSortField,
  type EmployeeSortOrder,
} from '../features/employees/types'

const PAGE_SIZE = 10

function createEmptyEmployeeForm(): EmployeeCreateRequest {
  return {
    employee_code: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: null,
    department: '',
    designation: '',
    joining_date: '',
    salary: '',
    is_active: true,
  }
}

function getEmployeeFormErrorMessage(error: unknown, action: 'add' | 'update'): string {
  if (error instanceof ApiError && error.status === 422) {
    const body = error.body
    if (typeof body === 'object' && body !== null && 'detail' in body && Array.isArray(body.detail)) {
      const details = body.detail.flatMap((issue: unknown) => {
        if (typeof issue !== 'object' || issue === null) {
          return []
        }

        const message = 'msg' in issue && typeof issue.msg === 'string' ? issue.msg : ''
        const location = 'loc' in issue && Array.isArray(issue.loc)
          ? issue.loc[issue.loc.length - 1]
          : undefined
        const field = typeof location === 'string' ? location.replaceAll('_', ' ') : ''
        return [field && message ? `${field}: ${message}` : message || 'The value is invalid.']
      })
      if (details.length > 0) {
        return details.join(' ')
      }
    }
  }

  if (error instanceof ApiError && error.status === 409) {
    return error.message
  }

  return `Unable to ${action} this employee right now. Please review the form and try again.`
}

export function EmployeesPage() {
  const { token, logout, user } = useAuth()
  const [skip, setSkip] = useState(0)
  const [employeeStatus, setEmployeeStatus] = useState<EmployeeListStatus>('active')
  const [searchInput, setSearchInput] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [searchRevision, setSearchRevision] = useState(0)
  const [departmentInput, setDepartmentInput] = useState('')
  const [designationInput, setDesignationInput] = useState('')
  const [filters, setFilters] = useState({ department: '', designation: '' })
  const [sortBy, setSortBy] = useState<EmployeeSortField>('id')
  const [sortOrder, setSortOrder] = useState<EmployeeSortOrder>('asc')
  const [employees, setEmployees] = useState<EmployeeListResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshRevision, setRefreshRevision] = useState(0)
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false)
  const [employeeForm, setEmployeeForm] = useState<EmployeeCreateRequest>(createEmptyEmployeeForm)
  const [editingEmployee, setEditingEmployee] = useState<EmployeeResponse | null>(null)
  const [employeeToDeactivate, setEmployeeToDeactivate] = useState<EmployeeResponse | null>(null)
  const [employeeToReactivate, setEmployeeToReactivate] = useState<EmployeeResponse | null>(null)
  const [editForm, setEditForm] = useState<EmployeeEditableFields | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [deactivationError, setDeactivationError] = useState<string | null>(null)
  const [reactivationError, setReactivationError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const isSubmittingRef = useRef(false)
  const canCreateEmployees = user?.role === 'ADMIN' || user?.role === 'HR'
  const canDeactivateEmployees = user?.role === 'ADMIN'
  const canReactivateEmployees = user?.role === 'ADMIN' || user?.role === 'HR'
  const hasRowActions = canCreateEmployees
    || (employeeStatus === 'active' && canDeactivateEmployees)
    || (employeeStatus === 'inactive' && canReactivateEmployees)

  useEffect(() => {
    if (!token) {
      return
    }

    const requestToken = token
    const controller = new AbortController()

    async function loadEmployees() {
      try {
        const result = submittedSearch
          ? await searchEmployees(
              requestToken,
                {
                  search: submittedSearch,
                  skip,
                  limit: PAGE_SIZE,
                  sortBy,
                  sortOrder,
                  status: employeeStatus,
                },
              controller.signal,
            )
          : await getEmployees(
              requestToken,
              {
                skip,
                limit: PAGE_SIZE,
                sortBy,
                sortOrder,
                status: employeeStatus,
                department: filters.department || undefined,
                designation: filters.designation || undefined,
              },
              controller.signal,
            )
        if (!controller.signal.aborted) {
          if (skip > 0 && skip >= result.total) {
            setIsLoading(true)
            setSkip(result.total > 0 ? Math.floor((result.total - 1) / PAGE_SIZE) * PAGE_SIZE : 0)
            return
          }
          setEmployees(result)
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        if (error instanceof ApiError && error.status === 401) {
          logout('session-expired')
          return
        }

        setErrorMessage('Unable to load employees right now. Please try again.')
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadEmployees()
    return () => controller.abort()
  }, [employeeStatus, filters.department, filters.designation, logout, refreshRevision, searchRevision, skip, sortBy, sortOrder, submittedSearch, token])

  const currentPage = employees
    ? Math.floor(employees.skip / employees.limit) + 1
    : 1
  const totalPages = employees
    ? Math.max(1, Math.ceil(employees.total / employees.limit))
    : 1
  const firstRecord = employees?.items.length ? employees.skip + 1 : 0
  const lastRecord = employees ? employees.skip + employees.items.length : 0

  function goToPreviousPage() {
    if (employees) {
      setIsLoading(true)
      setErrorMessage(null)
      setSkip(Math.max(0, employees.skip - employees.limit))
    }
  }

  function goToNextPage() {
    if (employees) {
      setIsLoading(true)
      setErrorMessage(null)
      setSkip(employees.skip + employees.limit)
    }
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)
    setSkip(0)
    setSubmittedSearch(searchInput.trim())
    setSearchRevision((revision) => revision + 1)
  }

  function handleFilterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittedSearch) {
      return
    }

    setIsLoading(true)
    setErrorMessage(null)
    setSkip(0)
    setFilters({
      department: departmentInput.trim(),
      designation: designationInput.trim(),
    })
  }

  function clearFilters() {
    setDepartmentInput('')
    setDesignationInput('')
    setIsLoading(true)
    setErrorMessage(null)
    setSkip(0)
    setFilters({ department: '', designation: '' })
  }

  function handleSortByChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextSortBy = event.currentTarget.value
    if (!isEmployeeSortField(nextSortBy)) {
      return
    }

    setIsLoading(true)
    setErrorMessage(null)
    setSkip(0)
    setSortBy(nextSortBy)
  }

  function handleSortOrderChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextSortOrder = event.currentTarget.value
    if (!isEmployeeSortOrder(nextSortOrder)) {
      return
    }

    setIsLoading(true)
    setErrorMessage(null)
    setSkip(0)
    setSortOrder(nextSortOrder)
  }

  function handleEmployeeStatusChange(event: ChangeEvent<HTMLInputElement>) {
    const nextStatus = event.currentTarget.value
    if (nextStatus !== 'active' && nextStatus !== 'inactive') {
      return
    }

    setIsLoading(true)
    setErrorMessage(null)
    setSkip(0)
    setEmployeeStatus(nextStatus)
  }

  function closeCreateForm() {
    if (isSubmittingRef.current) {
      return
    }
    setIsCreateFormOpen(false)
    setCreateError(null)
  }

  function handleCreateFormKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      closeCreateForm()
    }
  }

  function updateEmployeeForm<K extends keyof EmployeeCreateRequest>(
    field: K,
    value: EmployeeCreateRequest[K],
  ) {
    setEmployeeForm((current) => ({ ...current, [field]: value }))
  }

  function updateEditForm(field: keyof EmployeeEditableFields, value: string) {
    setEditForm((current) => current ? { ...current, [field]: value } : current)
  }

  function openEditForm(employee: EmployeeResponse) {
    setEditingEmployee(employee)
    setEditForm({
      employee_code: employee.employee_code,
      first_name: employee.first_name,
      last_name: employee.last_name,
      email: employee.email,
      phone: employee.phone,
      department: employee.department,
      designation: employee.designation,
      joining_date: employee.joining_date,
      salary: employee.salary,
    })
    setEditError(null)
    setSuccessMessage(null)
  }

  function closeEditForm() {
    if (isSubmittingRef.current) {
      return
    }
    setEditingEmployee(null)
    setEditForm(null)
    setEditError(null)
  }

  function requestDeactivation(employee: EmployeeResponse) {
    setEmployeeToDeactivate(employee)
    setDeactivationError(null)
    setSuccessMessage(null)
  }

  function closeDeactivationConfirmation() {
    if (isSubmittingRef.current) {
      return
    }
    setEmployeeToDeactivate(null)
    setDeactivationError(null)
  }

  async function handleDeactivationConfirm() {
    if (isSubmittingRef.current || !token || !employeeToDeactivate) {
      return
    }

    isSubmittingRef.current = true
    setIsSubmitting(true)
    setDeactivationError(null)
    setSuccessMessage(null)

    try {
      await deactivateEmployee(token, employeeToDeactivate.id)
      setEmployeeToDeactivate(null)
      setIsLoading(true)
      setErrorMessage(null)
      setSuccessMessage(
        `${employeeToDeactivate.first_name} ${employeeToDeactivate.last_name} was deactivated. The current list was refreshed; the employee may no longer appear in these results.`,
      )
      setRefreshRevision((revision) => revision + 1)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setEmployeeToDeactivate(null)
        logout('session-expired')
        return
      }
      if (error instanceof ApiError && error.status === 404) {
        setDeactivationError('This employee is no longer available. The list will be refreshed.')
        setRefreshRevision((revision) => revision + 1)
        return
      }
      setDeactivationError('Unable to deactivate this employee right now. Please try again.')
    } finally {
      isSubmittingRef.current = false
      setIsSubmitting(false)
    }
  }

  function requestReactivation(employee: EmployeeResponse) {
    setEmployeeToReactivate(employee)
    setReactivationError(null)
  }

  function closeReactivationConfirmation() {
    if (isSubmittingRef.current) {
      return
    }
    setEmployeeToReactivate(null)
    setReactivationError(null)
  }

  async function handleReactivationConfirm() {
    if (isSubmittingRef.current || !token || !employeeToReactivate) {
      return
    }

    isSubmittingRef.current = true
    setIsSubmitting(true)
    setReactivationError(null)
    setSuccessMessage(null)

    try {
      await reactivateEmployee(token, employeeToReactivate.id)
      setEmployeeToReactivate(null)
      setIsLoading(true)
      setErrorMessage(null)
      setSuccessMessage(
        `${employeeToReactivate.first_name} ${employeeToReactivate.last_name} was reactivated. The inactive list was refreshed; switch to Active employees to view this employee.`,
      )
      setRefreshRevision((revision) => revision + 1)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setEmployeeToReactivate(null)
        logout('session-expired')
        return
      }
      if (error instanceof ApiError && error.status === 404) {
        setReactivationError('This employee is no longer available. The inactive list will be refreshed.')
        setRefreshRevision((revision) => revision + 1)
        return
      }
      setReactivationError('Unable to reactivate this employee right now. Please try again.')
    } finally {
      isSubmittingRef.current = false
      setIsSubmitting(false)
    }
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmittingRef.current || !token || !editingEmployee || !editForm) {
      return
    }

    isSubmittingRef.current = true
    setIsSubmitting(true)
    setEditError(null)
    setSuccessMessage(null)

    try {
      await updateEmployee(token, editingEmployee.id, {
        ...editForm,
        employee_code: editForm.employee_code.trim(),
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone?.trim() || null,
        department: editForm.department.trim(),
        designation: editForm.designation.trim(),
        salary: editForm.salary.trim(),
      })

      setEditingEmployee(null)
      setEditForm(null)
      setIsLoading(true)
      setErrorMessage(null)
      setSuccessMessage(
        'Employee updated. The current list was refreshed; employees that no longer match its search or filters will not appear in this view.',
      )
      setRefreshRevision((revision) => revision + 1)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setEditingEmployee(null)
        setEditForm(null)
        logout('session-expired')
        return
      }
      setEditError(getEmployeeFormErrorMessage(error, 'update'))
    } finally {
      isSubmittingRef.current = false
      setIsSubmitting(false)
    }
  }

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmittingRef.current || !token) {
      return
    }

    isSubmittingRef.current = true
    setIsSubmitting(true)
    setCreateError(null)
    setSuccessMessage(null)

    try {
      await createEmployee(token, {
        ...employeeForm,
        employee_code: employeeForm.employee_code.trim(),
        first_name: employeeForm.first_name.trim(),
        last_name: employeeForm.last_name.trim(),
        email: employeeForm.email.trim(),
        phone: employeeForm.phone?.trim() || null,
        department: employeeForm.department.trim(),
        designation: employeeForm.designation.trim(),
        salary: employeeForm.salary.trim(),
      })

      setIsCreateFormOpen(false)
      setEmployeeForm(createEmptyEmployeeForm())
      setSearchInput('')
      setSubmittedSearch('')
      setDepartmentInput('')
      setDesignationInput('')
      setFilters({ department: '', designation: '' })
      setEmployeeStatus('active')
      setSkip(0)
      setIsLoading(true)
      setErrorMessage(null)
      setSuccessMessage('Employee added. The view switched to Active employees, search and filters were cleared, and the first page was refreshed.')
      setRefreshRevision((revision) => revision + 1)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setIsCreateFormOpen(false)
        logout('session-expired')
        return
      }
      setCreateError(getEmployeeFormErrorMessage(error, 'add'))
    } finally {
      isSubmittingRef.current = false
      setIsSubmitting(false)
    }
  }

  const filtersSuspended = submittedSearch.length > 0
  const hasActiveFilters = Boolean(filters.department || filters.designation)

  return (
    <section className="employees-page" aria-labelledby="employees-title">
      <header className="employees-heading">
        <div>
          <p className="eyebrow">Directory</p>
          <h1 id="employees-title">Employees</h1>
        </div>
        <div className="employees-heading-actions">
          {employees && (
            <p className="employee-count">
              {employees.total} {employees.total === 1 ? 'employee' : 'employees'}
            </p>
          )}
          {canCreateEmployees && (
            <button
              className="employee-add-button"
              onClick={() => {
                setEmployeeForm(createEmptyEmployeeForm())
                setCreateError(null)
                setSuccessMessage(null)
                setIsCreateFormOpen(true)
              }}
              type="button"
            >
              Add employee
            </button>
          )}
        </div>
      </header>

      {successMessage && (
        <p className="employee-success-message" role="status" aria-live="polite">
          {successMessage}
        </p>
      )}

      {isCreateFormOpen && (
        <div className="employee-create-overlay">
          <section
            aria-labelledby="employee-create-title"
            aria-modal="true"
            className="employee-create-dialog"
            onKeyDown={handleCreateFormKeyDown}
            role="dialog"
          >
            <div className="employee-create-heading">
              <div>
                <p className="eyebrow">Directory</p>
                <h2 id="employee-create-title">Add employee</h2>
              </div>
              <button
                aria-label="Close add employee form"
                className="employee-create-close"
                disabled={isSubmitting}
                onClick={closeCreateForm}
                type="button"
              >
                Close
              </button>
            </div>
            <p className="employee-create-note">
              After saving, search and filters will be cleared so the refreshed list includes the new employee.
            </p>
            <form className="employee-create-form" onSubmit={(event) => void handleCreateSubmit(event)}>
              <EmployeeFormFields
                idPrefix="create"
                onChange={(field, value) => updateEmployeeForm(field, value)}
                requiredFields
                values={employeeForm}
              >
                <label className="employee-create-checkbox" htmlFor="create-is-active">
                  <input checked={employeeForm.is_active} id="create-is-active" onChange={(event) => updateEmployeeForm('is_active', event.currentTarget.checked)} type="checkbox" />
                  Active employee
                </label>
              </EmployeeFormFields>

              {createError && (
                <p className="employee-create-error" role="alert">
                  {createError}
                </p>
              )}

              <div className="employee-create-actions">
                <button className="employee-page-button" disabled={isSubmitting} onClick={closeCreateForm} type="button">
                  Cancel
                </button>
                <button className="employee-add-button" disabled={isSubmitting} type="submit">
                  {isSubmitting ? 'Adding employee…' : 'Add employee'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {editingEmployee && editForm && (
        <div className="employee-create-overlay">
          <section
            aria-labelledby="employee-edit-title"
            aria-modal="true"
            className="employee-create-dialog"
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeEditForm()
            }}
            role="dialog"
          >
            <div className="employee-create-heading">
              <div>
                <p className="eyebrow">Directory</p>
                <h2 id="employee-edit-title">Edit employee</h2>
              </div>
              <button
                aria-label={`Close edit form for ${editingEmployee.first_name} ${editingEmployee.last_name}`}
                className="employee-create-close"
                disabled={isSubmitting}
                onClick={closeEditForm}
                type="button"
              >
                Close
              </button>
            </div>
            <form className="employee-create-form" onSubmit={(event) => void handleEditSubmit(event)}>
              <EmployeeFormFields
                idPrefix="edit"
                onChange={updateEditForm}
                requiredFields
                values={editForm}
              />
              {editError && (
                <p className="employee-create-error" role="alert">
                  {editError}
                </p>
              )}
              <div className="employee-create-actions">
                <button className="employee-page-button" disabled={isSubmitting} onClick={closeEditForm} type="button">
                  Cancel
                </button>
                <button className="employee-add-button" disabled={isSubmitting} type="submit">
                  {isSubmitting ? 'Saving changes…' : 'Save changes'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {employeeToDeactivate && (
        <div className="employee-create-overlay">
          <section
            aria-labelledby="employee-deactivate-title"
            aria-modal="true"
            className="employee-create-dialog employee-deactivate-dialog"
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeDeactivationConfirmation()
            }}
            role="dialog"
          >
            <div className="employee-create-heading">
              <div>
                <p className="eyebrow">Directory</p>
                <h2 id="employee-deactivate-title">Deactivate employee?</h2>
              </div>
              <button
                aria-label="Close deactivation confirmation"
                className="employee-create-close"
                disabled={isSubmitting}
                onClick={closeDeactivationConfirmation}
                type="button"
              >
                Close
              </button>
            </div>
            <p className="employee-create-note">
              This will deactivate {employeeToDeactivate.first_name} {employeeToDeactivate.last_name}. It is a soft deactivation, not permanent data removal. The employee will no longer appear in the active employee list.
            </p>
            {deactivationError && (
              <p className="employee-create-error" role="alert">
                {deactivationError}
              </p>
            )}
            <div className="employee-create-actions">
              <button
                className="employee-page-button"
                disabled={isSubmitting}
                onClick={closeDeactivationConfirmation}
                type="button"
              >
                Cancel
              </button>
              <button
                className="employee-deactivate-button"
                disabled={isSubmitting}
                onClick={() => void handleDeactivationConfirm()}
                type="button"
              >
                {isSubmitting ? 'Deactivating…' : 'Deactivate employee'}
              </button>
            </div>
          </section>
        </div>
      )}

      {employeeToReactivate && (
        <div className="employee-create-overlay">
          <section
            aria-labelledby="employee-reactivate-title"
            aria-modal="true"
            className="employee-create-dialog employee-reactivate-dialog"
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeReactivationConfirmation()
            }}
            role="dialog"
          >
            <div className="employee-create-heading">
              <div>
                <p className="eyebrow">Directory</p>
                <h2 id="employee-reactivate-title">Reactivate employee?</h2>
              </div>
              <button
                aria-label="Close reactivation confirmation"
                className="employee-create-close"
                disabled={isSubmitting}
                onClick={closeReactivationConfirmation}
                type="button"
              >
                Close
              </button>
            </div>
            <p className="employee-create-note">
              Reactivating {employeeToReactivate.first_name} {employeeToReactivate.last_name} will make this employee active again. They will appear in the Active employees view.
            </p>
            {reactivationError && (
              <p className="employee-create-error" role="alert">
                {reactivationError}
              </p>
            )}
            <div className="employee-create-actions">
              <button
                className="employee-page-button"
                disabled={isSubmitting}
                onClick={closeReactivationConfirmation}
                type="button"
              >
                Cancel
              </button>
              <button
                className="employee-reactivate-button"
                disabled={isSubmitting}
                onClick={() => void handleReactivationConfirm()}
                type="button"
              >
                {isSubmitting ? 'Reactivating…' : 'Reactivate employee'}
              </button>
            </div>
          </section>
        </div>
      )}

      <form className="employee-search" onSubmit={handleSearchSubmit} role="search">
        <label htmlFor="employee-search">Search employees</label>
        <div className="employee-search-controls">
          <input
            autoComplete="off"
            id="employee-search"
            onChange={(event) => setSearchInput(event.currentTarget.value)}
            type="search"
            value={searchInput}
          />
          <button className="employee-page-button" type="submit">
            Search
          </button>
        </div>
      </form>

      <fieldset className="employee-status-selector">
        <legend>Employee status</legend>
        {EMPLOYEE_STATUSES.map((status) => (
          <label key={status.value}>
            <input
              checked={employeeStatus === status.value}
              id={`employee-status-${status.value}`}
              name="employee-status"
              onChange={handleEmployeeStatusChange}
              type="radio"
              value={status.value}
            />
            {status.label}
          </label>
        ))}
      </fieldset>

      <form className="employee-filters" onSubmit={handleFilterSubmit}>
        <fieldset disabled={filtersSuspended}>
          <legend>Filter employee list</legend>
          <div className="employee-filter-fields">
            <div className="employee-filter-field">
              <label htmlFor="employee-department">Department</label>
              <input
                autoComplete="off"
                id="employee-department"
                onChange={(event) => setDepartmentInput(event.currentTarget.value)}
                type="text"
                value={departmentInput}
              />
            </div>
            <div className="employee-filter-field">
              <label htmlFor="employee-designation">Designation</label>
              <input
                autoComplete="off"
                id="employee-designation"
                onChange={(event) => setDesignationInput(event.currentTarget.value)}
                type="text"
                value={designationInput}
              />
            </div>
            <div className="employee-filter-actions">
              <button className="employee-page-button" type="submit">
                Apply filters
              </button>
              <button
                className="employee-page-button"
                disabled={!hasActiveFilters && !departmentInput && !designationInput}
                onClick={clearFilters}
                type="button"
              >
                Clear filters
              </button>
            </div>
          </div>
        </fieldset>
        {filtersSuspended && (
          <p className="employee-filter-note">
            The search endpoint does not support department or designation filters. Clear search to use those filters.
          </p>
        )}
      </form>

      <div className="employee-sort-controls">
        <div className="employee-filter-field">
          <label htmlFor="employee-sort-by">Sort by</label>
          <select id="employee-sort-by" onChange={handleSortByChange} value={sortBy}>
            {EMPLOYEE_SORT_FIELDS.map((field) => (
              <option key={field.value} value={field.value}>
                {field.label}
              </option>
            ))}
          </select>
        </div>
        <div className="employee-filter-field">
          <label htmlFor="employee-sort-order">Sort order</label>
          <select
            id="employee-sort-order"
            onChange={handleSortOrderChange}
            value={sortOrder}
          >
            {EMPLOYEE_SORT_ORDERS.map((order) => (
              <option key={order.value} value={order.value}>
                {order.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && (
        <p className="employee-feedback" role="status" aria-live="polite">
          Loading employees...
        </p>
      )}

      {!isLoading && errorMessage && (
        <p className="employee-feedback employee-feedback--error" role="alert">
          {errorMessage}
        </p>
      )}

      {!isLoading && !errorMessage && employees?.items.length === 0 && (
        <p className="employee-feedback" role="status">
          No {employeeStatus} employees found.
        </p>
      )}

      {!errorMessage && employees && employees.items.length > 0 && (
        <div className="employee-table-scroll" role="region" aria-label={`${employeeStatus} employee list`} tabIndex={0}>
          <table className="employee-table">
            <caption className="visually-hidden">{employeeStatus === 'active' ? 'Active' : 'Inactive'} employee directory</caption>
            <thead>
              <tr>
                <th scope="col">Employee code</th>
                <th scope="col">Full name</th>
                <th scope="col">Email</th>
                <th scope="col">Department</th>
                <th scope="col">Designation</th>
                <th scope="col">Joining date</th>
                <th scope="col">Salary</th>
                {hasRowActions && <th scope="col">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {employees.items.map((employee) => (
                <tr key={employee.id}>
                  <td>{employee.employee_code}</td>
                  <td>{`${employee.first_name} ${employee.last_name}`}</td>
                  <td>{employee.email}</td>
                  <td>{employee.department}</td>
                  <td>{employee.designation}</td>
                  <td>{employee.joining_date}</td>
                  <td>{employee.salary}</td>
                  {hasRowActions && (
                    <td>
                      {canCreateEmployees && (
                        <button
                          aria-label={`Edit ${employee.first_name} ${employee.last_name}`}
                          className="employee-row-edit"
                          onClick={() => openEditForm(employee)}
                          type="button"
                        >
                          Edit
                        </button>
                      )}
                      {canDeactivateEmployees && (
                        <button
                          aria-label={`Deactivate ${employee.first_name} ${employee.last_name}`}
                          className="employee-row-deactivate"
                          onClick={() => requestDeactivation(employee)}
                          type="button"
                        >
                          Deactivate
                        </button>
                      )}
                      {employeeStatus === 'inactive' && canReactivateEmployees && (
                        <button
                          aria-label={`Reactivate ${employee.first_name} ${employee.last_name}`}
                          className="employee-row-reactivate"
                          onClick={() => requestReactivation(employee)}
                          type="button"
                        >
                          Reactivate
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!errorMessage && employees && (
        <nav className="employee-pagination" aria-label="Employee pagination">
          <p className="employee-page-info">
            Showing {firstRecord}-{lastRecord} of {employees.total}
            <span>Page {currentPage} of {totalPages}</span>
          </p>
          <div className="employee-pagination-actions">
            <button
              className="employee-page-button"
              disabled={isLoading || employees.skip <= 0}
              onClick={goToPreviousPage}
              type="button"
            >
              Previous
            </button>
            <button
              className="employee-page-button"
              disabled={isLoading || employees.skip + employees.limit >= employees.total}
              onClick={goToNextPage}
              type="button"
            >
              Next
            </button>
          </div>
        </nav>
      )}
    </section>
  )
}
