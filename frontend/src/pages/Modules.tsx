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
          <Loader2 className="h-8 w-8 animate-spin text-[#605e5c]" />
          <p className="text-sm text-[#605e5c]">Loading modules...</p>
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
      color: 'text-[#ea580c]', 
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200'
    },
    'Menu Management': { 
      icon: UtensilsCrossed, 
      color: 'text-[#107c10]', 
      bgColor: 'bg-[#dff6dd]',
      borderColor: 'border-[#92c5f7]'
    },
    'Orders': { 
      icon: ShoppingCart, 
      color: 'text-[#004578]', 
      bgColor: 'bg-[#cce5ff]',
      borderColor: 'border-[#99ccff]'
    },
    'Bookings': { 
      icon: Calendar, 
      color: 'text-[#8764b8]', 
      bgColor: 'bg-[#e8d5ff]',
      borderColor: 'border-[#d4b9e8]'
    },
    'Marketing & Promotions': { 
      icon: TrendingUp, 
      color: 'text-[#d13438]', 
      bgColor: 'bg-[#fde7e9]',
      borderColor: 'border-[#f4c2c4]'
    },
    'Legacy': { 
      icon: Grid3x3, 
      color: 'text-[#605e5c]', 
      bgColor: 'bg-[#f3f2f1]',
      borderColor: 'border-[#edebe9]'
    },
    'Tools': { 
      icon: Settings, 
      color: 'text-[#ca5010]', 
      bgColor: 'bg-[#fff4ce]',
      borderColor: 'border-[#ffe69d]'
    },
    'Other': { 
      icon: Package, 
      color: 'text-[#605e5c]', 
      bgColor: 'bg-[#f3f2f1]',
      borderColor: 'border-[#edebe9]'
    },
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-md bg-orange-50">
            <Grid3x3 className="h-5 w-5 text-[#ea580c]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#323130] tracking-tight">
            All Modules
          </h1>
        </div>
        <p className="text-sm text-[#605e5c] pl-11">
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
            <div className="flex items-center gap-3 pb-3 border-b border-[#edebe9]">
              <div className={cn("p-2 rounded-md", config.bgColor, config.borderColor, "border")}>
                <CategoryIcon className={cn("h-4 w-4", config.color)} />
              </div>
              <div className="flex items-center gap-3 flex-1">
                <h2 className="text-lg font-semibold text-[#323130]">{category}</h2>
                <span className="text-xs text-[#605e5c] font-medium bg-[#f3f2f1] px-2 py-0.5 rounded-md">
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
        <Card className="border border-[#edebe9]">
          <CardContent className="py-16 sm:py-20 text-center">
            <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
              <div className="p-4 rounded-full bg-[#f3f2f1]">
                <Grid3x3 className="h-8 w-8 text-[#605e5c]" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-[#323130]">No modules available</h3>
                <p className="text-sm text-[#605e5c]">
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
        "h-full transition-all duration-200 border border-[#edebe9] bg-white",
        "hover:shadow-md hover:border-[#c8c6c4]",
        hasAccess 
          ? "cursor-pointer hover:bg-[#faf9f8]" 
          : "opacity-50 border-dashed"
      )}>
        <CardContent className="p-3">
          <div className="flex items-center gap-2.5">
            {/* Icon */}
            <div className={cn(
              "p-1.5 rounded-md flex-shrink-0",
              hasAccess ? categoryBgColor : "bg-[#f3f2f1]"
            )}>
              <ModuleIcon className={cn(
                "h-3.5 w-3.5",
                hasAccess ? categoryColor : "text-[#a19f9d]"
              )} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className={cn(
                  "text-sm font-semibold text-[#323130] leading-snug",
                  "group-hover:text-[#201f1e] transition-colors",
                  "line-clamp-1"
                )}>
                  {displayLabel}
                </h3>
                {!hasAccess && (
                  <Lock className="h-3.5 w-3.5 text-[#a19f9d] flex-shrink-0" />
                )}
                {hasAccess && (
                  <ChevronRight className={cn(
                    "h-3.5 w-3.5 transition-all duration-200 flex-shrink-0",
                    categoryColor,
                    "opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0"
                  )} />
                )}
              </div>
              <p className="text-xs text-[#605e5c] font-normal truncate mt-0.5">
                {doctype}
              </p>
            </div>
          </div>
          
          {/* Hover indicator */}
          {hasAccess && (
            <div className={cn(
              "mt-2.5 h-0.5 rounded-full transition-all duration-200",
              categoryColor.replace('text-', 'bg-'),
              "w-0 group-hover:w-full"
            )} />
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
