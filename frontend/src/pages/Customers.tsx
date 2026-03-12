import { Fragment, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useFrappeGetCall, useFrappePostCall } from '@/lib/frappe'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { useCurrency } from '@/hooks/useCurrency'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Users, Loader2, CheckCircle, XCircle, ChevronDown, ChevronRight, ChevronLeft, History, Eye, Star, Search } from 'lucide-react'
import { toast } from 'sonner'

interface OrderItem {
  name: string
  order_number: string
  total: number
  status: string
  creation: string
  customer_rating?: number
  customer_feedback?: string
  food_rating?: number
  service_rating?: number
}

interface RestaurantCustomer {
  id: string
  phone: string | null
  customerName: string
  verifiedAt: string | null
  lastVisited: string | null
  orders: OrderItem[]
  tableBookings: unknown[]
  banquetBookings: unknown[]
}

interface CustomersResponse {
  message?: {
    success: boolean
    data?: { customers: RestaurantCustomer[]; isAdmin?: boolean; totalCount?: number }
  }
}

interface RestaurantData {
  restaurant_id: string
  restaurant_name: string
  orders: OrderItem[]
  tableBookings: unknown[]
  banquetBookings: unknown[]
}

interface CustomerProfileData {
  success: boolean
  data?: {
    customer: { id: string; phone: string; customerName: string; email?: string; verifiedAt?: string }
    restaurants: RestaurantData[]
  }
  error?: string
}

