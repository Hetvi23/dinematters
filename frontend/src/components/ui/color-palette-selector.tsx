import React from 'react'
import { Label } from './label'
import { cn } from '@/lib/utils'

// Predefined color palette
const COLOR_PALETTE = [
  { name: 'Violet', value: '#A992B2' },
  { name: 'Indigo', value: '#8892B0' },
  { name: 'Blue', value: '#87ABCA' },
  { name: 'Green', value: '#9AAF7A' },
  { name: 'Yellow', value: '#E0C682' },
  { name: 'Orange', value: '#DB782F' },
  { name: 'Red', value: '#D68989' }
]

interface ColorPaletteSelectorProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  readOnly?: boolean
}

export function ColorPaletteSelector({
  id,
  label,
  value,
  onChange,
  required = false,
  readOnly = false
}: ColorPaletteSelectorProps) {
  const selectedColor = COLOR_PALETTE.find(c => c.value.toUpperCase() === value?.toUpperCase())

  const handleColorSelect = (colorValue: string) => {
    if (!readOnly) {
      onChange(colorValue)
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="flex flex-wrap gap-3">
        {COLOR_PALETTE.map((color) => {
          const isSelected = selectedColor?.value === color.value
          return (
            <div
              key={color.value}
              className={cn(
                "flex flex-col items-center gap-2 cursor-pointer transition-all",
                readOnly && "cursor-not-allowed opacity-60"
              )}
              onClick={() => !readOnly && handleColorSelect(color.value)}
              role={readOnly ? undefined : "button"}
              tabIndex={readOnly ? -1 : 0}
              onKeyDown={(e) => {
                if (!readOnly && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  handleColorSelect(color.value)
                }
              }}
            >
              {/* Color Swatch */}
              <div
                className={cn(
                  "h-12 w-12 rounded-lg border-2 shadow-md transition-all",
                  isSelected
                    ? "border-blue-500 ring-2 ring-blue-300 ring-offset-2 scale-110"
                    : "border-gray-300 hover:border-gray-400 hover:scale-105",
                  readOnly && "hover:scale-100"
                )}
                style={{ backgroundColor: color.value }}
                aria-label={`${color.name} color`}
              />
              {/* Color Name */}
              <span className={cn(
                "text-xs font-medium",
                isSelected ? "text-blue-600" : "text-muted-foreground"
              )}>
                {color.name}
              </span>
            </div>
          )
        })}
      </div>
      {/* Hidden input to store the selected value */}
      <input
        type="hidden"
        id={id}
        value={value || ''}
        name={id}
      />
    </div>
  )
}




