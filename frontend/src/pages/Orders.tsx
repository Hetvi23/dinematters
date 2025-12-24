import { useState, useMemo } from 'react'
import { useFrappeGetDocList } from '@/lib/frappe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

type ViewType = 'kanban' | 'list'

export default function Orders() {
  const [viewType, setViewType] = useState<ViewType>('kanban')
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
    fields: ['name', 'order_number', 'status', 'total', 'creation', 'table_number', 'coupon'],
    limit: 100,
    orderBy: { field: 'creation', order: 'desc' }
  })

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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Orders</h2>
        <div className="flex gap-2">
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <Button
            variant={viewType === 'kanban' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewType('kanban')}
          >
            <LayoutGrid className="h-4 w-4 mr-2" />
            Kanban
          </Button>
          <Button
            variant={viewType === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewType('list')}
          >
            <List className="h-4 w-4 mr-2" />
            List
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
            <div className="mt-4 flex items-center justify-between">
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
            viewType === 'kanban' ? (
              <OrdersKanban 
                orders={filteredOrders} 
                onCheckOrder={handleCheckOrder}
                onOrderUpdate={() => mutate()}
              />
            ) : (
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
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                          order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          order.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'preparing' ? 'bg-purple-100 text-purple-800' :
                          order.status === 'ready' ? 'bg-indigo-100 text-indigo-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {order.status || 'N/A'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {order.table_number ? (
                          <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800">
                            Table {order.table_number}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {order.coupon ? (
                          <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-green-100 text-green-800">
                            {order.coupon}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>₹{order.total || 0}</TableCell>
                      <TableCell>
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
                          variant="default"
                          size="sm"
                          onClick={() => handleCheckOrder(order.name)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Check Order
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          ) : (
            <div className="text-center py-8 text-muted-foreground">No orders found</div>
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





