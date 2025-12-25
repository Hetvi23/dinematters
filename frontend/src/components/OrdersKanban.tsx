import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Eye, GripVertical, Clock, UtensilsCrossed, X, User, Phone, CreditCard, Tag } from 'lucide-react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, DragMoveEvent, closestCorners, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useFrappePostCall } from '@/lib/frappe'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

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
}

const STATUSES = [
  { value: 'pending', label: 'Pending', color: 'bg-[#fff4ce] text-[#ca5010] border-[#ffe69d]' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-orange-50 text-[#ea580c] border-orange-200' },
  { value: 'preparing', label: 'Preparing', color: 'bg-[#e8d5ff] text-[#8764b8] border-[#d4b9e8]' },
  { value: 'delivered', label: 'Delivered', color: 'bg-[#dff6dd] text-[#107c10] border-[#92c5f7]' },
]

// Draggable Order Card Component
function DraggableOrderCard({ 
  order, 
  onCheckOrder, 
  onCancelOrder 
}: { 
  order: Order
  onCheckOrder: (orderId: string) => void
  onCancelOrder?: (orderId: string) => void
}) {
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
        "cursor-grab active:cursor-grabbing hover:shadow-md transition-all duration-200 bg-white border border-[#edebe9] py-0",
        isDragging && "opacity-50 scale-95 shadow-xl"
      )}
    >
      <CardContent className="px-3 py-3">
        {/* Header: Order ID and Table */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-xs font-semibold text-[#323130] uppercase truncate">
              {order.order_number || order.name}
            </span>
          </div>
          {order.table_number != null && (
            <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-[#e8d5ff] text-[#8764b8] border border-[#d4b9e8] flex-shrink-0">
              Table {order.table_number}
            </span>
          )}
        </div>
        
        {/* Customer Info - Single Row */}
        {(order.customer_name || order.customer_phone) && (
          <div className="flex items-center gap-2 mb-2.5 text-xs text-[#605e5c]">
            {order.customer_name && (
              <div className="flex items-center gap-1 min-w-0 flex-1">
                <User className="h-3 w-3 text-[#a19f9d] flex-shrink-0" />
                <span className="truncate">{order.customer_name}</span>
              </div>
            )}
            {order.customer_phone && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <Phone className="h-3 w-3 text-[#a19f9d]" />
                <span className="truncate">{order.customer_phone}</span>
              </div>
            )}
          </div>
        )}
        
        {/* Order Total - TO PAY */}
        <div className="mb-2.5 pb-2.5 border-b border-[#edebe9]">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-[#605e5c] font-medium">TO PAY</span>
            <span className="text-base font-bold text-[#323130]">
              ₹{order.total?.toFixed(0) || 0}
            </span>
          </div>
        </div>
        
        {/* Payment & Coupon Info */}
        <div className="space-y-1 mb-2.5">
          {order.payment_method && (
            <div className="flex items-center gap-1.5 text-xs text-[#605e5c]">
              <CreditCard className="h-3 w-3 text-[#a19f9d] flex-shrink-0" />
              <span className="capitalize truncate">{order.payment_method.replace('_', ' ')}</span>
              {order.payment_status && (
                <span className={cn(
                  "ml-1 px-1 py-0.5 rounded text-[10px] font-medium",
                  order.payment_status === 'completed' 
                    ? "bg-[#dff6dd] text-[#107c10]"
                    : order.payment_status === 'failed'
                    ? "bg-[#fde7e9] text-[#d13438]"
                    : "bg-[#fff4ce] text-[#ca5010]"
                )}>
                  {order.payment_status}
                </span>
              )}
            </div>
          )}
          {order.coupon && (
            <div className="flex items-center gap-1.5 text-xs text-[#605e5c]">
              <Tag className="h-3 w-3 text-[#a19f9d] flex-shrink-0" />
              <span className="truncate">{order.coupon}</span>
            </div>
          )}
        </div>
        
        {/* Timestamp */}
        <div className="flex items-center gap-1.5 text-xs text-[#605e5c] mb-2.5">
          <Clock className="h-3 w-3 text-[#a19f9d] flex-shrink-0" />
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
        <div className="flex items-center gap-2 pt-2 border-t border-[#edebe9]">
          {showCancelButton && onCancelOrder && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                if (confirm('Are you sure you want to cancel this order?')) {
                  onCancelOrder(order.name)
                }
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="h-7 px-2 text-xs text-[#d13438] hover:text-[#a4262c] hover:bg-[#fde7e9] border-[#f4c2c4] flex-1"
            >
              Cancel
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onCheckOrder(order.name)
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="h-7 px-2 text-xs text-[#323130] hover:text-[#201f1e] hover:bg-[#f3f2f1] flex-1"
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
  onCancelOrder 
}: { 
  status: typeof STATUSES[0]
  orders: Order[]
  onCheckOrder: (orderId: string) => void
  onCancelOrder?: (orderId: string) => void
}) {
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
          "space-y-1.5 rounded-md px-2 py-1 bg-[#faf9f8] flex-1 overflow-y-auto transition-all duration-200 border",
          isOver 
            ? 'bg-orange-50 border-2 border-[#ea580c] border-dashed shadow-inner' 
            : 'border-[#edebe9] hover:border-[#c8c6c4]'
        )}
        style={{ maxHeight: 'calc(100vh - 320px)', minHeight: '300px' }}
      >
        {orders.length === 0 ? (
          <div className="text-center text-[#605e5c] text-sm py-8">
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
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function OrdersKanban({ orders, onCheckOrder, onOrderUpdate, onCancelOrder }: OrdersKanbanProps) {
  const { call } = useFrappePostCall('dinematters.dinematters.api.order_status.update_status')
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  
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
    const order = event.active.data.current?.order
    if (order) {
      setActiveOrder(order)
      setActiveId(event.active.id as string)
    }
  }

  const handleDragMove = (event: DragMoveEvent) => {
    // Optional: Add any visual feedback during drag movement
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveOrder(null)
    setActiveId(null)
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const orderId = active.id as string
    const newStatus = over.id as string

    try {
      // Use our custom API endpoint to update status
      await call({
        order_id: orderId,
        status: newStatus
      })
      
      // Show success message
      toast.success(`Order moved to ${STATUSES.find(s => s.value === newStatus)?.label}`)
      
      // Trigger refresh to update the UI
      if (onOrderUpdate) {
        onOrderUpdate()
      }
    } catch (error: any) {
      console.error('Failed to update order status:', error)
      toast.error(error?.message || 'Failed to update order status')
      
      // Still refresh to sync with actual database state
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
          <Card className="cursor-grabbing shadow-2xl bg-white border-2 border-[#ea580c] w-80 rotate-1 scale-105 transition-transform duration-200">
            <CardContent className="px-3 py-3">
              {/* Header: Order ID and Table */}
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="text-xs font-semibold text-[#323130] uppercase truncate">
                    {activeOrder.order_number || activeOrder.name}
                  </span>
                </div>
                  {activeOrder.table_number != null && (
                    <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-[#e8d5ff] text-[#8764b8] border border-[#d4b9e8] flex-shrink-0">
                      Table {activeOrder.table_number}
                    </span>
                  )}
              </div>
              
              {/* Customer Info - Single Row */}
              {(activeOrder.customer_name || activeOrder.customer_phone) && (
                <div className="flex items-center gap-2 mb-2.5 text-xs text-[#605e5c]">
                  {activeOrder.customer_name && (
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      <User className="h-3 w-3 text-[#a19f9d] flex-shrink-0" />
                      <span className="truncate">{activeOrder.customer_name}</span>
                    </div>
                  )}
                  {activeOrder.customer_phone && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Phone className="h-3 w-3 text-[#a19f9d]" />
                      <span className="truncate">{activeOrder.customer_phone}</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Order Total - TO PAY */}
              <div className="mb-2.5 pb-2.5 border-b border-[#edebe9]">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-[#605e5c] font-medium">TO PAY</span>
                  <span className="text-base font-bold text-[#323130]">
                    ₹{activeOrder.total?.toFixed(0) || 0}
                  </span>
                </div>
              </div>
              
              {/* Timestamp */}
              <div className="flex items-center gap-1.5 text-xs text-[#605e5c]">
                <Clock className="h-3 w-3 text-[#a19f9d] flex-shrink-0" />
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


