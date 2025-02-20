'use client'

import { Building2, Clock, FileText, MapPin, User2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
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

interface PropertiesProps {
  properties: ParsedProperty[]
}

export default function Properties({ properties }: PropertiesProps) {
  const router = useRouter()

  return (
    <Table striped>
      <TableHead>
        <TableRow>
          <TableHeader>
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-zinc-400" />
              Name
            </div>
          </TableHeader>
          <TableHeader align="right">
            <div className="flex items-center justify-end gap-2">
              <MapPin className="size-4 text-zinc-400" />
              Address
            </div>
          </TableHeader>
          <TableHeader align="right">
            <div className="flex items-center justify-end gap-2">
              <User2 className="size-4 text-zinc-400" />
              Owner
            </div>
          </TableHeader>
          <TableHeader align="right">
            <div className="flex items-center justify-end gap-2">
              <FileText className="size-4 text-zinc-400" /># of Invoices
            </div>
          </TableHeader>
          <TableHeader align="right">
            <div className="flex items-center justify-end gap-2">
              <Clock className="size-4 text-zinc-400" />
              Last Updated
            </div>
          </TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {properties.map((property) => (
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
