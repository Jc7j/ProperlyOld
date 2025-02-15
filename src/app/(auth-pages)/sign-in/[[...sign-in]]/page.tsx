'use client'

import { SignIn } from '@clerk/nextjs'
import { AuthLayout } from '~/components/marketing/AuthLayout'

export default function SignInPage() {
  return (
    <AuthLayout>
      <SignIn
        appearance={{
          elements: {
            rootBox: 'mx-auto w-full',
            card: 'bg-transparent shadow-none',
            headerTitle: 'text-2xl font-bold',
            headerSubtitle: 'text-zinc-600 dark:text-zinc-400',
            socialButtonsBlockButton: 'border-zinc-300 dark:border-zinc-700',
            socialButtonsBlockButtonText: 'text-zinc-600 dark:text-zinc-400',
            dividerLine: 'bg-zinc-300 dark:bg-zinc-700',
            dividerText: 'text-zinc-600 dark:text-zinc-400',
            formFieldLabel: 'text-zinc-700 dark:text-zinc-300',
            formFieldInput:
              'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700',
            formButtonPrimary: 'bg-blue-600 hover:bg-blue-500',
            footerActionLink: 'text-blue-600 hover:text-blue-500',
          },
        }}
        signUpUrl="/sign-up"
      />
    </AuthLayout>
  )
}
