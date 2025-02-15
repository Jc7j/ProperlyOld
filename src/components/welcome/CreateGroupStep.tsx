import { useState } from "react";

interface StepProps {
  onNext: () => void;
  onBack?: () => void;
}

export function CreateGroupStep({ onNext, onBack }: StepProps) {
  const [groupName, setGroupName] = useState("");

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Create Your Management Group</h2>
      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="groupName" className="text-sm font-medium">
            Group Name
          </label>
          <input
            id="groupName"
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="bg-background w-full rounded-md border px-3 py-2"
            placeholder="Enter your group name"
          />
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
            disabled={!groupName.trim()}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
