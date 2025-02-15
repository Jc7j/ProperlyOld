interface StepProps {
  onNext: () => void;
  onBack?: () => void;
}

export function ThemeStep({ onNext, onBack }: StepProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Choose Your Theme</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <button
          onClick={() => {
            // Set light theme
            onNext();
          }}
          className="hover:bg-muted rounded-lg border p-4"
        >
          Light Mode
        </button>
        <button
          onClick={() => {
            // Set dark theme
            onNext();
          }}
          className="hover:bg-muted rounded-lg border p-4"
        >
          Dark Mode
        </button>
      </div>
      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="text-muted-foreground rounded-lg border px-4 py-2"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="bg-primary text-primary-foreground rounded-lg px-4 py-2"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
