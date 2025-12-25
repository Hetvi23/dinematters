import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-8 w-full rounded-md border border-[#8a8886] bg-white px-3 py-1.5 text-sm text-[#323130] transition-colors",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "placeholder:text-[#a19f9d]",
        "focus-visible:outline-none focus-visible:border-[#ea580c] focus-visible:ring-1 focus-visible:ring-[#ea580c]",
        "hover:border-[#323130]",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[#f3f2f1]",
        className
      )}
      {...props}
    />
  )
}

export { Input }












