import { Link, useLocation } from 'react-router-dom'
import { Home, ShoppingCart, Package, FolderTree, Grid3x3, Sparkles, Store, Menu, X, Lock, LockOpen, ChevronDown, TrendingUp, TrendingDown, DollarSign, Clock, AlertCircle, Activity, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFrappeGetDocList, useFrappeGetCall } from '@/lib/frappe'
import { useState, useEffect, useMemo } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTheme } from '@/contexts/ThemeContext'
import Breadcrumb from './Breadcrumb'

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

interface Restaurant {
  name: string
  restaurant_id: string
  restaurant_name: string
  is_active: boolean
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(false) // Mobile sidebar
  const [sidebarExpanded, setSidebarExpanded] = useState(true) // Desktop sidebar expanded/collapsed
  const [sidebarHovered, setSidebarHovered] = useState(false) // Hover state for temporary expansion
  const [hoverDisabled, setHoverDisabled] = useState(false) // Temporarily disable hover after toggle
  const [selectOpen, setSelectOpen] = useState(false) // Track if restaurant select is open
  const [lockAnimating, setLockAnimating] = useState(false) // Track lock animation state
  const [selectedRestaurant, setSelectedRestaurant] = useState<string | null>(null)

  // Fetch user's restaurants
  const { data: restaurantsData } = useFrappeGetCall<{ message: { restaurants: Restaurant[] } }>(
    'dinematters.dinematters.api.ui.get_user_restaurants',
    {},
    'user-restaurants'
  )

  const restaurants = restaurantsData?.message?.restaurants || []

  // Initialize selected restaurant from localStorage or use first restaurant
  useEffect(() => {
    if (restaurants.length > 0 && !selectedRestaurant) {
      try {
        const saved = localStorage.getItem('dinematters-selected-restaurant')
        if (saved && restaurants.find(r => r.name === saved || r.restaurant_id === saved)) {
          setSelectedRestaurant(saved)
        } else {
          // Use first restaurant as default
          setSelectedRestaurant(restaurants[0].name)
          localStorage.setItem('dinematters-selected-restaurant', restaurants[0].name)
        }
      } catch {
        setSelectedRestaurant(restaurants[0].name)
      }
    }
  }, [restaurants, selectedRestaurant])

  // Handle restaurant change
  const handleRestaurantChange = (restaurantId: string) => {
    setSelectedRestaurant(restaurantId)
    try {
      localStorage.setItem('dinematters-selected-restaurant', restaurantId)
      // Reload page to refresh data with new restaurant context
      window.location.reload()
    } catch {
      // If localStorage fails, still update state
    }
  }

  // Get current restaurant details
  const currentRestaurant = restaurants.find(r => r.name === selectedRestaurant || r.restaurant_id === selectedRestaurant)

  // Fetch orders for analytics
  const { data: orders } = useFrappeGetDocList('Order', {
    fields: ['name', 'status', 'total', 'creation'],
    limit: 200,
    orderBy: { field: 'creation', order: 'desc' }
  })

