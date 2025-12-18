import { Link, useLocation } from 'react-router-dom'
import { Home, ShoppingCart, Package, FolderTree, Grid3x3, Sparkles, Store, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFrappeGetDocList } from '@/lib/frappe'

interface LayoutProps {
  children: React.ReactNode
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Setup Wizard', href: '/setup', icon: Sparkles },
  { name: 'All Modules', href: '/modules', icon: Grid3x3 },
  { name: 'Restaurants', href: '/Restaurant', icon: Store },
  { name: 'Orders', href: '/orders', icon: ShoppingCart },
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Categories', href: '/categories', icon: FolderTree },
]

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()

  // Fetch quick stats for navigation (limited for performance)
  const { data: orders } = useFrappeGetDocList('Order', {
    fields: ['name', 'status', 'total'],
    limit: 100 // Get enough to calculate stats
  })

  const { data: restaurants } = useFrappeGetDocList('Restaurant', {
    fields: ['name', 'is_active'],
    limit: 100
  })

  // Calculate quick stats
  const totalOrders = orders?.length || 0
  const totalRestaurants = restaurants?.length || 0
  const totalRevenue = orders?.reduce((sum: number, order: any) => sum + (order.total || 0), 0) || 0

  // Get pending orders count
  const pendingOrders = orders?.filter((order: any) => 
    order.status?.toLowerCase() === 'pending'
  )?.length || 0

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <h1 className="text-2xl font-bold text-primary">Dinematters</h1>
              </Link>
              {/* Quick Stats */}
              <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
                {totalRestaurants > 0 && (
                  <div className="flex items-center gap-1">
                    <Store className="h-3.5 w-3.5" />
                    <span>{totalRestaurants} Restaurant{totalRestaurants !== 1 ? 's' : ''}</span>
                  </div>
                )}
                {totalOrders > 0 && (
                  <div className="flex items-center gap-1">
                    <ShoppingCart className="h-3.5 w-3.5" />
                    <span>{totalOrders} Order{totalOrders !== 1 ? 's' : ''}</span>
                  </div>
                )}
                {totalRevenue > 0 && (
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>₹{totalRevenue.toFixed(0)}</span>
                  </div>
                )}
              </div>
            </div>
            <nav className="flex items-center gap-1">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.href || 
                  (item.href !== '/dashboard' && location.pathname.startsWith(item.href))
                
                // Add badge for pending orders
                const showBadge = item.href === '/orders' && pendingOrders > 0
                
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      "relative flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Icon className="size-4" />
                    <span className="hidden sm:inline">{item.name}</span>
                    {showBadge && (
                      <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
                        {pendingOrders > 9 ? '9+' : pendingOrders}
                      </span>
                    )}
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}

