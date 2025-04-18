import { AlertTriangle, CheckCircle, Dot, FilePlus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button, Card } from '~/components/ui'

import OwnerStatementReviewTable from './OwnerStatementReviewTable'

export default function OwnerStatementReviewStepper({
  drafts,
  unmatchedListings,
  onDone,
}: {
  drafts: any[]
  unmatchedListings: string[]
  onDone: () => void
}) {
  // Sort drafts A-Z by propertyName on mount
  const [orderedDrafts, setOrderedDrafts] = useState<any[]>([])
  const [step, setStep] = useState(0)
  // Track which drafts have been created (reviewed)
  const [created, setCreated] = useState<boolean[]>([])

  useEffect(() => {
    const sorted = [...drafts].sort((a, b) =>
      a.propertyName.localeCompare(b.propertyName)
    )
    setOrderedDrafts(sorted)
    setCreated(new Array(sorted.length).fill(false))
    setStep(0)
  }, [drafts])

  const current = orderedDrafts[step] || {}

  // Progress list for sidebar
  const progressList = useMemo(
    () =>
      orderedDrafts.map((d, idx) => ({
        propertyName: d.propertyName,
        reviewed: created[idx],
        isCurrent: idx === step,
      })),
    [orderedDrafts, created, step]
  )

  // Handle marking as created (simulate backend creation)
  const handleNext = () => {
    // Mark as created
    setCreated((arr) => {
      const next = [...arr]
      next[step] = true
      return next
    })
    if (step === orderedDrafts.length - 1) onDone()
    else setStep((s) => s + 1)
  }

  // Progress bar calculation
  const reviewedCount = created.filter(Boolean).length
  const totalCount = created.length
  const progressPercent = totalCount
    ? Math.round((reviewedCount / totalCount) * 100)
    : 0

  // Right Panel: Review Table
  const handleDraftChange = (
    idx: number,
    section: string,
    rowIdx: number,
    key: string,
    value: any
  ) => {
    setOrderedDrafts((drafts) => {
      const newDrafts = [...drafts]
      const draft = { ...newDrafts[idx] }
      if (section === 'notes') {
        draft.notes = value
      } else if (key === '__delete') {
        const arr = [...draft[section]]
        arr.splice(rowIdx, 1)
        draft[section] = arr
      } else if (key === '__add') {
        draft[section] = [...draft[section], value]
      } else {
        const arr = [...draft[section]]
        arr[rowIdx] = { ...arr[rowIdx], [key]: value }
        draft[section] = arr
      }
      newDrafts[idx] = draft
      return newDrafts
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-zinc-900 flex flex-col min-h-screen px-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="text-lg font-bold">
          Review Owner Statements ({step + 1} of {orderedDrafts.length})
        </div>
        <Button outline onClick={onDone}>
          Exit Review
        </Button>
      </div>
      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row items-stretch justify-center overflow-y-auto py-8 gap-8">
        {/* Left Sidebar */}
        <div className="w-full md:w-1/4 max-w-xs mx-auto md:mx-0 mb-8 md:mb-0 flex flex-col gap-6">
          {/* Add Invoice Button */}
          <Button
            outline
            onClick={() =>
              console.log('Import Invoice PDF clicked for step:', step)
            } // Placeholder
            className="w-full mb-6"
          >
            <FilePlus className="w-4 h-4 mr-2" />
            Import a vendor invoice
          </Button>
          {/* Progress Card */}
          <Card className="p-4">
            <div className="font-semibold mb-2 text-sm">Review Progress</div>
            <div className="mb-3 flex items-center gap-2">
              <div className="flex-1 h-2 bg-zinc-200 rounded-full overflow-hidden">
                <div
                  className="h-2 bg-green-500 rounded-full transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs text-zinc-500 min-w-[48px] text-right">
                {reviewedCount}/{totalCount}
              </span>
            </div>
            <ul className="space-y-1 max-h-64 overflow-y-auto">
              {progressList.map((item, idx) => (
                <li
                  key={item.propertyName}
                  className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors
                    ${item.isCurrent ? 'bg-primary/10 font-bold text-primary' : ''}
                    ${item.reviewed ? 'opacity-70' : ''}
                  `}
                  onClick={() => setStep(idx)}
                >
                  {item.reviewed ? (
                    <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                  ) : item.isCurrent ? (
                    <Dot className="w-5 h-5 text-blue-500 shrink-0" />
                  ) : (
                    <Dot className="w-5 h-5 text-zinc-400 shrink-0" />
                  )}
                  <span className="truncate flex-1">{item.propertyName}</span>
                </li>
              ))}
            </ul>
          </Card>
          {/* Unmatched Listings Card */}
          <Card className="p-4 bg-yellow-50 border border-yellow-200">
            <div className="flex items-center gap-2 mb-2 text-yellow-800 font-semibold text-xs">
              <AlertTriangle className="w-4 h-4" />
              Unmatched Listings
            </div>
            {unmatchedListings.length === 0 ? (
              <div className="text-xs text-zinc-500">None</div>
            ) : (
              <ul className="text-xs text-yellow-800 space-y-1 max-h-32 overflow-y-auto">
                {unmatchedListings.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        {/* Right Panel: Review Table */}
        <div className="flex-1 flex flex-col items-center">
          <OwnerStatementReviewTable
            statementDraft={current}
            onChange={(section, rowIdx, key, value) =>
              handleDraftChange(step, section, rowIdx, key, value)
            }
          />
          <div className="flex justify-end gap-2 mt-8 w-full max-w-3xl">
            <Button
              outline
              disabled={step === 0}
              onClick={() => setStep((s) => s - 1)}
            >
              Previous
            </Button>
            <Button color="primary-solid" onClick={handleNext}>
              {step === orderedDrafts.length - 1 ? 'Finish' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
