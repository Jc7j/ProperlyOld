import { addDays, endOfDay, startOfDay } from 'date-fns'
import {
  type ExtendedColumnFilter,
  type JoinOperator,
} from '~/components/table/types'

type WhereCondition = {
  sql: string
  args: unknown[]
}

type Table = Record<string, unknown>

/**
 * Builds SQL conditions for PowerSync based on the provided filters
 */
export function filterColumns<T extends Table>({
  filters,
  joinOperator,
}: {
  filters: ExtendedColumnFilter<T>[]
  joinOperator: JoinOperator
}): { sql: string; args: unknown[] } | undefined {
  if (!filters.length) return undefined

  const conditions: WhereCondition[] = []

  filters.forEach((filter) => {
    const columnName = filter.id as string

    // Skip invalid filters
    if (!columnName || !filter.operator) return

    let condition: WhereCondition | undefined

    switch (filter.operator) {
      case 'iLike':
        if (filter.variant === 'text' && typeof filter.value === 'string') {
          condition = {
            sql: `${columnName} LIKE ?`,
            args: [`%${filter.value}%`],
          }
        }
        break

      case 'notILike':
        if (filter.variant === 'text' && typeof filter.value === 'string') {
          condition = {
            sql: `${columnName} NOT LIKE ?`,
            args: [`%${filter.value}%`],
          }
        }
        break

      case 'eq':
        if (filter.variant === 'boolean' && typeof filter.value === 'string') {
          condition = {
            sql: `${columnName} = ?`,
            args: [filter.value === 'true'],
          }
        } else if (
          filter.variant === 'date' ||
          filter.variant === 'dateRange'
        ) {
          const date = new Date(Number(filter.value))
          date.setHours(0, 0, 0, 0)
          const end = new Date(date)
          end.setHours(23, 59, 59, 999)
          condition = {
            sql: `${columnName} >= ? AND ${columnName} <= ?`,
            args: [date.toISOString(), end.toISOString()],
          }
        } else {
          condition = {
            sql: `${columnName} = ?`,
            args: [filter.value],
          }
        }
        break

      case 'ne':
        if (filter.variant === 'boolean' && typeof filter.value === 'string') {
          condition = {
            sql: `${columnName} != ?`,
            args: [filter.value === 'true'],
          }
        } else if (
          filter.variant === 'date' ||
          filter.variant === 'dateRange'
        ) {
          const date = new Date(Number(filter.value))
          date.setHours(0, 0, 0, 0)
          const end = new Date(date)
          end.setHours(23, 59, 59, 999)
          condition = {
            sql: `${columnName} < ? OR ${columnName} > ?`,
            args: [date.toISOString(), end.toISOString()],
          }
        } else {
          condition = {
            sql: `${columnName} != ?`,
            args: [filter.value],
          }
        }
        break

      case 'inArray':
        if (Array.isArray(filter.value) && filter.value.length > 0) {
          const placeholders = filter.value.map(() => '?').join(', ')
          condition = {
            sql: `${columnName} IN (${placeholders})`,
            args: filter.value,
          }
        }
        break

      case 'notInArray':
        if (Array.isArray(filter.value) && filter.value.length > 0) {
          const placeholders = filter.value.map(() => '?').join(', ')
          condition = {
            sql: `${columnName} NOT IN (${placeholders})`,
            args: filter.value,
          }
        }
        break

      case 'lt':
        if (filter.variant === 'number' || filter.variant === 'range') {
          condition = {
            sql: `${columnName} < ?`,
            args: [filter.value],
          }
        } else if (
          filter.variant === 'date' &&
          typeof filter.value === 'string'
        ) {
          const date = new Date(Number(filter.value))
          date.setHours(23, 59, 59, 999)
          condition = {
            sql: `${columnName} < ?`,
            args: [date.toISOString()],
          }
        }
        break

      case 'lte':
        if (filter.variant === 'number' || filter.variant === 'range') {
          condition = {
            sql: `${columnName} <= ?`,
            args: [filter.value],
          }
        } else if (
          filter.variant === 'date' &&
          typeof filter.value === 'string'
        ) {
          const date = new Date(Number(filter.value))
          date.setHours(23, 59, 59, 999)
          condition = {
            sql: `${columnName} <= ?`,
            args: [date.toISOString()],
          }
        }
        break

      case 'gt':
        if (filter.variant === 'number' || filter.variant === 'range') {
          condition = {
            sql: `${columnName} > ?`,
            args: [filter.value],
          }
        } else if (
          filter.variant === 'date' &&
          typeof filter.value === 'string'
        ) {
          const date = new Date(Number(filter.value))
          date.setHours(0, 0, 0, 0)
          condition = {
            sql: `${columnName} > ?`,
            args: [date.toISOString()],
          }
        }
        break

      case 'gte':
        if (filter.variant === 'number' || filter.variant === 'range') {
          condition = {
            sql: `${columnName} >= ?`,
            args: [filter.value],
          }
        } else if (
          filter.variant === 'date' &&
          typeof filter.value === 'string'
        ) {
          const date = new Date(Number(filter.value))
          date.setHours(0, 0, 0, 0)
          condition = {
            sql: `${columnName} >= ?`,
            args: [date.toISOString()],
          }
        }
        break

      case 'isBetween':
        if (
          (filter.variant === 'date' || filter.variant === 'dateRange') &&
          Array.isArray(filter.value) &&
          filter.value.length === 2
        ) {
          const dateConditions = []
          const dateArgs = []

          if (filter.value[0]) {
            const startDate = new Date(Number(filter.value[0]))
            startDate.setHours(0, 0, 0, 0)
            dateConditions.push(`${columnName} >= ?`)
            dateArgs.push(startDate.toISOString())
          }

          if (filter.value[1]) {
            const endDate = new Date(Number(filter.value[1]))
            endDate.setHours(23, 59, 59, 999)
            dateConditions.push(`${columnName} <= ?`)
            dateArgs.push(endDate.toISOString())
          }

          if (dateConditions.length > 0) {
            condition = {
              sql: dateConditions.join(' AND '),
              args: dateArgs,
            }
          }
        } else if (
          (filter.variant === 'number' || filter.variant === 'range') &&
          Array.isArray(filter.value) &&
          filter.value.length === 2
        ) {
          const firstValue =
            filter.value[0] && filter.value[0].trim() !== ''
              ? Number(filter.value[0])
              : null
          const secondValue =
            filter.value[1] && filter.value[1].trim() !== ''
              ? Number(filter.value[1])
              : null

          if (firstValue === null && secondValue === null) {
            // Skip this filter
          } else if (firstValue !== null && secondValue === null) {
            condition = {
              sql: `${columnName} = ?`,
              args: [firstValue],
            }
          } else if (firstValue === null && secondValue !== null) {
            condition = {
              sql: `${columnName} = ?`,
              args: [secondValue],
            }
          } else {
            condition = {
              sql: `${columnName} >= ? AND ${columnName} <= ?`,
              args: [firstValue, secondValue],
            }
          }
        }
        break

      case 'isRelativeToToday':
        if (
          (filter.variant === 'date' || filter.variant === 'dateRange') &&
          typeof filter.value === 'string'
        ) {
          const today = new Date()
          const [amount, unit] = filter.value.split(' ') ?? []
          let startDate: Date
          let endDate: Date

          if (!amount || !unit) break

          switch (unit) {
            case 'days':
              startDate = startOfDay(addDays(today, Number.parseInt(amount)))
              endDate = endOfDay(startDate)
              break
            case 'weeks':
              startDate = startOfDay(
                addDays(today, Number.parseInt(amount) * 7)
              )
              endDate = endOfDay(addDays(startDate, 6))
              break
            case 'months':
              startDate = startOfDay(
                addDays(today, Number.parseInt(amount) * 30)
              )
              endDate = endOfDay(addDays(startDate, 29))
              break
            default:
              return undefined
          }

          condition = {
            sql: `${columnName} >= ? AND ${columnName} <= ?`,
            args: [startDate.toISOString(), endDate.toISOString()],
          }
        }
        break

      case 'isEmpty':
        condition = {
          sql: `${columnName} IS NULL`,
          args: [],
        }
        break

      case 'isNotEmpty':
        condition = {
          sql: `${columnName} IS NOT NULL`,
          args: [],
        }
        break

      default:
        // Unsupported operator
        break
    }

    if (condition) {
      conditions.push(condition)
    }
  })

  // No valid conditions to filter on
  if (conditions.length === 0) {
    return undefined
  }

  // Combine all conditions with the specified join operator
  const joinStr = joinOperator === 'and' ? ' AND ' : ' OR '

  // Build the complete WHERE clause
  const finalSql = conditions.map((c) => `(${c.sql})`).join(joinStr)
  const finalArgs = conditions.flatMap((c) => c.args)

  return {
    sql: finalSql,
    args: finalArgs,
  }
}

/**
 * Helper function to get the column name for a given table and key
 */
export function getColumnName<T extends Table>(
  table: T,
  columnKey: keyof T
): string {
  return columnKey as string
}
