import { redis } from './redis'

const PREFIX = process.env.NODE_ENV === 'production' ? 'prod' : 'dev'

export const kv = {
  redis, // Expose redis instance for advanced operations
  prefix: PREFIX, // Expose prefix for manual key construction

  async get<T = unknown>(key: string): Promise<T | null> {
    const prefixedKey = `${PREFIX}:${key}`
    const value = await redis.get(prefixedKey)
    return value as T | null
  },

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const prefixedKey = `${PREFIX}:${key}`
    if (ttlSeconds) {
      await redis.setex(prefixedKey, ttlSeconds, JSON.stringify(value))
    } else {
      await redis.set(prefixedKey, JSON.stringify(value))
    }
  },

  async del(key: string): Promise<void> {
    const prefixedKey = `${PREFIX}:${key}`
    await redis.del(prefixedKey)
  },

  async expire(key: string, ttlSeconds: number): Promise<void> {
    const prefixedKey = `${PREFIX}:${key}`
    await redis.expire(prefixedKey, ttlSeconds)
  },

  async exists(key: string): Promise<boolean> {
    const prefixedKey = `${PREFIX}:${key}`
    const result = await redis.exists(prefixedKey)
    return result === 1
  },
}
