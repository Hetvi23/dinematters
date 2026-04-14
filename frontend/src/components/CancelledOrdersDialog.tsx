import { useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useCurrency } from '@/hooks/useCurrency'
import { format } from 'date-fns'
import { XCircle, Clock, UtensilsCrossed } from 'lucide-react'

interface CancelledOrdersDialogProps {
  isOpen: boolean
  onClose: () => void
  orders: any[]
}

export function CancelledOrdersDialog({ isOpen, onClose, orders }: CancelledOrdersDialogProps) {
  const { formatAmountNoDecimals } = useCurrency()

  const cancelledOrders = useMemo(() => {
    return orders.filter(o => o.status?.toLowerCase() === 'cancelled')
  }, [orders])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-2 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">Cancelled Orders</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground font-medium">Review recently cancelled orders for today</DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 font-bold px-3 py-1">
              {cancelledOrders.length} Orders
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-6 pt-2">
          {cancelledOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-4 bg-muted/30 rounded-full mb-4">
                <XCircle className="w-10 h-10 text-muted-foreground/40" />
              </div>
              <h3 className="text-lg font-medium">No cancelled orders</h3>
              <p className="text-sm text-muted-foreground">Today's cancelled orders will appear here.</p>
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="font-bold uppercase text-[10px]">Order ID</TableHead>
                    <TableHead className="font-bold uppercase text-[10px]">Time</TableHead>
                    <TableHead className="font-bold uppercase text-[10px]">Customer</TableHead>
                    <TableHead className="font-bold uppercase text-[10px]">Table</TableHead>
                    <TableHead className="font-bold uppercase text-[10px]">Items</TableHead>
                    <TableHead className="text-right font-bold uppercase text-[10px]">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cancelledOrders.map((order) => (
                    <TableRow key={order.name} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-black text-xs text-foreground py-4">
                        {order.order_number || order.name}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-xs font-bold uppercase">
                            {format(new Date(order.creation), 'hh:mm a')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-foreground">
                            {order.customer_name || 'Walk-in Guest'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {order.customer_phone || '-'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.order_type === 'dine_in' ? (
                          <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 font-black text-[10px] px-1.5">
                            T-{order.table_number || '?'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 font-black text-[10px] px-1.5 uppercase">
                            {order.order_type || 'Takeaway'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <UtensilsCrossed className="w-3.5 h-3.5" />
                          <span className="text-xs font-bold">{order.order_items?.length || 0} items</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-black text-sm text-foreground">
                        {formatAmountNoDecimals(order.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
