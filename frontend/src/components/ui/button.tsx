import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
      "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-normal transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ea580c]",
  {
    variants: {
      variant: {
        default:
          "bg-[#ea580c] text-white shadow-sm hover:bg-[#c2410c] active:bg-[#9a3412] border border-[#ea580c]",
        destructive:
          "bg-[#d13438] text-white shadow-sm hover:bg-[#a4262c] active:bg-[#8b1e23] border border-[#d13438]",
        outline:
          "border border-[#8a8886] bg-white text-[#323130] shadow-sm hover:bg-[#f3f2f1] active:bg-[#edebe9] hover:border-[#323130]",
        secondary:
          "bg-[#f3f2f1] text-[#323130] shadow-sm hover:bg-[#edebe9] active:bg-[#e1dfdd] border border-[#edebe9]",
        ghost:
          "text-[#323130] hover:bg-[#f3f2f1] active:bg-[#edebe9] border border-transparent",
        link: "text-[#ea580c] underline-offset-4 hover:underline hover:text-[#c2410c]",
      },
      size: {
        default: "h-8 px-4 py-1.5",
        sm: "h-7 rounded-md gap-1.5 px-3 text-xs",
        lg: "h-10 rounded-md px-6",
        icon: "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }












