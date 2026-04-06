import { useState, useMemo, useEffect } from 'react'
import { useFrappeGetDocList, useFrappeGetDoc, useFrappePostCall } from '@/lib/frappe'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Eye, LayoutGrid, List, Filter, X, Search, ShoppingBag, AlertCircle } from 'lucide-react'
import { LockedFeature } from '@/components/FeatureGate/LockedFeature'
import { EmptyState } from '@/components/EmptyState'
import { OrdersKanban } from '@/components/OrdersKanban'
import { OrdersModernView } from '@/components/OrdersModernView'
import { CancelledOrdersDialog } from '@/components/CancelledOrdersDialog'
import { OrderDetailsDialog } from '@/components/OrderDetailsDialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { useCurrency } from '@/hooks/useCurrency'

type ViewType = 'kanban' | 'list' | 'modern'

export default function Orders() {
  const { isDiamond } = useRestaurant()
  const { formatAmountNoDecimals } = useCurrency()

  const getOrderTypeBadgeClass = (orderType?: string) => {
    if (orderType === 'delivery') {
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800'
    }
    if (orderType === 'takeaway') {
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800'
    }
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
  }

  const getOrderTypeLabel = (orderType?: string) => (orderType || 'dine_in').replace('_', ' ')

  // Load view preference from localStorage, default to 'list' on mobile, 'kanban' on desktop
  const [viewType, setViewType] = useState<ViewType>(() => {
    // Check if mobile (screen width < 768px)
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'list' // Force list view on mobile
    }
    // Load from localStorage or default to 'modern' on desktop
    try {
      const saved = localStorage.getItem('dinematters-orders-view-type')
      // If the user hasn't specifically switched to modern yet, force it once
      const hasSeenModern = localStorage.getItem('dinematters-seen-modern-v1')
      if (!hasSeenModern) {
        localStorage.setItem('dinematters-seen-modern-v1', 'true')
        localStorage.setItem('dinematters-orders-view-type', 'modern')
        return 'modern'
      }
      return (saved === 'kanban' || saved === 'list' || saved === 'modern') ? saved as ViewType : 'modern'
    } catch {
      return 'modern'
    }
  })

  // Save view preference to localStorage
  useEffect(() => {
    // Only save if not on mobile
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      try {
        localStorage.setItem('dinematters-orders-view-type', viewType)
      } catch (error) {
        console.error('Failed to save view preference:', error)
      }
    }
  }, [viewType])

  // Force list view on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && viewType === 'kanban') {
        setViewType('list')
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [viewType])
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [isCancelledDialogOpen, setIsCancelledDialogOpen] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [tableFilter, setTableFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const { selectedRestaurant, restaurants } = useRestaurant()
  
  // Get the restaurant identifier to use for filtering
  // selectedRestaurant is the docname, which should match the Order.restaurant field
  const restaurantFilter = selectedRestaurant
  
  // Fetch restaurant data to get tables count
  const { data: restaurantDoc } = useFrappeGetDoc('Restaurant', selectedRestaurant || '', {
    enabled: !!selectedRestaurant,
    fields: ['name', 'tables']
  })
  
  // Generate table options based on restaurant tables count
  const tableOptions = useMemo(() => {
    const maxTables = Number(restaurantDoc?.tables ?? 0)
    const options: number[] = []
    if (maxTables > 0) {
      for (let i = 1; i <= maxTables; i++) {
        options.push(i)
      }
    }
    return options
  }, [restaurantDoc?.tables])
  
  // Build filters - always filter by restaurant if one is selected
  // Exclude tokenization orders from merchant-facing Orders UI
  const filters = restaurantFilter ? { restaurant: restaurantFilter, "is_tokenization": ["!=", 1] } as any : {}
  
  // Debug logging
  useEffect(() => {
    console.log('[Orders] Restaurant Filter:', {
      selectedRestaurant,
      restaurantFilter,
      filters,
      hasRestaurants: (restaurants?.length || 0) > 0
    })
  }, [selectedRestaurant, restaurantFilter, filters, restaurants])
  
  // Only fetch orders if a restaurant is selected
  const { data: orders, isLoading, mutate } = useFrappeGetDocList(
    'Order',
    {
    fields: ['name', 'order_number', 'status', 'total', 'creation', 'restaurant', 'table_number', 'order_type', 'coupon', 'customer_name', 'customer_phone', 'payment_method', 'payment_status', 'subtotal', 'discount', 'tax', 'delivery_fee', 'packaging_fee', 'order_items'],
      filters: restaurantFilter ? ([
        ['restaurant', '=', restaurantFilter],
        ['status', '!=', 'pending_verification'],
      ] as any) : undefined,
      limit: 100,
      orderBy: { field: 'creation', order: 'desc' }
    },
    restaurantFilter ? `orders-${restaurantFilter}` : null // Use null to disable query when no restaurant selected
  )
  


  // Debug: Log orders to verify filtering
  useEffect(() => {
    console.log('[Orders] Current Orders:', orders?.length, orders?.[0])
  }, [orders])
  // Debug: Log orders to verify filtering
  useEffect(() => {
    if (orders && Array.isArray(orders)) {
      const allRestaurants = [...new Set(orders.map((o: any) => o.restaurant))]
      const matchingOrders = restaurantFilter 
        ? orders.filter((o: any) => o.restaurant === restaurantFilter)
        : []
      
      console.log('[Orders] Filter Results:', {
        totalOrders: orders.length,
        matchingOrders: matchingOrders.length,
        restaurantFilter,
        allRestaurantsInData: allRestaurants,
        orders: orders.slice(0, 5).map((o: any) => ({ 
          id: o.name, 
          orderNumber: o.order_number,
          restaurant: o.restaurant, 
          matches: restaurantFilter ? o.restaurant === restaurantFilter : false 
        }))
      })
      
      // Warn if we see orders from other restaurants when a restaurant is selected
      if (restaurantFilter && allRestaurants.length > 1) {
        console.warn('[Orders] WARNING: Orders from multiple restaurants detected!', {
          selectedRestaurant: restaurantFilter,
          restaurantsInData: allRestaurants,
          shouldOnlyShow: restaurantFilter
        })
      }
    }
  }, [orders, restaurantFilter])
  
  // Force refresh when selectedRestaurant changes
  useEffect(() => {
    if (restaurantFilter) {
      // Small delay to ensure the filter is applied
      const timer = setTimeout(() => {
        mutate()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [restaurantFilter, mutate])

  // Status update API call
  const { call: updateOrderStatus } = useFrappePostCall('dinematters.dinematters.api.order_status.update_status')
  const { call: updateTableNumber } = useFrappePostCall('dinematters.dinematters.api.order_status.update_table_number')

  // Normalize status value (handle legacy "in_billing" format)
  const normalizeStatus = (status: string): string => {
    if (status === 'in_billing') {
      return 'In Billing'
    }
    return status
  }

  // Handle status change
  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      // Normalize the status before sending to API
      const normalizedStatus = normalizeStatus(newStatus)
      
      await updateOrderStatus({
        order_id: orderId,
        status: normalizedStatus
      })
      
      const statusLabels: Record<string, string> = {
        'confirmed': 'Confirmed',
        'preparing': 'Preparing',
        'ready': 'Ready',
        'In Billing': 'In Billing',
        'in_billing': 'In Billing', // Handle legacy format
        'delivered': 'Delivered',
        'billed': 'Billed',
        'cancelled': 'Cancelled'
      }
      
      toast.success(`Order status updated to ${statusLabels[normalizedStatus] || normalizedStatus}`)
      
      // Refresh orders list
      mutate()
    } catch (error: any) {
      console.error('Failed to update order status:', error)
      toast.error(error?.message || 'Failed to update order status')
    }
  }

  // Handle table number change
  const handleTableNumberChange = async (orderId: string, tableNumber: number) => {
    try {
      await updateTableNumber({
        order_id: orderId,
        table_number: tableNumber
      })
      
      toast.success(`Table updated to Table ${tableNumber}`)
      
      // Refresh orders list
      mutate()
    } catch (error: any) {
      console.error('Failed to update table number:', error)
      toast.error(error?.message || 'Failed to update table number')
    }
  }

  // Get unique table numbers for filter (use filteredOrders to only show tables from selected restaurant)
  const uniqueTables = useMemo(() => {
    if (!orders || !Array.isArray(orders) || !restaurantFilter) return []
    // First filter by restaurant, then get unique tables
    const restaurantOrders = orders.filter((order: any) => order.restaurant === restaurantFilter)
    if (!restaurantOrders || restaurantOrders.length === 0) return []
    
    const tables = new Set<number>()
    restaurantOrders.forEach((order: any) => {
      if (typeof order.table_number === 'number' && order.table_number > 0) {
        tables.add(order.table_number)
      }
    })
    return Array.from(tables).sort((a, b) => a - b)
  }, [orders, restaurantFilter])

  // Apply filters (including restaurant filter as fallback)
  // CRITICAL: This filter MUST always be applied to prevent showing orders from other restaurants
  const filteredOrders = useMemo(() => {
    // Force console log to verify code is running
    console.log('🔍 [Orders] Filter function EXECUTING:', {
      hasOrders: !!orders,
      ordersCount: orders?.length || 0,
      restaurantFilter: restaurantFilter || 'NULL',
      selectedRestaurant: selectedRestaurant || 'NULL',
      timestamp: new Date().toISOString()
    })
    
    if (!orders || !Array.isArray(orders)) {
      console.log('🔍 [Orders] No orders data or invalid data, returning empty array')
      return []
    }
    
    // If no restaurant is selected, return empty array (don't show any orders)
    if (!restaurantFilter) {
      console.log('🔍 [Orders] ⚠️ No restaurant selected, returning empty array')
      return []
    }
    
    // FIRST: Filter by restaurant - CRITICAL: This ensures data isolation
    // This MUST be the first filter applied to prevent showing orders from other restaurants
    const restaurantFiltered = orders.filter((order: any) => {
      const orderRestaurant = order.restaurant
      
      // Strict exact match - if restaurant doesn't match exactly, exclude the order
      // Handle null/undefined cases
      if (!orderRestaurant) {
        console.log('🔍 [Orders] ❌ Order has no restaurant field:', {
          orderId: order.name || order.order_number,
          orderNumber: order.order_number
        })
        return false
      }
      
      // Convert both to strings and trim for comparison
      const orderRestaurantStr = String(orderRestaurant).trim()
      const filterStr = String(restaurantFilter).trim()
      const matches = orderRestaurantStr === filterStr
      
      if (!matches) {
        console.log('🔍 [Orders] ❌ Restaurant MISMATCH - filtering out:', {
          orderId: order.name || order.order_number,
          orderNumber: order.order_number,
          orderRestaurant: orderRestaurantStr,
          restaurantFilter: filterStr,
          matches: false
        })
      } else {
        console.log('🔍 [Orders] ✅ Restaurant MATCH:', {
          orderId: order.name || order.order_number,
          orderRestaurant: orderRestaurantStr
        })
      }
      
      return matches
    })
    
    console.log('🔍 [Orders] ✅ Restaurant filter RESULT:', {
      totalOrdersFromAPI: orders.length,
      filteredCount: restaurantFiltered.length,
      restaurantFilter: restaurantFilter,
      allRestaurantsInData: [...new Set(orders.map((o: any) => o.restaurant))],
      filteredRestaurants: [...new Set(restaurantFiltered.map((o: any) => o.restaurant))]
    })
    
    // Filter by today's date - Real Time Orders should only show today's orders
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const todayFiltered = restaurantFiltered.filter((order: any) => {
      if (!order.creation) return false
      const orderDate = new Date(order.creation)
      orderDate.setHours(0, 0, 0, 0)
      return orderDate >= today && orderDate < tomorrow
    })
    
    // SECOND: Apply other filters (search, status, table, date) to today's restaurant-filtered orders
    return todayFiltered.filter((order: any) => {
      
      // Search filter
      const searchLower = searchQuery.toLowerCase()
      const searchMatch = !searchQuery || 
        order.name.toLowerCase().includes(searchLower) ||
        order.order_number?.toLowerCase().includes(searchLower) ||
        order.customer_name?.toLowerCase().includes(searchLower) ||
        order.customer_phone?.includes(searchQuery)
      
      if (!searchMatch) return false
      
      // Status filter
      if (statusFilter !== 'all' && order.status !== statusFilter) {
        return false
      }
      
      // Table filter
      if (tableFilter !== 'all' && order.table_number?.toString() !== tableFilter) {
        return false
      }
      
      // Date filter
      if (dateFrom || dateTo) {
        const orderDate = new Date(order.creation)
        
        if (dateFrom) {
          const fromDate = new Date(dateFrom)
          fromDate.setHours(0, 0, 0, 0)
          if (orderDate < fromDate) return false
        }
        
        if (dateTo) {
          const toDate = new Date(dateTo)
          toDate.setHours(23, 59, 59, 999)
          if (orderDate > toDate) return false
        }
      }

      // Hide cancelled orders from main view
      if (order.status?.toLowerCase() === 'cancelled') return false
      
      return true
    })
  }, [orders, restaurantFilter, searchQuery, statusFilter, tableFilter, dateFrom, dateTo]) || []

  const clearFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setTableFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || tableFilter !== 'all' || dateFrom || dateTo

  const handleCheckOrder = (orderId: string) => {
    setSelectedOrderId(orderId)
    setIsDialogOpen(true)
  }

  if (!isDiamond) {
    return <LockedFeature feature="ordering" requiredPlan={['DIAMOND']} />
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">Orders</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage and track all restaurant orders
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="flex-1 sm:flex-initial"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
          </Button>
          {/* Hide Kanban button on mobile */}
          <Button
            variant={viewType === 'modern' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewType('modern')}
            className="flex-1 sm:flex-initial"
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Modern</span>
          </Button>
          <Button
            variant={viewType === 'kanban' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewType('kanban')}
            className="hidden md:flex flex-1 sm:flex-initial"
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Kanban</span>
          </Button>
          <Button
            variant={viewType === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewType('list')}
            className="flex-1 sm:flex-initial"
          >
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">List</span>
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      {showFilters && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* Search */}
              <div className="relative md:col-span-2">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search order number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Pending Verification">Pending Verification</SelectItem>
                  <SelectItem value="Pending Payment">Pending Payment</SelectItem>
                  <SelectItem value="Auto Accepted">Auto Accepted</SelectItem>
                  <SelectItem value="Accepted">Accepted</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="preparing">Preparing</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="billed">Billed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              {/* Table Filter */}
              <Select value={tableFilter} onValueChange={setTableFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Tables" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tables</SelectItem>
                  {uniqueTables.map((table) => (
                    <SelectItem key={table} value={table.toString()}>
                      Table {table}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Date From */}
              <div>
                <DatePicker
                  value={dateFrom}
                  onChange={(value) => setDateFrom(value)}
                  placeholder="From Date"
                />
              </div>

              {/* Date To */}
              <div>
                <DatePicker
                  value={dateTo}
                  onChange={(value) => setDateTo(value)}
                  placeholder="To Date"
                />
              </div>
            </div>

            {/* Second Row for Clear Button */}
            <div className="mt-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                {hasActiveFilters ? (
                  <>Showing {filteredOrders?.length || 0} of {filteredOrders?.length || 0} orders (filtered by restaurant: {restaurantFilter || 'none'})</>
                ) : (
                  <>Total: {filteredOrders?.length || 0} orders (restaurant: {restaurantFilter || 'none'})</>
                )}
              </div>
              <Button
                variant="outline"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                size="sm"
                className="w-full sm:w-auto"
              >
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading orders...</div>
          ) : !restaurantFilter ? (
            <EmptyState
              icon={AlertCircle}
              title="Select a Restaurant"
              description="Please select a restaurant from the dropdown above to view and manage orders."
            />
          ) : !filteredOrders || filteredOrders?.length === 0 ? (
            <>
              {orders && orders.length > 0 ? (
                <EmptyState
                  icon={Filter}
                  title="No Matching Orders"
                  description={`Found ${orders.length} orders in the database, but none match the selected restaurant "${restaurantFilter}". Try selecting a different restaurant or check your filters.`}
                  action={{
                    label: "Clear Filters",
                    onClick: () => window.location.reload()
                  }}
                />
              ) : (
                <EmptyState
                  icon={ShoppingBag}
                  title="No Orders Yet"
                  description="This restaurant hasn't received any orders yet. Orders will appear here once customers start placing them through the menu."
                  action={{
                    label: "Refresh Orders",
                    onClick: () => mutate()
                  }}
                  secondaryAction={{
                    label: "View Menu",
                    onClick: () => window.open(`/${restaurantFilter}`, '_blank')
                  }}
                />
              )}
            </>
          ) : (
            <>
              {/* Modern View */}
              {viewType === 'modern' && (
                <OrdersModernView
                  orders={filteredOrders}
                  onCheckOrder={handleCheckOrder}
                  onOrderUpdate={() => mutate()}
                  onShowCancelled={() => setIsCancelledDialogOpen(true)}
                />
              )}

              {/* Kanban View - Desktop Only */}
              {viewType === 'kanban' && (
                <div className="hidden md:block">
              <OrdersKanban 
                orders={filteredOrders} 
                onCheckOrder={handleCheckOrder}
                onOrderUpdate={() => mutate()}
                restaurantTables={restaurantDoc?.tables}
              />
                </div>
              )}
              
              {/* List View - Mobile Card View or Desktop Table View */}
              {viewType === 'list' && (
                <>
                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-3">
                  {filteredOrders?.map((order: any) => (
                    <div key={order.name} className="p-4 border border-border rounded-md bg-card hover:border-border/80 transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground truncate">{order.order_number || order.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {order.creation ? new Date(order.creation).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : 'N/A'}
                          </p>
                        </div>
                        <Select
                          value={order.status || 'confirmed'}
                          onValueChange={(newStatus) => handleStatusChange(order.name, newStatus)}
                        >
                          <SelectTrigger className={cn(
                            "h-7 w-[110px] text-xs border-0 shadow-none font-semibold",
                            order.status === 'delivered' ? 'bg-[#dff6dd] dark:bg-[#1b5e20] text-[#0d5d0d] dark:text-[#a5d6a7] hover:bg-[#c8e6c9] dark:hover:bg-[#2e7d32]' :
                            order.status === 'cancelled' ? 'bg-[#fde7e9] dark:bg-[#b71c1c] text-[#b91c1c] dark:text-[#ffcdd2] hover:bg-[#fcc5c9] dark:hover:bg-[#c62828]' :
                            order.status === 'confirmed' ? 'bg-orange-50 dark:bg-[#ea580c]/20 text-[#c2410c] dark:text-[#ffb88c] hover:bg-orange-100 dark:hover:bg-[#ea580c]/30' :
                            order.status === 'preparing' ? 'bg-[#e8d5ff] dark:bg-[#4a148c] text-[#6b21a8] dark:text-[#ce93d8] hover:bg-[#d4b9e8] dark:hover:bg-[#6a1b9a]' :
                            order.status === 'ready' ? 'bg-[#cce5ff] dark:bg-[#0d47a1] text-[#003d7a] dark:text-[#90caf9] hover:bg-[#99ccff] dark:hover:bg-[#1565c0]' :
                            'bg-muted text-muted-foreground hover:bg-accent'
                          )}>
                            <SelectValue>
                              <span className="capitalize font-semibold">{order.status || 'confirmed'}</span>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pending Verification">Pending Verification</SelectItem>
                            <SelectItem value="Auto Accepted">Auto Accepted</SelectItem>
                            <SelectItem value="Accepted">Accepted</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="preparing">Preparing</SelectItem>
                            <SelectItem value="ready">Ready</SelectItem>
                            <SelectItem value="delivered">Delivered</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <span className={cn(
                          'inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium capitalize',
                          getOrderTypeBadgeClass(order.order_type)
                        )}>
                          {getOrderTypeLabel(order.order_type)}
                        </span>
                        {tableOptions.length > 0 ? (
                          <Select
                            value={typeof order.table_number === 'number' && order.table_number > 0 ? order.table_number.toString() : ''}
                            onValueChange={(value) => {
                              const parsed = parseInt(value, 10)
                              const tableNum = Number.isNaN(parsed) ? 1 : parsed
                              handleTableNumberChange(order.name, tableNum)
                            }}
                          >
                            <SelectTrigger className="h-7 px-2 text-xs font-medium bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border border-gray-700 dark:border-gray-300 w-auto min-w-[90px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {tableOptions.map((tableNum) => (
                                <SelectItem key={tableNum} value={tableNum.toString()}>
                                  Table {tableNum}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : typeof order.table_number === 'number' && order.table_number > 0 ? (
                          <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border border-gray-700 dark:border-gray-300">
                            Table {order.table_number}
                          </span>
                        ) : null}
                        {order.coupon && (
                          <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-[#dff6dd] dark:bg-[#1b5e20] text-[#107c10] dark:text-[#81c784] border border-[#92c5f7] dark:border-[#4caf50]">
                            {order.coupon}
                          </span>
                        )}
                        <span className="text-lg font-semibold text-foreground ml-auto">{formatAmountNoDecimals(order.total)}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCheckOrder(order.name)}
                        className="w-full"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Order Details
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order Number</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>Coupon</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Food Order</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders?.map((order: any) => (
                    <TableRow key={order.name}>
                      <TableCell className="font-medium">{order.order_number || order.name}</TableCell>
                      <TableCell>
                        <span className={cn(
                          'inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium capitalize',
                          getOrderTypeBadgeClass(order.order_type)
                        )}>
                          {getOrderTypeLabel(order.order_type)}
                        </span>
                      </TableCell>
                      <TableCell>
                            <Select
                              value={normalizeStatus(order.status || 'confirmed')}
                              onValueChange={(newStatus) => handleStatusChange(order.name, newStatus)}
                            >
                              <SelectTrigger className={cn(
                                "h-7 w-[120px] text-xs border-0 shadow-none",
                                order.status === 'delivered' ? 'bg-[#dff6dd] dark:bg-[#1b5e20] text-[#107c10] dark:text-[#81c784] hover:bg-[#c8e6c9] dark:hover:bg-[#2e7d32]' :
                                order.status === 'billed' ? 'bg-[#dff6dd] dark:bg-[#1b5e20] text-[#107c10] dark:text-[#81c784] hover:bg-[#c8e6c9] dark:hover:bg-[#2e7d32]' :
                                order.status === 'cancelled' ? 'bg-[#fde7e9] dark:bg-[#b71c1c] text-[#d13438] dark:text-[#ef5350] hover:bg-[#fcc5c9] dark:hover:bg-[#c62828]' :
                                order.status === 'confirmed' ? 'bg-orange-50 dark:bg-[#ea580c]/20 text-[#ea580c] dark:text-[#ff8c42] hover:bg-orange-100 dark:hover:bg-[#ea580c]/30' :
                                order.status === 'preparing' ? 'bg-[#e8d5ff] dark:bg-[#4a148c] text-[#8764b8] dark:text-[#ba68c8] hover:bg-[#d4b9e8] dark:hover:bg-[#6a1b9a]' :
                                order.status === 'ready' ? 'bg-[#cce5ff] dark:bg-[#0d47a1] text-[#004578] dark:text-[#64b5f6] hover:bg-[#99ccff] dark:hover:bg-[#1565c0]' :
                                (order.status === 'In Billing' || order.status === 'in_billing') ? 'bg-[#fff3e0] dark:bg-[#e65100]/20 text-[#e65100] dark:text-[#ff9800] hover:bg-[#ffe0b2] dark:hover:bg-[#e65100]/30' :
                                'bg-muted text-muted-foreground hover:bg-accent'
                              )}>
                                <SelectValue>
                                  <span className="capitalize font-semibold">{order.status || 'confirmed'}</span>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Pending Verification">Pending Verification</SelectItem>
                                <SelectItem value="Auto Accepted">Auto Accepted</SelectItem>
                                <SelectItem value="Accepted">Accepted</SelectItem>
                                <SelectItem value="confirmed">Confirmed</SelectItem>
                                <SelectItem value="preparing">Preparing</SelectItem>
                                <SelectItem value="ready">Ready</SelectItem>
                                <SelectItem value="In Billing">In Billing</SelectItem>
                                <SelectItem value="delivered">Delivered</SelectItem>
                                <SelectItem value="billed">Billed</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                      </TableCell>
                      <TableCell>
                        {tableOptions.length > 0 ? (
                          <Select
                            value={typeof order.table_number === 'number' && order.table_number > 0 ? order.table_number.toString() : ''}
                            onValueChange={(value) => {
                              const parsed = parseInt(value, 10)
                              const tableNum = Number.isNaN(parsed) ? 1 : parsed
                              handleTableNumberChange(order.name, tableNum)
                            }}
                          >
                            <SelectTrigger className="h-7 px-2 text-xs font-medium bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border border-gray-700 dark:border-gray-300 w-auto min-w-[100px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {tableOptions.map((tableNum) => (
                                <SelectItem key={tableNum} value={tableNum.toString()}>
                                  Table {tableNum}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : typeof order.table_number === 'number' && order.table_number > 0 ? (
                          <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border border-gray-700 dark:border-gray-300">
                            Table {order.table_number}
                          </span>
                        ) : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        {order.coupon ? (
                              <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-[#dff6dd] dark:bg-[#1b5e20] text-[#107c10] dark:text-[#81c784] border border-[#92c5f7] dark:border-[#4caf50]">
                            {order.coupon}
                          </span>
                        ) : (
                              <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                          <TableCell className="font-medium text-foreground">{formatAmountNoDecimals(order.total)}</TableCell>
                          <TableCell className="text-muted-foreground">
                        {order.creation ? new Date(order.creation).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Button
                              variant="outline"
                          size="sm"
                          onClick={() => handleCheckOrder(order.name)}
                        >
                              <Eye className="h-4 w-4" />
                              <span className="hidden sm:inline ml-1">View</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
                </div>
                </>
              )}
            </>
          )}
          <CancelledOrdersDialog
            isOpen={isCancelledDialogOpen}
            onClose={() => setIsCancelledDialogOpen(false)}
            orders={orders || []}
          />
        </CardContent>
      </Card>

      <OrderDetailsDialog
        orderId={selectedOrderId}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </div>
  )
}





