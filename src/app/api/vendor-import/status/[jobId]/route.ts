import { auth } from '@clerk/nextjs/server'
import { type NextRequest } from 'next/server'
import { tryCatch } from '~/lib/utils/try-catch'

// Import job results from processor
import { jobResults } from '../../process/route'

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const session = await auth()

  if (!session?.orgId || !session?.userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const result = await tryCatch(
    (async () => {
      const { jobId } = params
      const jobResult = jobResults.get(jobId)

      if (!jobResult) {
        // Job might still be processing or not found
        return {
          status: 'processing' as const,
          message: 'Job is being processed...',
        }
      }

      // Clean up completed/failed jobs after returning result
      if (jobResult.status !== 'processing') {
        setTimeout(() => jobResults.delete(jobId), 5000)
      }

      return jobResult
    })()
  )

  if (result.error) {
    console.error('Status check error:', result.error)
    return new Response('Failed to check job status', { status: 500 })
  }

  return Response.json(result.data)
}
