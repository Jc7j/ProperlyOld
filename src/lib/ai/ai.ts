import { openai } from '@ai-sdk/openai'
import { generateObject, generateText } from 'ai'
import { z } from 'zod'

export const model = openai('gpt-4o')

// General function for generating structured objects
export async function generateStructuredObject<T>({
  schema,
  prompt,
  messages,
}: {
  schema: any
  prompt?: string
  messages?: any[]
}): Promise<{ object: T }> {
  return generateObject({
    model,
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
  const prompt = `You are a property matching specialist for a property management system.

Your task is to match property names/addresses from import data to existing properties in the database.

DATABASE PROPERTIES:
${databaseProperties
  .map(
    (p) =>
      `ID: ${p.id} | Name: "${p.name}"${p.address ? ` | Address: "${p.address}"` : ''}`
  )
  .join('\n')}

IMPORT PROPERTIES TO MATCH:
${importProperties.map((prop, i) => `${i + 1}. "${prop}"`).join('\n')}

MATCHING RULES:
1. Match on property name OR address similarity
2. Handle variations: abbreviations (St/Street, Ave/Avenue, Apt/Unit), spacing, punctuation
3. Consider partial matches (e.g., "123 Main St" matches "123 Main Street Apt 2")
4. Unit numbers should match when possible but property without unit can match property with unit
5. Confidence score: 0.9+ = very confident, 0.7-0.89 = confident, 0.5-0.69 = uncertain, <0.5 = don't match

Return matches with confidence scores. Only include matches with confidence >= 0.5.
For unmatched properties, add them to the unmatched array.

IMPORTANT: Always return both "matches" and "unmatched" fields:
- If no properties match, return: {"matches": {}, "unmatched": ["prop1", "prop2"]}
- If some properties match, return: {"matches": {"prop1": {"propertyId": "id", "confidence": 0.8}}, "unmatched": ["prop2"]}

Be conservative - it's better to leave something unmatched than to make an incorrect match.`

  const result = await generateStructuredObject<PropertyMatchResult>({
    schema: propertyMatchSchema,
    prompt,
  })

  return result.object
}

// Export model for direct use if needed
export { model as aiModel }
