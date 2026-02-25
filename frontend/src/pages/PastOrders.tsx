import { useState, useMemo } from 'react'
import { useFrappeGetDocList, useFrappeGetDoc, useFrappePostCall } from '@/lib/frappe'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Eye, Filter, X, Search } from 'lucide-react'
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

export default function PastOrders() {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [tableFilter, setTableFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [showBilledOrders, setShowBilledOrders] = useState(false)

  const { selectedRestaurant } = useRestaurant()
  
  // Get the restaurant identifier to use for filtering
  const restaurantFilter = selectedRestaurant
  
  // Fetch restaurant data to get tables count
  const { data: restaurantDoc } = useFrappeGetDoc('Restaurant', selectedRestaurant || '', {
    enabled: !!selectedRestaurant,
    fields: ['name', 'tables']
  })
  
  // Generate table options based on restaurant tables count (always include Table 0)
  const tableOptions = useMemo(() => {
    const maxTables = Number(restaurantDoc?.tables ?? 0)
    const options: number[] = [0]
    if (maxTables > 0) {
      for (let i = 1; i <= maxTables; i++) {
        options.push(i)
      }
    }
    return options
  }, [restaurantDoc?.tables])
  
  // Build filters - always filter by restaurant if one is selected
  // Exclude tokenization orders from Past Orders view
  const filters = restaurantFilter ? { restaurant: restaurantFilter, "is_tokenization": ["!=", 1] } as any : {}
  
  // Fetch all orders for the restaurant
  const { data: orders, isLoading, mutate } = useFrappeGetDocList(
    'Order',
    {
      fields: ['name', 'order_number', 'status', 'table_number', 'coupon', 'total', 'creation', 'restaurant'],
      filters: filters,
      order_by: 'creation desc',
      limit: 1000 // Get all orders
    },
    restaurantFilter ? `past-orders-${restaurantFilter}` : null
  )

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
        'pending': 'Pending',
        'confirmed': 'Confirmed',
        'preparing': 'Preparing',
        'ready': 'Ready',
        'In Billing': 'In Billing',
        'in_billing': 'In Billing',
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

  const handleCheckOrder = (orderId: string) => {
    setSelectedOrderId(orderId)
    setIsDialogOpen(true)
  }

  // Get unique table numbers for filter
  const uniqueTables = useMemo(() => {
    if (!orders || !Array.isArray(orders) || !restaurantFilter) return []
    const restaurantOrders = orders.filter((order: any) => order.restaurant === restaurantFilter)
    if (!restaurantOrders || restaurantOrders.length === 0) return []
    const tables = new Set<number>()
    restaurantOrders.forEach((order: any) => {
      if (order.table_number != null) {
        tables.add(order.table_number)
      }
    })
    return Array.from(tables).sort((a, b) => a - b)
  }, [orders, restaurantFilter])

  // Filter orders
  const filteredOrders = useMemo(() => {
    if (!orders || !Array.isArray(orders)) {
      return []
    }

    // First filter by restaurant
    let filtered = orders.filter((order: any) => {
      if (!restaurantFilter) return false
      return order.restaurant === restaurantFilter
    })

    // Apply "Show Billed Orders" filter - show only today's billed orders
    if (showBilledOrders) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      filtered = filtered.filter((order: any) => {
        // Filter by billed status
        const normalized = normalizeStatus(order.status || 'pending')
        if (normalized !== 'billed') return false
        
        // Filter by today's date
        if (!order.creation) return false
        const orderDate = new Date(order.creation)
        orderDate.setHours(0, 0, 0, 0)
        return orderDate >= today && orderDate < tomorrow
      })
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((order: any) => {
        const orderNumber = (order.order_number || order.name || '').toLowerCase()
        return orderNumber.includes(query)
      })
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((order: any) => {
        const normalized = normalizeStatus(order.status || 'pending')
        return normalized === statusFilter
      })
    }

    // Apply table filter
    if (tableFilter !== 'all') {
      const tableNum = parseInt(tableFilter, 10)
      filtered = filtered.filter((order: any) => {
        return (order.table_number ?? 0) === tableNum
      })
    }

    // Apply date filters
    if (dateFrom) {
      const fromDate = new Date(dateFrom)
      fromDate.setHours(0, 0, 0, 0)
      filtered = filtered.filter((order: any) => {
        if (!order.creation) return false
        const orderDate = new Date(order.creation)
        orderDate.setHours(0, 0, 0, 0)
        return orderDate >= fromDate
      })
    }

    if (dateTo) {
      const toDate = new Date(dateTo)
      toDate.setHours(23, 59, 59, 999)
      filtered = filtered.filter((order: any) => {
        if (!order.creation) return false
        const orderDate = new Date(order.creation)
        return orderDate <= toDate
      })
    }

    return filtered
  }, [orders, restaurantFilter, showBilledOrders, searchQuery, statusFilter, tableFilter, dateFrom, dateTo]) || []

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">Past and Billed Orders</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {showBilledOrders 
              ? "Showing today's billed orders" 
              : "View all historical orders for your restaurant"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={showBilledOrders ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setShowBilledOrders(!showBilledOrders)
              // Reset filters when toggling billed orders view
              if (showBilledOrders) {
                setStatusFilter('all')
                setDateFrom('')
                setDateTo('')
              }
            }}
            className="flex-1 sm:flex-initial"
          >
            <span className="hidden sm:inline">{showBilledOrders ? 'All Orders' : 'Show Billed Orders'}</span>
            <span className="sm:hidden">{showBilledOrders ? 'All' : 'Billed'}</span>
          </Button>
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="flex-1 sm:flex-initial"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
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
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="preparing">Preparing</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="In Billing">In Billing</SelectItem>
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

            {/* Clear Filters */}
            {(searchQuery || statusFilter !== 'all' || tableFilter !== 'all' || dateFrom || dateTo) && (
              <div className="mt-4 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('')
                    setStatusFilter('all')
                    setTableFilter('all')
                    setDateFrom('')
                    setDateTo('')
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Orders List */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading orders...</div>
          ) : !restaurantFilter ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">Please select a restaurant from the dropdown above to view orders</p>
            </div>
          ) : !filteredOrders || filteredOrders?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No orders found for restaurant: {restaurantFilter}</p>
            </div>
          ) : (
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
                        value={normalizeStatus(order.status || 'pending')}
                        onValueChange={(newStatus) => handleStatusChange(order.name, newStatus)}
                      >
                        <SelectTrigger className={cn(
                          "h-7 w-[110px] text-xs border-0 shadow-none",
                          order.status === 'delivered' ? 'bg-[#dff6dd] dark:bg-[#1b5e20] text-[#107c10] dark:text-[#81c784] hover:bg-[#c8e6c9] dark:hover:bg-[#2e7d32]' :
                            order.status === 'billed' ? 'bg-[#dff6dd] dark:bg-[#1b5e20] text-[#107c10] dark:text-[#81c784] hover:bg-[#c8e6c9] dark:hover:bg-[#2e7d32]' :
                            order.status === 'cancelled' ? 'bg-[#fde7e9] dark:bg-[#b71c1c] text-[#d13438] dark:text-[#ef5350] hover:bg-[#fcc5c9] dark:hover:bg-[#c62828]' :
                            order.status === 'pending' ? 'bg-[#fff4ce] dark:bg-[#ca5010]/20 text-[#ca5010] dark:text-[#ffaa44] hover:bg-[#ffe69d] dark:hover:bg-[#ca5010]/30' :
                            order.status === 'confirmed' ? 'bg-orange-50 dark:bg-[#ea580c]/20 text-[#ea580c] dark:text-[#ff8c42] hover:bg-orange-100 dark:hover:bg-[#ea580c]/30' :
                            order.status === 'preparing' ? 'bg-[#e8d5ff] dark:bg-[#4a148c] text-[#8764b8] dark:text-[#ba68c8] hover:bg-[#d4b9e8] dark:hover:bg-[#6a1b9a]' :
                            order.status === 'ready' ? 'bg-[#cce5ff] dark:bg-[#0d47a1] text-[#004578] dark:text-[#64b5f6] hover:bg-[#99ccff] dark:hover:bg-[#1565c0]' :
                            (order.status === 'In Billing' || order.status === 'in_billing') ? 'bg-[#fff3e0] dark:bg-[#e65100]/20 text-[#e65100] dark:text-[#ff9800] hover:bg-[#ffe0b2] dark:hover:bg-[#e65100]/30' :
                            'bg-muted text-muted-foreground hover:bg-accent'
                        )}>
                          <SelectValue>
                            <span className="capitalize">{normalizeStatus(order.status || 'pending')}</span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="preparing">Preparing</SelectItem>
                          <SelectItem value="ready">Ready</SelectItem>
                          <SelectItem value="In Billing">In Billing</SelectItem>
                          <SelectItem value="delivered">Delivered</SelectItem>
                          <SelectItem value="billed">Billed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      {tableOptions.length > 0 ? (
                        <Select
                          value={(order.table_number ?? 0).toString()}
                          onValueChange={(value) => {
                            const parsed = parseInt(value, 10)
                            const tableNum = Number.isNaN(parsed) ? 0 : parsed
                            handleTableNumberChange(order.name, tableNum)
                          }}
                        >
                          <SelectTrigger className="h-7 px-2 text-xs font-medium bg-[#e8d5ff] dark:bg-[#4a148c] text-[#8764b8] dark:text-[#ba68c8] border border-[#d4b9e8] dark:border-[#6a1b9a] w-auto min-w-[90px]">
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
                      ) : (
                        <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-[#e8d5ff] dark:bg-[#4a148c] text-[#8764b8] dark:text-[#ba68c8] border border-[#d4b9e8] dark:border-[#6a1b9a]">
                          Table {order.table_number ?? 0}
                        </span>
                      )}
                      {order.coupon && (
                        <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-[#dff6dd] dark:bg-[#1b5e20] text-[#107c10] dark:text-[#81c784] border border-[#92c5f7] dark:border-[#4caf50]">
                          {order.coupon}
                        </span>
                      )}
                      <span className="text-lg font-semibold text-foreground ml-auto">₹{order.total || 0}</span>
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
                          <Select
                            value={normalizeStatus(order.status || 'pending')}
                            onValueChange={(newStatus) => handleStatusChange(order.name, newStatus)}
                          >
                            <SelectTrigger className={cn(
                              "h-7 w-[120px] text-xs border-0 shadow-none",
                              order.status === 'delivered' ? 'bg-[#dff6dd] dark:bg-[#1b5e20] text-[#107c10] dark:text-[#81c784] hover:bg-[#c8e6c9] dark:hover:bg-[#2e7d32]' :
                                order.status === 'billed' ? 'bg-[#dff6dd] dark:bg-[#1b5e20] text-[#107c10] dark:text-[#81c784] hover:bg-[#c8e6c9] dark:hover:bg-[#2e7d32]' :
                                order.status === 'cancelled' ? 'bg-[#fde7e9] dark:bg-[#b71c1c] text-[#d13438] dark:text-[#ef5350] hover:bg-[#fcc5c9] dark:hover:bg-[#c62828]' :
                                order.status === 'pending' ? 'bg-[#fff4ce] dark:bg-[#ca5010]/20 text-[#ca5010] dark:text-[#ffaa44] hover:bg-[#ffe69d] dark:hover:bg-[#ca5010]/30' :
                                order.status === 'confirmed' ? 'bg-orange-50 dark:bg-[#ea580c]/20 text-[#ea580c] dark:text-[#ff8c42] hover:bg-orange-100 dark:hover:bg-[#ea580c]/30' :
                                order.status === 'preparing' ? 'bg-[#e8d5ff] dark:bg-[#4a148c] text-[#8764b8] dark:text-[#ba68c8] hover:bg-[#d4b9e8] dark:hover:bg-[#6a1b9a]' :
                                order.status === 'ready' ? 'bg-[#cce5ff] dark:bg-[#0d47a1] text-[#004578] dark:text-[#64b5f6] hover:bg-[#99ccff] dark:hover:bg-[#1565c0]' :
                                (order.status === 'In Billing' || order.status === 'in_billing') ? 'bg-[#fff3e0] dark:bg-[#e65100]/20 text-[#e65100] dark:text-[#ff9800] hover:bg-[#ffe0b2] dark:hover:bg-[#e65100]/30' :
                                'bg-muted text-muted-foreground hover:bg-accent'
                            )}>
                              <SelectValue>
                                <span className="capitalize">{normalizeStatus(order.status || 'pending')}</span>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
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
                              value={(order.table_number ?? 0).toString()}
                              onValueChange={(value) => {
                                const parsed = parseInt(value, 10)
                                const tableNum = Number.isNaN(parsed) ? 0 : parsed
                                handleTableNumberChange(order.name, tableNum)
                              }}
                            >
                              <SelectTrigger className="h-7 px-2 text-xs font-medium bg-[#e8d5ff] dark:bg-[#4a148c] text-[#8764b8] dark:text-[#ba68c8] border border-[#d4b9e8] dark:border-[#6a1b9a] w-auto min-w-[100px]">
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
                          ) : (
                            <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-[#e8d5ff] dark:bg-[#4a148c] text-[#8764b8] dark:text-[#ba68c8] border border-[#d4b9e8] dark:border-[#6a1b9a]">
                              Table {order.table_number ?? 0}
                            </span>
                          )}
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
                        <TableCell className="font-medium text-foreground">₹{order.total || 0}</TableCell>
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

