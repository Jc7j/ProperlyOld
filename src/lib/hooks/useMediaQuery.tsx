'use client'

import { useEffect, useState } from 'react'

/**
 * A hook that returns a boolean indicating whether the given media query matches
 * @param query The media query to match against
 * @returns A boolean indicating whether the media query matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    // Check if window is available (client-side)
    if (typeof window === 'undefined') {
      return
    }

    // Create a media query list
    const mediaQuery = window.matchMedia(query)

    // Set the initial value
    setMatches(mediaQuery.matches)

    // Create a handler to update the state
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    // Add the event listener
    mediaQuery.addEventListener('change', handler)

    // Clean up
    return () => {
      mediaQuery.removeEventListener('change', handler)
    }
  }, [query])

  return matches
}
