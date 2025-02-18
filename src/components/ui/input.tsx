import * as Headless from '@headlessui/react'
import * as React from 'react'
import { cn } from '~/lib/utils/cn'
import { formatPhone } from '~/lib/utils/format'

const dateTypes = ['date', 'datetime-local', 'month', 'time', 'week']
type DateType = (typeof dateTypes)[number]

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  type?: DateType
  label?: string
  error?: string
  hint?: string
  wrapperClassName?: string
  formatPhoneNumber?: boolean
  showBorder?: boolean
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input(
    {
      className,
      type,
      label,
      error,
      hint,
      wrapperClassName,
      disabled,
      formatPhoneNumber: shouldFormatPhone,
      onChange,
      value,
      showBorder = true,
      ...props
    },
    ref
  ) {
    // Generate unique ID for input-label association
    const id = React.useId()

    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (shouldFormatPhone && type === 'tel') {
          const formattedValue = formatPhone(e.target.value)
          e.target.value = formattedValue
        }
        onChange?.(e)
      },
      [shouldFormatPhone, type, onChange]
    )

    return (
      <div className={cn('space-y-2', wrapperClassName)}>
        {label && (
          <label htmlFor={id} className="text-neutral-500 text-xs  ">
            {label}
          </label>
        )}

        <Headless.Input
          ref={ref}
          type={type}
          id={id}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
          onChange={handleChange}
          value={value}
          {...props}
          className={cn([
            className,
            // Basic layout
            'block w-full rounded-lg bg-white px-3 py-1.5 sm:text-sm/6',
            // Typography
            'text-base text-zinc-900 placeholder:text-zinc-500 dark:text-white dark:placeholder:text-zinc-400',
            // Border and Focus
            showBorder && [
              'outline-1 -outline-offset-1 outline-zinc-300',
              'focus:outline-primary focus:outline-2 focus:-outline-offset-2',
              // Dark mode
              'dark:focus:outline-primary dark:bg-zinc-900 dark:outline-zinc-700',
            ],
            !showBorder && ['outline-none', 'dark:bg-zinc-900'],
            // Invalid state
            error && 'outline-red-500 focus:outline-red-500',
            // Disabled state
            disabled && 'cursor-not-allowed opacity-50',
            // System icons
            'dark:[color-scheme:dark]',
            // Date input specific styles
            type &&
              dateTypes.includes(type) && [
                '[&::-webkit-datetime-edit-fields-wrapper]:p-0',
                '[&::-webkit-date-and-time-value]:min-h-[1.5em]',
                '[&::-webkit-datetime-edit]:inline-flex',
                '[&::-webkit-datetime-edit]:p-0',
                '[&::-webkit-datetime-edit-year-field]:p-0',
                '[&::-webkit-datetime-edit-month-field]:p-0',
                '[&::-webkit-datetime-edit-day-field]:p-0',
                '[&::-webkit-datetime-edit-hour-field]:p-0',
                '[&::-webkit-datetime-edit-minute-field]:p-0',
                '[&::-webkit-datetime-edit-second-field]:p-0',
                '[&::-webkit-datetime-edit-millisecond-field]:p-0',
                '[&::-webkit-datetime-edit-meridiem-field]:p-0',
              ],
          ])}
        />

        {/* Error or Hint Text */}
        {(error ?? hint) && (
          <p
            id={error ? `${id}-error` : `${id}-hint`}
            className={cn(
              'text-sm',
              error ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            {error ?? hint}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
