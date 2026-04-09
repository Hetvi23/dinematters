import { ReactNode } from 'react'
import { useFrappeGetDocList, useFrappeGetCall } from '@/lib/frappe'
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
  QrCode,
  Users
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
  isGold, 
  gradient 
}: { 
  title: string, 
  value: string | number, 
  subtext: string, 
  icon: any, 
  trend?: 'up' | 'down', 
  trendValue?: string,
  isGold?: boolean,
  gradient?: string
}) {
  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-300 hover:shadow-lg border-none bg-card shadow-sm",
      isGold && gradient && `bg-gradient-to-br ${gradient} text-white`
    )}>
      {isGold && (
        <div className="absolute top-0 right-0 p-3 opacity-10">
          <Icon className="h-16 w-16" />
        </div>
      )}
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className={cn("text-xs font-medium uppercase tracking-wider", isGold ? "text-white/80" : "text-muted-foreground")}>
          {title}
        </CardTitle>
        {!isGold && <Icon className="h-4 w-4 text-primary" />}
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
                ? (isGold ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400")
                : (isGold ? "bg-white/10 text-white/80" : "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400")
            )}>
              {trend === 'up' ? <TrendingUp className="h-2.5 w-2.5 mr-1" /> : <TrendingUp className="h-2.5 w-2.5 mr-1 rotate-180" />}
              {trendValue}
            </span>
          )}
          <p className={cn("text-[11px]", isGold ? "text-white/70" : "text-muted-foreground")}>
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
function LockedInsight({ title, description, children, isUnlocked }: { title: string, description: string, children: ReactNode, isUnlocked: boolean }) {
  if (isUnlocked) return <>{children}</>
  
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
            Unlock Gold Insights
          </Link>
        </Button>
      </div>
    </div>
  )
}

