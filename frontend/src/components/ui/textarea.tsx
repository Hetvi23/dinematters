import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-md border border-[#8a8886] bg-white px-3 py-2 text-sm shadow-sm placeholder:text-[#a19f9d] focus-visible:outline-none focus-visible:border-[#ea580c] focus-visible:ring-1 focus-visible:ring-[#ea580c] hover:border-[#323130] disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[#f3f2f1]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }












