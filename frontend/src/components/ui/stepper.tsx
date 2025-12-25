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
    <div className={cn("w-full overflow-x-hidden", className)}>
      {/* Desktop: Horizontal layout - single line, compact */}
      <div className="hidden md:flex items-start pb-2" style={{ gap: '2px' }}>
        {steps.map((step, index) => {
          const isCompleted = index < currentStep
          const isCurrent = index === currentStep
          const isClickable = onStepClick && (isCompleted || isCurrent)

          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center flex-shrink-0" style={{ flex: '1 1 0', minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick?.(index)}
                  disabled={!isClickable}
                  className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-md border-2 transition-all shrink-0",
                    isCompleted
                      ? "bg-primary border-primary text-primary-foreground shadow-sm"
                      : isCurrent
                      ? "border-primary text-primary bg-primary/10 dark:bg-primary/20 shadow-md"
                      : "border-border text-muted-foreground bg-background",
                    isClickable && "cursor-pointer hover:scale-105",
                    !isClickable && "cursor-not-allowed"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <span className="font-semibold text-xs">{index + 1}</span>
                  )}
                </button>
                <div className="mt-1 text-center w-full px-0.5">
                  <p
                    className={cn(
                      "text-[9px] font-medium leading-tight line-clamp-2",
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
                    "h-0.5 w-2 mt-3.5 transition-colors rounded-full flex-shrink-0",
                    isCompleted ? "bg-primary" : "bg-border"
                  )}
                />
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Mobile: Vertical compact layout */}
      <div className="md:hidden space-y-3">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep
          const isCurrent = index === currentStep
          const isClickable = onStepClick && (isCompleted || isCurrent)

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => isClickable && onStepClick?.(index)}
              disabled={!isClickable}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-md border transition-all text-left",
                isCompleted
                  ? "bg-primary/10 dark:bg-primary/20 border-primary"
                  : isCurrent
                  ? "bg-primary/10 dark:bg-primary/20 border-primary border-2"
                  : "bg-card border-border",
                isClickable && "cursor-pointer hover:bg-muted",
                !isClickable && "cursor-not-allowed opacity-60"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-md border-2 flex-shrink-0",
                  isCompleted
                    ? "bg-primary border-primary text-primary-foreground"
                    : isCurrent
                    ? "border-primary text-primary bg-background"
                    : "border-border text-muted-foreground bg-background"
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span className="font-semibold text-xs">{index + 1}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium leading-tight",
                    isCurrent ? "text-foreground font-semibold" : "text-muted-foreground"
                  )}
                >
                  {step.title}
                </p>
                {step.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {step.description}
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

