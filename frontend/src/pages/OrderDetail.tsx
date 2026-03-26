import { useParams, Link } from 'react-router-dom'
import { useFrappeGetDoc, useFrappePostCall } from '@/lib/frappe'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Star, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCurrency } from '@/hooks/useCurrency'

export default function OrderDetail() {
  const { formatAmount, formatAmountNoDecimals } = useCurrency()
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
  
  const [assigningDelivery, setAssigningDelivery] = useState(false)
  const [cancellingDelivery, setCancellingDelivery] = useState(false)
  const [deliveryMode, setDeliveryMode] = useState<'auto' | 'manual'>('manual')
  const [manualForm, setManualForm] = useState({ partner_name: '', rider_name: '', rider_phone: '', eta: '' })

  const handleAssignDelivery = async () => {
    if (!order?.name) return
    setAssigningDelivery(true)
    try {
      const payload: any = { order_id: order.name, delivery_mode: deliveryMode }
      if (deliveryMode === 'manual') {
        payload.partner_name = manualForm.partner_name || 'manual'
        payload.rider_name = manualForm.rider_name
        payload.rider_phone = manualForm.rider_phone
        payload.eta = manualForm.eta
      }
      const res = await fetch('/api/delivery/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.detail || data.error || 'Failed to assign delivery')
      toast.success('Delivery assigned successfully')
      window.location.reload()
    } catch (e: any) {
      toast.error(e.message || 'Error occurred')
    } finally {
      setAssigningDelivery(false)
    }
  }

  const handleCancelDelivery = async () => {
    if (!order?.delivery_id) return
    if (!confirm("Are you sure you want to cancel the delivery assignment?")) return;
    setCancellingDelivery(true)
    try {
      const res = await fetch('/api/delivery/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery_id: order.delivery_id, order_id: order.name })
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.detail || data.error || 'Failed to cancel delivery')
      toast.success('Delivery cancelled successfully')
      window.location.reload()
    } catch (e: any) {
      toast.error(e.message || 'Error occurred')
    } finally {
      setCancellingDelivery(false)
    }
  }
  
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
            <div>
              <p className="text-sm text-muted-foreground">Order Type</p>
              <p className="font-medium capitalize">{((order.order_type || 'dine_in') as string).replace('_', ' ')}</p>
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
                <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border border-gray-700 dark:border-gray-300">
                  Table {order.table_number}
                </span>
              </div>
            ) : null}
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p>{order.creation ? new Date(order.creation).toLocaleString() : 'N/A'}</p>
            </div>
            {(order.pickup_time || order.estimated_delivery) && (
              <div>
                <p className="text-sm text-muted-foreground">Timing</p>
                <p>
                  {order.pickup_time
                    ? `Pickup: ${new Date(order.pickup_time).toLocaleString()}`
                    : `ETA: ${new Date(order.estimated_delivery).toLocaleString()}`}
                </p>
              </div>
            )}
            {(order.delivery_address || order.delivery_city || order.delivery_instructions) && (
              <div>
                <p className="text-sm text-muted-foreground">Delivery Details</p>
                {order.delivery_address ? <p>{order.delivery_address}</p> : null}
                {order.delivery_landmark ? <p className="text-sm text-muted-foreground">Landmark: {order.delivery_landmark}</p> : null}
                {order.delivery_city ? <p className="text-sm text-muted-foreground">City: {order.delivery_city}</p> : null}
                {order.delivery_instructions ? <p className="text-sm text-muted-foreground">Instructions: {order.delivery_instructions}</p> : null}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <p className="text-muted-foreground">Subtotal</p>
              <p className="font-medium">{formatAmount(order.subtotal)}</p>
            </div>
            {order.discount && order.discount > 0 && (
              <div className="flex justify-between">
                <p className="text-muted-foreground">Discount</p>
                <p className="font-medium text-green-600">-{formatAmount(order.discount)}</p>
              </div>
            )}
            {order.tax && order.tax > 0 && (
              <div className="flex justify-between">
                <p className="text-muted-foreground">Tax</p>
                <p className="font-medium">{formatAmount(order.tax)}</p>
              </div>
            )}
            {order.delivery_fee && order.delivery_fee > 0 && (
              <div className="flex justify-between">
                <p className="text-muted-foreground">Delivery Fee</p>
                <p className="font-medium">{formatAmount(order.delivery_fee)}</p>
              </div>
            )}
            {order.packaging_fee && order.packaging_fee > 0 && (
              <div className="flex justify-between">
                <p className="text-muted-foreground">Packaging Fee</p>
                <p className="font-medium">{formatAmount(order.packaging_fee)}</p>
              </div>
            )}
            <div className="flex justify-between border-t pt-4">
              <p className="font-semibold">Total</p>
              <p className="font-bold text-lg">{formatAmountNoDecimals(order.total)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {order.order_type === 'delivery' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" /> Delivery Workflow
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!order.delivery_id && order.status !== 'cancelled' && (
              <div className="p-4 bg-muted/50 rounded-lg border space-y-4">
                <div className="flex items-center gap-4">
                  <span className="font-medium">Assignment Mode:</span>
                  <Select value={deliveryMode} onValueChange={(v: any) => setDeliveryMode(v)}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Borzo (Third Party)</SelectItem>
                      <SelectItem value="manual">Self / Manual Delivery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {deliveryMode === 'manual' && (
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t mt-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Partner Name (Optional)</label>
                      <input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" value={manualForm.partner_name} onChange={e => setManualForm({...manualForm, partner_name: e.target.value})} placeholder="e.g. Self, Porter" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Rider Name</label>
                      <input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" value={manualForm.rider_name} onChange={e => setManualForm({...manualForm, rider_name: e.target.value})} placeholder="Rider Name" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Rider Phone</label>
                      <input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" value={manualForm.rider_phone} onChange={e => setManualForm({...manualForm, rider_phone: e.target.value})} placeholder="Rider Phone" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Estimated Time (ETA)</label>
                      <input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" value={manualForm.eta} onChange={e => setManualForm({...manualForm, eta: e.target.value})} placeholder="e.g. 30 mins" />
                    </div>
                  </div>
                )}
                
                <div className="flex justify-end pt-2">
                  <Button onClick={handleAssignDelivery} disabled={assigningDelivery}>
                    {assigningDelivery ? 'Assigning...' : 'Assign Delivery'}
                  </Button>
                </div>
              </div>
            )}
            
            {(order.delivery_id || order.delivery_partner) && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg border">
                <div>
                  <p className="font-semibold">
                    {order.delivery_partner === 'borzo' ? 'Borzo Delivery' : 
                     order.delivery_partner === 'manual' || order.delivery_mode === 'manual' ? 'Manual Delivery' : 
                     'Unassigned'}
                  </p>
                  
                  {order.delivery_id && order.delivery_partner !== 'manual' && order.delivery_mode !== 'manual' && (
                    <p className="text-sm text-muted-foreground font-mono mt-1">
                      ID: {order.delivery_id} | Status: <span className="font-semibold text-primary">{order.delivery_status}</span>
                    </p>
                  )}
                  {(order.delivery_partner === 'manual' || order.delivery_mode === 'manual') && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Status: <span className="font-semibold text-primary">{order.delivery_status || 'Assigned'}</span>
                    </p>
                  )}
                  {order.delivery_eta && (
                    <p className="text-sm text-muted-foreground mt-1">ETA: {order.delivery_eta}</p>
                  )}
                  {order.delivery_rider_name && (
                    <div className="mt-2 text-sm bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-100 dark:border-blue-900/50">
                      Rider: <span className="font-semibold">{order.delivery_rider_name}</span> ({order.delivery_rider_phone})
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                  {order.delivery_partner !== 'manual' && order.delivery_mode !== 'manual' && order.delivery_status !== 'cancelled' && order.delivery_status !== 'delivered' && order.delivery_tracking_url && (
                    <Button variant="outline" asChild className="w-full sm:w-auto">
                      <a href={order.delivery_tracking_url} target="_blank" rel="noopener noreferrer">Track Delivery</a>
                    </Button>
                  )}
                  {order.delivery_status !== 'cancelled' && order.delivery_status !== 'delivered' && (
                    <Button variant="destructive" onClick={handleCancelDelivery} disabled={cancellingDelivery} className="w-full sm:w-auto">
                      {cancellingDelivery ? 'Cancelling...' : 'Cancel Delivery'}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {((order as any).customer_rating != null || (order as any).food_rating != null || (order as any).service_rating != null || !!((order as any).customer_feedback && String((order as any).customer_feedback).trim())) && (
        <Card>
          <CardHeader>
            <CardTitle>Customer Feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-6">
              {((order as any).food_rating ?? (order as any).customer_rating) != null && (
                <div>
                  <p className="text-sm text-muted-foreground">Food Rating</p>
                  <span className="flex items-center gap-1">
                    <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                    {(order as any).food_rating ?? (order as any).customer_rating}/5
                  </span>
                </div>
              )}
              {(order as any).service_rating != null && (
                <div>
                  <p className="text-sm text-muted-foreground">Service Rating</p>
                  <span className="flex items-center gap-1">
                    <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                    {(order as any).service_rating}/5
                  </span>
                </div>
              )}
            </div>
            {(order as any).customer_feedback && (
              <div>
                <p className="text-sm text-muted-foreground">Feedback</p>
                <p className="text-sm">{(order as any).customer_feedback}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                        Unit Price: {formatAmount(item.unit_price)}
                      </p>
                    )}
                  </div>
                  <p className="font-medium">{formatAmount(item.total_price || item.unit_price)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}