  // Calculate analytics metrics
  const analytics = useMemo(() => {
    if (!orders || orders.length === 0) {
      return {
        todayRevenue: 0,
        todayOrders: 0,
        pendingOrders: 0,
        totalRevenue: 0,
        totalOrders: 0,
        avgOrderValue: 0,
        yesterdayRevenue: 0,
        yesterdayOrders: 0,
        revenueChange: 0,
        ordersChange: 0,
      }
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    // Today's metrics
    const todayOrders = orders.filter((order: any) => {
      const orderDate = new Date(order.creation)
      return orderDate >= today
    })
    const todayRevenue = todayOrders.reduce((sum: number, order: any) => sum + (order.total || 0), 0)
    const todayOrdersCount = todayOrders.length

    // Yesterday's metrics
    const yesterdayOrders = orders.filter((order: any) => {
      const orderDate = new Date(order.creation)
      return orderDate >= yesterday && orderDate < today
    })
    const yesterdayRevenue = yesterdayOrders.reduce((sum: number, order: any) => sum + (order.total || 0), 0)
    const yesterdayOrdersCount = yesterdayOrders.length

    // Overall metrics
    const totalRevenue = orders.reduce((sum: number, order: any) => sum + (order.total || 0), 0)
    const totalOrders = orders.length
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
    const pendingOrders = orders.filter((order: any) => 
      order.status?.toLowerCase() === 'pending'
    ).length

    // Calculate changes
    const revenueChange = yesterdayRevenue > 0 
      ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 
      : (todayRevenue > 0 ? 100 : 0)
    const ordersChange = yesterdayOrdersCount > 0
      ? ((todayOrdersCount - yesterdayOrdersCount) / yesterdayOrdersCount) * 100
      : (todayOrdersCount > 0 ? 100 : 0)

    return {
      todayRevenue,
      todayOrders: todayOrdersCount,
      pendingOrders,
      totalRevenue,
      totalOrders,
      avgOrderValue,
      yesterdayRevenue,
      yesterdayOrders: yesterdayOrdersCount,
      revenueChange,
      ordersChange,
    }
  }, [orders])

  // Get pending orders count for badge
  const pendingOrders = analytics.pendingOrders

  // Determine if sidebar should show expanded content (either expanded state or hovered, but not if hover is disabled)
  const showExpanded = sidebarExpanded || (sidebarHovered && !hoverDisabled)

  // Handle toggle button click
  const handleToggle = () => {
    // Trigger animation
    setLockAnimating(true)
    setTimeout(() => {
      setLockAnimating(false)
    }, 300)
    
    setSidebarExpanded(!sidebarExpanded)
    // Disable hover temporarily to prevent immediate re-expansion
    setHoverDisabled(true)
    setSidebarHovered(false)
    // Re-enable hover after a short delay
    setTimeout(() => {
      setHoverDisabled(false)
    }, 300)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar - Toggleable with Hover */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-sidebar border-r border-sidebar-border transform transition-all duration-200 ease-in-out shadow-sm",
          // Mobile: slide in/out
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          // Desktop: width based on expanded state or hover
          showExpanded ? "lg:w-64" : "lg:w-16"
        )}
        onMouseEnter={() => !sidebarExpanded && !hoverDisabled && setSidebarHovered(true)}
        onMouseLeave={(e) => {
          // Don't collapse if select dropdown is open or if mouse is moving to dropdown
          const relatedTarget = e.relatedTarget as HTMLElement
          if (!selectOpen && relatedTarget && !relatedTarget.closest('[role="listbox"]')) {
            setSidebarHovered(false)
          }
        }}
      >
        <div className="flex flex-col h-full">
          {/* Logo with Toggle Button - Unified with Top Navbar */}
          <div className={cn(
            "flex items-center bg-card border-r border-sidebar-border transition-all",
            showExpanded ? "px-4 justify-between py-2.5 h-[3.5rem]" : "px-2 justify-center h-[3.5rem]"
          )}>
            {showExpanded ? (
              <>
                <div className="flex-1 flex flex-col gap-0.5 min-w-0 max-w-full">
                  {/* Restaurant Dropdown */}
                  {restaurants.length > 0 ? (
                    <Select
                      value={selectedRestaurant || restaurants[0]?.name || ''}
                      onValueChange={handleRestaurantChange}
                      onOpenChange={(open) => {
                        setSelectOpen(open)
                        // Keep sidebar expanded while dropdown is open
                        if (open && !sidebarExpanded) {
                          setSidebarHovered(true)
                        }
                      }}
                    >
                      <SelectTrigger className="h-auto py-1.5 px-2 border-0 bg-transparent hover:bg-sidebar-accent shadow-none focus:ring-0 focus:ring-offset-0 w-full justify-between data-[state=open]:bg-sidebar-accent [&>svg:last-child]:hidden">
                        <div className="flex items-center min-w-0 flex-1 max-w-[calc(100%-2rem)]">
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <SelectValue className="text-sm font-semibold text-sidebar-foreground block">
                              <span className="inline-block truncate max-w-full whitespace-nowrap overflow-hidden text-ellipsis">
                                {currentRestaurant?.restaurant_name || restaurants[0]?.restaurant_name || 'Select Restaurant'}
                              </span>
                            </SelectValue>
                          </div>
                        </div>
                        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2 opacity-70" />
                      </SelectTrigger>
                      <SelectContent 
                        className="min-w-[240px] z-[60]"
                        onCloseAutoFocus={() => {
                          // When dropdown closes, allow sidebar to collapse if needed
                          setSelectOpen(false)
                        }}
                      >
                        {restaurants.map((restaurant) => (
                          <SelectItem key={restaurant.name} value={restaurant.name}>
                            <div className="flex items-center gap-2 w-full">
                              <Store className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-sm font-medium text-foreground truncate">{restaurant.restaurant_name}</span>
                                {!restaurant.is_active && (
                                  <span className="text-xs text-muted-foreground">Inactive</span>
                                )}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-2 py-1.5 px-2">
                      <Store className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">No restaurants</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Lock/Unlock Button - Desktop Only */}
                  <button
                    onClick={handleToggle}
                    className={cn(
                      "hidden lg:flex items-center justify-center p-1.5 rounded-md transition-all duration-300",
                      "hover:bg-sidebar-accent active:scale-90",
                      "relative overflow-visible",
                      sidebarExpanded 
                        ? "text-primary hover:text-primary/80" 
                        : "text-muted-foreground hover:text-sidebar-foreground"
                    )}
                    title={sidebarExpanded ? "Unlock sidebar (allow auto-collapse)" : "Lock sidebar (keep expanded)"}
                  >
                    <div className={cn(
                      "relative transition-all duration-300",
                      lockAnimating && "lock-toggle-animate"
                    )}>
                      {sidebarExpanded ? (
                        <Lock className="h-4 w-4 transition-all duration-300" />
                      ) : (
                        <LockOpen className="h-4 w-4 transition-all duration-300" />
                      )}
                    </div>
                  </button>
                  {/* Close Button - Mobile Only */}
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="lg:hidden p-1.5 rounded-md hover:bg-sidebar-accent transition-colors"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link to="/dashboard" className="flex items-center justify-center hover:opacity-80 transition-opacity flex-1">
                  <Store className="h-5 w-5 text-primary" />
                </Link>
                {/* Lock/Unlock Button when collapsed - Desktop Only */}
                <button
                  onClick={handleToggle}
                  className={cn(
                    "hidden lg:flex items-center justify-center p-1.5 rounded transition-all duration-300",
                    "hover:bg-sidebar-accent active:scale-90",
                    "relative overflow-visible",
                    sidebarExpanded 
                      ? "text-primary hover:text-primary/80" 
                      : "text-muted-foreground hover:text-sidebar-foreground"
                  )}
                  title={sidebarExpanded ? "Unlock sidebar" : "Lock sidebar"}
                >
                  <div className={cn(
                    "relative transition-all duration-300",
                    lockAnimating && "lock-toggle-animate"
                  )}>
                    {sidebarExpanded ? (
                      <Lock className="h-4 w-4 transition-all duration-300" />
                    ) : (
                      <LockOpen className="h-4 w-4 transition-all duration-300" />
                    )}
                  </div>
                </button>
              </>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
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
                    "relative flex items-center rounded-md text-sm font-normal transition-all group",
                    showExpanded ? "gap-3 px-3 py-2" : "justify-center px-2 py-2",
                    "hover:bg-sidebar-accent active:bg-sidebar-accent/80",
                    isActive
                      ? "bg-primary/10 text-primary font-medium dark:bg-primary/20"
                      : "text-sidebar-foreground hover:text-sidebar-foreground"
                  )}
                  title={!showExpanded ? item.name : undefined}
                >
                  {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r" />
                  )}
                  <Icon className={cn(
                    "h-4 w-4 flex-shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )} />
                  {showExpanded && (
                    <>
                      <span className="flex-1">{item.name}</span>
                      {showBadge && (
                        <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-destructive text-white text-xs flex items-center justify-center font-semibold">
                          {pendingOrders > 9 ? '9+' : pendingOrders}
                        </span>
                      )}
                    </>
                  )}
                  {/* Tooltip for collapsed state */}
                  {!showExpanded && (
                    <span className="absolute left-full ml-2 px-2 py-1 rounded-md bg-foreground text-background text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 shadow-lg">
                      {item.name}
                      {showBadge && ` (${pendingOrders} pending)`}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
          
          {/* Footer with Theme Toggle and Tagline */}
          <div className="px-4 py-3 border-t border-sidebar-border bg-card">
            {showExpanded ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs italic text-muted-foreground font-light flex-1">
                  By Dinematters
                </p>
                {/* Animated Theme Switch - Expanded */}
                <button
                  onClick={toggleTheme}
                  className={cn(
                    "relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 ease-in-out",
                    "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card",
                    "hover:scale-105 active:scale-95",
                    theme === 'dark' 
                      ? "bg-primary shadow-md shadow-primary/30" 
                      : "bg-muted-foreground/30 hover:bg-muted-foreground/40"
                  )}
                  title={theme === 'light' ? "Switch to dark mode" : "Switch to light mode"}
                  role="switch"
                  aria-checked={theme === 'dark'}
                >
                  <span
                    className={cn(
                      "absolute flex items-center justify-center h-5 w-5 transform rounded-full bg-white shadow-md transition-all duration-300 ease-in-out",
                      theme === 'dark' ? "translate-x-6" : "translate-x-1"
                    )}
                  >
                    {theme === 'dark' ? (
                      <Moon className="h-3 w-3 text-primary transition-all duration-300" />
                    ) : (
                      <Sun className="h-3 w-3 text-muted-foreground transition-all duration-300" />
                    )}
                  </span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                {/* Animated Theme Switch - Collapsed */}
                <button
                  onClick={toggleTheme}
                  className={cn(
                    "relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 ease-in-out",
                    "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-sidebar",
                    "hover:scale-105 active:scale-95",
                    theme === 'dark' 
                      ? "bg-primary shadow-md shadow-primary/30" 
                      : "bg-muted-foreground/30 hover:bg-muted-foreground/40"
                  )}
                  title={theme === 'light' ? "Switch to dark mode" : "Switch to light mode"}
                  role="switch"
                  aria-checked={theme === 'dark'}
                >
                  <span
                    className={cn(
                      "absolute flex items-center justify-center h-5 w-5 transform rounded-full bg-white shadow-md transition-all duration-300 ease-in-out",
                      theme === 'dark' ? "translate-x-6" : "translate-x-1"
                    )}
                  >
                    {theme === 'dark' ? (
                      <Moon className="h-3 w-3 text-primary transition-all duration-300" />
                    ) : (
                      <Sun className="h-3 w-3 text-muted-foreground transition-all duration-300" />
                    )}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className={cn(
        "transition-all duration-200",
        showExpanded ? "lg:pl-64" : "lg:pl-16"
      )}>
        {/* Top Header - Analytics Magic Panel - Unified with Sidebar */}
        <header className="sticky top-0 z-30 bg-card border-b border-border shadow-sm">
          <div className="flex items-center h-[3.5rem]">
            {/* Left: Mobile Menu Only */}
            <div className="flex items-center flex-shrink-0 lg:hidden pl-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 -ml-2 rounded-md hover:bg-accent transition-colors"
              >
                <Menu className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* Analytics Panel - Full Width from Start */}
            <div className="hidden lg:flex items-center gap-4 flex-1 pl-6 pr-6 flex-nowrap overflow-x-auto h-full">
              {/* Today's Revenue */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-muted transition-colors group whitespace-nowrap">
                <DollarSign className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                <span className="text-xs text-muted-foreground">Today:</span>
                <span className="text-sm font-semibold text-foreground">
                  ₹{analytics.todayRevenue.toFixed(0)}
                </span>
                {analytics.revenueChange !== 0 && (
                  <div className={cn(
                    "flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ml-1",
                    analytics.revenueChange > 0 
                      ? "text-[#107c10] bg-[#dff6dd] dark:text-[#81c784] dark:bg-[#1b5e20]" 
                      : "text-[#d13438] bg-[#fde7e9] dark:text-white dark:bg-[#b71c1c]"
                  )}>
                    {analytics.revenueChange > 0 ? (
                      <TrendingUp className={cn(
                        "h-2.5 w-2.5",
                        analytics.revenueChange > 0 
                          ? "text-[#107c10] dark:text-[#81c784]" 
                          : "text-[#d13438] dark:text-white"
                      )} />
                    ) : (
                      <TrendingDown className={cn(
                        "h-2.5 w-2.5",
                        analytics.revenueChange > 0 
                          ? "text-[#107c10] dark:text-[#81c784]" 
                          : "text-[#d13438] dark:text-white"
                      )} />
                    )}
                    <span className="whitespace-nowrap">{Math.abs(analytics.revenueChange).toFixed(0)}%</span>
                  </div>
                )}
              </div>

              {/* Today's Orders */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-muted transition-colors group whitespace-nowrap">
                <ShoppingCart className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                <span className="text-xs text-muted-foreground">Orders:</span>
                <span className="text-sm font-semibold text-foreground">
                  {analytics.todayOrders}
                </span>
                {analytics.ordersChange !== 0 && (
                  <div className={cn(
                    "flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ml-1",
                    analytics.ordersChange > 0 
                      ? "text-[#107c10] bg-[#dff6dd] dark:text-[#81c784] dark:bg-[#1b5e20]" 
                      : "text-[#d13438] bg-[#fde7e9] dark:text-white dark:bg-[#b71c1c]"
                  )}>
                    {analytics.ordersChange > 0 ? (
                      <TrendingUp className={cn(
                        "h-2.5 w-2.5",
                        analytics.ordersChange > 0 
                          ? "text-[#107c10] dark:text-[#81c784]" 
                          : "text-[#d13438] dark:text-white"
                      )} />
                    ) : (
                      <TrendingDown className={cn(
                        "h-2.5 w-2.5",
                        analytics.ordersChange > 0 
                          ? "text-[#107c10] dark:text-[#81c784]" 
                          : "text-[#d13438] dark:text-white"
                      )} />
                    )}
                    <span className="whitespace-nowrap">{Math.abs(analytics.ordersChange).toFixed(0)}%</span>
                  </div>
                )}
              </div>

              {/* Pending Orders Alert */}
              {analytics.pendingOrders > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#fff4ce] dark:bg-[#ca5010]/20 border border-[#ffe69d] dark:border-[#ca5010]/40 hover:bg-[#fff4ce]/80 dark:hover:bg-[#ca5010]/30 transition-colors whitespace-nowrap">
                  <AlertCircle className="h-3.5 w-3.5 text-[#ca5010] dark:text-[#ffaa44] flex-shrink-0" />
                  <span className="text-xs text-[#ca5010] dark:text-[#ffaa44] font-medium">Pending:</span>
                  <span className="text-sm font-semibold text-[#ca5010] dark:text-[#ffaa44]">
                    {analytics.pendingOrders}
                  </span>
                </div>
              )}

              {/* Average Order Value */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-muted transition-colors group whitespace-nowrap">
                <Activity className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-xs text-muted-foreground">Avg:</span>
                <span className="text-sm font-semibold text-foreground">
                  ₹{analytics.avgOrderValue.toFixed(0)}
                </span>
              </div>

              {/* Total Revenue */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-muted transition-colors group whitespace-nowrap">
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-xs text-muted-foreground">Total:</span>
                <span className="text-sm font-semibold text-foreground">
                  ₹{analytics.totalRevenue.toFixed(0)}
                </span>
              </div>
            </div>

            {/* Mobile Analytics Panel - Compact */}
            <div className="lg:hidden flex-1 overflow-x-auto px-2">
              <div className="flex items-center gap-2">
                {/* Today's Revenue - Mobile */}
                <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted whitespace-nowrap">
                  <DollarSign className="h-3 w-3 text-primary flex-shrink-0" />
                  <span className="text-xs font-semibold text-foreground">
                    ₹{analytics.todayRevenue.toFixed(0)}
                  </span>
                </div>

                {/* Today's Orders - Mobile */}
                <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted whitespace-nowrap">
                  <ShoppingCart className="h-3 w-3 text-primary flex-shrink-0" />
                  <span className="text-xs font-semibold text-foreground">
                    {analytics.todayOrders}
                  </span>
                </div>

                {/* Pending Orders - Mobile */}
                {analytics.pendingOrders > 0 && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#fff4ce] dark:bg-[#ca5010]/20 border border-[#ffe69d] dark:border-[#ca5010]/40 whitespace-nowrap">
                    <AlertCircle className="h-3 w-3 text-[#ca5010] dark:text-[#ffaa44] flex-shrink-0" />
                    <span className="text-xs font-semibold text-[#ca5010] dark:text-[#ffaa44]">
                      {analytics.pendingOrders}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-3 sm:p-4 md:p-6 bg-background min-h-[calc(100vh-4.5rem)] overflow-x-hidden">
          <div className="max-w-full">
            <Breadcrumb />
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

