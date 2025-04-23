'use client'

import type { ComponentProps } from 'react'
import ReactDatePicker, { type CalendarContainer } from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

interface DatePickerProps {
  selected: Date | undefined
  onChange: (date: Date | null) => void
  dateFormat?: string
  showMonthYearPicker?: boolean
  className?: string
  wrapperClassName?: string
  popperClassName?: string
  calendarContainer?: React.FC<ComponentProps<typeof CalendarContainer>>
  placeholderText?: string
  isClearable?: boolean
  showMonthDropdown?: boolean
  showYearDropdown?: boolean
  dropdownMode?: 'scroll' | 'select'
}

export default function DatePicker({
  className,
  wrapperClassName,
  popperClassName,
  selected,
  onChange,
  dateFormat = 'MMMM yyyy', // Default format
  showMonthYearPicker = false, // Default behavior
  placeholderText,
  isClearable,
  showMonthDropdown,
  showYearDropdown,
  dropdownMode,
  ...props // Spread any other explicitly passed props
}: DatePickerProps) {
  return (
    <ReactDatePicker
      selected={selected}
      onChange={onChange}
      dateFormat={dateFormat}
      showMonthYearPicker={showMonthYearPicker}
      placeholderText={placeholderText}
      isClearable={isClearable}
      showMonthDropdown={showMonthDropdown}
      showYearDropdown={showYearDropdown}
      dropdownMode={dropdownMode}
      {...props} // Spread additional props
      className={`w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900 ${className ?? ''}`}
      wrapperClassName={`w-full ${wrapperClassName ?? ''}`}
      popperClassName={`react-datepicker-popper !z-50 ${popperClassName ?? ''}`} // Apply z-index
    />
  )
}
