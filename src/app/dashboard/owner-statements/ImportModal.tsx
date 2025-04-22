import React, { useRef } from 'react'
import ReactDatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
} from '~/components/ui'

export default function ImportModal({
  open,
  onClose,
  onNext,
  loading,
  error,
  parsedData,
  selectedFile,
  setSelectedFile,
  setError,
  month,
  setMonth,
}: {
  open: boolean
  onClose: () => void
  onNext: () => void
  loading: boolean
  error: string | null
  parsedData: any
  selectedFile: File | null
  setSelectedFile: (f: File | null) => void
  setError: (e: string | null) => void
  month: Date | null
  setMonth: (d: Date | null) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Drag and drop handlers
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      if (!file) return
      if (
        file.type ===
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.name.endsWith('.xlsx')
      ) {
        setSelectedFile(file)
        setError(null)
      } else {
        setError('Please upload a valid .xlsx file.')
      }
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Import Hostaway data (.xlsx)</DialogTitle>
      <DialogBody>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">
            Statement Month
          </label>
          <ReactDatePicker
            selected={month}
            onChange={setMonth}
            dateFormat="MMMM yyyy"
            showMonthYearPicker
            placeholderText="Select a month"
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
            wrapperClassName="w-full"
          />
        </div>
        <div
          className="border-2 border-dashed border-zinc-300 rounded-lg p-6 text-center cursor-pointer hover:bg-zinc-50"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setSelectedFile(file)
              setError(null)
            }}
          />
          <div className="text-zinc-500 mb-2">
            Drag and drop your Excel (.xlsx) file here, or click to select
          </div>
          {selectedFile && (
            <div className="text-zinc-700">{selectedFile.name}</div>
          )}
        </div>
        {loading && <div className="mt-4 text-blue-600">Parsing file...</div>}
        {error && <div className="mt-4 text-red-600">{error}</div>}
        {parsedData && !loading && (
          <div className="mt-4 text-green-700">
            File parsed! Ready for review. ({parsedData.length} rows)
          </div>
        )}
      </DialogBody>
      <DialogActions>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="default"
          disabled={!parsedData || !month || loading}
          onClick={onNext}
        >
          Next
        </Button>
      </DialogActions>
    </Dialog>
  )
}
