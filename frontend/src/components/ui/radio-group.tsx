/**
 * Lightweight RadioGroup built on native <input type="radio">.
 * Drop-in compatible with shadcn/ui RadioGroup API surface.
 */
import * as React from 'react'
import { cn } from '@/lib/utils'

interface RadioGroupProps {
  value?: string
  onValueChange?: (value: string) => void
  className?: string
  children?: React.ReactNode
  disabled?: boolean
}

const RadioGroupContext = React.createContext<{
  value?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
}>({})

function RadioGroup({ value, onValueChange, className, children, disabled }: RadioGroupProps) {
  return (
    <RadioGroupContext.Provider value={{ value, onValueChange, disabled }}>
      <div className={cn('grid gap-2', className)} role="radiogroup">
        {children}
      </div>
    </RadioGroupContext.Provider>
  )
}

interface RadioGroupItemProps {
  value: string
  id?: string
  className?: string
  disabled?: boolean
}

function RadioGroupItem({ value, id, className, disabled }: RadioGroupItemProps) {
  const ctx = React.useContext(RadioGroupContext)
  const isChecked = ctx.value === value
  const isDisabled = disabled || ctx.disabled

  return (
    <input
      type="radio"
      id={id}
      value={value}
      checked={isChecked}
      disabled={isDisabled}
      onChange={() => !isDisabled && ctx.onValueChange?.(value)}
      className={cn(
        'h-4 w-4 shrink-0 cursor-pointer accent-primary',
        isDisabled && 'cursor-not-allowed opacity-50',
        className
      )}
    />
  )
}

export { RadioGroup, RadioGroupItem }
