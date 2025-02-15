'use client'

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { createContext, useContext, useState } from 'react'
import type React from 'react'
import { cn } from '~/lib/utils/cn'

import { Button } from './button'
import { Link } from './link'

export type SortDirection = 'asc' | 'desc' | undefined
export interface SortConfig<T> {
  field: keyof T
  direction: SortDirection
}

interface TableContextValue {
  bleed: boolean
  dense: boolean
  grid: boolean
  striped: boolean
  sortable?: boolean
  sortConfig?: SortConfig<unknown>
  onSort?: (field: string) => void
}

const TableContext = createContext<TableContextValue>({
  bleed: false,
  dense: false,
  grid: false,
  striped: false,
  sortable: false,
})

export function Table<T>({
  bleed = false,
  dense = false,
  grid = false,
  striped = false,
  sortable = false,
  sortConfig,
  onSort,
  className,
  children,
  ...props
}: {
  bleed?: boolean
  dense?: boolean
  grid?: boolean
  striped?: boolean
  sortable?: boolean
  sortConfig?: SortConfig<T>
  onSort?: (field: keyof T) => void
} & React.ComponentPropsWithoutRef<'div'>) {
  return (
    <TableContext.Provider
      value={
        {
          bleed,
          dense,
          grid,
          striped,
          sortable,
          sortConfig,
          onSort,
        } as TableContextValue
      }
    >
      <div className="flow-root">
        <div
          {...props}
          className={cn(className, '-mx-(--gutter) overflow-x-auto')}
        >
          <div
            className={cn(
              'inline-block min-w-full align-middle',
              !bleed && 'sm:px-(--gutter)'
            )}
          >
            <table className="min-w-full text-left text-sm/6 text-zinc-950 dark:text-white">
              {children}
            </table>
          </div>
        </div>
      </div>
    </TableContext.Provider>
  )
}

export function TableHead({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'thead'>) {
  return (
    <thead
      {...props}
      className={cn(
        className,
        'text-zinc-500 dark:text-zinc-400',
        'sticky top-0 z-10 bg-white dark:bg-zinc-900'
      )}
    />
  )
}

export function TableBody(props: React.ComponentPropsWithoutRef<'tbody'>) {
  return (
    <tbody
      {...props}
      className="divide-y divide-zinc-200 dark:divide-zinc-800"
    />
  )
}

const TableRowContext = createContext<{
  href?: string
  target?: string
  title?: string
}>({
  href: undefined,
  target: undefined,
  title: undefined,
})

export function TableRow({
  href,
  target,
  title,
  className,
  ...props
}: {
  href?: string
  target?: string
  title?: string
} & React.ComponentPropsWithoutRef<'tr'>) {
  const { striped } = useContext(TableContext)

  return (
    <TableRowContext.Provider
      value={
        { href, target, title } as React.ContextType<typeof TableRowContext>
      }
    >
      <tr
        {...props}
        className={cn(
          className,
          href &&
            'has-[[data-row-link][data-focus]]:outline-2 has-[[data-row-link][data-focus]]:-outline-offset-2 has-[[data-row-link][data-focus]]:outline-blue-500 dark:focus-within:bg-white/[2.5%]',
          striped && 'even:bg-zinc-50 dark:even:bg-zinc-800/50',
          href &&
            striped &&
            'hover:bg-(--secondary-100) dark:hover:bg-(--secondary-800)',
          href &&
            !striped &&
            'hover:bg-(--secondary-50) dark:hover:bg-(--secondary-800)/50'
        )}
      />
    </TableRowContext.Provider>
  )
}

export function TableHeader({
  className,
  children,
  sortKey,
  align = 'left',
  ...props
}: React.ComponentPropsWithoutRef<'th'> & {
  sortKey?: string
  align?: 'left' | 'right' | 'center'
}) {
  const { bleed, grid, sortable, sortConfig, onSort } = useContext(TableContext)

  const getSortIcon = () => {
    if (!sortKey || !sortConfig || sortConfig.field !== sortKey) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    )
  }

  const content =
    sortable && sortKey ? (
      <Button
        plain
        onClick={() => onSort?.(sortKey)}
        className={cn(
          'group h-auto p-0 font-normal px-0 py-0',
          sortConfig?.field === sortKey &&
            'bg-(--secondary-50) text-(--secondary-600) dark:bg-(--secondary-950) dark:text-(--secondary-400)'
        )}
      >
        <p className="text-xs font-medium tracking-wider uppercase">
          {children}
        </p>
        {getSortIcon()}
      </Button>
    ) : (
      children
    )

  return (
    <th
      {...props}
      className={cn(
        className,
        'border-b border-b-zinc-950/10 px-4 py-2 text-xs font-medium tracking-wider whitespace-nowrap uppercase',
        'last:pr-(--gutter,--spacing(2))',
        'dark:border-b-white/10',
        grid &&
          'border-l border-l-zinc-950/5 first:border-l-0 dark:border-l-white/5',
        !bleed && 'sm:first:pl-1 sm:last:pr-1',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center'
      )}
    >
      {content}
    </th>
  )
}

export function TableCell({
  className,
  children,
  align = 'left',
  ...props
}: React.ComponentPropsWithoutRef<'td'> & {
  align?: 'left' | 'right' | 'center'
}) {
  const { bleed, dense, grid, striped } = useContext(TableContext)
  const { href, target, title } = useContext(TableRowContext)
  const [cellRef, setCellRef] = useState<HTMLElement | null>(null)

  return (
    <td
      ref={href ? setCellRef : undefined}
      {...props}
      className={cn(
        className,
        'relative px-4 whitespace-nowrap',
        'first:pl-(--gutter,--spacing(2)) last:pr-(--gutter,--spacing(2))',
        !striped && 'border-b border-zinc-950/5 dark:border-white/5',
        grid &&
          'border-l border-l-zinc-950/5 first:border-l-0 dark:border-l-white/5',
        dense ? 'py-2.5' : 'py-4',
        !bleed && 'sm:first:pl-1 sm:last:pr-1',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center'
      )}
    >
      {href && (
        <Link
          data-row-link
          href={href}
          target={target}
          aria-label={title}
          tabIndex={cellRef?.previousElementSibling === null ? 0 : -1}
          className="absolute inset-0 focus:outline-hidden"
        />
      )}
      {children}
    </td>
  )
}
