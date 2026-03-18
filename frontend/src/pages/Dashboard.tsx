import { ReactNode } from 'react'
import { useFrappeGetDocList } from '@/lib/frappe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  ShoppingCart, 
  Package, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Crown, 
  Lock, 
  ArrowRight,
  Zap,
  Star,
  Activity,
  MapPin,
  ChevronRight
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { useCurrency } from '@/hooks/useCurrency'
import { cn } from '@/lib/utils'

// Enhanced Stat Card with Trends
function StatCard({ 
  title, 
  value, 
  subtext, 
  icon: Icon, 
  trend, 
  trendValue, 
  isPro, 
  gradient 
}: { 
  title: string, 
  value: string | number, 
  subtext: string, 
  icon: any, 
  trend?: 'up' | 'down', 
  trendValue?: string,
  isPro?: boolean,
  gradient?: string
}) {
  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-300 hover:shadow-lg border-none bg-card shadow-sm",
      isPro && gradient && `bg-gradient-to-br ${gradient} text-white`
    )}>
      {isPro && (
        <div className="absolute top-0 right-0 p-3 opacity-10">
          <Icon className="h-16 w-16" />
        </div>
      )}
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className={cn("text-xs font-medium uppercase tracking-wider", isPro ? "text-white/80" : "text-muted-foreground")}>
          {title}
        </CardTitle>
        {!isPro && <Icon className="h-4 w-4 text-primary" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">
          {value}
        </div>
        <div className="mt-1 flex items-center gap-2">
          {trend && (
            <span className={cn(
              "flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full",
              trend === 'up' 
                ? (isPro ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400")
                : (isPro ? "bg-white/10 text-white/80" : "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400")
            )}>
              {trend === 'up' ? <TrendingUp className="h-2.5 w-2.5 mr-1" /> : <TrendingUp className="h-2.5 w-2.5 mr-1 rotate-180" />}
              {trendValue}
            </span>
          )}
          <p className={cn("text-[11px]", isPro ? "text-white/70" : "text-muted-foreground")}>
            {subtext}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// Custom SVG Line Chart for Revenue
function RevenueTrendChart({ data }: { data: number[] }) {
  if (!data || data.length === 0) return null
  
  const max = Math.max(...data) || 1
  const height = 100
  const width = 300
  const points = data.map((val, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - (val / max) * height
  }))
  
  const pathData = points.reduce((acc, p, i) => 
    i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, ""
  )
  
  const areaData = `${pathData} L ${width} ${height} L 0 ${height} Z`

  return (
    <div className="w-full h-[120px] relative mt-4 group">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaData} fill="url(#gradient)" className="transition-all duration-700" />
        <path d={pathData} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-700 opacity-80 group-hover:opacity-100" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill="var(--background)" stroke="var(--primary)" strokeWidth="2" className="opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        ))}
      </svg>
    </div>
  )
}

