'use client'

import { Plus, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Suspense, useState } from 'react'
import Properties from '~/components/property/Properties'
import {
  Button,
  ErrorToast,
  Heading,
  Pagination,
  PaginationList,
  PaginationNext,
  PaginationPage,
  PaginationPrevious,
} from '~/components/ui'
import { ROUTES } from '~/lib/constants/routes'
import { cn } from '~/lib/utils/cn'
import { type ParsedProperty } from '~/server/api/routers/property'
import { api } from '~/trpc/react'

const ITEMS_PER_PAGE = 15

function PropertiesTableSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800">
      <div className="grid animate-pulse gap-4 p-4">
        <div className="h-8 w-48 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        <div className="space-y-3">
          <div className="h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        </div>
      </div>
    </div>
  )
}

function PropertiesContent() {
  const { data: properties, isPending } = api.property.getMany.useQuery()
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  if (isPending) {
    return <PropertiesTableSkeleton />
  }

  if (!properties?.length) {
    return (
      <div className="text-center">
        <svg
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="mx-auto size-12 text-muted-foreground"
        >
          <path
            d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <h3 className="mt-2 text-sm font-semibold">No properties</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Get started by creating a new property.
        </p>
      </div>
    )
  }

  // Filter properties
  const filteredProperties = properties.filter(
    (property) =>
      property.name.toLowerCase().includes(searchQuery.toLowerCase()) ??
      property.locationInfo?.address
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ??
      property.owner?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Calculate pagination
  const totalItems = filteredProperties.length
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedProperties = filteredProperties.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  )

  return (
    <div className="space-y-4">
      {/* Search field */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="size-4 text-zinc-400" />
        </div>
        <input
          type="text"
          placeholder="Search properties..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setCurrentPage(1)
          }}
          className={cn(
            'w-full rounded-lg border bg-white px-3 py-2 pl-10 text-sm outline-none transition-all',
            'border-zinc-200 placeholder:text-zinc-400',
            'dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder:text-zinc-600',
            'focus:border-primary/50 focus:ring-4 focus:ring-primary/10',
            'dark:focus:border-primary/50 dark:focus:ring-primary/20'
          )}
        />
      </div>

      <Properties
        properties={paginatedProperties as unknown as ParsedProperty[]}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 space-y-2">
          <div className="text-muted-foreground text-center text-sm">
            Showing {startIndex + 1} to{' '}
            {Math.min(startIndex + ITEMS_PER_PAGE, totalItems)} of {totalItems}{' '}
            properties
          </div>
          <Pagination className="justify-center">
            <PaginationPrevious
              href={currentPage > 1 ? '#' : null}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            />
            <PaginationList>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => (
                  <PaginationPage
                    key={page}
                    href="#"
                    current={page === currentPage}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </PaginationPage>
                )
              )}
            </PaginationList>
            <PaginationNext
              href={currentPage < totalPages ? '#' : null}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            />
          </Pagination>
        </div>
      )}
    </div>
  )
}

export default function PropertiesPage() {
  const router = useRouter()
  const utils = api.useUtils()
  const { mutate: createProperty, isPending: isCreating } =
    api.property.create.useMutation({
      onSuccess: async (newProperty) => {
        await utils.property.getMany.invalidate()
        router.push(`${ROUTES.DASHBOARD.PROPERTIES}/${newProperty}`)
      },
      onError: (error) => {
        console.error(error)
        ErrorToast(
          'Failed to create property. Contact support if the problem persists.'
        )
      },
    })

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <Heading level={1}>Properties</Heading>
        <Button onClick={() => createProperty()} disabled={isCreating}>
          <Plus className="size-4" />
          <span>{isCreating ? 'Creating...' : 'Add Property'}</span>
        </Button>
      </div>

      <Suspense fallback={<PropertiesTableSkeleton />}>
        <PropertiesContent />
      </Suspense>
    </div>
  )
}
