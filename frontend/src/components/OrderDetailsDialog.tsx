import { useFrappeGetDoc } from '@/lib/frappe'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCurrency } from '@/hooks/useCurrency'

interface OrderDetailsDialogProps {
  orderId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OrderDetailsDialog({ orderId, open, onOpenChange }: OrderDetailsDialogProps) {
  const { formatAmount, formatAmountNoDecimals } = useCurrency()
  const { data: order, isLoading } = useFrappeGetDoc('Order', orderId || '', {
    fields: ['*'],
    enabled: open && !!orderId
  })

  // Fetch coupon details if coupon is applied
  const { data: coupon } = useFrappeGetDoc('Coupon', order?.coupon || '', {
    fields: ['code', 'discount_type', 'discount_value', 'description', 'detailed_description'],
    enabled: open && !!order?.coupon
  })

  if (!orderId) return null

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-[#dff6dd] dark:bg-[#1b5e20] text-[#107c10] dark:text-[#81c784]'
      case 'cancelled':
        return 'bg-[#fde7e9] dark:bg-[#b71c1c] text-[#d13438] dark:text-[#ef5350]'
      case 'pending':
        return 'bg-[#fff4ce] dark:bg-[#ca5010]/20 text-[#ca5010] dark:text-[#ffaa44]'
      case 'confirmed':
        return 'bg-orange-50 dark:bg-primary/20 text-primary dark:text-primary/80'
      case 'preparing':
        return 'bg-[#e8d5ff] dark:bg-[#4a148c] text-[#8764b8] dark:text-[#ba68c8]'
      case 'ready':
        return 'bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  // Parse customizations from JSON string if needed
  const parseCustomizations = (customizations: string | object | null) => {
    if (!customizations) return {}
    if (typeof customizations === 'string') {
      try {
        return JSON.parse(customizations)
      } catch {
        return {}
      }
    }
    return customizations
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Order Details</DialogTitle>
          <DialogDescription>
            {order?.order_number || order?.name || orderId}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading order details...</div>
        ) : order ? (
          <div className="space-y-4">
            {/* Order Items with Customizations */}
            {order.order_items && order.order_items.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Order Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {order.order_items.map((item: any, index: number) => {
                      const customizations = parseCustomizations(item.customizations)
                      const hasCustomizations = customizations && Object.keys(customizations).length > 0

                      return (
                        <div key={index} className="border-b border-border pb-3 last:border-0 last:pb-0">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-medium text-foreground">{item.product || 'N/A'}</p>
                              <p className="text-xs text-muted-foreground">
                                Qty: {item.quantity || 1} × {formatAmount(item.unit_price)}
                              </p>
                            </div>
                            <p className="font-semibold text-foreground">{formatAmount(item.total_price || item.unit_price)}</p>
                          </div>
                          
                          {hasCustomizations && (
                            <div className="mt-2 pl-2 border-l-2 border-border">
                              <div className="space-y-0.5">
                                {Object.entries(customizations).map(([questionId, optionIds]: [string, any]) => {
                                  const options = Array.isArray(optionIds) ? optionIds : [optionIds]
                                  return (
                                    <p key={questionId} className="text-xs text-muted-foreground">
                                      <span className="font-medium">{questionId}:</span> {options.join(', ')}
                                    </p>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Payment Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <p className="text-muted-foreground">Subtotal</p>
                  <p className="font-medium">{formatAmount(order.subtotal)}</p>
                </div>
                {order.discount && order.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <p className="text-muted-foreground">Discount</p>
                    <p className="font-medium text-[#107c10] dark:text-[#81c784]">-{formatAmount(order.discount)}</p>
                  </div>
                )}
                {order.tax && order.tax > 0 && (
                  <div className="flex justify-between text-sm">
                    <p className="text-muted-foreground">Tax</p>
                    <p className="font-medium">{formatAmount(order.tax)}</p>
                  </div>
                )}
                {order.delivery_fee && order.delivery_fee > 0 && (
                  <div className="flex justify-between text-sm">
                    <p className="text-muted-foreground">Delivery Fee</p>
                    <p className="font-medium">{formatAmount(order.delivery_fee)}</p>
                  </div>
                )}
                {(order.coupon || coupon) && (
                  <div className="flex justify-between items-center text-sm bg-[#dff6dd] dark:bg-[#1b5e20] p-2 rounded-md border border-[#92c5f7] dark:border-[#4caf50]">
                    <div>
                      <p className="text-xs text-muted-foreground">Coupon</p>
                      <p className="font-semibold text-[#107c10] dark:text-[#81c784]">{coupon?.code || order.coupon || 'N/A'}</p>
                    </div>
                    {coupon && (
                      <p className="font-semibold text-[#107c10] dark:text-[#81c784]">
                        {coupon.discount_type === 'percent' 
                          ? `-${coupon.discount_value}%` 
                          : `-${formatAmount(coupon.discount_value)}`}
                      </p>
                    )}
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-2 mt-2">
                  <p className="font-semibold text-foreground">Total</p>
                  <p className="font-bold text-lg text-foreground">{formatAmountNoDecimals(order.total)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">Order not found</div>
        )}
      </DialogContent>
    </Dialog>
  )
}

