import { useState } from 'react'
import { Button } from '~/components/ui'

import OwnerStatementReviewTable from './OwnerStatementReviewTable'

export default function OwnerStatementReviewStepper({
  drafts,
  unmatchedListings,
  onDone,
  onDraftChange,
}: {
  drafts: any[]
  unmatchedListings: string[]
  onDone: () => void
  onDraftChange: (idx: number, field: string, value: any) => void
}) {
  const [step, setStep] = useState(0)
  const current = drafts[step]

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-zinc-900 flex flex-col min-h-screen">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="text-lg font-bold">
          Review Owner Statements ({step + 1} of {drafts.length})
        </div>
        <Button outline onClick={onDone}>
          Exit Review
        </Button>
      </div>
      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto py-8">
        <div className="w-full max-w-4xl">
          {unmatchedListings.length > 0 && step === 0 && (
            <div className="mb-4 p-3 bg-yellow-100 text-yellow-800 rounded">
              <b>Unmatched Listings:</b> {unmatchedListings.join(', ')}
            </div>
          )}
          <OwnerStatementReviewTable
            statementDraft={current}
            onChange={(field, value) => onDraftChange(step, field, value)}
          />
          <div className="flex justify-between mt-8">
            <Button outline onClick={onDone}>
              Exit Review
            </Button>
            <div className="flex gap-2">
              <Button
                outline
                disabled={step === 0}
                onClick={() => setStep((s) => s - 1)}
              >
                Previous
              </Button>
              <Button
                color="primary-solid"
                onClick={() => {
                  if (step === drafts.length - 1) onDone()
                  else setStep((s) => s + 1)
                }}
              >
                {step === drafts.length - 1 ? 'Finish' : 'Next'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
