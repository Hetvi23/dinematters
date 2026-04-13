import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Truck, Navigation, IndianRupee, Clock, Activity } from 'lucide-react'
import { useCurrency } from '@/hooks/useCurrency'
import { Progress } from '@/components/ui/progress'

interface Order {
  name: string
  status: string
  order_type: string
  delivery_partner?: string
  delivery_status?: string
  total: number
  delivery_fee?: number
}

interface LogisticsHubCardProps {
  orders: Order[]
  isLoading?: boolean
}

export function LogisticsHubCard({ orders, isLoading }: LogisticsHubCardProps) {
  const { formatAmountNoDecimals } = useCurrency()

  const activeDeliveries = orders.filter(o => 
    o.order_type === 'delivery' && 
    ['borzo', 'flash'].includes(o.delivery_partner || '') && 
    !['delivered', 'cancelled', 'cancelled_by_manager', 'cancelled_by_client'].includes(o.delivery_status?.toLowerCase() || '')
  )

  const todayDeliveryRevenue = orders
    .filter(o => o.order_type === 'delivery' && ['borzo', 'flash'].includes(o.delivery_partner || ''))
    .reduce((sum, o) => sum + (o.delivery_fee || 0), 0)

  const latestActive = activeDeliveries[0]

  if (isLoading) {
    return (
      <Card className="animate-pulse bg-muted/20 border-none h-[180px]" />
    )
  }

  return (
    <Card className="relative overflow-hidden border-none bg-gradient-to-br from-zinc-900 to-black text-white shadow-2xl group">
      <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
        <Truck className="h-24 w-24" />
      </div>
      
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
          <Activity className="h-3 w-3 text-amber-500" />
          Logistics Hub
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-3xl font-black tracking-tighter">
              {activeDeliveries.length}
            </p>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight">Active Deliveries</p>
          </div>
          
          <div className="space-y-1 text-right">
            <p className="text-xl font-black tracking-tight text-amber-400 flex items-center justify-end gap-1">
              <IndianRupee className="h-4 w-4" />
              {formatAmountNoDecimals(todayDeliveryRevenue)}
            </p>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight">Logistic Cost (Today)</p>
          </div>
        </div>

        {latestActive ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 backdrop-blur-md">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Navigation className="h-3 w-3 text-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-wider">{latestActive.name}</span>
              </div>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {latestActive.delivery_status || 'Assigned'}
              </span>
            </div>
            <Progress value={45} className="h-1 bg-white/10" />
          </div>
        ) : (
          <div className="flex items-center gap-2 text-zinc-500 italic text-[11px] py-2">
            <Clock className="h-3 w-3" />
            No active courier movements
          </div>
        )}
      </CardContent>
    </Card>
  )
}
