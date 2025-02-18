'use client'

import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui'
import dayjs from '~/lib/utils/day'
import { type ParsedProperty } from '~/server/api/routers/property'

interface PropertiesProps {
  properties: ParsedProperty[]
}

export default function Properties({ properties }: PropertiesProps) {
  const router = useRouter()

  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeader>Name</TableHeader>
          <TableHeader align="right">Address</TableHeader>
          <TableHeader align="right">Owner</TableHeader>
          <TableHeader align="right">Last Updated</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {properties.map((property) => (
          <TableRow
            key={property.id}
            className="hover:bg-muted/50 cursor-pointer"
            onClick={() => router.push(`/dashboard/properties/${property.id}`)}
          >
            <TableCell className="font-medium">{property.name}</TableCell>
            <TableCell align="right">
              {property.locationInfo?.address ?? 'N/A'}
            </TableCell>
            <TableCell align="right">{property.owner?.name ?? 'N/A'}</TableCell>
            <TableCell align="right">
              {property.updatedAt
                ? dayjs(property.updatedAt).fromNow()
                : 'Never'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
