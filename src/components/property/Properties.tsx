'use client'

import { Building2, Clock, FileText, MapPin, User2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui'
import { cn } from '~/lib/utils/cn'
import dayjs from '~/lib/utils/day'
import { type ParsedProperty } from '~/server/api/routers/property'

type SortField = 'name' | 'address' | 'owner' | 'invoices' | 'updated'
type SortDirection = 'asc' | 'desc'

interface PropertiesProps {
  properties: ParsedProperty[]
}

export default function Properties({ properties }: PropertiesProps) {
  const router = useRouter()
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortedProperties = [...properties].sort((a, b) => {
    const direction = sortDirection === 'asc' ? 1 : -1

    switch (sortField) {
      case 'name':
        return (
          (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1) * direction
        )
      case 'address':
        return (
          ((a.locationInfo?.address ?? '').toLowerCase() >
          (b.locationInfo?.address ?? '').toLowerCase()
            ? 1
            : -1) * direction
        )
      case 'owner':
        return (
          ((a.owner?.name ?? '').toLowerCase() >
          (b.owner?.name ?? '').toLowerCase()
            ? 1
            : -1) * direction
        )
      case 'invoices':
        return (a.totalInvoices - b.totalInvoices) * direction
      case 'updated':
        return (
          (dayjs(a.updatedAt).unix() - dayjs(b.updatedAt).unix()) * direction
        )
      default:
        return 0
    }
  })

  const SortButton = ({
    field,
    children,
  }: {
    field: SortField
    children: React.ReactNode
  }) => (
    <button
      type="button"
      onClick={() => handleSort(field)}
      className="flex items-center gap-2 hover:text-zinc-900 dark:hover:text-white"
    >
      {children}
      {sortField === field && (
        <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
      )}
    </button>
  )

  return (
    <Table striped>
      <TableHead>
        <TableRow>
          <TableHeader>
            <SortButton field="name">
              <Building2 className="size-4 text-zinc-400" />
              Name
            </SortButton>
          </TableHeader>
          <TableHeader align="right">
            <SortButton field="address">
              <MapPin className="size-4 text-zinc-400" />
              Address
            </SortButton>
          </TableHeader>
          <TableHeader align="right">
            <SortButton field="owner">
              <User2 className="size-4 text-zinc-400" />
              Owner
            </SortButton>
          </TableHeader>
          <TableHeader align="right">
            <SortButton field="invoices">
              <FileText className="size-4 text-zinc-400" /># of Invoices
            </SortButton>
          </TableHeader>
          <TableHeader align="right">
            <SortButton field="updated">
              <Clock className="size-4 text-zinc-400" />
              Last Updated
            </SortButton>
          </TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {sortedProperties.map((property) => (
          <TableRow
            key={property.id}
            className={cn(
              'group cursor-pointer transition-colors duration-200',
              'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
            )}
            onClick={() => router.push(`/dashboard/properties/${property.id}`)}
          >
            <TableCell>{property.name}</TableCell>
            <TableCell
              align="right"
              className="text-zinc-600 dark:text-zinc-400"
            >
              {property.locationInfo?.address ?? 'N/A'}
            </TableCell>
            <TableCell
              align="right"
              className="text-zinc-600 dark:text-zinc-400"
            >
              {property.owner?.name ?? 'N/A'}
            </TableCell>
            <TableCell
              align="right"
              className="text-zinc-600 dark:text-zinc-400"
            >
              <div className="flex flex-col items-end gap-1">
                <span>{property.totalInvoices}</span>
                {property.latestInvoiceDate && (
                  <span className="text-xs">
                    Latest:{' '}
                    {dayjs(property.latestInvoiceDate).format('MMM D, YYYY')}
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell
              align="right"
              className={cn(
                'text-sm',
                property.updatedAt
                  ? 'text-zinc-600 dark:text-zinc-400'
                  : 'text-red-600 dark:text-red-400'
              )}
            >
              {property.updatedAt ? dayjs(property.updatedAt).fromNow() : 'N/A'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
