'use client'

import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Suspense } from 'react'
import Properties from '~/components/property/Properties'
import { Button, ErrorToast, Heading } from '~/components/ui'
import { ROUTES } from '~/lib/constants/routes'
import { api } from '~/trpc/react'

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

  return <Properties properties={properties} />
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
