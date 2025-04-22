import { ClerkProvider } from '@clerk/nextjs'
import { auth } from '@clerk/nextjs/server'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import { NextSSRPlugin } from '@uploadthing/react/next-ssr-plugin'
import { GeistSans } from 'geist/font/sans'
import { type Metadata } from 'next'
import { Toaster } from 'sonner'
import { extractRouterConfig } from 'uploadthing/server'
import { SyncActiveOrganization } from '~/components/clerk/SyncActiveOrganizations'
import '~/styles/globals.css'
import { TRPCReactProvider } from '~/trpc/react'

import { ThemeProvider } from './ThemeProvider'
import { ourFileRouter } from './api/uploadthing/core'

export const metadata: Metadata = {
  title: 'Properly | Streamline your Property Management',
  description: '',
  icons: [{ rel: 'icon', url: '/favicon.ico' }],
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { sessionClaims } = await auth()

  return (
    <ClerkProvider>
      <SyncActiveOrganization
        membership={sessionClaims?.membership as Record<string, string>}
      />
      <NextSSRPlugin
        /**
         * The `extractRouterConfig` will extract **only** the route configs
         * from the router to prevent additional information from being
         * leaked to the client. The data passed to the client is the same
         * as if you were to fetch `/api/uploadthing` directly.
         */
        routerConfig={extractRouterConfig(ourFileRouter)}
      />
      <html lang="en" className={`${GeistSans.variable}`}>
        <body>
          <TooltipProvider>
            <TRPCReactProvider>
              <ThemeProvider>{children}</ThemeProvider>
              <Toaster />
            </TRPCReactProvider>
          </TooltipProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
