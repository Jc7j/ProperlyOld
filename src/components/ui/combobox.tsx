'use client'

import { Combobox as HeadlessCombobox } from '@headlessui/react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { cn } from '~/lib/utils/cn'

export interface ComboboxOption {
  id: string | number
  label: string
  [key: string]: any
}

interface ComboboxProps {
  value: ComboboxOption | null
  onChange: (value: ComboboxOption) => void
  options: ComboboxOption[]
  placeholder?: string
  label?: string
  disabled?: boolean
  className?: string
  error?: string
  name?: string
  required?: boolean
  displayValue?: (item: ComboboxOption | null) => string
  filterFunction?: (option: ComboboxOption, query: string) => boolean
  renderOption?: (option: ComboboxOption) => ReactNode
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  label,
  disabled,
  className,
  error,
  name,
  required,
  displayValue,
  filterFunction,
  renderOption,
}: ComboboxProps) {
  const [query, setQuery] = useState('')

  const filteredOptions =
    query === ''
      ? options
      : options.filter((option) => {
          if (filterFunction) {
            return filterFunction(option, query)
          }
          return option.label.toLowerCase().includes(query.toLowerCase())
        })

  return (
    <div className={cn('relative w-full', className)}>
      {label && (
        <label
          className={cn(
            'mb-2 block text-sm font-medium',
            disabled
              ? 'text-zinc-500 dark:text-zinc-400'
              : 'text-zinc-900 dark:text-zinc-100',
            error && 'text-red-600 dark:text-red-400'
          )}
        >
          {label}
          {required && <span className="text-red-600">*</span>}
        </label>
      )}
      <HeadlessCombobox
        value={value}
        onChange={onChange}
        name={name}
        disabled={disabled}
      >
        <div className="relative">
          <div
            className={cn(
              'group relative flex items-center overflow-hidden rounded-lg border bg-white transition-all',
              'border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900',
              'focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10',
              'dark:focus-within:border-primary/50 dark:focus-within:ring-primary/20',
              disabled && 'cursor-not-allowed bg-zinc-50 dark:bg-zinc-800/50',
              error &&
                'border-red-600 focus-within:border-red-600 focus-within:ring-red-600/10 dark:border-red-400 dark:focus-within:border-red-400 dark:focus-within:ring-red-400/10'
            )}
          >
            <div className="pointer-events-none absolute left-3 flex items-center">
              <Search
                className={cn(
                  'size-4',
                  disabled
                    ? 'text-zinc-400 dark:text-zinc-500'
                    : 'text-zinc-500 dark:text-zinc-400'
                )}
              />
            </div>
            <HeadlessCombobox.Input
              className={cn(
                'w-full border-none bg-transparent px-3 py-2 pl-10 pr-10 text-sm outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600',
                disabled && 'text-zinc-500 dark:text-zinc-400'
              )}
              displayValue={(option: ComboboxOption | null) =>
                displayValue ? displayValue(option) : (option?.label ?? '')
              }
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
            />
            <HeadlessCombobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronDown
                className={cn(
                  'size-4 transition-transform duration-200',
                  disabled
                    ? 'text-zinc-400 dark:text-zinc-500'
                    : 'text-zinc-500 dark:text-zinc-400',
                  'group-data-[open]:rotate-180'
                )}
                aria-hidden="true"
              />
            </HeadlessCombobox.Button>
          </div>
          <HeadlessCombobox.Options
            className={cn(
              'absolute z-50 mt-2 max-h-60 w-full overflow-auto rounded-lg border bg-white py-1 shadow-lg',
              'border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900',
              'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800'
            )}
          >
            {filteredOptions.length === 0 && query !== '' ? (
              <div className="relative cursor-default select-none px-4 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                No results found.
              </div>
            ) : (
              filteredOptions.map((option) => (
                <HeadlessCombobox.Option
                  key={option.id}
                  value={option}
                  className={({ active, selected }) =>
                    cn(
                      'relative cursor-pointer select-none px-4 py-2 text-sm',
                      active && 'bg-zinc-50 dark:bg-zinc-800/50',
                      selected && 'font-medium text-primary'
                    )
                  }
                >
                  {({ selected }) => (
                    <div className="flex items-center justify-between">
                      {renderOption ? (
                        renderOption(option)
                      ) : (
                        <span>{option.label}</span>
                      )}
                      {selected && <Check className="size-4 text-primary" />}
                    </div>
                  )}
                </HeadlessCombobox.Option>
              ))
            )}
          </HeadlessCombobox.Options>
        </div>
      </HeadlessCombobox>
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}
