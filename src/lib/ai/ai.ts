import { openai } from '@ai-sdk/openai'
import { generateObject, generateText } from 'ai'
import { z } from 'zod'

export const model = openai('gpt-4o')

// General function for generating structured objects
export async function generateStructuredObject<T>({
  schema,
  prompt,
  messages,
  temperature = 0.1, // Low temperature for consistent structured responses
}: {
  schema: any
  prompt?: string
  messages?: any[]
  temperature?: number
}): Promise<{ object: T }> {
  return generateObject({
    model,
    temperature,
    schema,
    ...(prompt ? { prompt } : {}),
    ...(messages ? { messages } : {}),
  }) as Promise<{ object: T }>
}

// General function for generating text
export async function generateAIText({
  prompt,
  messages,
}: {
  prompt?: string
  messages?: any[]
}) {
  return generateText({
    model,
    ...(prompt ? { prompt } : {}),
    ...(messages ? { messages } : {}),
  })
}

// Property matching schema for structured response
const propertyMatchSchema = z.object({
  matches: z
    .record(
      z.string(),
      z.object({
        propertyId: z.string(),
        confidence: z.number().min(0).max(1),
        reason: z.string().optional(),
      })
    )
    .default({}),
  unmatched: z.array(z.string()).default([]),
})

export type PropertyMatchResult = z.infer<typeof propertyMatchSchema>

// Property matching function for vendor imports
export async function matchPropertiesWithGPT({
  importProperties,
  databaseProperties,
}: {
  importProperties: string[]
  databaseProperties: Array<{
    id: string
    name: string
    address?: string | null
  }>
}): Promise<PropertyMatchResult> {
  const exactMatches: Record<string, any> = {}
  const remainingProperties: string[] = []

  for (const importProp of importProperties) {
    const exactMatch = databaseProperties.find(
      (dbProp) =>
        dbProp.name.trim().toLowerCase() === importProp.trim().toLowerCase()
    )

    if (exactMatch) {
      exactMatches[importProp] = {
        propertyId: exactMatch.id,
        confidence: 1.0,
        reason: 'exact match',
      }
    } else {
      remainingProperties.push(importProp)
    }
  }

  if (remainingProperties.length === 0) {
    return {
      matches: exactMatches,
      unmatched: [],
    }
  }

  const prompt = `Match property names from import data to database properties.

DATABASE PROPERTIES:
${databaseProperties.map((p) => `"${p.name}" (ID: ${p.id})`).join('\n')}

IMPORT PROPERTIES:
${remainingProperties.map((prop) => `"${prop}"`).join('\n')}

MATCHING RULES:
1. Exact matches get confidence 1.0
2. Very similar matches (minor differences) get confidence 0.8-0.9  
3. Partial matches get confidence 0.5-0.7
4. Only return matches with confidence ≥ 0.5

Return JSON format:
{
  "matches": {
    "importPropertyName": {
      "propertyId": "database-property-id",
      "confidence": 0.95,
      "reason": "exact match"
    }
  },
  "unmatched": ["unmatched-property-name"]
}`

  try {
    const result = await generateStructuredObject<PropertyMatchResult>({
      schema: propertyMatchSchema,
      prompt,
      temperature: 0.3, // Slightly higher temperature for better reasoning
    })

    // Combine exact matches with GPT matches
    const combinedMatches = {
      ...exactMatches,
      ...result.object.matches,
    }

    const finalResult = {
      matches: combinedMatches,
      unmatched: result.object.unmatched,
    }

    return finalResult
  } catch (error) {
    console.error('❌ GPT matching failed:', error)
    return {
      matches: exactMatches,
      unmatched: remainingProperties,
    }
  }
}

// Export model for direct use if needed
export { model as aiModel }
