'use client'

import { SignUp } from '@clerk/nextjs'
import { AuthLayout } from '~/components/marketing/AuthLayout'

export default function SignUpPage() {
  return (
    <AuthLayout>
      <SignUp signInUrl="/sign-in" forceRedirectUrl="/welcome" />
    </AuthLayout>
  )
}
