'use client'

import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Suspense } from 'react'
import Properties from '~/components/property/Properties'
import { Button, ErrorToast, Heading, Spinner } from '~/components/ui'
import { ROUTES } from '~/lib/constants/routes'
import { api } from '~/trpc/react'

export default function PropertiesPage() {
  const router = useRouter()
  const utils = api.useUtils()
  const { data: properties } = api.property.getMany.useQuery()
  const createProperty = api.property.create.useMutation({
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
        <Button
          onClick={() => createProperty.mutate()}
          disabled={createProperty.isPending}
        >
          <Plus className="size-4" />
          <span>Add Property</span>
        </Button>
      </div>

      {properties?.length && properties.length > 0 ? (
        <Suspense fallback={<Spinner size="lg" className="mx-auto mt-8" />}>
          <Properties properties={properties} />
        </Suspense>
      ) : (
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
          <div className="mt-6">
            <Button
              onClick={() => createProperty.mutate()}
              disabled={createProperty.isPending}
            >
              <Plus className="h-4 w-4" />
              <span>New Property</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
