import { useState } from 'react'
import { useFrappeGetDocList } from '@/lib/frappe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Eye, LayoutGrid, List } from 'lucide-react'
import { OrdersKanban } from '@/components/OrdersKanban'
import { OrderDetailsDialog } from '@/components/OrderDetailsDialog'

type ViewType = 'kanban' | 'list'

export default function Orders() {
  const [viewType, setViewType] = useState<ViewType>('kanban')
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const { data: orders, isLoading, mutate } = useFrappeGetDocList('Order', {
    fields: ['name', 'order_number', 'status', 'total', 'creation', 'table_number', 'coupon'],
    limit: 100,
    orderBy: { field: 'creation', order: 'desc' }
  })

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

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading orders...</div>
          ) : orders && orders.length > 0 ? (
            viewType === 'kanban' ? (
              <OrdersKanban 
                orders={orders} 
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
                  {orders.map((order: any) => (
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
                        {order.creation ? new Date(order.creation).toLocaleDateString() : 'N/A'}
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