export default function Customers() {
  const { selectedRestaurant } = useRestaurant()
  const { formatAmountNoDecimals } = useCurrency()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [profileCustomerId, setProfileCustomerId] = useState<string | null>(null)
  const [profileData, setProfileData] = useState<CustomerProfileData | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const { data, isLoading, error } = useFrappeGetCall<CustomersResponse>(
    'dinematters.dinematters.api.customers.get_restaurant_customers',
    selectedRestaurant
      ? { restaurant_id: selectedRestaurant, search: search || undefined, page, page_size: pageSize }
      : undefined,
    selectedRestaurant ? `restaurant-customers-${selectedRestaurant}-${search}-${page}` : null
  )

  // More robust data extraction with error handling
  const customers: RestaurantCustomer[] = useMemo(() => {
    try {
      if (!data) return []
      
      // Handle different response structures
      if (data?.message?.data?.customers) {
        return Array.isArray(data.message.data.customers) ? data.message.data.customers : []
      }
      if (data?.message && typeof data.message === 'object' && 'customers' in data.message) {
        return Array.isArray((data.message as any).customers) ? (data.message as any).customers : []
      }
      if (data && typeof data === 'object' && 'customers' in data) {
        return Array.isArray((data as any).customers) ? (data as any).customers : []
      }
      if (Array.isArray(data)) {
        return data
      }
      
      console.warn('Unexpected customers data structure:', data)
      return []
    } catch (err) {
      console.error('Error processing customers data:', err)
      return []
    }
  }, [data])

  const isAdmin = data?.message?.data?.isAdmin ?? false
  const totalCount = data?.message?.data?.totalCount ?? customers.length
  const success = data?.message?.success ?? true
  const totalPages = Math.ceil(totalCount / pageSize) || 1

  const { call: getCustomerProfile } = useFrappePostCall(
    'dinematters.dinematters.api.customers.get_customer_profile'
  )

  const handleViewFullProfile = async (customerId: string) => {
    setProfileCustomerId(customerId)
    setProfileLoading(true)
    setProfileData(null)
    try {
      const res = await getCustomerProfile({ customer_id: customerId })
      const body = (res as { message?: CustomerProfileData })?.message ?? (res as CustomerProfileData)
      setProfileData(body)
    } catch {
      toast.error('Failed to load customer profile')
    } finally {
      setProfileLoading(false)
    }
  }

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return d
    }
  }

  if (!selectedRestaurant) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">
              Select a restaurant from the dropdown to view customers.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Customers</h1>
          <p className="text-muted-foreground mt-1">
            Customers who have placed orders or bookings at this restaurant
          </p>
        </div>
        <div className="relative max-w-sm w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Restaurant Customers
          </CardTitle>
          <CardDescription>
            Name, phone, verification status. Expand to view order history and feedback.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Unable to load customers. Please try again.</p>
              <p className="text-sm text-red-500 mt-2">Error: {error.message || 'Unknown error occurred'}</p>
              <Button 
                onClick={() => window.location.reload()} 
                variant="outline" 
                className="mt-4"
              >
                Retry
              </Button>
            </div>
          ) : !success ? (
            <p className="text-muted-foreground text-center py-8">
              Unable to load customers. Please try again.
            </p>
          ) : customers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No customers yet. Customers appear here once they place an order or booking.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Last visited</TableHead>
                  <TableHead className="text-center">Verified</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => {
                  const isExpanded = expandedId === c.id
                  const hasOrders = c.orders && c.orders.length > 0
                  return (
                    <Fragment key={c.id}>
                      <TableRow>
                        <TableCell className="w-8 p-1">
                          {hasOrders && (
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : c.id)}
                              className="p-1 rounded hover:bg-muted"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{c.customerName || '—'}</TableCell>
                        <TableCell>{c.phone || '—'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {c.lastVisited ? formatDate(c.lastVisited) : '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          {c.verifiedAt ? (
                            <Badge
                              variant="secondary"
                              className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                              Yes
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="gap-1 bg-muted text-muted-foreground"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              No
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewFullProfile(c.id)}
                              className="gap-1"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Full profile
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {isExpanded && hasOrders && (
                        <TableRow key={`${c.id}-expanded`}>
                          <TableCell colSpan={6} className="bg-muted/30 p-4">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                                <History className="h-4 w-4" />
                                Order history at this restaurant
                              </div>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Order</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Total</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Food</TableHead>
                                    <TableHead>Service</TableHead>
                                    <TableHead>Feedback</TableHead>
                                    <TableHead />
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {c.orders.map((o) => (
                                    <TableRow key={o.name}>
                                      <TableCell>
                                        <Link
                                          to={`/orders/${o.name}`}
                                          className="text-primary hover:underline font-medium"
                                        >
                                          {o.order_number}
                                        </Link>
                                      </TableCell>
                                      <TableCell className="text-muted-foreground">
                                        {formatDate(o.creation)}
                                      </TableCell>
                                      <TableCell>
                                        {formatAmountNoDecimals(o.total ?? 0)}
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="outline" className="capitalize">
                                          {o.status}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        {(o.food_rating ?? o.customer_rating) != null ? (
                                          <span className="flex items-center gap-0.5">
                                            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                                            {o.food_rating ?? o.customer_rating}/5
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground">—</span>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        {(o.service_rating ?? o.customer_rating) != null ? (
                                          <span className="flex items-center gap-0.5">
                                            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                                            {o.service_rating ?? o.customer_rating}/5
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground">—</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="max-w-[200px]">
                                        <span
                                          className="text-sm text-muted-foreground truncate block"
                                          title={o.customer_feedback || ''}
                                        >
                                          {o.customer_feedback || '—'}
                                        </span>
                                      </TableCell>
                                      <TableCell>
                                        <Link to={`/orders/${o.name}`}>
                                          <Button variant="ghost" size="sm">
                                            View
                                          </Button>
                                        </Link>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          )}
          {success && totalCount > 0 && totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin: Full Customer Profile Dialog */}
      <Dialog open={!!profileCustomerId} onOpenChange={(open) => !open && setProfileCustomerId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Customer profile</DialogTitle>
            <DialogDescription>
              All orders and bookings across restaurants (Admin view)
            </DialogDescription>
          </DialogHeader>
          {profileLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : profileData?.data ? (
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-2">Customer</h4>
                <p className="text-sm">
                  {profileData.data.customer.customerName} • {profileData.data.customer.phone}
                  {profileData.data.customer.email && ` • ${profileData.data.customer.email}`}
                </p>
                {profileData.data.customer.verifiedAt && (
                  <Badge variant="secondary" className="mt-2 gap-1 bg-emerald-500/10">
                    <CheckCircle className="h-3 w-3" />
                    Verified
                  </Badge>
                )}
              </div>
              {profileData.data.restaurants.map((rest) => (
                <div key={rest.restaurant_id} className="rounded-lg border p-4 space-y-2">
                  <h4 className="font-medium">{rest.restaurant_name}</h4>
                  {rest.orders && rest.orders.length > 0 && (
                    <div className="text-sm">
                      <p className="text-muted-foreground mb-1">Orders:</p>
                      <ul className="space-y-1">
                        {rest.orders.map((o: OrderItem) => (
                          <li key={o.name} className="flex items-center gap-2 flex-wrap">
                            <Link
                              to={`/orders/${o.name}`}
                              className="text-primary hover:underline"
                            >
                              {o.order_number}
                            </Link>
                            <span className="text-muted-foreground">
                              {formatDate(o.creation)} • {formatAmountNoDecimals(o.total ?? 0)}
                            </span>
                            {(o.food_rating ?? o.customer_rating) != null && (
                              <span className="flex items-center gap-0.5">
                                <Star className="h-3 w-3 fill-amber-400" />
                                Food {o.food_rating ?? o.customer_rating}/5
                              </span>
                            )}
                            {(o.service_rating ?? o.customer_rating) != null && o.service_rating != null && (
                              <span className="flex items-center gap-0.5">
                                <Star className="h-3 w-3 fill-amber-400" />
                                Service {o.service_rating}/5
                              </span>
                            )}
                            {o.customer_feedback && (
                              <span className="text-muted-foreground truncate max-w-[200px]">
                                — {o.customer_feedback}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {rest.tableBookings && rest.tableBookings.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Table bookings: {rest.tableBookings.length}
                    </p>
                  )}
                  {rest.banquetBookings && rest.banquetBookings.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Banquet bookings: {rest.banquetBookings.length}
                    </p>
                  )}
                  {(!rest.orders || rest.orders.length === 0) &&
                    (!rest.tableBookings || rest.tableBookings.length === 0) &&
                    (!rest.banquetBookings || rest.banquetBookings.length === 0) && (
                      <p className="text-sm text-muted-foreground">No activity</p>
                    )}
                </div>
              ))}
            </div>
          ) : profileData && !profileData.data && (
            <p className="text-muted-foreground py-4">
              {profileData.error || 'Unable to load profile.'}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
