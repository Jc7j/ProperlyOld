import { useCallback, useRef, useState } from 'react'

interface ProgressEvent {
  step: string
  message: string
  progress?: number
}

interface CompleteEvent {
  message: string
  updatedCount: number
  updatedProperties: string[]
}

interface ErrorEvent {
  message: string
}

interface BulkProcessState {
  isProcessing: boolean
  progress: ProgressEvent | null
  error: string | null
  result: CompleteEvent | null
}

interface BulkProcessInput {
  currentStatementId: string
  vendor: string
  description: string
  pdfBase64: string
}

export function useBulkProcess() {
  const [state, setState] = useState<BulkProcessState>({
    isProcessing: false,
    progress: null,
    error: null,
    result: null,
  })

  const eventSourceRef = useRef<EventSource | null>(null)

  const startProcessing = useCallback(async (input: BulkProcessInput) => {
    // Reset state
    setState({
      isProcessing: true,
      progress: null,
      error: null,
      result: null,
    })

    try {
      // Step 1: Start the processing by sending POST request
      const response = await fetch('/api/owner-statements/bulk-process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${errorText}`
        )
      }

      const { sessionId } = (await response.json()) as { sessionId: string }

      // Step 2: Set up EventSource to listen for progress updates using the sessionId
      const eventSource = new EventSource(
        `/api/owner-statements/bulk-process?sessionId=${sessionId}`
      )
      eventSourceRef.current = eventSource

      eventSource.addEventListener('progress', (event) => {
        try {
          const data = JSON.parse(event.data) as ProgressEvent
          setState((prev) => ({
            ...prev,
            progress: data,
          }))
        } catch (error) {
          console.error('Failed to parse progress event:', error)
        }
      })

      eventSource.addEventListener('complete', (event) => {
        try {
          const data = JSON.parse(event.data) as CompleteEvent
          setState((prev) => ({
            ...prev,
            isProcessing: false,
            result: data,
          }))
          eventSource.close()
        } catch (error) {
          console.error('Failed to parse complete event:', error)
          setState((prev) => ({
            ...prev,
            isProcessing: false,
            error: 'Failed to parse completion data',
          }))
          eventSource.close()
        }
      })

      eventSource.addEventListener('error', (event) => {
        try {
          const messageEvent = event as MessageEvent
          const data = JSON.parse(messageEvent.data) as ErrorEvent
          setState((prev) => ({
            ...prev,
            isProcessing: false,
            error: data.message,
          }))
          eventSource.close()
        } catch (error) {
          console.error('Failed to parse error event:', error)
          setState((prev) => ({
            ...prev,
            isProcessing: false,
            error: 'Connection error occurred',
          }))
          eventSource.close()
        }
      })

      eventSource.onerror = (event) => {
        console.error('EventSource error:', event)
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: 'Connection error occurred',
        }))
        eventSource.close()
      }
    } catch (error) {
      console.error('Failed to start processing:', error)
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      }))
    }
  }, [])

  const cancelProcessing = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setState((prev) => ({
      ...prev,
      isProcessing: false,
      error: 'Processing cancelled',
    }))
  }, [])

  const resetState = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setState({
      isProcessing: false,
      progress: null,
      error: null,
      result: null,
    })
  }, [])

  return {
    ...state,
    startProcessing,
    cancelProcessing,
    resetState,
  }
}
