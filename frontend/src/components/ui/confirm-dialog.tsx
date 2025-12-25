import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Info, CheckCircle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: "default" | "destructive" | "warning" | "info"
  onConfirm: () => void | Promise<void>
  onCancel?: () => void
  loading?: boolean
}

const variantConfig = {
  default: {
    icon: Info,
    iconColor: "text-primary",
    iconBg: "bg-primary/10 dark:bg-primary/20",
    confirmButton: "bg-primary hover:bg-primary/90 text-primary-foreground",
  },
  destructive: {
    icon: XCircle,
    iconColor: "text-destructive",
    iconBg: "bg-destructive/10 dark:bg-destructive/20",
    confirmButton: "bg-destructive hover:bg-destructive/90 text-white",
  },
  warning: {
    icon: AlertTriangle,
    iconColor: "text-warning dark:text-warning/80",
    iconBg: "bg-warning/10 dark:bg-warning/20",
    confirmButton: "bg-warning hover:bg-warning/90 text-warning-foreground dark:text-foreground",
  },
  info: {
    icon: Info,
    iconColor: "text-primary",
    iconBg: "bg-primary/10 dark:bg-primary/20",
    confirmButton: "bg-primary hover:bg-primary/90 text-primary-foreground",
  },
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  const [isLoading, setIsLoading] = React.useState(false)
  const config = variantConfig[variant]
  const Icon = config.icon

  const handleConfirm = async () => {
    setIsLoading(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (error) {
      // Error handling is done by the caller
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className={cn(
              "flex items-center justify-center h-10 w-10 rounded-full flex-shrink-0",
              config.iconBg
            )}>
              <Icon className={cn("h-5 w-5", config.iconColor)} />
            </div>
            <div className="flex-1 pt-0.5">
              <DialogTitle className="text-lg font-semibold text-foreground">
                {title}
              </DialogTitle>
              {description && (
                <DialogDescription className="mt-2 text-sm text-muted-foreground">
                  {description}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading || loading}
            className="w-full sm:w-auto"
          >
            {cancelText}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || loading}
            className={cn(
              "w-full sm:w-auto",
              config.confirmButton
            )}
          >
            {isLoading || loading ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

