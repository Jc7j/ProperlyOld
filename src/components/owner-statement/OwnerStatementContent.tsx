import { FileDown, MoreHorizontal, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { exportSingleOwnerStatement } from '~/components/owner-statement/ExportOwnerStatement'
import MonthlyVendorImporter from '~/components/owner-statement/MonthlyVendorImporter'
import OwnerStatementReviewTable from '~/components/owner-statement/OwnerStatementReviewTable'
import VendorExcelImporter from '~/components/owner-statement/VendorExcelImporter'
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
  Heading,
} from '~/components/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { ErrorToast, SuccessToast } from '~/components/ui/sonner'
import { useToggle } from '~/lib/hooks/useToggle'
import dayjs from '~/lib/utils/day'
import { api } from '~/trpc/react'

interface OwnerStatementContentProps {
  statementId: string
  onClose: () => void
  onRefresh: () => void
}

// Transform raw statement data for the review table
function transformStatementData(statement: any) {
  if (!statement) return null

  const convertDecimal = (value: any): number => {
    if (value === null || value === undefined) return 0
    if (typeof value === 'object' && value.toString) {
      return Number(value.toString())
    }
    return typeof value === 'number' ? value : Number(value) || 0
  }

  return {
    id: statement.id,
    propertyId: statement.propertyId,
    propertyName: statement.property?.name || 'Unknown Property',
    statementMonth: statement.statementMonth,
    notes: statement.notes || '',
    incomes: (statement.incomes || []).map((income: any) => ({
      ...income,
      days:
        typeof income.days === 'number'
          ? income.days
          : Number(income.days || 0),
      grossRevenue: convertDecimal(income.grossRevenue),
      hostFee: convertDecimal(income.hostFee),
      platformFee: convertDecimal(income.platformFee),
      grossIncome: convertDecimal(income.grossIncome),
      checkIn: income.checkIn || '',
      checkOut: income.checkOut || '',
      platform: income.platform || '',
      guest: income.guest || '',
    })),
    expenses: (statement.expenses || []).map((expense: any) => ({
      ...expense,
      amount: convertDecimal(expense.amount),
      date: expense.date || '',
      description: expense.description || '',
      vendor: expense.vendor || '',
    })),
    adjustments: (statement.adjustments || []).map((adjustment: any) => ({
      ...adjustment,
      amount: convertDecimal(adjustment.amount),
      description: adjustment.description || '',
      checkIn: adjustment.checkIn || '',
      checkOut: adjustment.checkOut || '',
    })),
  }
}

export default function OwnerStatementContent({
  statementId,
  onClose,
  onRefresh,
}: OwnerStatementContentProps) {
  const [isDeleteDialogOpen, toggleDeleteDialog] = useToggle(false)

  // Fetch statement data
  const {
    data: statement,
    isLoading,
    refetch,
  } = api.ownerStatement.getOne.useQuery(
    { id: statementId },
    {
      enabled: !!statementId,
      refetchOnWindowFocus: false,
    }
  )

  const statementData = useMemo(
    () => transformStatementData(statement),
    [statement]
  )

  const deleteMutation = api.ownerStatement.delete.useMutation({
    onSuccess: () => {
      SuccessToast('Statement deleted successfully')
      onClose()
      onRefresh()
    },
    onError: (error) => {
      ErrorToast(`Failed to delete statement: ${error.message}`)
      toggleDeleteDialog()
    },
  })

  const handleDelete = () => {
    deleteMutation.mutate({ id: statementId })
  }

  const handleExportPdf = () => {
    if (!statementData) {
      ErrorToast('Statement data is not available for export.')
      return
    }
    exportSingleOwnerStatement(statementData)
  }



  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">Loading statement...</div>
      </div>
    )
  }

  if (!statement || !statementData) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-red-500">
          Statement not found or could not be loaded.
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-zinc-200 dark:border-zinc-800">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Heading level={2} className="text-base font-semibold">
                {statement.property?.name || 'Owner Statement'} -{' '}
                {dayjs(statement.statementMonth).format('MMMM YYYY')}
              </Heading>
            </div>
            <div className="flex gap-2">
              <MonthlyVendorImporter
                currentStatementId={statementId}
                onSuccess={() => {
                  void refetch()
                  onRefresh()
                }}
              />
              <VendorExcelImporter
                currentStatementId={statementId}
                onSuccess={() => {
                  void refetch()
                  onRefresh()
                }}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="text-xs py-1 h-7">
                    <MoreHorizontal className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={handleExportPdf}
                    disabled={!statementData || isLoading}
                  >
                    <FileDown className="w-4 h-4 mr-2" />
                    Export PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={toggleDeleteDialog}
                    disabled={deleteMutation.isPending}
                    className="text-red-600 dark:text-red-400"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Statement
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <OwnerStatementReviewTable
          statementDraft={statementData}
          readOnly={false}
          statementId={statement.id}
        />
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onClose={toggleDeleteDialog} size="sm">
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogBody>
          <p className="text-sm">
            Are you sure you want to delete this owner statement for{' '}
            {statement.property?.name}?
          </p>
          <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
            This action cannot be undone.
          </p>
        </DialogBody>
        <DialogActions>
          <Button
            variant="outline"
            onClick={toggleDeleteDialog}
            disabled={deleteMutation.isPending}
            className="text-xs py-1 h-7"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="text-xs py-1 h-7"
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete Statement'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}
