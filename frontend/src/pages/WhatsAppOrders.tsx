import { useState, useEffect } from 'react'
import { useFrappePostCall, useFrappeEventListener } from '@/lib/frappe'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  MessageSquare, 
  CheckCircle2, 
  Eye, 
  Search, 
  Calendar,
  Phone,
  User,
  ShoppingBag,
  ExternalLink,
  Clock,
  History,
  FilterX,
  Lock,
  ShieldCheck,
  AlertCircle,
  HelpCircle
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { useCurrency } from '@/hooks/useCurrency'
import { OrderDetailsDialog } from '@/components/OrderDetailsDialog'
import { toast } from 'sonner'
import { DatePicker } from '@/components/ui/date-picker'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export default function WhatsAppOrders() {
  const { selectedRestaurant, restaurantConfig } = useRestaurant()
  const { formatAmountNoDecimals } = useCurrency()
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  // App States
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [start, setStart] = useState(0)
  const PAGE_LENGTH = 20

  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'recent' | 'past'>('recent')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const { call: getOrdersApi } = useFrappePostCall('dinematters.dinematters.api.whatsapp_ordering.get_whatsapp_orders')
  const { call: unlockLeadApi } = useFrappePostCall('dinematters.dinematters.api.whatsapp_ordering.unlock_whatsapp_lead')
  const { call: updateStatus } = useFrappePostCall('dinematters.dinematters.api.order_status.update_status')
  
  // ── Real-time Notifications ───────────────────────────────────────────────
  useFrappeEventListener('whatsapp_intent', (data: any) => {
    // Proactive alert for the merchant
    toast.info(`New WhatsApp Order Intent!`, {
      description: `${data.customer_name} is placing an order for approx. ${restaurantConfig?.pricing?.symbol || '₹'}${data.total}`,
      duration: 10000,
      action: {
        label: 'Refresh List',
        onClick: () => fetchOrders(false)
      }
    })
    
    // Auto-refresh the list if we are in recent view
    if (viewMode === 'recent') {
      setTimeout(() => fetchOrders(false), 1000)
    }
  })

  // Fetch Logic
  const fetchOrders = async (isLoadMore = false) => {
    if (!selectedRestaurant) return
    
    setLoading(true)
    const currentStart = isLoadMore ? start : 0
    
    // Calculate 24h ago if in recent mode
    let effectiveFrom = dateFrom
    if (viewMode === 'recent') {
        const yesterday = new Date()
        yesterday.setHours(yesterday.getHours() - 24)
        effectiveFrom = yesterday.toISOString().split('T')[0] // We'll pass as Date string for simplicity
    }

    try {
        const res: any = await getOrdersApi({
            restaurant_id: selectedRestaurant,
            search_query: searchQuery,
            status: statusFilter,
            from_date: effectiveFrom,
            to_date: dateTo,
            start: currentStart,
            page_length: PAGE_LENGTH
        })

        if (res.message?.success) {
            const newOrders = res.message.data || []
            if (isLoadMore) {
                setOrders(prev => [...prev, ...newOrders])
            } else {
                setOrders(newOrders)
            }
            setHasMore(res.message.has_more)
            setStart(currentStart + PAGE_LENGTH)
        }
    } catch (error) {
        console.error("Failed to fetch WhatsApp orders:", error)
        toast.error("Failed to fetch leads")
    } finally {
        setLoading(false)
    }
  }

  // Trigger fetch on filter changes
  useEffect(() => {
    setStart(0)
    fetchOrders(false)
  }, [selectedRestaurant, searchQuery, viewMode, dateFrom, dateTo, statusFilter])

  const handleOpenWhatsApp = (phone: string, orderNumber: string) => {
    const cleanPhone = phone.replace(/\D/g, '')
    const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone
    const message = encodeURIComponent(`Hi! Reaching out regarding your order ${orderNumber}. How can we help you?`)
    window.open(`https://wa.me/${finalPhone}?text=${message}`, '_blank')
  }

  const handleUnlockLead = async (phone: string, orderId: string) => {
    try {
      setLoading(true)
      const res: any = await unlockLeadApi({
        restaurant_id: selectedRestaurant,
        customer_phone: phone,
        order_id: orderId
      })

      if (res.message?.success) {
        toast.success(res.message.message || "Lead Unlocked!")
        // Locally update all orders with this phone number
        setOrders(prev => prev.map(o => o.customer_phone === phone ? { ...o, is_unlocked: true } : o))
      } else {
        toast.error(res.message?.error || "Failed to unlock lead")
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to unlock lead")
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteOrder = async (orderId: string) => {
    try {
      await updateStatus({
        order_id: orderId,
        status: 'delivered'
      })
      toast.success('Order marked as completed')
      // Locally update specifically to avoid full refetch
      setOrders(prev => prev.map(o => o.name === orderId ? { ...o, status: 'delivered' } : o))
    } catch (error: any) {
      toast.error(error.message || 'Failed to update order')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'Pending Verification':
      case 'pending verification':
      case 'pending_verification':
        return (
          <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 gap-1.5 animate-pulse font-bold">
            <Clock className="h-3 w-3" />
            Awaiting Msg
          </Badge>
        )
      case 'confirmed':
        return (
          <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 gap-1.5 font-bold">
            <CheckCircle2 className="h-3 w-3" />
            Confirmed
          </Badge>
        )
      case 'delivered':
        return (
          <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1.5 font-bold">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </Badge>
        )
      case 'cancelled':
        return (
          <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 gap-1.5 font-bold">
            <AlertCircle className="h-3 w-3" />
            Cancelled
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200 gap-1.5 font-bold">
            <HelpCircle className="h-3 w-3" />
            {status}
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            WhatsApp Orders
          </h2>
          <p className="text-muted-foreground text-sm">
            Track customer leads and manage orders received via WhatsApp perfectly.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search name or order..."
                    className="pl-9 bg-card"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            <Button 
              variant={viewMode === 'past' ? 'default' : 'outline'}
              onClick={() => setViewMode(prev => prev === 'recent' ? 'past' : 'recent')}
              className="gap-2 shrink-0"
            >
              <History className="h-4 w-4" />
              {viewMode === 'recent' ? 'Show Past Orders' : 'Show Recent (24h)'}
            </Button>
        </div>
      </div>

      {viewMode === 'past' && (
        <Card className="border-none shadow-sm bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Pending Verification">New Intent (Lead)</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="delivered">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">From Date</label>
                <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="Start Date" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">To Date</label>
                <DatePicker value={dateTo} onChange={setDateTo} placeholder="End Date" />
              </div>
              <div className="flex items-end">
                <Button 
                  variant="ghost" 
                  className="w-full text-xs h-10 hover:bg-destructive/10 hover:text-destructive gap-2"
                  onClick={() => {
                    setDateFrom('')
                    setDateTo('')
                    setStatusFilter('all')
                    setSearchQuery('')
                  }}
                >
                  <FilterX className="h-4 w-4" />
                  Clear All Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-none shadow-sm bg-card/50 backdrop-blur-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[120px] font-bold">Order #</TableHead>
                  <TableHead className="font-bold">Customer</TableHead>
                  <TableHead className="font-bold">Total</TableHead>
                  <TableHead className="font-bold text-center">Table</TableHead>
                  <TableHead className="font-bold">Status</TableHead>
                  <TableHead className="font-bold">Received At</TableHead>
                  <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                       <div className="flex flex-col items-center gap-2">
                          <Clock className="h-6 w-6 animate-spin opacity-20" />
                          <span>Fetching your WhatsApp leads...</span>
                       </div>
                    </TableCell>
                  </TableRow>
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-64 text-center">
                       <div className="flex flex-col items-center justify-center gap-4 py-8">
                          <div className="bg-primary/10 p-4 rounded-full">
                            <ShoppingBag className="h-8 w-8 text-primary" />
                          </div>
                          <div className="max-w-[280px] space-y-1">
                            <h3 className="font-semibold text-lg text-foreground">No orders found</h3>
                            <p className="text-sm text-muted-foreground">
                              {viewMode === 'recent' 
                                ? "No WhatsApp orders received in the last 24 hours." 
                                : "No WhatsApp orders found matching these filters."}
                            </p>
                          </div>
                       </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {orders.map((order) => (
                      <TableRow key={order.name} className="hover:bg-muted/30 transition-colors group text-sm">
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                             <span className="text-primary font-bold">#{order.order_number}</span>
                             <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{order.name.slice(-4)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col relative group/phone">
                            <div className="flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-semibold text-foreground">{order.customer_name}</span>
                              {order.is_unlocked && (
                                <ShieldCheck className="h-3 w-3 text-emerald-500" />
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2 mt-0.5 min-h-[1.25rem]">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <div className="relative">
                                <span className={cn(
                                  "font-mono text-xs transition-all duration-700",
                                  !order.is_unlocked && "blur-[4.5px] select-none opacity-40 brightness-50"
                                )}>
                                  {order.is_unlocked 
                                    ? order.customer_phone 
                                    : `${order.customer_phone.slice(0, 2)}****${order.customer_phone.slice(-4)}`}
                                </span>
                                
                                {!order.is_unlocked && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleUnlockLead(order.customer_phone, order.name)
                                    }}
                                    className="absolute -top-1 -right-4 flex items-center gap-1 bg-primary/95 text-[9px] text-primary-foreground px-1.5 py-0.5 rounded shadow-sm hover:bg-primary transition-all scale-90 hover:scale-100 font-bold border border-white/10"
                                  >
                                    <Lock className="h-2 w-2" />
                                    1 Coin
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-foreground">
                          {formatAmountNoDecimals(order.total)}
                        </TableCell>
                        <TableCell className="text-center">
                          {order.table_number ? (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                              Table {order.table_number}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Dine-in</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(order.status)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-xs text-muted-foreground">
                             <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(order.creation).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                             </div>
                             <div className="flex items-center gap-1 mt-0.5">
                                <Clock className="h-3 w-3" />
                                {new Date(order.creation).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                             </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-2">
                             <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                onClick={() => {
                                  setSelectedOrderId(order.name)
                                  setIsDialogOpen(true)
                                }}
                                title="View Order Details"
                             >
                                <Eye className="h-4 w-4" />
                             </Button>
                             
                             <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  "h-8 w-8 text-muted-foreground transition-colors",
                                  order.status === 'delivered' ? "text-emerald-500 bg-emerald-50" : "hover:text-emerald-600 hover:bg-emerald-50"
                                )}
                                onClick={() => handleCompleteOrder(order.name)}
                                disabled={order.status === 'delivered'}
                                title="Mark as Completed"
                             >
                                <CheckCircle2 className="h-4 w-4" />
                             </Button>
  
                             <Button
                                variant="default"
                                size="sm"
                                className={cn(
                                  "h-8 text-white font-bold ml-2 shadow-sm transition-all duration-300",
                                  order.is_unlocked 
                                    ? "bg-[#25D366] hover:bg-[#128C7E]" 
                                    : "bg-slate-400 cursor-not-allowed opacity-50 grayscale"
                                )}
                                onClick={() => {
                                  if (order.is_unlocked) {
                                    handleOpenWhatsApp(order.customer_phone, order.order_number!)
                                  } else {
                                    handleUnlockLead(order.customer_phone, order.name)
                                  }
                                }}
                             >
                                {order.is_unlocked ? (
                                  <>
                                    <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                                    Open Chat
                                    <ExternalLink className="h-3 w-3 ml-1 opacity-50" />
                                  </>
                                ) : (
                                  <>
                                    <Lock className="h-3 w-3 mr-1.5" />
                                    Unlock
                                  </>
                                )}
                             </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {hasMore && (
                        <TableRow>
                            <TableCell colSpan={7} className="p-4 text-center">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => fetchOrders(true)}
                                    disabled={loading}
                                >
                                    {loading ? "Loading..." : "Load More Orders"}
                                </Button>
                            </TableCell>
                        </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
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
