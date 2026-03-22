import { useState, useEffect } from 'react'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { useFrappePostCall } from '@/lib/frappe'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Users, Search, PlusCircle, MinusCircle, User } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from '@/components/ui/label'

export default function CustomerInsights() {
  const { selectedRestaurant } = useRestaurant()
  const [loading, setLoading] = useState(false)
  const [customers, setCustomers] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustType, setAdjustType] = useState<'Earn' | 'Redeem'>('Earn')
  const [adjusting, setAdjusting] = useState(false)

  const { call: getInsights } = useFrappePostCall('dinematters.dinematters.api.loyalty.get_customer_insights')
  const { call: adjustPoints } = useFrappePostCall('dinematters.dinematters.api.loyalty.adjust_customer_points')

  const fetchInsights = async () => {
    if (!selectedRestaurant) return
    setLoading(true)
    try {
      const res: any = await getInsights({ 
        restaurant_id: selectedRestaurant,
        search_query: searchQuery 
      })
      if (res.message?.success) {
        setCustomers(res.message.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch insights:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInsights()
  }, [selectedRestaurant, searchQuery])

  const handleAdjustPoints = async () => {
    if (!selectedRestaurant || !selectedCustomer || !adjustAmount) return
    
    setAdjusting(true)
    try {
      const res: any = await adjustPoints({
        restaurant_id: selectedRestaurant,
        customer_id: selectedCustomer.id,
        coins: Math.abs(parseInt(adjustAmount)),
        reason: adjustReason || 'Manual Adjustment',
        transaction_type: adjustType
      })

      if (res.message?.success) {
        toast.success(res.message.message)
        setAdjustModalOpen(false)
        setAdjustAmount('')
        setAdjustReason('')
        fetchInsights()
      } else {
        toast.error(res.message?.error || 'Failed to adjust points')
      }
    } catch (error) {
      toast.error('Failed to adjust points')
    } finally {
      setAdjusting(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Customer Insights</h1>
          </div>
          <p className="text-muted-foreground mt-2">
            View customer points, history, and manually reward your loyal customers.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-muted-foreground" />
              Customer Loyalty List
            </CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search name or phone..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Points Balance</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading customers...</TableCell>
                  </TableRow>
                ) : customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No customers found with loyalty history.</TableCell>
                  </TableRow>
                ) : (
                  customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>{customer.phone || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={customer.balance > 0 ? "default" : "secondary"} className="gap-1">
                          {customer.balance} Coins
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {new Date(customer.last_active).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                           <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 gap-1"
                            onClick={() => {
                              setSelectedCustomer(customer)
                              setAdjustType('Earn')
                              setAdjustModalOpen(true)
                            }}
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            Give Points
                          </Button>
                           <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 gap-1 text-destructive hover:text-destructive"
                            onClick={() => {
                              setSelectedCustomer(customer)
                              setAdjustType('Redeem')
                              setAdjustModalOpen(true)
                            }}
                          >
                            <MinusCircle className="w-3.5 h-3.5" />
                            Deduct
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Adjustment Modal */}
      <Dialog open={adjustModalOpen} onOpenChange={setAdjustModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{adjustType === 'Earn' ? 'Give Points' : 'Deduct Points'}</DialogTitle>
            <DialogDescription>
              {adjustType === 'Earn' 
                ? `Reward points to ${selectedCustomer?.name}.`
                : `Manually deduct points from ${selectedCustomer?.name}.`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Number of Coins</Label>
              <Input
                id="amount"
                type="number"
                placeholder="e.g. 50"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Input
                id="reason"
                placeholder="e.g. Compensation for delay"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleAdjustPoints} 
              disabled={adjusting || !adjustAmount}
              variant={adjustType === 'Redeem' ? 'destructive' : 'default'}
            >
              {adjusting ? 'Processing...' : (adjustType === 'Earn' ? 'Add Points' : 'Deduct Points')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
