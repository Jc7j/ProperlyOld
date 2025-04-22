'use client'

import type { Column } from '@tanstack/react-table'
import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils/cn'

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>
  title: string
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>
  }

  return (
    <div className={cn('flex items-center space-x-2', className)}>
      <Button
        variant="ghost"
        className="-ml-3 h-8 p-0 font-medium data-[state=open]:bg-accent hover:bg-transparent"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        <span>{title}</span>
        {column.getIsSorted() === 'desc' ? (
          <ChevronDown className="ml-2 size-4" />
        ) : column.getIsSorted() === 'asc' ? (
          <ChevronUp className="ml-2 size-4" />
        ) : (
          <ArrowUpDown className="ml-2 size-4 opacity-50" />
        )}
      </Button>
    </div>
  )
}
