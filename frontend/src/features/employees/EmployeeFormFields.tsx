import type { ReactNode } from 'react'
import type { EmployeeEditableFields } from './types'

interface EmployeeFormFieldsProps {
  idPrefix: 'create' | 'edit'
  values: EmployeeEditableFields
  requiredFields: boolean
  onChange: (field: keyof EmployeeEditableFields, value: string) => void
  children?: ReactNode
}

export function EmployeeFormFields({
  idPrefix,
  values,
  requiredFields,
  onChange,
  children,
}: EmployeeFormFieldsProps) {
  return (
    <div className="employee-create-fields">
      <div className="employee-create-field">
        <label htmlFor={`${idPrefix}-employee-code`}>Employee code</label>
        <input
          autoComplete="off"
          id={`${idPrefix}-employee-code`}
          maxLength={30}
          onChange={(event) => onChange('employee_code', event.currentTarget.value)}
          required={requiredFields}
          value={values.employee_code}
        />
      </div>
      <div className="employee-create-field">
        <label htmlFor={`${idPrefix}-first-name`}>First name</label>
        <input
          autoComplete="given-name"
          id={`${idPrefix}-first-name`}
          maxLength={100}
          onChange={(event) => onChange('first_name', event.currentTarget.value)}
          required={requiredFields}
          value={values.first_name}
        />
      </div>
      <div className="employee-create-field">
        <label htmlFor={`${idPrefix}-last-name`}>Last name</label>
        <input
          autoComplete="family-name"
          id={`${idPrefix}-last-name`}
          maxLength={100}
          onChange={(event) => onChange('last_name', event.currentTarget.value)}
          required={requiredFields}
          value={values.last_name}
        />
      </div>
      <div className="employee-create-field">
        <label htmlFor={`${idPrefix}-email`}>Email</label>
        <input
          autoComplete="email"
          id={`${idPrefix}-email`}
          onChange={(event) => onChange('email', event.currentTarget.value)}
          required={requiredFields}
          type="email"
          value={values.email}
        />
      </div>
      <div className="employee-create-field">
        <label htmlFor={`${idPrefix}-phone`}>Phone <span>(optional)</span></label>
        <input
          autoComplete="tel"
          id={`${idPrefix}-phone`}
          maxLength={30}
          onChange={(event) => onChange('phone', event.currentTarget.value)}
          type="tel"
          value={values.phone ?? ''}
        />
      </div>
      <div className="employee-create-field">
        <label htmlFor={`${idPrefix}-department`}>Department</label>
        <input
          id={`${idPrefix}-department`}
          maxLength={100}
          onChange={(event) => onChange('department', event.currentTarget.value)}
          required={requiredFields}
          value={values.department}
        />
      </div>
      <div className="employee-create-field">
        <label htmlFor={`${idPrefix}-designation`}>Designation</label>
        <input
          id={`${idPrefix}-designation`}
          maxLength={150}
          onChange={(event) => onChange('designation', event.currentTarget.value)}
          required={requiredFields}
          value={values.designation}
        />
      </div>
      <div className="employee-create-field">
        <label htmlFor={`${idPrefix}-joining-date`}>Joining date</label>
        <input
          id={`${idPrefix}-joining-date`}
          onChange={(event) => onChange('joining_date', event.currentTarget.value)}
          required={requiredFields}
          type="date"
          value={values.joining_date}
        />
      </div>
      <div className="employee-create-field">
        <label htmlFor={`${idPrefix}-salary`}>Salary</label>
        <input
          id={`${idPrefix}-salary`}
          inputMode="decimal"
          min="0"
          onChange={(event) => onChange('salary', event.currentTarget.value)}
          required={requiredFields}
          step="0.01"
          type="number"
          value={values.salary}
        />
      </div>
      {children}
    </div>
  )
}
