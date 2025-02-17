interface StepProps {
  onBack?: () => void;
}

export function CompleteStep({ onBack }: StepProps) {
  return (
    <div className="space-y-8 text-center">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">All Set!</h2>
        <p className="text-muted-foreground text-lg">
          Your property management system is ready to use
        </p>
      </div>
      <div className="mx-auto max-w-md space-y-4">
        <p className="text-muted-foreground text-sm">
          You can now start managing your properties, tracking maintenance, and
          more.
        </p>
        <button
          onClick={() => (window.location.href = "/dashboard")}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-lg px-8 py-2 text-sm font-medium transition-colors"
        >
          Go to Dashboard
        </button>
        <button
          onClick={onBack}
          className="border-input inline-flex h-10 items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
        >
          Back
        </button>
      </div>
    </div>
  );
}
