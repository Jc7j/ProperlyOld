import { ClerkProvider } from '@clerk/nextjs'
import { auth } from '@clerk/nextjs/server'
import { GeistSans } from 'geist/font/sans'
import { type Metadata } from 'next'
import { Toaster } from 'sonner'
import { SyncActiveOrganization } from '~/components/clerk/SyncActiveOrganizations'
import '~/styles/globals.css'
import { TRPCReactProvider } from '~/trpc/react'

import { ThemeProvider } from './ThemeProvider'

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
      <html lang="en" className={`${GeistSans.variable}`}>
        <body>
          <TRPCReactProvider>
            <ThemeProvider>{children}</ThemeProvider>
            <Toaster />
          </TRPCReactProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
