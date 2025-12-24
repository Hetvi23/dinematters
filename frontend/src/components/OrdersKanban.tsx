import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Eye, GripVertical, Clock, UtensilsCrossed, X } from 'lucide-react'
import { DndContext, DragEndEvent, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useFrappePostCall } from '@/lib/frappe'
import { toast } from 'sonner'

interface Order {
  name: string
  order_number?: string
  status: string
  total: number
  creation: string
  table_number?: number
  restaurant?: string
}

interface OrdersKanbanProps {
  orders: Order[]
  onCheckOrder: (orderId: string) => void
  onOrderUpdate?: () => void
  onCancelOrder?: (orderId: string) => void
}

const STATUSES = [
  { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { value: 'preparing', label: 'Preparing', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { value: 'delivered', label: 'Delivered', color: 'bg-green-100 text-green-800 border-green-300' },
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
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 10000,
    position: 'relative' as const,
  } : undefined

  // Don't show cancel button for cancelled or delivered orders
  const showCancelButton = order.status !== 'cancelled' && order.status !== 'delivered'

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-grab active:cursor-grabbing hover:shadow-lg transition-all bg-white border border-gray-200 ${isDragging ? 'opacity-70 shadow-2xl z-[9999] scale-105' : ''}`}
    >
      <CardContent className="p-3">
        {/* Order ID */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-gray-500 uppercase">
            {order.order_number || order.name}
          </span>
          {order.table_number != null && (
            <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800">
              Table {order.table_number}
            </span>
          )}
        </div>
        
        {/* Order Title/Price */}
        <h4 className="font-semibold text-sm text-gray-900 mb-2">
          Order Total: ₹{order.total || 0}
        </h4>
        
        {/* Metadata Section */}
        <div className="space-y-1 mb-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <Clock className="h-3.5 w-3.5 text-gray-400" />
            <span>
              {order.creation ? new Date(order.creation).toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              }) : 'N/A'}
            </span>
          </div>
        </div>
        
        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-1.5 border-t border-gray-100">
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
              className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300"
            >
              Cancel Order
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
            className="h-7 px-2 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-50"
          >
            <Eye className="h-3.5 w-3.5 mr-1" />
            Check Order
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
    <div className="flex-shrink-0 w-80 flex flex-col">
      <div className={`rounded-md px-3 py-2 ${status.color} mb-3 inline-flex items-center justify-center`}>
        <h3 className="font-semibold text-xs uppercase tracking-wide">
          {status.label} ({orders.length})
        </h3>
      </div>
      
      <div
        ref={setNodeRef}
        className={`space-y-1 rounded-lg p-2 bg-stone-50 flex-1 overflow-y-auto transition-colors ${
          isOver ? 'bg-blue-50 border-2 border-blue-300 border-dashed' : 'border border-stone-200'
        }`}
        style={{ maxHeight: 'calc(100vh - 320px)', minHeight: '300px' }}
      >
        {orders.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            No orders
          </div>
        ) : (
          orders.map(order => (
            <DraggableOrderCard
              key={order.name}
              order={order}
              onCheckOrder={onCheckOrder}
              onCancelOrder={onCancelOrder}
            />
          ))
        )}
      </div>
    </div>
  )
}

export function OrdersKanban({ orders, onCheckOrder, onOrderUpdate, onCancelOrder }: OrdersKanbanProps) {
  const { call } = useFrappePostCall('dinematters.dinematters.api.order_status.update_status')
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
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

  const handleDragStart = (event: any) => {
    const order = event.active.data.current?.order
    if (order) {
      setActiveOrder(order)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveOrder(null)
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
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-6 overflow-x-auto pb-4" style={{ height: 'calc(100vh - 280px)' }}>
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
      
      <DragOverlay>
        {activeOrder ? (
          <Card className="cursor-grabbing shadow-2xl bg-white border border-gray-200 w-80 rotate-3">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-gray-500 uppercase">
                  {activeOrder.order_number || activeOrder.name}
                </span>
                {activeOrder.table_number != null && (
                  <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800">
                    Table {activeOrder.table_number}
                  </span>
                )}
              </div>
              
              <h4 className="font-semibold text-sm text-gray-900 mb-2">
                Order Total: ₹{activeOrder.total || 0}
              </h4>
              
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <Clock className="h-3.5 w-3.5 text-gray-400" />
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


