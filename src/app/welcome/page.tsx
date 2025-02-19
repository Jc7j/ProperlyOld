'use client'

import { SignOutButton } from '@clerk/nextjs'
import { useUser } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CompleteStep } from '~/components/welcome/CompleteStep'
import { CreateGroupStep } from '~/components/welcome/CreateGroupStep'
import { IntroStep } from '~/components/welcome/IntroStep'
import { ThemeStep } from '~/components/welcome/ThemeStep'

const STEPS = ['intro', 'createGroup', 'theme', 'complete'] as const
type StepType = (typeof STEPS)[number]

export default function WelcomePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useUser()
  const [currentStep, setCurrentStep] = useState<StepType>('intro')
  const userEmail = user?.primaryEmailAddress?.emailAddress

  useEffect(() => {
    const step = searchParams.get('step') as StepType
    if (step && STEPS.includes(step)) {
      setCurrentStep(step)
    }
  }, [searchParams])

  const handleStepChange = (step: StepType) => {
    router.push(`/welcome?step=${step}`)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-x-3">
            <span className="text-muted-foreground hidden text-sm sm:block">
              {userEmail}
            </span>
          </div>
          <SignOutButton />
        </div>
      </header>

      {/* Content */}
      <div className="flex min-h-[calc(100vh-65px)] items-center justify-center">
        <div className="mx-auto w-full max-w-2xl px-4">
          <div className="mb-8">
            <div className="relative">
              <div className="bg-muted absolute top-1/2 left-0 h-0.5 w-full -translate-y-1/2">
                <div
                  className="bg-primary h-full transition-all duration-500"
                  style={{
                    width: `${
                      ((STEPS.indexOf(currentStep) + 1) / STEPS.length) * 100
                    }%`,
                  }}
                />
              </div>
              <div className="relative flex justify-between">
                {STEPS.map((_, index) => (
                  <div
                    key={index}
                    className={`h-2 w-2 rounded-full transition-colors duration-500 ${
                      index <= STEPS.indexOf(currentStep)
                        ? 'bg-primary'
                        : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="min-h-[400px]">
            {currentStep === 'intro' && (
              <IntroStep onNext={() => handleStepChange('createGroup')} />
            )}
            {currentStep === 'createGroup' && (
              <div className="h-full w-full">
                <CreateGroupStep />
              </div>
            )}
            {currentStep === 'theme' && (
              <ThemeStep
                onNext={() => handleStepChange('complete')}
                onBack={() => handleStepChange('createGroup')}
              />
            )}
            {currentStep === 'complete' && (
              <CompleteStep onBack={() => handleStepChange('theme')} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
