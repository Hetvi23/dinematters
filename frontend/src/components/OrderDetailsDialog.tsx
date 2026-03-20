import { useFrappeGetDoc } from '@/lib/frappe'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { useCurrency } from '@/hooks/useCurrency'
import { 
  ShoppingBag, 
  Clock, 
  User, 
  CreditCard, 
  MapPin, 
  Truck, 
  HelpCircle,
  Copy,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Hash,
  ArrowRight,
  Loader2
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface OrderDetailsDialogProps {
  orderId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OrderDetailsDialog({ orderId, open, onOpenChange }: OrderDetailsDialogProps) {
  const { formatAmount, formatAmountNoDecimals } = useCurrency()
  const [copied, setCopied] = useState(false)
  
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

  const handleCopyId = () => {
    if (orderId) {
      navigator.clipboard.writeText(orderId)
      setCopied(true)
      toast.success('Order ID copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const getStatusConfig = (status: string) => {
    const s = status?.toLowerCase()
    switch (s) {
      case 'delivered':
      case 'billed':
        return { color: 'text-green-600 bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400', icon: CheckCircle2, label: 'Completed' }
      case 'cancelled':
        return { color: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400', icon: AlertCircle, label: 'Cancelled' }
      case 'pending verification':
      case 'pending_verification':
        return { color: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400', icon: Clock, label: 'Verifying' }
      case 'preparing':
        return { color: 'text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-400', icon: Loader2, label: 'Preparing' }
      case 'ready':
        return { color: 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400', icon: ArrowRight, label: 'Ready for Pickup' }
      default:
        return { color: 'text-gray-600 bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400', icon: HelpCircle, label: status }
    }
  }

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

  const statusConfig = getStatusConfig(order?.status || '')
  const StatusIcon = statusConfig.icon

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 border-none bg-slate-50 dark:bg-zinc-950 gap-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-sm font-medium text-muted-foreground italic">Fetching order details...</p>
          </div>
        ) : order ? (
          <div className="flex flex-col h-full bg-white dark:bg-zinc-900 shadow-xl overflow-hidden">
            {/* Enterprise Header */}
            <div className="px-6 py-6 border-b bg-white dark:bg-zinc-900 sticky top-0 z-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1">
                      <Hash className="w-3 h-3" />
                      Order Identification
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-display font-black tracking-tight text-foreground">
                      {order?.order_number || order?.name}
                    </h2>
                    <button 
                      onClick={handleCopyId}
                      className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-muted-foreground"
                      title="Copy Order ID"
                    >
                      {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 font-bold text-xs uppercase tracking-wider shadow-sm ${statusConfig.color}`}>
                  <StatusIcon className="w-4 h-4" />
                  {statusConfig.label}
                </div>
              </div>
            </div>

            <div className="p-6 space-y-8 overflow-y-auto bg-slate-50/50 dark:bg-zinc-950/20">
              {/* Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">Order Type</span>
                  </div>
                  <p className="text-sm font-bold capitalize">{(order.order_type || 'dine_in').replace('_', ' ')}</p>
                  {order.table_number && (
                    <p className="text-xs text-muted-foreground mt-1 font-mono bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded inline-block">Table No. {order.table_number}</p>
                  )}
                </div>

                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">Timing</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs flex items-center justify-between">
                      <span className="text-muted-foreground">Placed:</span>
                      <span className="font-bold">{new Date(order.creation).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </p>
                    {order.pickup_time && (
                      <p className="text-xs flex items-center justify-between">
                        <span className="text-muted-foreground">Pickup:</span>
                        <span className="font-bold">{new Date(order.pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                      <User className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">Customer</span>
                  </div>
                  <p className="text-sm font-bold truncate">{order.customer_name || 'Guest User'}</p>
                  <p className="text-xs text-muted-foreground mt-1 font-mono tracking-tighter">{order.customer_phone || 'No phone'}</p>
                </div>
              </div>

              {/* Delivery Details Section (If applicable) */}
              {(order.delivery_address || order.delivery_city) && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b bg-gray-50/50 dark:bg-zinc-800/30 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-black uppercase tracking-widest">Delivery Details</h3>
                  </div>
                  <div className="p-4 flex gap-4">
                    <div className="mt-1">
                      <MapPin className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-relaxed">{order.delivery_address}</p>
                      {order.delivery_landmark && (
                        <p className="text-xs text-muted-foreground italic">Landmark: {order.delivery_landmark}</p>
                      )}
                      {order.delivery_instructions && (
                        <div className="mt-3 p-3 rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800/50">
                          <p className="text-[10px] font-black uppercase text-orange-600 mb-1">Kitchen / Driver Notes</p>
                          <p className="text-xs italic text-orange-900 dark:text-orange-200">{order.delivery_instructions}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Items Table Section */}
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden shadow-sm">
                <div className="px-4 py-4 border-b bg-gray-50/50 dark:bg-zinc-800/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Hash className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <h3 className="text-xs font-black uppercase tracking-widest">Order Items</h3>
                  </div>
                  <span className="text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full text-muted-foreground">
                    {order.order_items?.length || 0} Products
                  </span>
                </div>
                
                <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                  {order.order_items?.map((item: any, index: number) => {
                    const customizations = parseCustomizations(item.customizations)
                    const hasCustomizations = customizations && Object.keys(customizations).length > 0

                    return (
                      <div key={index} className="p-4 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center justify-center font-mono font-black text-xs min-w-[24px] h-[24px] bg-zinc-900 text-white rounded-md shadow-inner">
                                {item.quantity || 1}
                              </div>
                              <span className="text-base font-bold text-foreground truncate">{item.product_name || item.product || 'Unnamed Item'}</span>
                            </div>
                            
                            {hasCustomizations && (
                              <div className="mt-2 ml-8 space-y-1">
                                {Object.entries(customizations).map(([question, options]: [string, any]) => {
                                  const opts = Array.isArray(options) ? options : [options]
                                  return (
                                    <div key={question} className="flex items-start gap-1.5">
                                      <span className="text-[10px] uppercase font-bold text-muted-foreground/60 mt-0.5">{question}:</span>
                                      <span className="text-xs font-medium text-muted-foreground leading-tight">{opts.join(', ')}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-foreground">{formatAmount(item.total_price || item.unit_price)}</p>
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5 opacity-60">
                              @{formatAmount(item.unit_price)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Payment & Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start pb-4">
                {/* Method Info */}
                <div className="space-y-4">
                   <div className="bg-zinc-50 dark:bg-zinc-800/40 p-5 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700">
                    <div className="flex items-center gap-2 mb-3">
                      <CreditCard className="w-5 h-5 text-muted-foreground" />
                      <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Payment Method</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-white dark:bg-zinc-700 shadow-sm flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-black capitalize">{(order.payment_method || 'Unspecified').replace('_', ' ')}</p>
                        <p className={`text-[10px] font-bold uppercase mt-0.5 ${order.payment_status === 'Paid' ? 'text-green-500' : 'text-orange-500'}`}>
                          {order.payment_status || 'Pending Payment'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {order.coupon && (
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-2xl border border-green-100 dark:border-green-800/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase text-green-700 dark:text-green-400 tracking-widest">Promotion Applied</span>
                        <div className="px-2 py-0.5 bg-green-600 text-white text-[9px] font-black rounded-full shadow-sm">
                          -{coupon?.discount_type === 'percent' ? `${coupon.discount_value}%` : formatAmount(coupon?.discount_value || 0)}
                        </div>
                      </div>
                      <p className="text-sm font-black text-green-800 dark:text-green-300">{order.coupon}</p>
                      {coupon?.description && <p className="text-xs text-green-600/80 dark:text-green-400/60 mt-1 italic leading-tight">{coupon.description}</p>}
                    </div>
                  )}
                </div>

                {/* Final Breakdown */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm px-1">
                    <span className="text-muted-foreground font-medium">Cart Subtotal</span>
                    <span className="font-bold text-foreground">{formatAmount(order.subtotal)}</span>
                  </div>
                  
                  {order.packaging_fee > 0 && (
                    <div className="flex justify-between items-center text-sm px-1">
                      <span className="text-muted-foreground font-medium">Packaging Charges</span>
                      <span className="font-bold text-foreground">{formatAmount(order.packaging_fee)}</span>
                    </div>
                  )}

                  {order.delivery_fee > 0 && (
                    <div className="flex justify-between items-center text-sm px-1">
                      <span className="text-muted-foreground font-medium">Home Delivery Fee</span>
                      <span className="font-bold text-foreground">{formatAmount(order.delivery_fee)}</span>
                    </div>
                  )}

                  {order.tax > 0 && (
                    <div className="flex justify-between items-center text-sm px-1">
                      <span className="text-muted-foreground font-medium">Taxes & GST (18%)</span>
                      <span className="font-bold text-foreground">{formatAmount(order.tax)}</span>
                    </div>
                  )}

                  {order.discount > 0 && (
                    <div className="flex justify-between items-center text-sm px-1">
                      <span className="text-green-600 font-bold">Total Savings</span>
                      <span className="font-black text-green-600">-{formatAmount(order.discount)}</span>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t-2 border-slate-100 dark:border-zinc-800 flex justify-between items-end px-1">
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Total Amount Payable</p>
                      <span className="text-[10px] text-muted-foreground font-medium italic">Incl. all taxes and fees</span>
                    </div>
                    <div className="text-right">
                      <h4 className="text-3xl font-display font-black text-foreground tracking-tighter leading-none">
                        {formatAmountNoDecimals(order.total)}
                      </h4>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Action Bar */}
            <div className="p-4 border-t bg-white dark:bg-zinc-900 flex justify-end gap-3 sticky bottom-0">
               <button 
                  onClick={() => onOpenChange(false)}
                  className="px-6 py-2.5 rounded-xl font-bold text-sm bg-gray-100 dark:bg-zinc-800 text-foreground hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all border-b-4 border-gray-200 dark:border-zinc-700 active:border-b-0 active:translate-y-1"
                >
                  Close Window
                </button>
                {/* Potential room for "Print Receipt" button */}
            </div>
          </div>
        ) : (
          <div className="text-center py-20 px-6 space-y-4">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <div>
              <h3 className="text-xl font-black text-foreground">Order Not Found</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">We couldn't retrieve the details for this order. It may have been deleted or the ID is incorrect.</p>
            </div>
            <button 
              onClick={() => onOpenChange(false)}
              className="px-8 py-3 bg-primary text-white font-black rounded-xl"
            >
              Go Back
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

