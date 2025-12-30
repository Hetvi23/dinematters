import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Eye, Clock, User, Phone, CreditCard, Tag } from 'lucide-react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, DragMoveEvent, closestCorners, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useFrappePostCall } from '@/lib/frappe'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/hooks/useConfirm'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Order {
  name: string
  order_number?: string
  status: string
  total: number
  creation: string
  table_number?: number
  restaurant?: string
  customer_name?: string
  customer_phone?: string
  payment_method?: string
  payment_status?: string
  coupon?: string
  subtotal?: number
  discount?: number
  tax?: number
  delivery_fee?: number
}

interface OrdersKanbanProps {
  orders: Order[]
  onCheckOrder: (orderId: string) => void
  onOrderUpdate?: () => void
  onCancelOrder?: (orderId: string) => void
  restaurantTables?: number
}

const STATUSES = [
  { value: 'pending', label: 'Pending', color: 'bg-[#fff4ce] dark:bg-[#ca5010]/20 text-[#ca5010] dark:text-[#ffaa44] border-[#ffe69d] dark:border-[#ca5010]/40' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-orange-50 dark:bg-[#ea580c]/20 text-[#ea580c] dark:text-[#ff8c42] border-orange-200 dark:border-[#ea580c]/40' },
  { value: 'preparing', label: 'Preparing', color: 'bg-[#e8d5ff] dark:bg-[#4a148c] text-[#8764b8] dark:text-[#ba68c8] border-[#d4b9e8] dark:border-[#6a1b9a]' },
  { value: 'delivered', label: 'Delivered', color: 'bg-[#dff6dd] dark:bg-[#1b5e20] text-[#107c10] dark:text-[#81c784] border-[#92c5f7] dark:border-[#4caf50]' },
]

// Draggable Order Card Component
function DraggableOrderCard({ 
  order, 
  onCheckOrder, 
  onCancelOrder,
  onTableNumberChange,
  tableOptions = []
}: { 
  order: Order
  onCheckOrder: (orderId: string) => void
  onCancelOrder?: (orderId: string) => void
  onTableNumberChange?: (orderId: string, tableNumber: number) => void
  tableOptions?: number[]
}) {
  const { confirm, ConfirmDialogComponent } = useConfirm()
  const safeTableOptions = Array.isArray(tableOptions) ? tableOptions : []
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: order.name,
    data: {
      order,
    },
  })

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? 'none' : 'transform 200ms ease',
  } : {
    transition: 'transform 200ms ease',
  }

  // Don't show cancel button for cancelled or delivered orders
  const showCancelButton = order.status !== 'cancelled' && order.status !== 'delivered'

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "cursor-grab active:cursor-grabbing hover:shadow-md transition-all duration-200 bg-card border border-border py-0",
        isDragging && "opacity-50 scale-95 shadow-xl"
      )}
    >
      <CardContent className="px-3 py-3">
        {/* Header: Order ID and Table */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-xs font-semibold text-foreground uppercase truncate">
              {order.order_number || order.name}
            </span>
          </div>
          {safeTableOptions.length > 0 && onTableNumberChange ? (
            <Select
              value={(order.table_number ?? 0).toString()}
              onValueChange={(value) => {
                const parsed = parseInt(value, 10)
                const tableNum = Number.isNaN(parsed) ? 0 : parsed
                onTableNumberChange(order.name, tableNum)
              }}
            >
              <SelectTrigger
                className="h-5 px-1.5 text-[10px] font-medium bg-[#e8d5ff] dark:bg-[#4a148c] text-[#8764b8] dark:text-[#ba68c8] border border-[#d4b9e8] dark:border-[#6a1b9a] flex-shrink-0 w-auto min-w-[60px]"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {safeTableOptions.map((tableNum) => (
                  <SelectItem key={tableNum} value={tableNum.toString()}>
                    Table {tableNum}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-[#e8d5ff] dark:bg-[#4a148c] text-[#8764b8] dark:text-[#ba68c8] border border-[#d4b9e8] dark:border-[#6a1b9a] flex-shrink-0">
              Table {order.table_number ?? 0}
            </span>
          )}
        </div>
        
        {/* Customer Info - Single Row */}
        {(order.customer_name || order.customer_phone) && (
          <div className="flex items-center gap-2 mb-2.5 text-xs text-muted-foreground">
            {order.customer_name && (
              <div className="flex items-center gap-1 min-w-0 flex-1">
                <User className="h-3 w-3 text-muted-foreground/70 flex-shrink-0" />
                <span className="truncate">{order.customer_name}</span>
              </div>
            )}
            {order.customer_phone && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <Phone className="h-3 w-3 text-muted-foreground/70" />
                <span className="truncate">{order.customer_phone}</span>
              </div>
            )}
          </div>
        )}
        
        {/* Order Total - TO PAY */}
        <div className="mb-2.5 pb-2.5 border-b border-border">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-muted-foreground font-medium">TO PAY</span>
            <span className="text-base font-bold text-foreground">
              ₹{order.total?.toFixed(0) || 0}
            </span>
          </div>
        </div>
        
        {/* Payment & Coupon Info */}
        <div className="space-y-1 mb-2.5">
          {order.payment_method && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CreditCard className="h-3 w-3 text-muted-foreground/70 flex-shrink-0" />
              <span className="capitalize truncate">{order.payment_method.replace('_', ' ')}</span>
              {order.payment_status && (
                <span className={cn(
                  "ml-1 px-1 py-0.5 rounded-md text-[10px] font-medium",
                  order.payment_status === 'completed' 
                    ? "bg-[#dff6dd] dark:bg-[#1b5e20] text-[#107c10] dark:text-[#81c784]"
                    : order.payment_status === 'failed'
                    ? "bg-[#fde7e9] dark:bg-[#b71c1c] text-[#d13438] dark:text-[#ef5350]"
                    : "bg-[#fff4ce] dark:bg-[#ca5010]/20 text-[#ca5010] dark:text-[#ffaa44]"
                )}>
                  {order.payment_status}
                </span>
              )}
            </div>
          )}
          {order.coupon && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Tag className="h-3 w-3 text-muted-foreground/70 flex-shrink-0" />
              <span className="truncate">{order.coupon}</span>
            </div>
          )}
        </div>
        
        {/* Timestamp */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2.5">
          <Clock className="h-3 w-3 text-muted-foreground/70 flex-shrink-0" />
          <span>
            {order.creation ? new Date(order.creation).toLocaleString('en-IN', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            }) : 'N/A'}
          </span>
        </div>
        
        {/* Footer Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          {showCancelButton && onCancelOrder && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={async (e) => {
                  e.stopPropagation()
                  const confirmed = await confirm({
                    title: 'Cancel Order',
                    description: 'Are you sure you want to cancel this order? This action cannot be undone.',
                    variant: 'destructive',
                    confirmText: 'Cancel Order',
                    cancelText: 'Keep Order'
                  })
                  if (confirmed) {
                    onCancelOrder(order.name)
                  }
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="h-7 px-2 text-xs text-destructive hover:text-destructive/80 hover:bg-destructive/10 border-destructive/20 flex-1"
              >
                Cancel
              </Button>
              {ConfirmDialogComponent}
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onCheckOrder(order.name)
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="h-7 px-2 text-xs text-foreground hover:text-foreground hover:bg-accent flex-1"
          >
            <Eye className="h-3.5 w-3.5 mr-1" />
            View
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Droppable Status Column Component
function DroppableStatusColumn({ 
  status, 
  orders, 
  onCheckOrder,
  onCancelOrder,
  activeId,
  handleTableNumberChange,
  tableOptions = []
}: { 
  status: typeof STATUSES[0]
  orders: Order[]
  onCheckOrder: (orderId: string) => void
  onCancelOrder?: (orderId: string) => void
  activeId?: string | null
  handleTableNumberChange: (orderId: string, tableNumber: number) => void
  tableOptions?: number[]
}) {
  const safeTableOptions = Array.isArray(tableOptions) ? tableOptions : []
  const { setNodeRef, isOver } = useDroppable({
    id: status.value,
  })

  return (
    <div className="flex-shrink-0 flex-1 min-w-0 flex flex-col">
      <div className={`rounded-md px-3 py-2 ${status.color} mb-3 inline-flex items-center justify-center`}>
        <h3 className="font-semibold text-xs uppercase tracking-wide">
          {status.label} ({orders.length})
        </h3>
      </div>
      
      <div
        ref={setNodeRef}
        className={cn(
          "space-y-1.5 rounded-md px-2 py-1 bg-muted flex-1 overflow-y-auto transition-all duration-200 border",
          isOver 
            ? 'bg-primary/10 dark:bg-primary/20 border-2 border-primary border-dashed shadow-inner' 
            : 'border-border hover:border-border/80'
        )}
        style={{ maxHeight: 'calc(100vh - 320px)', minHeight: '300px' }}
      >
        {orders.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            No orders
          </div>
        ) : (
          orders.map(order => (
            <div
              key={order.name}
              className={cn(
                "transition-all duration-200",
                activeId === order.name && "opacity-0"
              )}
            >
              <DraggableOrderCard
                order={order}
                onCheckOrder={onCheckOrder}
                onCancelOrder={onCancelOrder}
                onTableNumberChange={handleTableNumberChange}
                tableOptions={safeTableOptions}
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function OrdersKanban({ orders, onCheckOrder, onOrderUpdate, onCancelOrder, restaurantTables }: OrdersKanbanProps) {
  const { call } = useFrappePostCall('dinematters.dinematters.api.order_status.update_status')
  const { call: updateTableNumber } = useFrappePostCall('dinematters.dinematters.api.order_status.update_table_number')
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  
  // Generate table options based on restaurant tables count (always include Table 0)
  const tableOptions = useMemo(() => {
    const maxTables = Number(restaurantTables ?? 0)
    const options: number[] = [0]
    if (maxTables > 0) {
      for (let i = 1; i <= maxTables; i++) {
        options.push(i)
      }
    }
    return options
  }, [restaurantTables])
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  )

  const ordersByStatus = useMemo(() => {
    const grouped: Record<string, Order[]> = {}
    STATUSES.forEach(status => {
      grouped[status.value] = []
    })
    orders.forEach(order => {
      const status = order.status || 'pending'
      if (!grouped[status]) {
        grouped[status] = []
      }
      grouped[status].push(order)
    })
    return grouped
  }, [orders])

  const handleDragStart = (event: DragStartEvent) => {
    const order = event.active.data.current?.order as Order | undefined
    if (order) {
      setActiveOrder(order)
      setActiveId(event.active.id as string)
    }
  }

  const handleDragMove = (_event: DragMoveEvent) => {
    // optional: add visual feedback
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    setActiveOrder(null)
    setActiveId(null)

    if (!over || active.id === over.id) {
      return
    }

    const orderId = active.id as string
    const newStatus = over.id as string

    try {
      await call({
        order_id: orderId,
        status: newStatus,
      })

      toast.success(`Order moved to ${STATUSES.find(s => s.value === newStatus)?.label || newStatus}`)
    } catch (error: any) {
      console.error('Failed to update order status:', error)
      toast.error(error?.message || 'Failed to update order status')
    } finally {
      if (onOrderUpdate) {
        onOrderUpdate()
      }
    }
  }

  const handleCancelOrder = async (orderId: string) => {
    try {
      await call({
        order_id: orderId,
        status: 'cancelled'
      })
      
      toast.success('Order cancelled successfully')
      
      if (onOrderUpdate) {
        onOrderUpdate()
      }
    } catch (error: any) {
      console.error('Failed to cancel order:', error)
      toast.error(error?.message || 'Failed to cancel order')
      
      if (onOrderUpdate) {
        onOrderUpdate()
      }
    }
  }

  const handleTableNumberChange = async (orderId: string, tableNumber: number) => {
    try {
      await updateTableNumber({
        order_id: orderId,
        table_number: tableNumber
      })
      
      toast.success(`Table updated to Table ${tableNumber}`)
      
      if (onOrderUpdate) {
        onOrderUpdate()
      }
    } catch (error: any) {
      console.error('Failed to update table number:', error)
      toast.error(error?.message || 'Failed to update table number')
      
      if (onOrderUpdate) {
        onOrderUpdate()
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-hidden pb-4" style={{ height: 'calc(100vh - 280px)' }}>
        {STATUSES.map((status) => {
          const statusOrders = ordersByStatus[status.value] || []
          
          return (
            <DroppableStatusColumn
              key={status.value}
              status={status}
              orders={statusOrders}
              onCheckOrder={onCheckOrder}
              onCancelOrder={onCancelOrder || handleCancelOrder}
              activeId={activeId}
              handleTableNumberChange={handleTableNumberChange}
              tableOptions={tableOptions}
            />
          )
        })}
      </div>
      
      <DragOverlay
        dropAnimation={{
          duration: 300,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1)',
        }}
        style={{
          opacity: 0.95,
        }}
      >
        {activeOrder ? (
          <Card className="cursor-grabbing shadow-2xl bg-card border-2 border-primary w-80 rotate-1 scale-105 transition-transform duration-200">
            <CardContent className="px-3 py-3">
              {/* Header: Order ID and Table */}
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="text-xs font-semibold text-foreground uppercase truncate">
                    {activeOrder.order_number || activeOrder.name}
                  </span>
                </div>
                  {activeOrder.table_number != null ? (
                    <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-[#e8d5ff] dark:bg-[#4a148c] text-[#8764b8] dark:text-[#ba68c8] border border-[#d4b9e8] dark:border-[#6a1b9a] flex-shrink-0">
                      Table {activeOrder.table_number}
                    </span>
                  ) : null}
              </div>
              
              {/* Customer Info - Single Row */}
              {(activeOrder.customer_name || activeOrder.customer_phone) && (
                <div className="flex items-center gap-2 mb-2.5 text-xs text-muted-foreground">
                  {activeOrder.customer_name && (
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      <User className="h-3 w-3 text-muted-foreground/70 flex-shrink-0" />
                      <span className="truncate">{activeOrder.customer_name}</span>
                    </div>
                  )}
                  {activeOrder.customer_phone && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Phone className="h-3 w-3 text-muted-foreground/70" />
                      <span className="truncate">{activeOrder.customer_phone}</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Order Total - TO PAY */}
              <div className="mb-2.5 pb-2.5 border-b border-border">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-muted-foreground font-medium">TO PAY</span>
                  <span className="text-base font-bold text-foreground">
                    ₹{activeOrder.total?.toFixed(0) || 0}
                  </span>
                </div>
              </div>
              
              {/* Timestamp */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3 text-muted-foreground/70 flex-shrink-0" />
                <span>
                  {activeOrder.creation ? new Date(activeOrder.creation).toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'N/A'}
                </span>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}


