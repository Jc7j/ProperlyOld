interface StepProps {
  onBack?: () => void;
}

export function CompleteStep({ onBack }: StepProps) {
  return (
    <div className="space-y-6 text-center">
      <h2 className="text-2xl font-semibold">All Set!</h2>
      <p className="text-muted-foreground">
        Your property management system is ready to use.
      </p>
      <button
        onClick={() => (window.location.href = "/dashboard")}
        className="bg-primary text-primary-foreground rounded-lg px-4 py-2"
      >
        Go to Dashboard
      </button>
    </div>
  );
}
