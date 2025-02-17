interface StepProps {
  onNext: () => void;
  onBack?: () => void;
}

export function ThemeStep({ onNext, onBack }: StepProps) {
  return (
    <div className="space-y-8">
      <div className="space-y-2 text-center">
        <h2 className="text-3xl font-bold tracking-tight">Choose Your Theme</h2>
        <p className="text-muted-foreground text-lg">
          Select a theme that suits your style
        </p>
      </div>
      <div className="mx-auto max-w-md space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <button
            onClick={() => {
              // Set light theme
              onNext();
            }}
            className="hover:bg-muted group relative rounded-lg border p-6 transition-colors"
          >
            <div className="space-y-2">
              <div className="bg-background h-24 rounded-md border shadow-sm" />
              <p className="font-medium">Light Mode</p>
              <p className="text-muted-foreground text-sm">
                Clean and bright interface
              </p>
            </div>
          </button>
          <button
            onClick={() => {
              // Set dark theme
              onNext();
            }}
            className="hover:bg-muted group relative rounded-lg border p-6 transition-colors"
          >
            <div className="space-y-2">
              <div className="h-24 rounded-md bg-zinc-900 shadow-sm" />
              <p className="font-medium">Dark Mode</p>
              <p className="text-muted-foreground text-sm">Easy on the eyes</p>
            </div>
          </button>
        </div>
        <div className="flex items-center justify-between pt-4">
          <button
            onClick={onBack}
            className="text-muted-foreground hover:bg-muted inline-flex h-10 items-center justify-center rounded-lg border px-8 py-2 text-sm font-medium transition-colors"
          >
            Back
          </button>
          <button
            onClick={onNext}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-lg px-8 py-2 text-sm font-medium transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
