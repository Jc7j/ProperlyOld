'use client'

import { Camera, Image as ImageIcon, Upload, X } from 'lucide-react'
import Image from 'next/image'
import { useRef, useState } from 'react'
import { Button, Card } from '~/components/ui'
import dayjs from '~/lib/utils/day'
import { UploadButton, UploadDropzone } from '~/lib/utils/uploadthing'
import { type InvoiceWithUser } from '~/server/api/routers/invoice'
import { api } from '~/trpc/react'

interface InvoiceImagesProps {
  invoice: InvoiceWithUser
  propertyId: string
}

export function InvoiceImages({ invoice, propertyId }: InvoiceImagesProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState<string | null>(null)
  const [showUploadDropzone, setShowUploadDropzone] = useState(false)
  const [showCameraOption, setShowCameraOption] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  // Function to handle file selection from camera
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)

    // Create a FormData object to upload the file
    const formData = new FormData()
    formData.append('file', file)

    try {
      // Use the fetch API to upload the file to your server
      const response = await fetch('/api/uploadthing', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const data = await response.json()

      // Add the image to the invoice
      addImage({
        invoiceId: invoice.id,
        propertyId,
        url: data.url,
      })

      setIsUploading(false)
      setShowCameraOption(false)

      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      setIsUploading(false)
      setShowCameraOption(false)
    }
  }

  return (
    <Card>
      <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
            Invoice Images
          </h2>
          <div className="flex gap-2">
            <Button
              color="primary-solid"
              onClick={() => setShowUploadDropzone(true)}
              disabled={isUploading || showCameraOption}
            >
              <Upload className="mr-1 h-4 w-4" />
              Upload
            </Button>
            <Button
              color="primary-outline"
              onClick={() => setShowCameraOption(true)}
              disabled={isUploading || showUploadDropzone}
            >
              <Camera className="mr-1 h-4 w-4" />
              Camera
            </Button>
          </div>
        </div>
      </div>

      {showUploadDropzone && (
        <div className="p-4">
          <UploadDropzone
            endpoint="imageUploader"
            className="ut-label:text-zinc-500 dark:ut-label:text-zinc-400
              ut-allowed-content:hidden
              border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-4"
            onUploadBegin={() => {
              setIsUploading(true)
            }}
            onClientUploadComplete={(res) => {
              setIsUploading(false)
              setShowUploadDropzone(false)
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
              setShowUploadDropzone(false)
              console.error('Upload error:', error)
            }}
            content={{
              label: ({ ready }) =>
                ready ? 'Tap to upload a file' : 'Loading...',
              allowedContent: () => null,
            }}
          />
          <div className="mt-2 flex justify-end">
            <Button
              outline
              onClick={() => setShowUploadDropzone(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {showCameraOption && (
        <div className="p-4">
          <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-4 text-center">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              ref={fileInputRef}
              className="hidden"
              id="camera-input"
            />
            <label
              htmlFor="camera-input"
              className="flex flex-col items-center justify-center cursor-pointer py-6"
            >
              <Camera className="h-12 w-12 text-zinc-400 mb-2" />
              <p className="text-zinc-500 dark:text-zinc-400">
                Tap to take a photo with your camera
              </p>
            </label>
          </div>
          <div className="mt-2 flex justify-end">
            <Button
              outline
              onClick={() => setShowCameraOption(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {invoice.images?.length === 0 &&
          !isUploading &&
          !showUploadDropzone &&
          !showCameraOption && (
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

        {isUploading && !showUploadDropzone && !showCameraOption && (
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
