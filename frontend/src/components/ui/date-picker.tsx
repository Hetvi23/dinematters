import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  id?: string
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  required?: boolean
  readOnly?: boolean
  disabled?: boolean
  className?: string
  label?: string
  description?: string
}

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Pick a date",
  required = false,
  readOnly = false,
  disabled = false,
  className,
  label,
  description
}: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [currentMonth, setCurrentMonth] = React.useState(new Date())
  
  // Parse the value to a Date object
  const selectedDate = React.useMemo(() => {
    if (!value) return null
    const date = new Date(value)
    // Check if date is valid
    if (isNaN(date.getTime())) return null
    return date
  }, [value])
  
  // Format date for display
  const displayValue = selectedDate ? format(selectedDate, "dd/MM/yyyy") : ""
  
  // Update current month when selected date changes
  React.useEffect(() => {
    if (selectedDate) {
      setCurrentMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))
    }
  }, [selectedDate])

  // Get first day of current month
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
  const lastDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
  
  // Get the day of week for the first day (0 = Sunday, 1 = Monday, etc.)
  const firstDayOfWeek = firstDayOfMonth.getDay()
  
  // Get all days in the month
  const daysInMonth = lastDayOfMonth.getDate()
  
  // Create array of days
  const days: (number | null)[] = []
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push(null)
  }
  
  // Add all days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day)
  }

  const handleDateSelect = (day: number) => {
    if (readOnly || disabled) return
    
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    const formattedDate = format(newDate, "yyyy-MM-dd")
    onChange?.(formattedDate)
    setIsOpen(false)
  }

  const handlePreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const handleToday = () => {
    if (readOnly || disabled) return
    const today = new Date()
    const formattedDate = format(today, "yyyy-MM-dd")
    onChange?.(formattedDate)
    setIsOpen(false)
  }

  const handleClear = () => {
    if (readOnly || disabled) return
    onChange?.("")
    setIsOpen(false)
  }

  const isToday = (day: number) => {
    const today = new Date()
    return (
      day === today.getDate() &&
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear()
    )
  }

  const isSelected = (day: number) => {
    if (!selectedDate) return false
    return (
      day === selectedDate.getDate() &&
      currentMonth.getMonth() === selectedDate.getMonth() &&
      currentMonth.getFullYear() === selectedDate.getFullYear()
    )
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label htmlFor={id}>
          {label}
          {required && <span className="text-destructive">*</span>}
        </Label>
      )}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !displayValue && "text-muted-foreground",
              readOnly && "cursor-not-allowed opacity-60",
              disabled && "cursor-not-allowed opacity-60"
            )}
            disabled={readOnly || disabled}
            type="button"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {displayValue || <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-4">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePreviousMonth}
                className="h-7 w-7"
                type="button"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center">
                <div className="font-semibold text-base">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextMonth}
                className="h-7 w-7"
                type="button"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Week Days Header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-medium text-muted-foreground py-1"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} className="h-9" />
                }
                
                const isDayToday = isToday(day)
                const isDaySelected = isSelected(day)
                
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDateSelect(day)}
                    className={cn(
                      "h-9 w-9 rounded-md text-sm font-medium transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                      isDayToday && !isDaySelected && "bg-accent/50 font-semibold",
                      isDaySelected && "bg-primary text-primary-foreground hover:bg-primary/90",
                      !isDaySelected && !isDayToday && "text-foreground"
                    )}
                  >
                    {day}
                  </button>
                )
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                type="button"
                className="text-xs"
              >
                Clear
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleToday}
                type="button"
                className="text-xs"
              >
                Today
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  )
}

