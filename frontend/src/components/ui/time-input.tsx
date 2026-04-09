import * as React from "react"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface TimeInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  description?: string
  required?: boolean
}

const TimeInput = React.forwardRef<HTMLInputElement, TimeInputProps>(
  ({ className, label, error, description, required, ...props }, ref) => {
    return (
      <div className="space-y-2 w-full">
        {label && (
          <Label 
            htmlFor={props.id}
            className={cn(
              "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
              error && "text-destructive"
            )}
          >
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        <div className="relative group">
          <Input
            type="time"
            className={cn(
              "pl-9 pr-4 transition-all duration-200",
              "focus-visible:ring-primary/20 focus-visible:border-primary",
              error && "border-destructive focus-visible:ring-destructive/20 focus-visible:border-destructive",
              "appearance-none", // Hide default browser styling if possible
              className
            )}
            ref={ref}
            {...props}
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors duration-200">
            <Clock className="h-4 w-4" />
          </div>
        </div>
        {description && !error && (
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
        {error && (
          <p className="text-[11px] font-medium text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
            {error}
          </p>
        )}
      </div>
    )
  }
)
TimeInput.displayName = "TimeInput"

export { TimeInput }
