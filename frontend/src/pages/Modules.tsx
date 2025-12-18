import { Link } from 'react-router-dom'
import { useFrappeGetCall } from '@/lib/frappe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { usePermissions } from '@/lib/permissions'
import { 
  Loader2, 
  Building2, 
  ShoppingCart, 
  Settings, 
  Calendar, 
  Ticket, 
  Gift, 
  Sparkles, 
  Gamepad2, 
  Home,
  Lock,
  Grid3x3,
  TrendingUp,
  UtensilsCrossed
} from 'lucide-react'

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
  
  // Debug: Log categories to console
  if (data && !isLoading) {
    console.log('Modules data:', data)
    console.log('Categories:', categories)
    console.log('Has categories:', hasCategories)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Category icons mapping
  const categoryIcons: Record<string, any> = {
    'Restaurant Setup': Building2,
    'Menu Management': UtensilsCrossed,
    'Orders': ShoppingCart,
    'Bookings': Calendar,
    'Marketing & Promotions': TrendingUp,
    'Legacy': Grid3x3,
    'Tools': Settings,
    'Other': Grid3x3,
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Grid3x3 className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">All Modules</h2>
          </div>
          <p className="text-muted-foreground text-sm">
            Access all dinematters modules. Permissions are automatically enforced.
          </p>
        </div>
      </div>

      {/* Categories */}
      {Object.entries(categories).map(([category, doctypes]) => {
        const doctypeArray = Array.isArray(doctypes) ? doctypes : []
        if (doctypeArray.length === 0) return null
        
        const CategoryIcon = categoryIcons[category] || Grid3x3
        
        return (
          <div key={category} className="space-y-4">
            <div className="flex items-center gap-3 pb-2 border-b">
              <CategoryIcon className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-semibold text-foreground">{category}</h3>
              <span className="text-sm text-muted-foreground">({doctypeArray.length})</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {doctypeArray.map((doctype) => (
                <ModuleCard key={doctype.name} doctype={doctype.name} label={doctype.label} />
              ))}
            </div>
          </div>
        )
      })}
      
      {!hasCategories && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-full bg-muted">
                <Grid3x3 className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-medium">No modules available</p>
                <p className="text-sm text-muted-foreground max-w-md">
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


function ModuleCard({ doctype, label }: { doctype: string; label: string }) {
  const { permissions } = usePermissions(doctype)

  // Show all modules, but indicate if user doesn't have access
  const hasAccess = permissions.read

  return (
    <Link to={`/${doctype}`} className={hasAccess ? 'block' : 'pointer-events-none block'}>
      <Card className={`
        group relative h-full transition-all duration-200
        ${hasAccess 
          ? 'hover:shadow-lg hover:border-primary/50 cursor-pointer border' 
          : 'opacity-60 border-dashed'
        }
      `}>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base font-semibold capitalize leading-tight">
                {label || doctype.replace(/_/g, ' ')}
              </CardTitle>
            </div>
            {!hasAccess && (
              <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
            )}
          </div>
        </CardHeader>
        {hasAccess && (
          <div className="absolute inset-0 rounded-lg border-2 border-primary opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        )}
      </Card>
    </Link>
  )
}

