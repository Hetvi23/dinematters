import { Link } from 'react-router-dom'
import { useFrappeGetCall } from '@/lib/frappe'
import { Card, CardContent } from '@/components/ui/card'
import { usePermissions } from '@/lib/permissions'
import { 
  Loader2, 
  Building2, 
  ShoppingCart, 
  Settings, 
  Calendar, 
  Lock,
  Grid3x3,
  TrendingUp,
  UtensilsCrossed,
  ChevronRight,
  Package,
  Users,
  FileText,
  BarChart3
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Modules() {
  const { data, isLoading } = useFrappeGetCall<{ message: Record<string, Array<{ name: string; label: string }>> }>(
    'dinematters.dinematters.api.ui.get_all_doctypes',
    {},
    'all-doctypes'
  )

  const categories = data?.message || {}
  
  // Check if we have any categories with items
  const hasCategories = Object.keys(categories).length > 0 && 
    Object.values(categories).some((doctypes: any) => Array.isArray(doctypes) && doctypes.length > 0)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading modules...</p>
        </div>
      </div>
    )
  }

  // Category configuration with icons and colors
  const categoryConfig: Record<string, { 
    icon: any
    color: string
    bgColor: string
    borderColor: string
  }> = {
    'Restaurant Setup': { 
      icon: Building2, 
      color: 'text-[#ea580c] dark:text-[#ff8c42]', 
      bgColor: 'bg-orange-50 dark:bg-[#ea580c]/20',
      borderColor: 'border-orange-200 dark:border-[#ea580c]/40'
    },
    'Menu Management': { 
      icon: UtensilsCrossed, 
      color: 'text-[#107c10] dark:text-[#81c784]', 
      bgColor: 'bg-[#dff6dd] dark:bg-[#1b5e20]',
      borderColor: 'border-[#92c5f7] dark:border-[#4caf50]'
    },
    'Orders': { 
      icon: ShoppingCart, 
      color: 'text-[#004578] dark:text-[#64b5f6]', 
      bgColor: 'bg-[#cce5ff] dark:bg-[#0d47a1]',
      borderColor: 'border-[#99ccff] dark:border-[#1565c0]'
    },
    'Bookings': { 
      icon: Calendar, 
      color: 'text-[#8764b8] dark:text-[#ba68c8]', 
      bgColor: 'bg-[#e8d5ff] dark:bg-[#4a148c]',
      borderColor: 'border-[#d4b9e8] dark:border-[#6a1b9a]'
    },
    'Marketing & Promotions': { 
      icon: TrendingUp, 
      color: 'text-[#d13438] dark:text-[#ef5350]', 
      bgColor: 'bg-[#fde7e9] dark:bg-[#b71c1c]',
      borderColor: 'border-[#f4c2c4] dark:border-[#d32f2f]'
    },
    'Legacy': { 
      icon: Grid3x3, 
      color: 'text-muted-foreground', 
      bgColor: 'bg-muted',
      borderColor: 'border-border'
    },
    'Tools': { 
      icon: Settings, 
      color: 'text-[#ca5010] dark:text-[#ffaa44]', 
      bgColor: 'bg-[#fff4ce] dark:bg-[#ca5010]/20',
      borderColor: 'border-[#ffe69d] dark:border-[#ca5010]/40'
    },
    'Other': { 
      icon: Package, 
      color: 'text-muted-foreground', 
      bgColor: 'bg-muted',
      borderColor: 'border-border'
    },
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-md bg-orange-50 dark:bg-[#ea580c]/20">
            <Grid3x3 className="h-5 w-5 text-[#ea580c] dark:text-[#ff8c42]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
            All Modules
          </h1>
        </div>
        <p className="text-sm text-muted-foreground pl-11">
          Access and manage all dinematters modules. Permissions are automatically enforced based on your role.
        </p>
      </div>

      {/* Categories */}
      {Object.entries(categories).map(([category, doctypes]) => {
        const doctypeArray = Array.isArray(doctypes) ? doctypes : []
        if (doctypeArray.length === 0) return null
        
        const config = categoryConfig[category] || categoryConfig['Other']
        const CategoryIcon = config.icon
        
        return (
          <div key={category} className="space-y-4">
            {/* Category Header */}
            <div className="flex items-center gap-3 pb-3 border-b border-border">
              <div className={cn("p-2 rounded-md", config.bgColor, config.borderColor, "border")}>
                <CategoryIcon className={cn("h-4 w-4", config.color)} />
              </div>
              <div className="flex items-center gap-3 flex-1">
                <h2 className="text-lg font-semibold text-foreground">{category}</h2>
                <span className="text-xs text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded-md">
                  {doctypeArray.length} {doctypeArray.length === 1 ? 'module' : 'modules'}
                </span>
              </div>
            </div>
            
            {/* Module Grid */}
            <div className="grid gap-2.5 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {doctypeArray.map((doctype) => (
                <ModuleCard 
                  key={doctype.name} 
                  doctype={doctype.name} 
                  label={doctype.label}
                  categoryColor={config.color}
                  categoryBgColor={config.bgColor}
                />
              ))}
            </div>
          </div>
        )
      })}
      
      {/* Empty State */}
      {!hasCategories && (
        <Card className="border border-border">
          <CardContent className="py-16 sm:py-20 text-center">
            <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
              <div className="p-4 rounded-full bg-muted">
                <Grid3x3 className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">No modules available</h3>
                <p className="text-sm text-muted-foreground">
                  Please check your permissions or contact your administrator to get access to modules.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ModuleCard({ 
  doctype, 
  label, 
  categoryColor,
  categoryBgColor
}: { 
  doctype: string
  label: string
  categoryColor: string
  categoryBgColor: string
}) {
  const { permissions } = usePermissions(doctype)

  const hasAccess = permissions.read

  const displayLabel = label || doctype.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

  // Get appropriate icon based on doctype name
  const getModuleIcon = () => {
    const lowerName = doctype.toLowerCase()
    if (lowerName.includes('product') || lowerName.includes('item')) return Package
    if (lowerName.includes('order')) return ShoppingCart
    if (lowerName.includes('user') || lowerName.includes('staff') || lowerName.includes('employee')) return Users
    if (lowerName.includes('report') || lowerName.includes('analytics') || lowerName.includes('dashboard')) return BarChart3
    if (lowerName.includes('document') || lowerName.includes('file')) return FileText
    return Grid3x3
  }

  const ModuleIcon = getModuleIcon()

  return (
    <Link 
      to={`/${doctype}`} 
      className={cn(
        "block group",
        !hasAccess && "pointer-events-none"
      )}
    >
      <Card className={cn(
        "h-full transition-all duration-200 border border-border bg-card",
        "hover:shadow-md hover:border-border/80",
        hasAccess 
          ? "cursor-pointer hover:bg-muted" 
          : "opacity-50 border-dashed"
      )}>
        <CardContent className="p-3">
          <div className="flex items-center gap-2.5">
            {/* Icon */}
            <div className={cn(
              "p-1.5 rounded-md flex-shrink-0",
              hasAccess ? categoryBgColor : "bg-muted"
            )}>
              <ModuleIcon className={cn(
                "h-3.5 w-3.5",
                hasAccess ? categoryColor : "text-muted-foreground"
              )} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className={cn(
                  "text-sm font-semibold text-foreground leading-snug",
                  "group-hover:text-foreground transition-colors",
                  "line-clamp-1"
                )}>
                  {displayLabel}
                </h3>
                {!hasAccess && (
                  <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                )}
                {hasAccess && (
                  <ChevronRight className={cn(
                    "h-3.5 w-3.5 transition-all duration-200 flex-shrink-0",
                    categoryColor,
                    "opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0"
                  )} />
                )}
              </div>
              <p className="text-xs text-muted-foreground font-normal truncate mt-0.5">
                {doctype}
              </p>
            </div>
          </div>
          
          {/* Hover indicator */}
          {hasAccess && (
            <div className={cn(
              "mt-2.5 h-0.5 rounded-full transition-all duration-200",
              // Extract the first color class and convert to bg
              categoryColor.includes('text-') 
                ? categoryColor.split(' ')[0].replace('text-', 'bg-')
                : 'bg-primary',
              "w-0 group-hover:w-full"
            )} />
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
