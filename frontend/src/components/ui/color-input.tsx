import React, { useRef, useEffect } from 'react'
import { Label } from './label'
import { cn } from '@/lib/utils'

interface ColorInputProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  readOnly?: boolean
  defaultColor?: string
}

export function ColorInput({
  id,
  label,
  value,
  onChange,
  required = false,
  readOnly = false,
  defaultColor
}: ColorInputProps) {
  const colorInputRef = useRef<HTMLInputElement>(null)
  
  // Use value if available, otherwise defaultColor, otherwise white
  const colorValue = value || defaultColor || '#FFFFFF'

  // Ensure the default color is set when component mounts if no value exists
  useEffect(() => {
    if (defaultColor && !value) {
      onChange(defaultColor)
    }
  }, [defaultColor, value, onChange])

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toUpperCase()
    onChange(newValue)
  }

  const handleSwatchClick = () => {
    if (!readOnly && colorInputRef.current) {
      colorInputRef.current.click()
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="flex items-center">
        {/* Hidden Color Picker Input */}
        <input
          ref={colorInputRef}
          id={id}
          type="color"
          value={colorValue}
          onChange={handleColorChange}
          disabled={readOnly}
          required={required}
          className="sr-only"
        />
        
        {/* Clickable Color Swatch */}
        <div
          className={cn(
            "h-12 w-20 rounded-md border-2 border-gray-300 shadow-md cursor-pointer transition-all hover:shadow-lg hover:scale-105",
            readOnly && "cursor-not-allowed opacity-60 hover:scale-100 hover:shadow-md"
          )}
          style={{ backgroundColor: colorValue }}
          onClick={handleSwatchClick}
          role="button"
          aria-label={`Select ${label} color`}
          tabIndex={readOnly ? -1 : 0}
          onKeyDown={(e) => {
            if (!readOnly && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              handleSwatchClick()
            }
          }}
        />
      </div>
    </div>
  )
}
