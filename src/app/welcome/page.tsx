"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { IntroStep } from "~/components/welcome/IntroStep";
import { CreateGroupStep } from "~/components/welcome/CreateGroupStep";
import { ThemeStep } from "~/components/welcome/ThemeStep";
import { CompleteStep } from "~/components/welcome/CompleteStep";

const STEPS = ["intro", "createGroup", "theme", "complete"] as const;
type StepType = (typeof STEPS)[number];

export default function WelcomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState<StepType>("intro");

  useEffect(() => {
    const step = searchParams.get("step") as StepType;
    if (step && STEPS.includes(step)) {
      setCurrentStep(step);
    }
  }, [searchParams]);

  return (
    <div className="container mx-auto min-h-screen py-8">
      <div className="mx-auto max-w-2xl px-4">
        <div className="mb-8">
          <div className="relative">
            <div className="bg-muted absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2">
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
              {STEPS.map((step, index) => (
                <div
                  key={step}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors duration-500 ${
                    index <= STEPS.indexOf(currentStep)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted bg-background"
                  }`}
                >
                  {index + 1}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="min-h-[400px]">
          {currentStep === "intro" && (
            <IntroStep
              onNext={() =>
                router.push(
                  `/welcome?step=${STEPS[STEPS.indexOf(currentStep) + 1]}`,
                )
              }
            />
          )}
          {currentStep === "createGroup" && (
            <CreateGroupStep
              onNext={() =>
                router.push(
                  `/welcome?step=${STEPS[STEPS.indexOf(currentStep) + 1]}`,
                )
              }
              onBack={() =>
                router.push(
                  `/welcome?step=${STEPS[STEPS.indexOf(currentStep) - 1]}`,
                )
              }
            />
          )}
          {currentStep === "theme" && (
            <ThemeStep
              onNext={() =>
                router.push(
                  `/welcome?step=${STEPS[STEPS.indexOf(currentStep) + 1]}`,
                )
              }
              onBack={() =>
                router.push(
                  `/welcome?step=${STEPS[STEPS.indexOf(currentStep) - 1]}`,
                )
              }
            />
          )}
          {currentStep === "complete" && (
            <CompleteStep
              onBack={() =>
                router.push(
                  `/welcome?step=${STEPS[STEPS.indexOf(currentStep) - 1]}`,
                )
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