// Bar Chart for Top Products
function TopProductsChart({ products }: { products: { name: string, count: number, total: number }[] }) {
  const max = Math.max(...products.map(p => p.count)) || 1
  
  return (
    <div className="space-y-4 mt-2">
      {products.map((p, i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex justify-between text-xs font-medium">
            <span className="truncate max-w-[150px]">{p.name}</span>
            <span className="text-muted-foreground">{p.count} orders</span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${(p.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// Locked Content Wrapper
function LockedInsight({ title, description, children, isPro }: { title: string, description: string, children: ReactNode, isPro: boolean }) {
  if (isPro) return <>{children}</>
  
  return (
    <div className="relative overflow-hidden rounded-xl border bg-card/50 p-6 min-h-[200px] flex flex-col justify-center">
      <div className="absolute inset-0 blur-[3px] opacity-40 select-none pointer-events-none grayscale">
        {children}
      </div>
      <div className="relative z-10 flex flex-col items-center text-center space-y-3">
        <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-1">
          <h3 className="font-bold text-lg">{title}</h3>
          <p className="text-sm text-muted-foreground max-w-[250px] mx-auto">
            {description}
          </p>
        </div>
        <Button 
          variant="default" 
          size="sm" 
          className="rounded-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
          asChild
        >
          <Link to="/billing">
            <Crown className="h-4 w-4 mr-2" />
            Unlock Pro Insights
          </Link>
        </Button>
      </div>
    </div>
  )
}

// Main Dashboard Component
export default function Dashboard() {
  const { selectedRestaurant, isPro } = useRestaurant()
  const { formatAmountNoDecimals } = useCurrency()
  const navigate = useNavigate()
  
  // Fetch data
  const { data: orders } = useFrappeGetDocList('Order', {
    fields: ['name', 'status', 'total', 'creation', 'restaurant', 'table_number'],
    filters: selectedRestaurant ? ({ restaurant: selectedRestaurant } as any) : undefined,
    limit: 100,
    orderBy: { field: 'creation', order: 'desc' }
  }, selectedRestaurant ? `orders-dashboard-${selectedRestaurant}` : null)

  const { data: products } = useFrappeGetDocList('Menu Product', {
    fields: ['name', 'product_name', 'price', 'is_active', 'restaurant'],
    filters: selectedRestaurant ? ({ restaurant: selectedRestaurant } as any) : undefined,
    limit: 100
  }, selectedRestaurant ? `products-dashboard-${selectedRestaurant}` : null)

  const { data: categories } = useFrappeGetDocList('Menu Category', {
    fields: ['name', 'category_name', 'restaurant'],
    filters: selectedRestaurant ? ({ restaurant: selectedRestaurant } as any) : undefined,
    limit: 100
  }, selectedRestaurant ? `categories-dashboard-${selectedRestaurant}` : null)

  const { data: restaurants } = useFrappeGetDocList('Restaurant', {
    fields: ['name', 'restaurant_name', 'is_active', 'owner_email', 'city', 'state'],
    filters: selectedRestaurant ? ({ name: selectedRestaurant } as any) : undefined,
    limit: 100
  }, selectedRestaurant ? `restaurants-dashboard-${selectedRestaurant}` : null)

  // Calculations
  const totalOrders = orders?.length || 0
  const totalRevenue = orders?.reduce((sum, order) => sum + (order.total || 0), 0) || 0

  // Today's Stats
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const todayOrders = orders?.filter((o: any) => new Date(o.creation) >= today) || []
  const yesterdayOrders = orders?.filter((o: any) => {
    const d = new Date(o.creation)
    return d >= yesterday && d < today
  }) || []

  const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.total || 0), 0)
  const yesterdayRevenue = yesterdayOrders.reduce((sum, o) => sum + (o.total || 0), 0)
  
  // Trend percentage
  const revenueTrend = yesterdayRevenue === 0 ? 0 : ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
  const ordersTrend = yesterdayOrders.length === 0 ? 0 : ((todayOrders.length - yesterdayOrders.length) / yesterdayOrders.length) * 100

  // 7-day Trend for Chart
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    d.setHours(0, 0, 0, 0)
    return d
  })

  const dailyRevenue = last7Days.map(date => {
    const nextDay = new Date(date)
    nextDay.setDate(nextDay.getDate() + 1)
    return orders?.filter(o => {
      const d = new Date(o.creation)
      return d >= date && d < nextDay
    }).reduce((sum, o) => sum + (o.total || 0), 0) || 0
  })

  // Top Products (Mocked for now since Order Items aren't fetched, but using what we have)
  const topProducts = products?.slice(0, 4).map(p => ({
    name: p.product_name,
    count: Math.floor(Math.random() * 50) + 10, // Mock count for UI demo
    total: 100
  })).sort((a,b) => b.count - a.count) || []

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />
      case 'cancelled':
      case 'rejected':
        return <XCircle className="h-4 w-4 text-rose-500" />
      case 'pending':
        return <Clock className="h-4 w-4 text-amber-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />
    }
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Header & Upgrade Banner for Lite */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            {isPro ? "Welcome back! Here's your data-driven insight for today." : "Manage your restaurant and track basic operations."}
          </p>
        </div>

        {!isPro && (
          <div 
            className="flex items-center gap-4 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 p-4 rounded-xl border border-orange-100 dark:border-orange-900/30 group cursor-pointer hover:shadow-md transition-all duration-300" 
            onClick={() => navigate('/billing')}
          >
            <div className="h-10 w-10 bg-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform">
              <Zap className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-bold text-orange-700 dark:text-orange-400">Ready to grow?</p>
              <p className="text-[11px] text-orange-600/80 dark:text-orange-500/80">Upgrade to PRO for advanced analytics & AI features.</p>
            </div>
            <ArrowRight className="h-4 w-4 text-orange-400 ml-4 group-hover:translate-x-1 transition-transform" />
          </div>
        )}
      </div>

      {/* Main Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Daily Revenue"
          value={formatAmountNoDecimals(todayRevenue)}
          subtext={`vs ${formatAmountNoDecimals(yesterdayRevenue)} yesterday`}
          icon={TrendingUp}
          trend={revenueTrend >= 0 ? 'up' : 'down'}
          trendValue={`${Math.abs(Math.round(revenueTrend))}%`}
          isPro={isPro}
          gradient="from-indigo-600 to-blue-500"
        />
        <StatCard 
          title="Daily Orders"
          value={todayOrders.length}
          subtext={`vs ${yesterdayOrders.length} yesterday`}
          icon={ShoppingCart}
          trend={ordersTrend >= 0 ? 'up' : 'down'}
          trendValue={`${Math.abs(Math.round(ordersTrend))}%`}
          isPro={isPro}
          gradient="from-emerald-600 to-teal-500"
        />
        <StatCard 
          title="Avg Order Value"
          value={formatAmountNoDecimals(todayOrders.length > 0 ? todayRevenue / todayOrders.length : 0)}
          subtext="Based on today's orders"
          icon={Activity}
          isPro={isPro}
          gradient="from-amber-500 to-orange-500"
        />
        <StatCard 
          title="Total Menu items"
          value={products?.length || 0}
          subtext={`${categories?.length || 0} active categories`}
          icon={Package}
          isPro={isPro}
          gradient="from-rose-500 to-pink-500"
        />
      </div>

      {/* Charts & Insights Section */}
      <div className="grid gap-6 lg:grid-cols-7">
        {/* Revenue Trend Chart - Lg spans 4 cols */}
        <Card className="lg:col-span-4 shadow-sm border-none bg-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold">Revenue Trends</CardTitle>
              <CardDescription>Daily revenue performance over the last 7 days</CardDescription>
            </div>
            <div className="flex gap-2">
               <span className="flex items-center text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md">
                 <TrendingUp className="h-3 w-3 mr-1" />
                 Stable
               </span>
            </div>
          </CardHeader>
          <CardContent>
            <LockedInsight 
              isPro={isPro} 
              title="Revenue Analytics" 
              description="Visualize your growth trends and identify seasonal patterns."
            >
              <div className="flex items-end justify-between mt-4 mb-2 h-[20px]">
                {last7Days.map((d, i) => (
                  <span key={i} className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
                    {d.toLocaleDateString(undefined, { weekday: 'short' })}
                  </span>
                ))}
              </div>
              <RevenueTrendChart data={dailyRevenue} />
              <div className="mt-8 grid grid-cols-2 gap-4">
                 <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">Best Day</p>
                    <p className="text-sm font-bold">Saturday</p>
                 </div>
                 <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">Avg Ticket Size</p>
                    <p className="text-sm font-bold">{formatAmountNoDecimals(totalRevenue / (totalOrders || 1))}</p>
                 </div>
              </div>
            </LockedInsight>
          </CardContent>
        </Card>

        {/* Top Selling Products - Lg spans 3 cols */}
        <Card className="lg:col-span-3 shadow-sm border-none bg-card">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Top Products</CardTitle>
            <CardDescription>Most popular items in your menu</CardDescription>
          </CardHeader>
          <CardContent>
            <LockedInsight 
              isPro={isPro} 
              title="Inventory Insights" 
              description="Know exactly which products drive your revenue."
            >
              <TopProductsChart products={topProducts} />
              <div className="mt-6 pt-6 border-t border-border">
                <Button variant="outline" size="sm" className="w-full text-xs" asChild>
                  <Link to="/products">Manage Inventory</Link>
                </Button>
              </div>
            </LockedInsight>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Orders List */}
        <Card className="shadow-sm border-none bg-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold">Recent Orders</CardTitle>
              <CardDescription>Latest transactions from customers</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-xs" asChild>
              <Link to="/orders">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {todayOrders.length > 0 ? (
                todayOrders.slice(0, 5).map((order: any) => (
                  <div key={order.name} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center",
                        "bg-background border border-border"
                      )}>
                        {getStatusIcon(order.status)}
                      </div>
                      <div>
                        <p className="text-sm font-bold">{order.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {order.table_number ? `Table ${order.table_number}` : 'Delivery'} • {new Date(order.creation).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-foreground">{formatAmountNoDecimals(order.total)}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 space-y-2">
                  <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center mx-auto opacity-40">
                    <ShoppingCart className="h-6 w-6" />
                  </div>
                  <p className="text-sm text-muted-foreground italic">No orders recorded today yet.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pro Insights / Quick Actions */}
        <div className="space-y-6">
           <Card className="shadow-sm border-none bg-card overflow-hidden">
             <CardHeader className="pb-2">
               <CardTitle className="text-lg font-bold flex items-center gap-2">
                 <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                 Smart Recommendations
               </CardTitle>
             </CardHeader>
             <CardContent>
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-4">
                  <p className="text-sm text-foreground/80 leading-relaxed italic">
                    "AI suggests running a 15% discount on <strong>{topProducts[0]?.name || 'Appetizers'}</strong> between 4 PM - 6 PM to boost off-peak hour sales."
                  </p>
                  <Button variant="default" size="sm" className="w-full bg-primary hover:bg-primary/90 text-white gap-2" asChild>
                    <Link to="/recommendations-engine">
                      <Activity className="h-4 w-4" />
                      View AI Analysis
                    </Link>
                  </Button>
                </div>
             </CardContent>
           </Card>

           <div className="grid grid-cols-2 gap-4">
             <Button variant="outline" className="h-[100px] flex-col gap-2 rounded-2xl hover:bg-primary/5 hover:border-primary/30 group" asChild>
               <Link to="/products/new">
                 <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                   <Package className="h-5 w-5 text-primary" />
                 </div>
                 <span className="text-xs font-bold uppercase tracking-wide">Add Product</span>
               </Link>
             </Button>
             <Button variant="outline" className="h-[100px] flex-col gap-2 rounded-2xl hover:bg-emerald-500/5 hover:border-emerald-500/30 group" asChild>
                <Link to="/accept-orders">
                  <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wide">Accept Orders</span>
                </Link>
             </Button>
           </div>
        </div>
      </div>

      {/* Locations Section */}
      <Card className="shadow-sm border-none bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold">My Locations</CardTitle>
            <CardDescription>Managed restaurant outlets</CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="text-xs" asChild>
            <Link to="/setup">Manage All</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {restaurants && restaurants.length > 0 ? (
              restaurants.map((restaurant: any) => (
                <div 
                  key={restaurant.name}
                  className={cn(
                    "group flex items-center justify-between p-4 rounded-xl border transition-all duration-300",
                    restaurant.name === selectedRestaurant 
                      ? "bg-primary/5 border-primary/20 shadow-sm" 
                      : "bg-muted/20 border-border hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110",
                      restaurant.name === selectedRestaurant ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                    )}>
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{restaurant.restaurant_name || restaurant.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {restaurant.city || 'Default Location'}
                      </p>
                    </div>
                  </div>
                  {restaurant.name === selectedRestaurant && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      Active
                      <ChevronRight className="h-2.5 w-2.5" />
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-6 text-muted-foreground italic text-sm">
                No locations found.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}







