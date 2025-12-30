import { useParams, Link } from 'react-router-dom'
import { useFrappeGetDoc, useFrappePostCall } from '@/lib/frappe'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function OrderDetail() {
  const { orderId } = useParams<{ orderId: string }>()
  const { data: order, isLoading } = useFrappeGetDoc('Order', orderId || '', {
    fields: ['*']
  })
  
  // Get restaurant data to fetch table options
  const { data: restaurantDoc } = useFrappeGetDoc('Restaurant', order?.restaurant || '', {
    enabled: !!order?.restaurant,
    fields: ['name', 'tables']
  })
  
  // Table update API call
  const { call: updateTableNumber } = useFrappePostCall('dinematters.dinematters.api.order_status.update_table_number')
  
  // Generate table options based on restaurant tables count
  const tableOptions = [0, ...(restaurantDoc?.tables ? Array.from({length: restaurantDoc.tables}, (_, i) => i + 1) : [])]
  
  // Handle table number change
  const handleTableNumberChange = async (newTableNumber: number) => {
    if (!order?.name) return
    
    try {
      await updateTableNumber({
        order_id: order.name,
        table_number: newTableNumber
      })
      
      toast.success(`Table updated to Table ${newTableNumber}`)
      
      // Reload the order data to show the updated table number
      window.location.reload()
    } catch (error: any) {
      console.error('Failed to update table number:', error)
      toast.error(error?.message || 'Failed to update table number')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8 text-muted-foreground">Loading order details...</div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">Order not found</p>
          <Link to="/orders">
            <Button>Back to Orders</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/orders">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Order Details</h2>
          <p className="text-muted-foreground">
            {order.order_number || order.name}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Order Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Order ID</p>
              <p className="font-mono text-sm">{order.order_id || order.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {order.status || 'N/A'}
              </span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Restaurant</p>
              <p className="font-medium">{order.restaurant || 'N/A'}</p>
            </div>
            {tableOptions.length > 0 ? (
              <div>
                <p className="text-sm text-muted-foreground">Table Number</p>
                <Select
                  value={(order.table_number ?? 0).toString()}
                  onValueChange={(value) => {
                    const parsed = parseInt(value, 10)
                    const tableNum = Number.isNaN(parsed) ? 0 : parsed
                    handleTableNumberChange(tableNum)
                  }}
                >
                  <SelectTrigger className="w-full max-w-[150px]">
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
              </div>
            ) : order.table_number ? (
              <div>
                <p className="text-sm text-muted-foreground">Table Number</p>
                <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800">
                  Table {order.table_number}
                </span>
              </div>
            ) : null}
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p>{order.creation ? new Date(order.creation).toLocaleString() : 'N/A'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <p className="text-muted-foreground">Subtotal</p>
              <p className="font-medium">₹{order.subtotal || 0}</p>
            </div>
            {order.discount && order.discount > 0 && (
              <div className="flex justify-between">
                <p className="text-muted-foreground">Discount</p>
                <p className="font-medium text-green-600">-₹{order.discount}</p>
              </div>
            )}
            {order.tax && order.tax > 0 && (
              <div className="flex justify-between">
                <p className="text-muted-foreground">Tax</p>
                <p className="font-medium">₹{order.tax}</p>
              </div>
            )}
            {order.delivery_fee && order.delivery_fee > 0 && (
              <div className="flex justify-between">
                <p className="text-muted-foreground">Delivery Fee</p>
                <p className="font-medium">₹{order.delivery_fee}</p>
              </div>
            )}
            <div className="flex justify-between border-t pt-4">
              <p className="font-semibold">Total</p>
              <p className="font-bold text-lg">₹{order.total || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {order.order_items && order.order_items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {order.order_items.map((item: any, index: number) => (
                <div key={index} className="flex justify-between items-center border-b pb-4 last:border-0">
                  <div>
                    <p className="font-medium">{item.product || 'N/A'}</p>
                    <p className="text-sm text-muted-foreground">
                      Quantity: {item.quantity || 1}
                    </p>
                    {item.unit_price && (
                      <p className="text-sm text-muted-foreground">
                        Unit Price: ₹{item.unit_price}
                      </p>
                    )}
                  </div>
                  <p className="font-medium">₹{item.total_price || item.unit_price || 0}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}





