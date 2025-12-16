import { Link } from 'react-router-dom'
import { useFrappeGetDocList } from '@/lib/frappe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Eye } from 'lucide-react'

export default function Orders() {
  const { data: orders, isLoading } = useFrappeGetDocList('Order', {
    fields: ['name', 'order_id', 'order_number', 'status', 'total', 'creation', 'restaurant'],
    limit: 100,
    orderBy: { field: 'creation', order: 'desc' }
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Orders</h2>
        <p className="text-muted-foreground">
          View and manage all orders (filtered by your restaurant permissions)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Orders</CardTitle>
          <CardDescription>
            Orders are automatically filtered based on your restaurant access
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading orders...</div>
          ) : orders && orders.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order Number</TableHead>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order: any) => (
                  <TableRow key={order.name}>
                    <TableCell className="font-medium">{order.order_number || order.name}</TableCell>
                    <TableCell className="font-mono text-xs">{order.order_id || order.name}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                        order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {order.status || 'N/A'}
                      </span>
                    </TableCell>
                    <TableCell>₹{order.total || 0}</TableCell>
                    <TableCell>{order.restaurant || 'N/A'}</TableCell>
                    <TableCell>
                      {order.creation ? new Date(order.creation).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Link to={`/orders/${order.name}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No orders found</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}





