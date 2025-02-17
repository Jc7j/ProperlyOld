'use client'

import { SignIn } from '@clerk/nextjs'
import Image from 'next/image'
import Link from 'next/link'

export default function SignInPage() {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      {/* Left Side - Form */}
      <div className="flex flex-col justify-center px-4 py-10 sm:px-6 lg:px-8 xl:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="space-y-6">
            {/* Logo */}
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
              <Image
                src="/logo.svg"
                alt="PropertyManager"
                width={24}
                height={24}
                className="h-6 w-6 text-white"
              />
            </div>

            {/* Header Text */}
            <div className="space-y-2">
              <h2 className="text-2xl/tight font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                Sign in to your account
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Don&apos;t have an account?{' '}
                <Link
                  href="/sign-up"
                  className="font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Sign up for free
                </Link>
              </p>
            </div>

            {/* Sign In Form */}
            <SignIn />
          </div>
        </div>
      </div>

      {/* Right Side - Image */}
      <div className="relative hidden md:block">
        <Image
          src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c"
          alt="Property Management"
          fill
          className="object-cover"
          priority
          quality={90}
        />
        <div className="absolute inset-0 bg-zinc-900/20" />
      </div>
    </div>
  )
}