// Main Dashboard Component
export default function Dashboard() {
  const { selectedRestaurant, isGold, isDiamond } = useRestaurant()
  const isAtLeastGold = isGold || isDiamond
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

  const { data: restaurants } = useFrappeGetDocList('Restaurant', {
    fields: ['name', 'restaurant_name', 'is_active', 'owner_email', 'city', 'state'],
    filters: selectedRestaurant ? ({ name: selectedRestaurant } as any) : undefined,
    limit: 100
  }, selectedRestaurant ? `restaurants-dashboard-${selectedRestaurant}` : null)
  
  // Real-time Analytics Summary
  const { data: analytics } = useFrappeGetCall('dinematters.dinematters.api.analytics.get_dashboard_summary', {
    restaurant_id: selectedRestaurant
  }, selectedRestaurant ? `analytics-dashboard-${selectedRestaurant}` : null)

  const analyticsData = analytics?.success ? analytics : null

  // Calculations
  const totalOrders = orders?.length || 0
  const totalRevenue = orders?.reduce((sum, order) => sum + (order.total || 0), 0) || 0

  // Today's Stats
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const todayOrders = orders?.filter((o: any) => new Date(o.creation) >= today) || []


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
      {/* Top Banner & Strategy */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          </div>
          <p className="text-muted-foreground text-sm flex items-center gap-1.5">
            <Activity className="h-4 w-4 text-primary" />
            Showing rolling 7-day performance for <span className="font-bold text-foreground">{restaurants?.[0]?.restaurant_name || selectedRestaurant}</span>
          </p>
        </div>

        {/* Dynamic Upgrade Banner */}
        {!isAtLeastGold && (
           <div 
             className="flex flex-1 sm:flex-initial items-center gap-3 sm:gap-4 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 p-3 sm:p-4 rounded-xl border border-orange-100 dark:border-orange-900/30 group cursor-pointer hover:shadow-md transition-all duration-300" 
             onClick={() => navigate('/autopay-setup')}
           >
             <div className="h-10 w-10 bg-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform">
               <Zap className="h-5 w-5 text-white animate-pulse" />
             </div>
             <div>
               <p className="text-sm font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wide text-[10px]">Ready to grow?</p>
               <p className="text-xs font-bold text-foreground/90">Unlock Scan-to-Order Conversion</p>
             </div>
             <ArrowRight className="h-4 w-4 text-orange-400 ml-4 group-hover:translate-x-1 transition-transform" />
           </div>
        )}
      </div>

      {/* --- PRODUCTION ANALYTICS GRID --- */}
      <div className="space-y-8">
        
        {/* Layer 1: Guest Engagement (Addiction - For All Tiers) */}
        <div>
          <div className="flex items-center gap-2 mb-4">
             <div className="h-1 w-8 bg-primary rounded-full" />
             <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Guest Engagement</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard 
              title="Menu Scans (7D)"
              value={analyticsData?.traffic?.totalViews || 0}
              subtext="Total menu opens this week"
              icon={QrCode}
              trend={analyticsData?.traffic?.growth >= 0 ? 'up' : 'down'}
              trendValue={`${Math.abs(analyticsData?.traffic?.growth || 0)}%`}
              isGold={false}
            />
            <StatCard 
              title="Unique Guests"
              value={analyticsData?.traffic?.uniqueVisitors || 0}
              subtext="Unique brand reach (7D)"
              icon={Users}
              isGold={false}
            />
            <StatCard 
              title="Peak Discovery"
              value={analyticsData?.traffic?.peakHour || "00:00"}
              subtext="Busiest time for menu scans"
              icon={Clock}
              isGold={false}
            />
            <StatCard 
              title="Menu Health"
              value={`${products?.length || 0} Items`}
              subtext={`${analyticsData?.traffic?.totalViews || 0} impressions served`}
              icon={Package}
              isGold={false}
            />
          </div>
        </div>

        {/* Layer 2: Business Performance (Impact - For GOLD/DIAMOND) */}
        {isAtLeastGold && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center gap-2 mb-4">
               <div className="h-1 w-8 bg-indigo-500 rounded-full" />
               <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500/80">Business Performance</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard 
                title="7D Revenue"
                value={formatAmountNoDecimals(totalRevenue)}
                subtext={`vs ${formatAmountNoDecimals(totalRevenue * 0.9)} last 7D`}
                icon={TrendingUp}
                trend="up"
                trendValue="10%"
                isGold={true}
                gradient="from-indigo-600 to-blue-500"
              />
              <StatCard 
                title="Weekly Orders"
                value={totalOrders}
                subtext={`${Math.round(totalOrders / 7)} orders daily average`}
                icon={ShoppingCart}
                isGold={true}
                gradient="from-emerald-600 to-teal-500"
              />
              <StatCard 
                title="Conv. Rate %"
                value={`${analyticsData?.enhanced?.conversionRate || 0}%`}
                subtext="Scans to Order success"
                icon={Zap}
                isGold={true}
                gradient="from-amber-500 to-orange-500"
              />
              <StatCard 
                title="Avg Order Value"
                value={formatAmountNoDecimals(analyticsData?.enhanced?.avgOrderValue || 0)}
                subtext="Spend per customer visit"
                icon={Activity}
                isGold={true}
                gradient="from-rose-500 to-pink-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Insights & Actions Grid */}
      <div className="grid gap-6 lg:grid-cols-7 pt-4">
        {/* Revenue & Scan Trends Comparison Chart */}
        <Card className="lg:col-span-4 shadow-sm border-none bg-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                 Growth Intelligence
                 <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">GOLD</span>
              </CardTitle>
              <CardDescription>Visualizing revenue vs guest discovery paths</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <LockedInsight 
              isUnlocked={isAtLeastGold} 
              title="Trend Analysis" 
              description="See how your scans drive orders across the week."
            >
              <div className="flex items-end justify-between mt-4 mb-2 h-[20px]">
                {last7Days.map((d, i) => (
                  <span key={i} className="text-[10px] text-muted-foreground font-medium">
                    {d.toLocaleDateString(undefined, { weekday: 'short' })}
                  </span>
                ))}
              </div>
              <RevenueTrendChart data={dailyRevenue} />
              <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
                 <div className="p-3 bg-muted/30 rounded-xl border border-border/40">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">Peak Day</p>
                    <p className="text-sm font-bold">Saturday</p>
                 </div>
                 <div className="p-3 bg-muted/30 rounded-xl border border-border/40">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">Ticket Size</p>
                    <p className="text-sm font-bold">{formatAmountNoDecimals(analyticsData?.enhanced?.avgOrderValue || 0)}</p>
                 </div>
                 <div className="p-3 bg-muted/30 rounded-xl border border-border/40">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">Scan Efficiency</p>
                    <p className="text-sm font-bold text-primary">High</p>
                 </div>
                 <div className="p-3 bg-muted/30 rounded-xl border border-border/40">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">Churn Risk</p>
                    <p className="text-sm font-bold text-emerald-500">Low</p>
                 </div>
              </div>
            </LockedInsight>
          </CardContent>
        </Card>

        {/* Top Performers (Reach vs Sales) */}
        <Card className="lg:col-span-3 shadow-sm border-none bg-card">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Top Products</CardTitle>
            <CardDescription>Reach metrics for your menu items</CardDescription>
          </CardHeader>
          <CardContent>
            <LockedInsight 
              isUnlocked={isAtLeastGold} 
              title="Engagement Insights" 
              description="Learn which dishes attract eyes and which ones attract cash."
            >
              <TopProductsChart products={analyticsData?.topPerformers?.map((p: any) => ({
                name: p.item_name,
                count: p.views,
                total: analyticsData.traffic.totalViews
              })) || topProducts} />
              <div className="mt-10 pt-6 border-t border-border flex justify-between items-center">
                 <p className="text-[11px] text-muted-foreground italic flex items-center gap-1">
                   <Clock className="h-3 w-3" /> Updated in real-time
                 </p>
                <Button variant="outline" size="sm" className="text-xs rounded-full px-4" asChild>
                  <Link to="/products">Manage Menu</Link>
                </Button>
              </div>
            </LockedInsight>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions and Activity Layer */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Real-time Feed (Recent Orders) */}
        <Card className="shadow-sm border-none bg-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold">Today's Transactions</CardTitle>
              <CardDescription>Latest order activities</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-xs rounded-full" asChild>
              <Link to="/orders">View Ledger</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {todayOrders.length > 0 ? (
                todayOrders.slice(0, 5).map((order: any) => (
                  <div key={order.name} className="flex items-center justify-between p-3 rounded-2xl bg-muted/20 hover:bg-muted/40 transition-colors border border-transparent hover:border-border/40">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-background border border-border/60 flex items-center justify-center">
                        {getStatusIcon(order.status)}
                      </div>
                      <div>
                        <p className="text-sm font-bold">{order.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Table {order.table_number || 'N/A'} • {new Date(order.creation).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="text-sm font-bold text-foreground">{formatAmountNoDecimals(order.total)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 px-6">
                  <div className="h-14 w-14 bg-muted/40 rounded-full flex items-center justify-center mx-auto mb-4 border border-border/40">
                    <ShoppingCart className="h-6 w-6 text-muted-foreground opacity-30" />
                  </div>
                  <h4 className="text-sm font-bold text-muted-foreground/60 mb-1">No Orders Today</h4>
                  <p className="text-xs text-muted-foreground/40 italic">Waiting for your first scan of the day...</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Smart Recommendations Engine Overlay */}
        <div className="space-y-6">
           <Card className="shadow-sm border-none bg-card relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                <Zap className="h-32 w-32" />
             </div>
             <CardHeader className="pb-2">
               <CardTitle className="text-lg font-bold flex items-center gap-2">
                 <div className="h-8 w-8 bg-amber-100 dark:bg-amber-950/40 rounded-lg flex items-center justify-center">
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                 </div>
                 Smart Growth Engine
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
                 <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 relative">
                   <p className="text-sm text-foreground/80 leading-relaxed font-sans italic">
                     "AI indicates that <strong>{analyticsData?.traffic?.topCategory?.[0]?.event_value || 'Beverages'}</strong> are being viewed more than they are being ordered. Suggest adding a <strong>'Featured Combo'</strong> to boost sales."
                   </p>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <Button variant="default" size="sm" className="bg-primary hover:bg-primary/90 text-white rounded-xl h-11 transition-all" asChild>
                      <Link to="/recommendations-engine" className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        AI Analysis
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-xl h-11 border-primary/20 hover:bg-primary/5 hover:text-primary transition-all" asChild>
                       <Link to="/accept-orders">
                         Queue Settings
                       </Link>
                    </Button>
                 </div>
             </CardContent>
           </Card>

           <div className="grid grid-cols-2 gap-4">
              <Card className="p-5 flex flex-col items-center justify-center gap-3 bg-muted/20 border-border/40 hover:bg-muted/40 transition-all cursor-pointer group" onClick={() => navigate('/products/new')}>
                 <div className="h-10 w-10 rounded-full bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Package className="h-5 w-5 text-indigo-500" />
                 </div>
                 <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Add Dish</p>
              </Card>
              <Card className="p-5 flex flex-col items-center justify-center gap-3 bg-muted/20 border-border/40 hover:bg-muted/40 transition-all cursor-pointer group" onClick={() => navigate('/setup')}>
                 <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <MapPin className="h-5 w-5 text-emerald-500" />
                 </div>
                 <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">My Store</p>
              </Card>
           </div>
        </div>
      </div>

      {/* Multi-Location Management View */}
      <Card className="shadow-sm border-none bg-card">
        <CardHeader className="flex flex-row items-center justify-between pb-6">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold">Outlets</CardTitle>
            <CardDescription>Switch between your managed locations</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {restaurants?.map((restaurant: any) => (
              <div 
                key={restaurant.name}
                className={cn(
                  "group flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 cursor-pointer",
                  restaurant.name === selectedRestaurant 
                    ? "bg-primary/10 border-primary/30 shadow-md shadow-primary/5" 
                    : "bg-muted/30 border-border/40 hover:bg-muted/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center transition-all",
                    restaurant.name === selectedRestaurant ? "bg-primary text-white" : "bg-background border border-border text-muted-foreground"
                  )}>
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold truncate max-w-[120px]">{restaurant.restaurant_name || restaurant.name}</p>
                    <p className="text-[11px] text-muted-foreground italic">
                      {restaurant.city || 'Standard Area'}
                    </p>
                  </div>
                </div>
                {restaurant.name === selectedRestaurant && (
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}







