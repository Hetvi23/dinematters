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
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'cancelled':
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'delivered':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Overview of your restaurant operations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/setup">
              <LinkIcon className="mr-2 h-4 w-4" />
              Setup Wizard
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/modules">
              <Package className="mr-2 h-4 w-4" />
              All Modules
            </Link>
          </Button>
        </div>
      </div>

      {/* Primary Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Restaurants</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {restaurantsLoading ? '...' : `${activeRestaurants}/${totalRestaurants}`}
            </div>
            <p className="text-xs text-muted-foreground">
              Active / Total restaurants
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Orders</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {ordersLoading ? '...' : todayOrders.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Revenue: ₹{todayRevenue.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {ordersLoading ? '...' : totalOrders}
            </div>
            <p className="text-xs text-muted-foreground">
              All time orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {ordersLoading ? '...' : `₹${totalRevenue.toFixed(2)}`}
            </div>
            <p className="text-xs text-muted-foreground">
              Total revenue from orders
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Menu Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {productsLoading ? '...' : totalProducts}
            </div>
            <p className="text-xs text-muted-foreground">
              Active menu products
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <FolderTree className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {categoriesLoading ? '...' : totalCategories}
            </div>
            <p className="text-xs text-muted-foreground">
              Menu categories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Order Status</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(orderStatusCounts).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{status}</span>
                  <span className="text-sm font-semibold">{count as number}</span>
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Restaurants</CardTitle>
                <CardDescription>Your restaurant locations</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
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
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{restaurant.restaurant_name || restaurant.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {restaurant.city && restaurant.state
                          ? `${restaurant.city}, ${restaurant.state}`
                          : restaurant.owner_email || 'No details'}
                      </p>
                    </div>
                    <div className="ml-4">
                      {restaurant.is_active ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Orders</CardTitle>
                <CardDescription>Latest orders from your restaurants</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
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
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {getStatusIcon(order.status)}
                      <div className="flex-1">
                        <p className="font-medium">{order.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {order.restaurant && (
                            <span>{order.restaurant}</span>
                          )}
                          {order.table_number && (
                            <span> • Table {order.table_number}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-medium">₹{order.total || 0}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(order.creation).toLocaleDateString()}
                      </p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${getStatusColor(order.status || 'Pending')}`}>
                        {order.status || 'Pending'}
                      </span>
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







