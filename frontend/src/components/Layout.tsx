import { Link, useLocation } from 'react-router-dom'
import { Home, ShoppingCart, Package, FolderTree, Grid3x3, Sparkles, Store, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFrappeGetDocList } from '@/lib/frappe'
import { useState } from 'react'

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
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Fetch orders for pending count badge
  const { data: orders } = useFrappeGetDocList('Order', {
    fields: ['name', 'status'],
    limit: 100
  })

  // Get pending orders count
  const pendingOrders = orders?.filter((order: any) => 
    order.status?.toLowerCase() === 'pending'
  )?.length || 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <Link to="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <h1 className="text-xl font-bold text-orange-600">Dinematters</h1>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 rounded-md hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.href || 
                (item.href !== '/dashboard' && location.pathname.startsWith(item.href))
              
              const showBadge = item.href === '/orders' && pendingOrders > 0
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                    isActive
                      ? "bg-orange-50 text-orange-600"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span>{item.name}</span>
                  {showBadge && (
                    <span className="ml-auto h-5 min-w-[20px] px-1.5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
                      {pendingOrders > 9 ? '9+' : pendingOrders}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-200 flex items-center px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 rounded-md hover:bg-gray-100"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 lg:ml-0 ml-2">
            <h2 className="text-lg font-semibold text-gray-900">
              {navigation.find(item => 
                location.pathname === item.href || 
                (item.href !== '/dashboard' && location.pathname.startsWith(item.href))
              )?.name || 'Dashboard'}
            </h2>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

