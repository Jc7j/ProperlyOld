'use client'

import { ArrowLeft, Save } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button, Card, Heading } from '~/components/ui'
import { ErrorToast, SuccessToast } from '~/components/ui/sonner'
import dayjs from '~/lib/utils/day'
import { api } from '~/trpc/react'

import OwnerStatementReviewTable from '../OwnerStatementReviewTable'

export default function OwnerStatementDetailPage() {
  const params = useParams()
  const router = useRouter()
  const statementId = params.statementId as string
  const [statementData, setStatementData] = useState<any>(null)
  const [originalData, setOriginalData] = useState<any>(null)
  const [changedSections, setChangedSections] = useState<{
    incomes: boolean
    expenses: boolean
    adjustments: boolean
    notes: boolean
  }>({
    incomes: false,
    expenses: false,
    adjustments: false,
    notes: false,
  })

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

  // Update mutation
  const updateMutation = api.ownerStatement.update.useMutation({
    onSuccess: (data) => {
      SuccessToast('Statement updated successfully')
      setChangedSections({
        incomes: false,
        expenses: false,
        adjustments: false,
        notes: false,
      })

      // Update the local state with the updated data from the server
      const formattedData = formatStatementForEdit(data)
      setStatementData(formattedData)
      setOriginalData(JSON.parse(JSON.stringify(formattedData)))

      // Refresh the data from server
      void refetch()
    },
    onError: (error) => {
      ErrorToast(
        `Failed to update statement: ${error.message || 'Unknown error'}`
      )
    },
  })

  // Format statement data for editing
  const formatStatementForEdit = (data: any) => {
    if (!data) return null

    // Convert Prisma Decimal values to JS numbers to ensure compatibility
    const convertDecimalToNumber = (value: any) => {
      if (value === null || value === undefined) return 0
      // For Prisma Decimal fields that might come as strings or objects
      return typeof value === 'object' && value.toString
        ? Number(value.toString())
        : typeof value === 'string'
          ? Number(value)
          : value
    }

    // Process incomes array
    const processedIncomes = (data.incomes || []).map((income: any) => ({
      ...income,
      // Ensure all numeric fields are proper JS numbers
      days:
        typeof income.days === 'number'
          ? income.days
          : Number(income.days || 0),
      grossRevenue: convertDecimalToNumber(income.grossRevenue),
      hostFee: convertDecimalToNumber(income.hostFee),
      platformFee: convertDecimalToNumber(income.platformFee),
      grossIncome: convertDecimalToNumber(income.grossIncome),
      // Ensure string fields have default values
      checkIn: income.checkIn || '',
      checkOut: income.checkOut || '',
      platform: income.platform || '',
      guest: income.guest || '',
    }))

    // Process expenses array
    const processedExpenses = (data.expenses || []).map((expense: any) => ({
      ...expense,
      amount: convertDecimalToNumber(expense.amount),
      date: expense.date || '',
      description: expense.description || '',
      vendor: expense.vendor || '',
    }))

    // Process adjustments array
    const processedAdjustments = (data.adjustments || []).map(
      (adjustment: any) => ({
        ...adjustment,
        amount: convertDecimalToNumber(adjustment.amount),
        description: adjustment.description || '',
        checkIn: adjustment.checkIn || '',
        checkOut: adjustment.checkOut || '',
      })
    )

    return {
      propertyId: data.propertyId,
      propertyName: data.property?.name || 'Unknown Property',
      statementMonth: data.statementMonth,
      incomes: processedIncomes,
      expenses: processedExpenses,
      adjustments: processedAdjustments,
      notes: data.notes || '',
      // Calculate grand total if not present
      grandTotal: data.grandTotal
        ? convertDecimalToNumber(data.grandTotal)
        : processedIncomes.reduce(
            (sum: number, i: any) => sum + (i.grossIncome || 0),
            0
          ) -
          processedExpenses.reduce(
            (sum: number, e: any) => sum + (e.amount || 0),
            0
          ) +
          processedAdjustments.reduce(
            (sum: number, a: any) => sum + (a.amount || 0),
            0
          ),
    }
  }

  useEffect(() => {
    if (statement) {
      const formattedData = formatStatementForEdit(statement)
      setStatementData(formattedData)
      setOriginalData(JSON.parse(JSON.stringify(formattedData)))
    }
  }, [statement])

  // Check for changesin specific sections
  useEffect(() => {
    if (!statementData || !originalData) return

    // Compare each section with its original data
    const incomesChanged =
      JSON.stringify(statementData.incomes) !==
      JSON.stringify(originalData.incomes)
    const expensesChanged =
      JSON.stringify(statementData.expenses) !==
      JSON.stringify(originalData.expenses)
    const adjustmentsChanged =
      JSON.stringify(statementData.adjustments) !==
      JSON.stringify(originalData.adjustments)
    const notesChanged = statementData.notes !== originalData.notes

    setChangedSections({
      incomes: incomesChanged,
      expenses: expensesChanged,
      adjustments: adjustmentsChanged,
      notes: notesChanged,
    })
  }, [statementData, originalData])

  // Handle changes to the statement data
  function handleStatementChange(
    section: string,
    rowIdx: number,
    key: string,
    value: any
  ) {
    setStatementData((prevData: any) => {
      if (!prevData) return prevData

      const newData = { ...prevData }

      if (section === 'notes') {
        newData.notes = value
      } else if (key === '__delete') {
        const arr = [...prevData[section]]
        arr.splice(rowIdx, 1)
        newData[section] = arr
      } else if (key === '__add') {
        newData[section] = [...prevData[section], value]
      } else {
        const arr = [...prevData[section]]
        arr[rowIdx] = { ...arr[rowIdx], [key]: value }
        newData[section] = arr
      }

      // Recalculate totals
      const totalIncome = newData.incomes.reduce((sum: number, i: any) => {
        const income = Number(i.grossIncome) || 0
        return parseFloat((sum + income).toFixed(2))
      }, 0)

      const totalExpenses = newData.expenses.reduce((sum: number, e: any) => {
        const expense = Number(e.amount) || 0
        return parseFloat((sum + expense).toFixed(2))
      }, 0)

      const totalAdjustments = newData.adjustments.reduce(
        (sum: number, a: any) => {
          const adjustment = Number(a.amount) || 0
          return parseFloat((sum + adjustment).toFixed(2))
        },
        0
      )

      newData.grandTotal = parseFloat(
        (totalIncome - totalExpenses + totalAdjustments).toFixed(2)
      )

      return newData
    })
  }

  function handleSaveSection() {
    if (!statementData) return

    // Process data for submission (always process everything consistently)
    const processedIncomes = statementData.incomes.map((income: any) => ({
      checkIn: income.checkIn || '',
      checkOut: income.checkOut || '',
      days: Number(income.days) || 0,
      platform: income.platform || '',
      guest: income.guest || '',
      grossRevenue: Number(income.grossRevenue) || 0,
      hostFee: Number(income.hostFee) || 0,
      platformFee: Number(income.platformFee) || 0,
      grossIncome: Number(income.grossIncome) || 0,
    }))

    const processedExpenses = statementData.expenses.map((expense: any) => ({
      date: expense.date || '',
      description: expense.description || '',
      vendor: expense.vendor || '',
      amount: Number(expense.amount) || 0,
    }))

    const processedAdjustments = statementData.adjustments.map(
      (adjustment: any) => ({
        checkIn: adjustment.checkIn || '',
        checkOut: adjustment.checkOut || '',
        description: adjustment.description || '',
        amount: Number(adjustment.amount) || 0,
      })
    )

    // Calculate summary totals with precise handling of floating point numbers
    const totalIncome = processedIncomes.reduce((sum: number, i: any) => {
      const income = Number(i.grossIncome) || 0
      // Use toFixed and parseFloat to handle floating point precision issues
      return parseFloat((sum + income).toFixed(2))
    }, 0)

    const totalExpenses = processedExpenses.reduce((sum: number, e: any) => {
      const expense = Number(e.amount) || 0
      return parseFloat((sum + expense).toFixed(2))
    }, 0)

    const totalAdjustments = processedAdjustments.reduce(
      (sum: number, a: any) => {
        const adjustment = Number(a.amount) || 0
        return parseFloat((sum + adjustment).toFixed(2))
      },
      0
    )

    // Calculate grand total with proper precision handling
    const grandTotal = parseFloat(
      (totalIncome - totalExpenses + totalAdjustments).toFixed(2)
    )

    updateMutation.mutate({
      id: statementId,
      notes: statementData.notes || '',
      incomes: processedIncomes,
      expenses: processedExpenses,
      adjustments: processedAdjustments,
      totalIncome,
      totalExpenses,
      totalAdjustments,
      grandTotal,
    })
  }

  // Navigate back to owner statements list
  const handleBackClick = () => {
    router.push('/dashboard/owner-statements')
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center mb-6">
          <Button outline onClick={handleBackClick}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        </div>
        <Card className="p-6">
          <div className="text-center py-8">Loading statement data...</div>
        </Card>
      </div>
    )
  }

  if (!statement || !statementData) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center mb-6">
          <Button outline onClick={handleBackClick}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        </div>
        <Card className="p-6">
          <div className="text-center py-8 text-red-500">
            Statement not found or could not be loaded.
          </div>
        </Card>
      </div>
    )
  }

  // Check if any section has changes
  const hasAnyChanges = Object.values(changedSections).some(
    (changed) => changed
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div className="flex items-center">
          <Button outline onClick={handleBackClick} className="mr-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <Heading level={1}>
            {statement.property?.name || 'Owner Statement'} -{' '}
            {dayjs(statement.statementMonth).format('MMMM YYYY')}
          </Heading>
        </div>
        <div className="flex gap-2">
          <Button
            color="primary-solid"
            onClick={handleSaveSection}
            disabled={!hasAnyChanges || updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              'Saving...'
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" /> Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <OwnerStatementReviewTable
        statementDraft={statementData}
        onChange={handleStatementChange}
        readOnly={false}
      />

      {/* Status Message */}
      {hasAnyChanges && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-md">
          You have unsaved changes. Click the save button to update the
          statement.
        </div>
      )}
    </div>
  )
}
