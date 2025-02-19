import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isOnboardingRoute = createRouteMatcher(['/welcome'])
const isProtectedRoute = createRouteMatcher(['/dashboard(.*)'])
const isTRPCRoute = createRouteMatcher(['/api/trpc(.*)'])
const isHomePage = createRouteMatcher(['/'])

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth()

  if (isHomePage(req)) {
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  // Always allow tRPC requests to pass through
  if (isTRPCRoute(req)) {
    return NextResponse.next()
  }

  // Redirect to dashboard if onboarding is complete and on welcome page
  if (
    userId &&
    sessionClaims?.metadata?.onboardingComplete &&
    isOnboardingRoute(req)
  ) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Protect dashboard routes
  if (isProtectedRoute(req)) {
    await auth.protect()
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
