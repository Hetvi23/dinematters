import { useState, useCallback } from 'react'
import { ConfirmDialog, ConfirmDialogProps } from '@/components/ui/confirm-dialog'

interface ConfirmOptions {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: "default" | "destructive" | "warning" | "info"
}

export function useConfirm() {
  const [dialogProps, setDialogProps] = useState<ConfirmDialogProps | null>(null)

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setDialogProps({
        open: true,
        onOpenChange: (open) => {
          if (!open) {
            setDialogProps(null)
            resolve(false)
          }
        },
        title: options.title,
        description: options.description,
        confirmText: options.confirmText || "Confirm",
        cancelText: options.cancelText || "Cancel",
        variant: options.variant || "default",
        onConfirm: () => {
          resolve(true)
        },
        onCancel: () => {
          resolve(false)
        },
      })
    })
  }, [])

  const ConfirmDialogComponent = dialogProps ? (
    <ConfirmDialog {...dialogProps} />
  ) : null

  return { confirm, ConfirmDialogComponent }
}

