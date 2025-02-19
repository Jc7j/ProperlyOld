'use client'

import { Image as ImageIcon, X } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'
import { Button, Card } from '~/components/ui'
import dayjs from '~/lib/utils/day'
import { UploadButton } from '~/lib/utils/uploadthing'
import { type InvoiceWithUser } from '~/server/api/routers/invoice'
import { api } from '~/trpc/react'

interface InvoiceImagesProps {
  invoice: InvoiceWithUser
  propertyId: string
}

export function InvoiceImages({ invoice, propertyId }: InvoiceImagesProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState<string | null>(null)
  const utils = api.useUtils()

  const { mutate: addImage } = api.invoice.addImage.useMutation({
    onSuccess: () => {
      void utils.invoice.getOne.invalidate({
        invoiceId: invoice.id,
        propertyId,
      })
    },
  })

  const { mutate: removeImage } = api.invoice.removeImage.useMutation({
    onSuccess: () => {
      void utils.invoice.getOne.invalidate({
        invoiceId: invoice.id,
        propertyId,
      })
      setIsRemoving(null)
    },
  })

  function handleRemoveImage(imageUrl: string) {
    setIsRemoving(imageUrl)
    removeImage({
      invoiceId: invoice.id,
      propertyId,
      imageUrl,
    })
  }

  return (
    <Card>
      <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
            Invoice Images
          </h2>
          <UploadButton
            endpoint="imageUploader"
            className="ut-button:bg-zinc-900 ut-button:text-white ut-button:px-4 ut-button:py-2 
              ut-button:rounded-md ut-button:font-medium ut-button:text-sm
              ut-button:transition-colors ut-button:hover:bg-zinc-700
              ut-button:disabled:bg-zinc-300 ut-button:disabled:cursor-not-allowed
              dark:ut-button:bg-zinc-50 dark:ut-button:text-zinc-900 
              dark:ut-button:hover:bg-zinc-200"
            content={{
              button({ ready }) {
                if (ready) return 'Upload Image'
                return 'Loading...'
              },
              allowedContent() {
                return null // Hide the allowed content text
              },
            }}
            onUploadBegin={() => setIsUploading(true)}
            onClientUploadComplete={(res) => {
              setIsUploading(false)
              res?.forEach((file) => {
                addImage({
                  invoiceId: invoice.id,
                  propertyId,
                  url: file.url,
                })
              })
            }}
            onUploadError={(error) => {
              setIsUploading(false)
              console.error('Upload error:', error)
            }}
          />
        </div>
      </div>

      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {invoice.images?.length === 0 && !isUploading && (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <ImageIcon className="mb-2 h-12 w-12 text-zinc-300 dark:text-zinc-700" />
            <h3 className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              No images
            </h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Upload images to attach them to this invoice.
            </p>
          </div>
        )}

        {isUploading && (
          <div className="p-4">
            <div className="h-32 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          </div>
        )}

        {invoice.images?.map((image) => (
          <div
            key={image.id}
            className="flex items-start justify-between gap-x-4 p-4"
          >
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg">
                <Image
                  src={image.url}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </div>
              <div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Added{' '}
                  {dayjs(image.createdAt).format('MMM D, YYYY [at] h:mm A')}
                </p>
                <a
                  href={image.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 text-sm font-medium text-primary hover:underline"
                >
                  View full size
                </a>
              </div>
            </div>
            <Button
              plain
              className="-m-2 text-zinc-400 hover:text-zinc-500"
              onClick={() => handleRemoveImage(image.url)}
              disabled={isRemoving === image.url}
            >
              {isRemoving === image.url ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
              ) : (
                <X className="h-5 w-5" />
              )}
              <span className="sr-only">Remove image</span>
            </Button>
          </div>
        ))}
      </div>
    </Card>
  )
}
