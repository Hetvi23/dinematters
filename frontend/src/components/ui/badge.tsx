import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#ea580c] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-[#ea580c] bg-[#ea580c] text-white hover:bg-[#c2410c]",
        secondary:
          "border-[#edebe9] bg-[#f3f2f1] text-[#323130] hover:bg-[#edebe9]",
        destructive:
          "border-[#d13438] bg-[#d13438] text-white hover:bg-[#a4262c]",
        outline: "border-[#8a8886] text-[#323130] hover:bg-[#f3f2f1]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }











