import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface Step {
  id: string
  title: string
  description?: string
  completed?: boolean
  active?: boolean
}

interface StepperProps {
  steps: Step[]
  currentStep: number
  onStepClick?: (stepIndex: number) => void
  className?: string
}

export function Stepper({ steps, currentStep, onStepClick, className }: StepperProps) {
  if (!steps || steps.length === 0) {
    return null
  }

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <div className="flex items-start justify-between min-w-full pb-2">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep
          const isCurrent = index === currentStep
          const isClickable = onStepClick && (isCompleted || isCurrent)

          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center flex-1 min-w-[80px] max-w-[120px]">
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick?.(index)}
                  disabled={!isClickable}
                  className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all shrink-0",
                    isCompleted
                      ? "bg-primary border-primary text-primary-foreground shadow-sm"
                      : isCurrent
                      ? "border-primary text-primary bg-primary/10 shadow-md scale-110"
                      : "border-muted text-muted-foreground bg-background",
                    isClickable && "cursor-pointer hover:scale-105",
                    !isClickable && "cursor-not-allowed"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-6 w-6" />
                  ) : (
                    <span className="font-bold text-sm">{index + 1}</span>
                  )}
                </button>
                <div className="mt-3 text-center w-full px-1">
                  <p
                    className={cn(
                      "text-xs font-medium leading-tight break-words hyphens-auto",
                      isCurrent ? "text-foreground font-semibold" : "text-muted-foreground"
                    )}
                    title={step.description || step.title}
                  >
                    {step.title}
                  </p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-1 mx-2 mt-6 transition-colors rounded-full min-w-[20px]",
                    isCompleted ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

