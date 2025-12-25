import { useFrappeGetDocList } from '@/lib/frappe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ShoppingCart, Package, FolderTree, TrendingUp, Store, Clock, CheckCircle, XCircle, AlertCircle, Link as LinkIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function Dashboard() {
  // Fetch data with permissions (restaurant-based filtering is handled by permission_query_conditions)
  const { data: orders, isLoading: ordersLoading } = useFrappeGetDocList('Order', {
    fields: ['name', 'status', 'total', 'creation', 'restaurant', 'table_number'],
    limit: 50,
    orderBy: { field: 'creation', order: 'desc' }
  })

  const { data: products, isLoading: productsLoading } = useFrappeGetDocList('Menu Product', {
    fields: ['name', 'product_name', 'price', 'is_active', 'restaurant'],
    limit: 100
  })

  const { data: categories, isLoading: categoriesLoading } = useFrappeGetDocList('Menu Category', {
    fields: ['name', 'category_name', 'restaurant'],
    limit: 100
  })

  const { data: restaurants, isLoading: restaurantsLoading } = useFrappeGetDocList('Restaurant', {
    fields: ['name', 'restaurant_name', 'is_active', 'owner_email', 'city', 'state'],
    limit: 100
  })

  // Calculate stats
  const totalOrders = orders?.length || 0
  const totalProducts = products?.length || 0
  const totalCategories = categories?.length || 0
  const totalRestaurants = restaurants?.length || 0
  const activeRestaurants = restaurants?.filter((r: any) => r.is_active)?.length || 0
  const totalRevenue = orders?.reduce((sum, order) => sum + (order.total || 0), 0) || 0

  // Today's stats
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayOrders = orders?.filter((order: any) => {
    const orderDate = new Date(order.creation)
    orderDate.setHours(0, 0, 0, 0)
    return orderDate.getTime() === today.getTime()
  }) || []
  const todayRevenue = todayOrders.reduce((sum: number, order: any) => sum + (order.total || 0), 0)

  // Order status breakdown
  const orderStatusCounts = orders?.reduce((acc: Record<string, number>, order: any) => {
    const status = order.status || 'Pending'
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {}) || {}

  // Recent orders (last 10)
  const recentOrders = orders?.slice(0, 10) || []

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-[#107c10] dark:text-[#81c784]" />
      case 'cancelled':
      case 'rejected':
        return <XCircle className="h-4 w-4 text-[#d13438] dark:text-[#ef5350]" />
      case 'pending':
        return <Clock className="h-4 w-4 text-[#ca5010] dark:text-[#ffaa44]" />
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'delivered':
        return 'bg-[#dff6dd] dark:bg-[#1b5e20] text-[#107c10] dark:text-[#81c784] border border-[#92c5f7] dark:border-[#4caf50]'
      case 'cancelled':
      case 'rejected':
        return 'bg-[#fde7e9] dark:bg-[#b71c1c] text-[#d13438] dark:text-[#ef5350] border border-[#f4c2c4] dark:border-[#d32f2f]'
      case 'pending':
        return 'bg-[#fff4ce] dark:bg-[#ca5010]/20 text-[#ca5010] dark:text-[#ffaa44] border border-[#ffe69d] dark:border-[#ca5010]/40'
      default:
        return 'bg-muted text-muted-foreground border border-border'
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Overview of your restaurant operations
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild className="flex-1 sm:flex-initial">
            <Link to="/setup">
              <LinkIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Setup Wizard</span>
              <span className="sm:hidden">Setup</span>
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="flex-1 sm:flex-initial">
            <Link to="/modules">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">All Modules</span>
              <span className="sm:hidden">Modules</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Primary Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Restaurants</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              {restaurantsLoading ? '...' : `${activeRestaurants}/${totalRestaurants}`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active / Total restaurants
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Today's Orders</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              {ordersLoading ? '...' : todayOrders.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Revenue: ₹{todayRevenue.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              {ordersLoading ? '...' : totalOrders}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All time orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              {ordersLoading ? '...' : `₹${totalRevenue.toFixed(2)}`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total revenue from orders
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Menu Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              {productsLoading ? '...' : totalProducts}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active menu products
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Categories</CardTitle>
            <FolderTree className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              {categoriesLoading ? '...' : totalCategories}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Menu categories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Order Status</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(orderStatusCounts).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{status}</span>
                  <span className="text-sm font-semibold text-foreground">{count as number}</span>
                </div>
              ))}
              {Object.keys(orderStatusCounts).length === 0 && (
                <p className="text-sm text-muted-foreground">No orders yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Restaurants List */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle>Restaurants</CardTitle>
                <CardDescription>Your restaurant locations</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
                <Link to="/Restaurant">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {restaurantsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : restaurants && restaurants.length > 0 ? (
              <div className="space-y-3">
                {restaurants.slice(0, 5).map((restaurant: any) => (
                  <Link
                    key={restaurant.name}
                    to={`/Restaurant/${restaurant.name}`}
                    className="flex items-center justify-between p-3 rounded-md border border-border hover:bg-muted hover:border-border/80 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{restaurant.restaurant_name || restaurant.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {restaurant.city && restaurant.state
                          ? `${restaurant.city}, ${restaurant.state}`
                          : restaurant.owner_email || 'No details'}
                      </p>
                    </div>
                    <div className="ml-4">
                      {restaurant.is_active ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-[#dff6dd] dark:bg-[#1b5e20] text-[#107c10] dark:text-[#81c784] border border-[#92c5f7] dark:border-[#4caf50]">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground border border-border">
                          Inactive
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
                {restaurants.length > 5 && (
                  <p className="text-sm text-center text-muted-foreground pt-2">
                    +{restaurants.length - 5} more restaurants
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No restaurants found</p>
                <Button variant="outline" size="sm" className="mt-4" asChild>
                  <Link to="/setup">Create Restaurant</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle>Recent Orders</CardTitle>
                <CardDescription>Latest orders from your restaurants</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
                <Link to="/orders">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : recentOrders && recentOrders.length > 0 ? (
              <div className="space-y-3">
                {recentOrders.map((order: any) => (
                  <Link
                    key={order.name}
                    to={`/orders/${order.name}`}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-md border border-border hover:bg-muted hover:border-border/80 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {getStatusIcon(order.status)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{order.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {order.restaurant && (
                            <span>{order.restaurant}</span>
                          )}
                          {order.table_number && (
                            <span> • Table {order.table_number}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:flex-col sm:items-end sm:text-right sm:ml-4 gap-2">
                      <p className="font-medium text-foreground">₹{order.total || 0}</p>
                      <div className="flex flex-col sm:block items-end sm:items-start gap-1">
                      <p className="text-sm text-muted-foreground">
                        {new Date(order.creation).toLocaleDateString()}
                      </p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${getStatusColor(order.status || 'Pending')}`}>
                        {order.status || 'Pending'}
                      </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">No orders found</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}







