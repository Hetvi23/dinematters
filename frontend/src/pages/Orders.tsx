import { useState, useMemo, useEffect } from 'react'
import { useFrappeGetDocList, useFrappePostCall } from '@/lib/frappe'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Eye, LayoutGrid, List, Filter, X, Search } from 'lucide-react'
import { OrdersKanban } from '@/components/OrdersKanban'
import { OrderDetailsDialog } from '@/components/OrderDetailsDialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

type ViewType = 'kanban' | 'list'

export default function Orders() {
  // Load view preference from localStorage, default to 'list' on mobile, 'kanban' on desktop
  const [viewType, setViewType] = useState<ViewType>(() => {
    // Check if mobile (screen width < 768px)
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'list' // Force list view on mobile
    }
    // Load from localStorage or default to 'kanban' on desktop
    try {
      const saved = localStorage.getItem('dinematters-orders-view-type')
      return (saved === 'kanban' || saved === 'list') ? saved as ViewType : 'kanban'
    } catch {
      return 'kanban'
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
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [tableFilter, setTableFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const { data: orders, isLoading, mutate } = useFrappeGetDocList('Order', {
    fields: ['name', 'order_number', 'status', 'total', 'creation', 'restaurant', 'table_number', 'coupon', 'customer_name', 'customer_phone', 'payment_method', 'payment_status', 'subtotal', 'discount', 'tax', 'delivery_fee'],
    limit: 100,
    orderBy: { field: 'creation', order: 'desc' }
  })

  // Status update API call
  const { call: updateOrderStatus } = useFrappePostCall('dinematters.dinematters.api.order_status.update_status')

  // Handle status change
  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await updateOrderStatus({
        order_id: orderId,
        status: newStatus
      })
      
      const statusLabels: Record<string, string> = {
        'pending': 'Pending',
        'confirmed': 'Confirmed',
        'preparing': 'Preparing',
        'ready': 'Ready',
        'delivered': 'Delivered',
        'cancelled': 'Cancelled'
      }
      
      toast.success(`Order status updated to ${statusLabels[newStatus] || newStatus}`)
      
      // Refresh orders list
      mutate()
    } catch (error: any) {
      console.error('Failed to update order status:', error)
      toast.error(error?.message || 'Failed to update order status')
    }
  }

  // Get unique table numbers for filter
  const uniqueTables = useMemo(() => {
    if (!orders) return []
    const tables = new Set<number>()
    orders.forEach((order: any) => {
      if (order.table_number != null) {
        tables.add(order.table_number)
      }
    })
    return Array.from(tables).sort((a, b) => a - b)
  }, [orders])

  // Apply filters
  const filteredOrders = useMemo(() => {
    if (!orders) return []
    
    return orders.filter((order: any) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const orderNumber = (order.order_number || order.name || '').toLowerCase()
        if (!orderNumber.includes(query)) return false
      }
      
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
      
      return true
    })
  }, [orders, searchQuery, statusFilter, tableFilter, dateFrom, dateTo])

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

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setSelectedOrderId(null)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
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
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="preparing">Preparing</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
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
                <Input
                  type="date"
                  placeholder="From Date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>

              {/* Date To */}
              <div>
                <Input
                  type="date"
                  placeholder="To Date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>

            {/* Second Row for Clear Button */}
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                {hasActiveFilters ? (
                  <>Showing {filteredOrders.length} of {orders?.length || 0} orders</>
                ) : (
                  <>Total: {orders?.length || 0} orders</>
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
          ) : filteredOrders && filteredOrders.length > 0 ? (
            <>
              {/* Kanban View - Desktop Only */}
              {viewType === 'kanban' && (
                <div className="hidden md:block">
              <OrdersKanban 
                orders={filteredOrders} 
                onCheckOrder={handleCheckOrder}
                onOrderUpdate={() => mutate()}
              />
                </div>
              )}
              
              {/* List View - Mobile Card View or Desktop Table View */}
              {viewType === 'list' && (
                <>
                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-3">
                  {filteredOrders.map((order: any) => (
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
                          value={order.status || 'pending'}
                          onValueChange={(newStatus) => handleStatusChange(order.name, newStatus)}
                        >
                          <SelectTrigger className={cn(
                            "h-7 w-[110px] text-xs border-0 shadow-none",
                            order.status === 'delivered' ? 'bg-[#dff6dd] dark:bg-[#1b5e20] text-[#107c10] dark:text-[#81c784] hover:bg-[#c8e6c9] dark:hover:bg-[#2e7d32]' :
                            order.status === 'cancelled' ? 'bg-[#fde7e9] dark:bg-[#b71c1c] text-[#d13438] dark:text-[#ef5350] hover:bg-[#fcc5c9] dark:hover:bg-[#c62828]' :
                            order.status === 'pending' ? 'bg-[#fff4ce] dark:bg-[#ca5010]/20 text-[#ca5010] dark:text-[#ffaa44] hover:bg-[#ffe69d] dark:hover:bg-[#ca5010]/30' :
                            order.status === 'confirmed' ? 'bg-orange-50 dark:bg-[#ea580c]/20 text-[#ea580c] dark:text-[#ff8c42] hover:bg-orange-100 dark:hover:bg-[#ea580c]/30' :
                            order.status === 'preparing' ? 'bg-[#e8d5ff] dark:bg-[#4a148c] text-[#8764b8] dark:text-[#ba68c8] hover:bg-[#d4b9e8] dark:hover:bg-[#6a1b9a]' :
                            order.status === 'ready' ? 'bg-[#cce5ff] dark:bg-[#0d47a1] text-[#004578] dark:text-[#64b5f6] hover:bg-[#99ccff] dark:hover:bg-[#1565c0]' :
                            'bg-muted text-muted-foreground hover:bg-accent'
                          )}>
                            <SelectValue>
                              <span className="capitalize">{order.status || 'pending'}</span>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="preparing">Preparing</SelectItem>
                            <SelectItem value="ready">Ready</SelectItem>
                            <SelectItem value="delivered">Delivered</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        {order.table_number && (
                          <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-[#e8d5ff] dark:bg-[#4a148c] text-[#8764b8] dark:text-[#ba68c8] border border-[#d4b9e8] dark:border-[#6a1b9a]">
                            Table {order.table_number}
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
                  {filteredOrders.map((order: any) => (
                    <TableRow key={order.name}>
                      <TableCell className="font-medium">{order.order_number || order.name}</TableCell>
                      <TableCell>
                            <Select
                              value={order.status || 'pending'}
                              onValueChange={(newStatus) => handleStatusChange(order.name, newStatus)}
                            >
                              <SelectTrigger className={cn(
                                "h-7 w-[120px] text-xs border-0 shadow-none",
                                order.status === 'delivered' ? 'bg-[#dff6dd] dark:bg-[#1b5e20] text-[#107c10] dark:text-[#81c784] hover:bg-[#c8e6c9] dark:hover:bg-[#2e7d32]' :
                                order.status === 'cancelled' ? 'bg-[#fde7e9] dark:bg-[#b71c1c] text-[#d13438] dark:text-[#ef5350] hover:bg-[#fcc5c9] dark:hover:bg-[#c62828]' :
                                order.status === 'pending' ? 'bg-[#fff4ce] dark:bg-[#ca5010]/20 text-[#ca5010] dark:text-[#ffaa44] hover:bg-[#ffe69d] dark:hover:bg-[#ca5010]/30' :
                                order.status === 'confirmed' ? 'bg-orange-50 dark:bg-[#ea580c]/20 text-[#ea580c] dark:text-[#ff8c42] hover:bg-orange-100 dark:hover:bg-[#ea580c]/30' :
                                order.status === 'preparing' ? 'bg-[#e8d5ff] dark:bg-[#4a148c] text-[#8764b8] dark:text-[#ba68c8] hover:bg-[#d4b9e8] dark:hover:bg-[#6a1b9a]' :
                                order.status === 'ready' ? 'bg-[#cce5ff] dark:bg-[#0d47a1] text-[#004578] dark:text-[#64b5f6] hover:bg-[#99ccff] dark:hover:bg-[#1565c0]' :
                                'bg-muted text-muted-foreground hover:bg-accent'
                              )}>
                                <SelectValue>
                                  <span className="capitalize">{order.status || 'pending'}</span>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="confirmed">Confirmed</SelectItem>
                                <SelectItem value="preparing">Preparing</SelectItem>
                                <SelectItem value="ready">Ready</SelectItem>
                                <SelectItem value="delivered">Delivered</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                      </TableCell>
                      <TableCell>
                        {order.table_number ? (
                              <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-[#e8d5ff] dark:bg-[#4a148c] text-[#8764b8] dark:text-[#ba68c8] border border-[#d4b9e8] dark:border-[#6a1b9a]">
                            Table {order.table_number}
                          </span>
                        ) : (
                              <span className="text-muted-foreground">-</span>
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
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No orders found</p>
              {hasActiveFilters && (
                <p className="text-xs mt-2 text-muted-foreground/70">Try adjusting your filters</p>
              )}
            </div>
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





