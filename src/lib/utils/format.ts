interface FormatCurrencyOptions {
  locale?: string
  minimumFractionDigits?: number
  maximumFractionDigits?: number
  centsToDollars?: boolean
  noCurrencySymbol?: boolean
}

/**
 * Formats minutes into either minutes or hours with appropriate formatting
 * @param minutes - The number of minutes to format
 * @param options - Formatting options
 * @returns Formatted string (e.g., "90 minutes" or "1.5 hours")
 */
interface FormatMinutesOptions {
  displayInHours?: boolean
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}

export function formatMinutes(
  minutes: number,
  options: FormatMinutesOptions = {}
): string {
  const {
    displayInHours = false,
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
  } = options

  if (displayInHours) {
    const hours = minutes / 60
    return `${hours.toFixed(Math.min(Math.max(minimumFractionDigits, 0), maximumFractionDigits))}`
  }

  return `${Math.round(minutes)}`
}

/**
 * Formats a number as currency with the specified currency code and locale
 * @param amount - The amount to format (in the smallest currency unit, e.g., cents)
 * @param currency - The ISO 4217 currency code (e.g., 'USD', 'EUR')
 * @param options - Additional formatting options
 * @returns Formatted currency string (e.g., "$10.00", "€10.00")
 */
export function formatCurrency(
  amount: number,
  currency = 'USD',
  options: FormatCurrencyOptions = {}
): string {
  const {
    locale = 'en',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    centsToDollars = true,
    noCurrencySymbol = false,
  } = options

  const value = centsToDollars ? amount / 100 : amount

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(value)
  } catch (error) {
    console.error(`Error formatting currency: ${currency}`, error)
    return `${noCurrencySymbol ? '' : `$${currency.toUpperCase()} `}${value.toFixed(minimumFractionDigits)}`
  }
}

/**
 * Formats a phone number string into a standardized format.
 * If the number includes a country code, it will be preserved.
 * Area codes (if present) will be wrapped in parentheses.
 *
 * @example
 * // Returns "(555) 123-4567"
 * formatPhone("5551234567")
 *
 * // Returns "123-4567"
 * formatPhone("1234567")
 *
 * // Returns "+1 (555) 123-4567"
 * formatPhone("+15551234567")
 *
 * @param phone - The phone number to format
 * @returns The formatted phone number string
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return ''

  // Remove all non-numeric characters except + for country code
  const cleaned = phone.replace(/[^\d+]/g, '')

  // Check if there's a country code (starts with +)
  const hasCountryCode = cleaned.startsWith('+')

  // Extract country code if present
  const countryCode = hasCountryCode
    ? cleaned.slice(0, cleaned.indexOf('') + 1)
    : ''
  const number = hasCountryCode
    ? cleaned.slice(cleaned.indexOf('') + 1)
    : cleaned

  // Format based on length
  if (number.length <= 7) {
    // Local number without area code: 123-4567
    return number.replace(/(\d{3})(\d{4})/, '$1-$2')
  } else {
    // Number with area code: (555) 123-4567
    const areaCode = number.slice(0, 3)
    const prefix = number.slice(3, 6)
    const lineNumber = number.slice(6, 10)

    const formattedNumber = `(${areaCode}) ${prefix}-${lineNumber}`
    return hasCountryCode
      ? `${countryCode} ${formattedNumber}`
      : formattedNumber
  }
}

/**
 * Formats a location object into a human-readable address string.
 *
 * @example
 * // Returns "123 Main St, Suite 100, San Francisco, CA 94105, USA"
 * formatAddress({
 *   address_line1: "123 Main St",
 *   address_line2: "Suite 100",
 *   city: "San Francisco",
 *   state: "CA",
 *   postal_code: "94105",
 *   country: "USA"
 * })
 *
 * // Returns "123 Main St, San Francisco, CA 94105"
 * formatAddress({
 *   address_line1: "123 Main St",
 *   city: "San Francisco",
 *   state: "CA",
 *   postal_code: "94105"
 * })
 */
export function formatAddress(location: {
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
}): string {
  if (!location) return ''

  const parts = [
    location.address_line1,
    location.address_line2,
    location.city,
    location.state,
    location.postal_code,
    location.country,
  ].filter(Boolean)

  return parts.join(', ')
}
