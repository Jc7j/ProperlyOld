import { Button } from '../ui'

interface StepProps {
  onNext: () => void
  onBack?: () => void
}

export function IntroStep({ onNext }: StepProps) {
  return (
    <div className="space-y-8 text-center">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">
          Welcome to Properly
        </h1>
      </div>
      <div className="mx-auto max-w-md space-y-4">
        <Button
          onClick={onNext}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-lg px-8 py-2 text-sm font-medium transition-colors"
        >
          Get Started
        </Button>
      </div>
    </div>
  )
}
