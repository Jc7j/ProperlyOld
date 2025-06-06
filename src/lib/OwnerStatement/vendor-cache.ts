import { kv } from '~/lib/redis/kv'

// Cache TTL constants (in seconds)
const CACHE_TTL = {
  MONTH_STATEMENTS: 300, // 5 minutes
  PROPERTY_MAPPINGS: 600, // 10 minutes
  GPT_MAPPINGS: 3600, // 1 hour
  EXISTING_EXPENSES: 300, // 5 minutes
} as const

// Cache key generators
export const CacheKeys = {
  monthStatements: (orgId: string, month: string) =>
    `vendor_import:statements:${orgId}:${month}`,

  propertyMappings: (orgId: string, month: string) =>
    `vendor_import:properties:${orgId}:${month}`,

  gptMappings: (hash: string) => `vendor_import:gpt:${hash}`,

  existingExpenses: (
    orgId: string,
    month: string,
    vendor: string,
    description: string
  ) => `vendor_import:expenses:${orgId}:${month}:${vendor}:${description}`,
} as const

// Simple hash function for cache keys
export function hashPropertyList(propertyNames: string[]): string {
  const sortedNames = [...propertyNames].sort().join('|')
  let hash = 0
  for (let i = 0; i < sortedNames.length; i++) {
    const char = sortedNames.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return hash.toString(36)
}

// Vendor import specific cache operations
export const VendorCache = {
  // Cache month statements with property data
  async getMonthStatements(orgId: string, month: string) {
    const key = CacheKeys.monthStatements(orgId, month)
    return await kv.get<any[]>(key)
  },

  async setMonthStatements(orgId: string, month: string, statements: any[]) {
    const key = CacheKeys.monthStatements(orgId, month)
    await kv.set(key, statements, CACHE_TTL.MONTH_STATEMENTS)
  },

  // Cache property mappings for a month
  async getPropertyMappings(orgId: string, month: string) {
    const key = CacheKeys.propertyMappings(orgId, month)
    return await kv.get<
      Array<{
        id: string
        name: string
        address: string | null
        statementId: string
      }>
    >(key)
  },

  async setPropertyMappings(orgId: string, month: string, properties: any[]) {
    const key = CacheKeys.propertyMappings(orgId, month)
    await kv.set(key, properties, CACHE_TTL.PROPERTY_MAPPINGS)
  },

  // Cache GPT matching results
  async getGPTMappings(propertyNames: string[], dbProperties: any[]) {
    const hash =
      hashPropertyList(propertyNames) +
      '_' +
      hashPropertyList(dbProperties.map((p) => p.name))
    const key = CacheKeys.gptMappings(hash)
    return await kv.get<{
      matches: Record<
        string,
        { propertyId: string; confidence: number; reason?: string }
      >
      unmatched: string[]
    }>(key)
  },

  async setGPTMappings(
    propertyNames: string[],
    dbProperties: any[],
    result: any
  ) {
    const hash =
      hashPropertyList(propertyNames) +
      '_' +
      hashPropertyList(dbProperties.map((p) => p.name))
    const key = CacheKeys.gptMappings(hash)
    await kv.set(key, result, CACHE_TTL.GPT_MAPPINGS)
  },

  // Cache existing expense checks
  async getExistingExpenses(
    orgId: string,
    month: string,
    vendor: string,
    description: string
  ) {
    const key = CacheKeys.existingExpenses(orgId, month, vendor, description)
    return await kv.get<boolean>(key)
  },

  async setExistingExpenses(
    orgId: string,
    month: string,
    vendor: string,
    description: string,
    exists: boolean
  ) {
    const key = CacheKeys.existingExpenses(orgId, month, vendor, description)
    await kv.set(key, exists)
    await kv.redis.expire(`${kv.prefix}:${key}`, CACHE_TTL.EXISTING_EXPENSES)
  },

  // Clear cache for a specific month when data changes
  async invalidateMonth(orgId: string, month: string) {
    const keys = [
      CacheKeys.monthStatements(orgId, month),
      CacheKeys.propertyMappings(orgId, month),
    ]

    for (const key of keys) {
      await kv.del(key)
    }
  },
}
