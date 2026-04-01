export function PageSkeleton() {
  return (
    <div className="flex flex-col h-full space-y-6 animate-pulse p-6">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-64 bg-muted rounded-md" />
        <div className="h-4 w-96 bg-muted/60 rounded-md" />
      </div>

      {/* Content Grid Skeleton */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 rounded-xl bg-muted border border-muted-foreground/10" />
        ))}
      </div>

      {/* Main Content Area Skeleton */}
      <div className="flex-1 space-y-4">
        <div className="h-10 w-full bg-muted/40 rounded-lg" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 w-full bg-muted/20 rounded-md" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function SidebarSkeleton() {
  return (
    <div className="w-64 border-r bg-sidebar h-screen p-4 space-y-4 animate-pulse hidden lg:block">
      <div className="h-10 w-full bg-muted rounded-lg mb-8" />
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-8 w-8 bg-muted rounded-md shrink-0" />
          <div className="h-4 w-full bg-muted/60 rounded-md" />
        </div>
      ))}
    </div>
  )
}
