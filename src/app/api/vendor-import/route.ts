import { auth } from '@clerk/nextjs/server'
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { qstashClientPublish } from '~/lib/qstash/qstash'
import { tryCatch } from '~/lib/utils/try-catch'
import { db } from '~/server/db'

const inputSchema = z.object({
  currentStatementId: z.string(),
  vendor: z.string(),
  description: z.string(),
  pdfBase64: z.string(),
})

export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session?.orgId || !session?.userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const result = await tryCatch(
    (async () => {
      const body = await request.json()
      const input = inputSchema.parse(body)

      // Validate statement exists
      const statement = await db.ownerStatement.findUnique({
        where: { id: input.currentStatementId },
        select: {
          managementGroupId: true,
          property: { select: { name: true } },
        },
      })

      if (!statement || statement.managementGroupId !== session.orgId) {
        throw new Error('Statement not found')
      }

      // Create job ID
      const jobId = `vendor-${Date.now()}`

      // Queue with QStash
      await qstashClientPublish.publishJSON({
        url: `${process.env.NEXT_PUBLIC_QSTASH_URL}/api/vendor-import/process`,
        body: {
          ...input,
          orgId: session.orgId,
          userId: session.userId,
          jobId,
        },
        retries: 2,
      })

      return {
        jobId,
        message: `Processing vendor import for ${statement.property?.name}`,
      }
    })()
  )

  if (result.error) {
    console.error('Vendor import error:', result.error)

    if (result.error.message === 'Statement not found') {
      return new Response('Statement not found', { status: 404 })
    }

    if (result.error instanceof z.ZodError) {
      return new Response('Invalid request data', { status: 400 })
    }

    return new Response('Failed to queue job', { status: 500 })
  }

  return Response.json(result.data)
}
