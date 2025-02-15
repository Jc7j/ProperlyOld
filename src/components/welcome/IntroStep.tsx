interface StepProps {
  onNext: () => void;
  onBack?: () => void;
}

export function IntroStep({ onNext }: StepProps) {
  return (
    <div className="space-y-6 text-center">
      <h1 className="text-3xl font-bold">Welcome to PropertyManager</h1>
      <p className="text-muted-foreground">
        Let&apos;s get you set up with your property management system.
      </p>
      <button
        onClick={onNext}
        className="bg-primary text-primary-foreground rounded-lg px-4 py-2"
      >
        Get Started
      </button>
    </div>
  );
}
