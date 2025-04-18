/**
// Basic usage (same as before)
const policies = parseJsonField<Policies>(facility.policies)

// With validation and logging
const policies = parseJsonField<Policies>(facility.policies, {
  logErrors: true,
  validate: (value): value is Policies => {
    return isPlainObject(value) && 'cancellation' in value
  }
})

// With custom default value
const policies = parseJsonField<Policies>(facility.policies, {
  defaultValue: { cancellation: 'default' }
})
*/

/**
 * Options for parsing JSON fields
 */
interface ParseJsonOptions<T> {
  /** Default value to return if parsing fails */
  defaultValue?: T | null
  /** Validate the parsed result matches expected shape */
  validate?: (value: unknown) => value is T
  /** Whether to log parsing errors */
  logErrors?: boolean
}

/**
 * Safely parses a JSON field with type checking and validation
 * @param field - The field to parse, can be a string, the target type, or null
 * @param options - Optional configuration for parsing behavior
 * @returns The parsed value of type T, or null/defaultValue if parsing fails
 */
export function parseJsonField<T>(
  field: string | T | null | undefined,
  options: ParseJsonOptions<T> = {}
): T | null {
  const { defaultValue = null, validate, logErrors = false } = options

  // Handle undefined case
  if (field === undefined) return defaultValue

  // Handle null case
  if (field === null) return defaultValue

  // If it's not a string, validate and return as is
  if (typeof field !== 'string') {
    if (validate && !validate(field)) {
      if (logErrors) {
        console.warn(
          '[parseJsonField] Value does not match expected type:',
          field
        )
      }
      return defaultValue
    }
    return field as T
  }

  // Handle empty string
  if (field.trim() === '') return defaultValue

  try {
    const parsed = JSON.parse(field)

    // Validate parsed result if validator provided
    if (validate && !validate(parsed)) {
      if (logErrors) {
        console.warn(
          '[parseJsonField] Parsed value does not match expected type:',
          parsed
        )
      }
      return defaultValue
    }

    return parsed as T
  } catch (error) {
    if (logErrors) {
      console.warn('[parseJsonField] Failed to parse JSON:', { error, field })
    }
    return defaultValue
  }
}

/**
 * Usage examples:
 *
 * // Basic usage - object to JSON string
 * const preferences = { color: '#6366F1' }
 * const jsonStr = stringifyField(preferences)
 * // Result: '{"color":"#6366F1"}'
 *
 * // With validation of existing JSON string
 * const existingJson = '{"color":"#6366F1"}'
 * const validated = stringifyField(existingJson)
 * // Result: '{"color":"#6366F1"}' (returns as is if valid JSON)
 *
 * // With error logging
 * const invalidObj = { circular: {} }
 * invalidObj.circular = invalidObj
 * const result = stringifyField(invalidObj, { logErrors: true })
 * // Result: null (and logs warning about circular reference)
 *
 * // Handling null/undefined
 * const nullValue = stringifyField(null)
 * // Result: null
 *
 * // Non-JSON string becomes JSON string
 * const textValue = stringifyField('hello')
 * // Result: '"hello"'
 */

/**
 * Options for stringifying fields
 */
interface StringifyOptions {
  /** Whether to log stringification errors */
  logErrors?: boolean
}

/**
 * Safely stringifies a field to JSON format
 * If the input is already a string, validates it's JSON format before returning
 * @param field - The field to stringify
 * @param options - Optional configuration for stringification behavior
 * @returns The stringified value, or null if stringification fails
 */
export function stringifyField<T>(
  field: T | string | null | undefined,
  options: StringifyOptions = {}
): string | null {
  const { logErrors = false } = options

  // Handle undefined/null case
  if (field === undefined || field === null) {
    return null
  }

  // If it's already a string, validate it's JSON format
  if (typeof field === 'string') {
    try {
      // Try parsing to validate JSON format
      JSON.parse(field)
      return field
    } catch {
      // If it's not valid JSON, treat it as a regular value to stringify
      try {
        return JSON.stringify(field)
      } catch (error) {
        if (logErrors) {
          console.warn('[stringifyField] Failed to stringify string value:', {
            error,
            field,
          })
        }
        return null
      }
    }
  }

  // Handle non-string values
  try {
    return JSON.stringify(field)
  } catch (error) {
    if (logErrors) {
      console.warn('[stringifyField] Failed to stringify value:', {
        error,
        field,
      })
    }
    return null
  }
}
