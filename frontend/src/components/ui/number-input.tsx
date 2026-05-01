import * as React from "react"
import { Input, InputProps } from "@/components/ui/input"

export interface NumberInputProps extends Omit<InputProps, "type"> {
  allowNegative?: boolean
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, allowNegative = false, onChange, onWheel, min, value, ...props }, ref) => {
    // Keep local string state to allow user to backspace down to an empty string 
    // and easily type new numbers without being blocked by 0 or NaN logic
    const [localValue, setLocalValue] = React.useState<string>(
      value !== undefined && value !== null ? String(value) : ""
    )

    // Sync from props when value changes externally
    React.useEffect(() => {
      if (value !== undefined && value !== null) {
        const valStr = String(value)
        // Only update local value if it's materially different, to prevent cursor jump
        if (parseFloat(localValue) !== value && !(localValue === "" && value === 0)) {
           setLocalValue(valStr)
        } else if (localValue === "" && value === 0 && localValue !== valStr) {
           // Allow empty string to represent 0 temporarily
        }
      } else {
        setLocalValue("")
      }
    }, [value])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = e.target.value

      // Prevent negative if not allowed
      if (!allowNegative && val.includes('-')) {
        val = val.replace('-', '')
      }

      setLocalValue(val)
      
      if (onChange) {
         // Create a synthetic event or just pass it directly
         // We intercept to provide the parsed float or empty string to the parent
         e.target.value = val
         onChange(e)
      }
    }

    const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
      // Prevent scroll from changing the value
      e.currentTarget.blur()
      if (onWheel) onWheel(e)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // If negative not allowed or min >= 0, prevent typing minus sign
      if ((!allowNegative || (min !== undefined && Number(min) >= 0)) && e.key === '-') {
        e.preventDefault()
      }
      if (props.onKeyDown) props.onKeyDown(e)
    }

    return (
      <Input
        type="number"
        className={className}
        ref={ref}
        onChange={handleChange}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        min={min}
        value={localValue}
        {...props}
      />
    )
  }
)
NumberInput.displayName = "NumberInput"

export { NumberInput }
