import { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {Icon && (
        <div className="mb-4 rounded-full bg-muted p-6">
          <Icon className="h-12 w-12 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
        {description}
      </p>
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {action && (
            <Button onClick={action.onClick} size="default">
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button onClick={secondaryAction.onClick} variant="outline" size="default">
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
