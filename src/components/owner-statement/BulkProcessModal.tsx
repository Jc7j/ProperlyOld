import { CheckCircle, XCircle } from 'lucide-react'
import React from 'react'
import { Button, Dialog, DialogBody, DialogTitle } from '~/components/ui'
import { useBulkProcess } from '~/lib/hooks/use-bulk-process'

interface BulkProcessModalProps {
  open: boolean
  onClose: () => void
  onComplete?: (result: {
    updatedCount: number
    updatedProperties: string[]
  }) => void
  input: {
    currentStatementId: string
    vendor: string
    description: string
    pdfBase64: string
  } | null
}

export default function BulkProcessModal({
  open,
  onClose,
  onComplete,
  input,
}: BulkProcessModalProps) {
  const {
    isProcessing,
    progress,
    error,
    result,
    startProcessing,
    cancelProcessing,
    resetState,
  } = useBulkProcess()

  React.useEffect(() => {
    if (open && input && !isProcessing && !result && !error) {
      void startProcessing(input)
    }
  }, [open, input, isProcessing, result, error, startProcessing])

  React.useEffect(() => {
    if (result && onComplete) {
      onComplete({
        updatedCount: result.updatedCount,
        updatedProperties: result.updatedProperties,
      })
    }
  }, [result, onComplete])

  const handleClose = () => {
    if (isProcessing) {
      cancelProcessing()
    }
    resetState()
    onClose()
  }

  const getStepIcon = (step: string) => {
    switch (step) {
      case 'validating':
        return '🔍'
      case 'fetching':
        return '📋'
      case 'checking':
        return '✅'
      case 'ai-processing':
        return '🤖'
      case 'processing':
        return '⚙️'
      case 'database':
        return '💾'
      default:
        return '⏳'
    }
  }

  const getProgressPercentage = () => {
    if (result) return 100
    if (error) return 0
    if (progress?.progress) return progress.progress

    // Estimate progress based on step
    switch (progress?.step) {
      case 'validating':
        return 5
      case 'fetching':
        return 10
      case 'checking':
        return 15
      case 'ai-processing':
        return 40
      case 'processing':
        return 50
      case 'database':
        return 80
      default:
        return 0
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} size="lg">
      <DialogTitle className="flex items-center gap-2">
        {result ? (
          <>
            <CheckCircle className="h-5 w-5 text-green-600" />
            Processing Complete
          </>
        ) : error ? (
          <>
            <XCircle className="h-5 w-5 text-red-600" />
            Processing Failed
          </>
        ) : (
          <>
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Processing Invoice
          </>
        )}
      </DialogTitle>

      <DialogBody className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{getProgressPercentage()}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                result ? 'bg-green-500' : error ? 'bg-red-500' : 'bg-primary'
              }`}
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
        </div>

        {/* Current Step */}
        {progress && (
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <span className="text-2xl">{getStepIcon(progress.step)}</span>
            <div>
              <div className="font-medium capitalize">
                {progress.step.replace('-', ' ')}
              </div>
              <div className="text-sm text-gray-600">{progress.message}</div>
            </div>
          </div>
        )}

        {/* Success Result */}
        {result && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-800 font-medium mb-2">
              <CheckCircle className="h-4 w-4" />
              Success!
            </div>
            <div className="text-sm text-green-700">{result.message}</div>
            {result.updatedProperties.length > 0 && (
              <div className="mt-3">
                <div className="text-sm font-medium text-green-800 mb-1">
                  Updated Properties:
                </div>
                <div className="text-xs text-green-600 max-h-20 overflow-y-auto">
                  {result.updatedProperties.join(', ')}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
              <XCircle className="h-4 w-4" />
              Error
            </div>
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {/* Processing Info */}
        {isProcessing && !error && (
          <div className="text-sm text-gray-600 space-y-1">
            <p>
              • Processing invoice with AI to extract property-specific expenses
            </p>
            <p>• Creating expense entries for each property</p>
            <p>• Recalculating statement totals</p>
            <p className="text-xs text-gray-500 mt-2">
              This may take a few minutes for organizations with many
              properties.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          {isProcessing ? (
            <Button variant="outline" onClick={cancelProcessing}>
              Cancel
            </Button>
          ) : (
            <Button variant="outline" onClick={handleClose}>
              {result || error ? 'Close' : 'Cancel'}
            </Button>
          )}
        </div>
      </DialogBody>
    </Dialog>
  )
}
