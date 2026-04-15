import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFrappeAuth, useFrappePostCall } from '@/lib/frappe'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Shield, 
  Crown, 
  RefreshCw, 
  Power, 
  PowerOff, 
  Trash2, 
  TrendingUp, 
  Activity, 
  Coins, 
  Settings, 
  Zap, 
  Search,
  ArrowUpRight,
  Building2,
  Calendar,
  Mail
} from 'lucide-react'
import { useDataTable } from '@/hooks/useDataTable'
import { DataPagination } from '@/components/ui/DataPagination'

interface Restaurant {
  name: string
  restaurant_id: string
  restaurant_name: string
  owner_email?: string
  is_active: number
  plan_type: 'SILVER' | 'GOLD' | 'DIAMOND'
  coins_balance: number
  platform_fee_percent: number
  monthly_minimum: number
  creation: string
  modified: string
}

export default function AdminRestaurantManagement() {
  const navigate = useNavigate()
  const { currentUser } = useFrappeAuth()
  const [updating, setUpdating] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  
  // Modals state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [restaurantToDelete, setRestaurantToDelete] = useState<{ id: string, name: string } | null>(null)
  const [verificationInput, setVerificationInput] = useState('')

  const [isCoinModalOpen, setIsCoinModalOpen] = useState(false)
  const [coinAmount, setCoinAmount] = useState('')
  const [coinReason, setCoinReason] = useState('Admin Grant')
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [editPlatformFee, setEditPlatformFee] = useState('')
  const [editMonthlyMinimum, setEditMonthlyMinimum] = useState('')
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')

  useEffect(() => {
    if (currentUser === 'Administrator') {
      setIsAdmin(true)
    } else {
      setIsAdmin(false)
    }
  }, [currentUser])

  const {
    data: restaurants,
    isLoading,
    mutate: loadRestaurants,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalCount,
    searchQuery,
    setSearchQuery
  } = useDataTable({
    customEndpoint: 'dinematters.dinematters.api.admin.get_all_restaurants',
    paramNames: {
      page: 'page',
      pageSize: 'page_size',
      search: 'search'
    },
    initialPageSize: 20,
    debugId: 'admin-restaurants'
  })

  // APIs
  const { call: updateRestaurantPlan } = useFrappePostCall<{ success: boolean, error?: string }>(
    'dinematters.dinematters.api.admin.update_restaurant_plan'
  )
  const { call: toggleRestaurantStatus } = useFrappePostCall<{ success: boolean, error?: string }>(
    'dinematters.dinematters.api.admin.toggle_restaurant_status'
  )
  const { call: deleteRestaurant } = useFrappePostCall<{ success: boolean, message?: string, error?: string }>(
    'dinematters.dinematters.api.admin.delete_restaurant'
  )
  const { call: giveCoins } = useFrappePostCall<{ success: boolean, message?: string, error?: string }>(
    'dinematters.dinematters.api.admin.admin_give_coins'
  )
  const { call: updateSettings } = useFrappePostCall<{ success: boolean, message?: string, error?: string }>(
    'dinematters.dinematters.api.admin.admin_update_restaurant_settings'
  )

  const handlePlanChange = async (restaurantName: string, newPlan: 'SILVER' | 'GOLD' | 'DIAMOND') => {
    try {
      setUpdating(restaurantName)
      const result = await updateRestaurantPlan({ restaurant_id: restaurantName, plan_type: newPlan }) as any
      if (result?.message?.success) {
        toast.success(`Plan upgraded to ${newPlan}`)
        loadRestaurants()
      }
    } catch (error) {
      toast.error('Strategic update failed')
    } finally {
      setUpdating(null)
    }
  }

  const handleStatusToggle = async (restaurantName: string, currentStatus: number) => {
    try {
      setUpdating(restaurantName)
      const newStatus = currentStatus ? 0 : 1
      const result = await toggleRestaurantStatus({ restaurant_id: restaurantName, is_active: newStatus }) as any
      if (result?.message?.success) {
        toast.success(`Restaurant ${newStatus ? 'activated' : 'deactivated'}`)
        loadRestaurants()
      }
    } catch (error) {
      toast.error('Status synchronization failed')
    } finally {
      setUpdating(null)
    }
  }

  const handleGiveCoins = async () => {
    if (!selectedRestaurant || !coinAmount) return
    try {
      setUpdating(selectedRestaurant.name)
      const result = await giveCoins({
        restaurant_id: selectedRestaurant.restaurant_id,
        amount: coinAmount,
        reason: coinReason
      }) as any
      if (result?.message?.success) {
        toast.success(`Granted ${coinAmount} coins to treasury`)
        setIsCoinModalOpen(false)
        loadRestaurants()
      }
    } catch (error) {
      toast.error('Treasury grant failed')
    } finally {
      setUpdating(null)
    }
  }

  const handleUpdateSettings = async () => {
    if (!selectedRestaurant) return
    try {
      setUpdating(selectedRestaurant.name)
      const result = await updateSettings({
        restaurant_id: selectedRestaurant.restaurant_id,
        updates: {
          platform_fee_percent: editPlatformFee,
          monthly_minimum: editMonthlyMinimum,
          restaurant_name: editName,
          owner_email: editEmail
        }
      }) as any
      if (result?.message?.success) {
        toast.success('Core settings updated')
        setIsSettingsModalOpen(false)
        loadRestaurants()
      }
    } catch (error) {
      toast.error('Settings update failed')
    } finally {
      setUpdating(null)
    }
  }

  const handleConfirmDelete = async () => {
    if (!restaurantToDelete || verificationInput !== restaurantToDelete.id) return
    try {
      setUpdating(restaurantToDelete.id)
      const result = await deleteRestaurant({ restaurant_id: restaurantToDelete.id }) as any
      if (result?.message?.success) {
        toast.success(`Restaurant purged from system`)
        setIsDeleteDialogOpen(false)
        loadRestaurants()
      }
    } catch (error) {
      toast.error('System purge failed')
    } finally {
      setUpdating(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-none shadow-2xl rounded-3xl overflow-hidden">
          <div className="bg-red-600 h-2" />
          <CardContent className="p-10 text-center">
            <div className="mx-auto w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mb-8">
              <Shield className="h-10 w-10 text-red-600" />
            </div>
            <h2 className="text-3xl font-black tracking-tight mb-4">RESTRICTED ZONE</h2>
            <p className="text-muted-foreground leading-relaxed font-medium">
              You lack the administrative clearance required to access the central restaurant control hub.
            </p>
            <Button onClick={() => navigate('/')} className="mt-8 rounded-xl px-10 h-12 font-bold uppercase tracking-widest text-xs">
               Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Restaurant Management</h2>
          <p className="text-muted-foreground text-sm">
            Manage all restaurants in the ecosystem
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search restaurants..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              <Button 
                variant="outline" 
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => loadRestaurants()}
              >
                 <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
            </div>
            <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(parseInt(v))}>
              <SelectTrigger className="h-9 w-[120px]">
                <SelectValue placeholder="Page Size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20 Rows</SelectItem>
                <SelectItem value="50">50 Rows</SelectItem>
                <SelectItem value="100">100 Rows</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && !restaurants.length ? (
            <div className="py-20 flex justify-center">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : !restaurants || restaurants.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground">No restaurants found</div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Restaurant</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead className="text-right">Coins</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {restaurants.map((restaurant: any) => (
                      <TableRow key={restaurant.name}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold">{restaurant.restaurant_name}</span>
                            <span className="text-xs text-muted-foreground">{restaurant.owner_email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-[10px] bg-muted px-1 rounded">{restaurant.restaurant_id}</code>
                        </TableCell>
                        <TableCell>
                          {restaurant.is_active ? (
                            <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">Online</Badge>
                          ) : (
                            <Badge variant="secondary">Offline</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                           <Badge variant={restaurant.plan_type === 'DIAMOND' ? 'default' : 'outline'}>
                              {restaurant.plan_type}
                           </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {restaurant.coins_balance.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                             <Button
                                variant="ghost" size="icon" className="h-8 w-8 text-amber-600"
                                onClick={() => {
                                  setSelectedRestaurant(restaurant)
                                  setCoinAmount('')
                                  setIsCoinModalOpen(true)
                                }}
                              >
                                <Coins className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost" size="icon" className="h-8 w-8"
                                onClick={() => navigate(`/admin/restaurants/${restaurant.restaurant_id}`)}
                              >
                                <ArrowUpRight className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost" size="icon"
                                onClick={() => handleStatusToggle(restaurant.name, restaurant.is_active)}
                                disabled={updating === restaurant.name}
                                className={cn("h-8 w-8", restaurant.is_active ? "text-red-500" : "text-green-500")}
                              >
                                {restaurant.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                              </Button>
                              <DropdownMenu>
                                 <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                       <Settings className="h-4 w-4" />
                                    </Button>
                                 </DropdownMenuTrigger>
                                 <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => {
                                       setSelectedRestaurant(restaurant)
                                       setEditName(restaurant.restaurant_name)
                                       setEditEmail(restaurant.owner_email || '')
                                       setEditPlatformFee(restaurant.platform_fee_percent.toString())
                                       setEditMonthlyMinimum(restaurant.monthly_minimum.toString())
                                       setIsSettingsModalOpen(true)
                                    }}>
                                       <Settings className="h-4 w-4 mr-2" />
                                       <span>Configure</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => {
                                      setRestaurantToDelete({ id: restaurant.restaurant_id, name: restaurant.restaurant_name })
                                      setVerificationInput('')
                                      setIsDeleteDialogOpen(true)
                                    }} className="text-red-600">
                                       <Trash2 className="h-4 w-4 mr-2" />
                                       <span>Delete</span>
                                    </DropdownMenuItem>
                                 </DropdownMenuContent>
                              </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <DataPagination
                currentPage={page}
                totalCount={totalCount}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                isLoading={isLoading}
              />
            </>
          )}
        </CardContent>
      </Card>


      {/* Grant Coins Modal */}
      <Dialog open={isCoinModalOpen} onOpenChange={setIsCoinModalOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-none shadow-3xl rounded-3xl">
          <div className="bg-amber-500/5 p-8 pb-6 border-b border-amber-500/10">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
                 <Coins className="h-6 w-6 text-amber-600" />
                 Treasury Grant
              </DialogTitle>
              <DialogDescription className="text-sm font-medium">Issue digital credits to {selectedRestaurant?.restaurant_name}</DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Magnitude (Amount)</Label>
              <Input 
                type="number" 
                value={coinAmount} 
                onChange={(e) => setCoinAmount(e.target.value)} 
                placeholder="0.00" 
                className="h-12 rounded-2xl bg-muted/20 border-none font-black text-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Reason for Audit Trail</Label>
              <Input value={coinReason} onChange={(e) => setCoinReason(e.target.value)} className="h-11 rounded-2xl bg-muted/20 border-none font-bold" />
            </div>
          </div>
          <DialogFooter className="p-8 bg-muted/10 border-t border-border/40">
            <Button variant="ghost" onClick={() => setIsCoinModalOpen(false)} className="rounded-xl h-11 font-bold uppercase text-xs">Revoke</Button>
            <Button onClick={handleGiveCoins} className="rounded-xl h-11 px-8 font-bold uppercase text-xs bg-black text-white hover:bg-black/90 shadow-xl shadow-black/10">Authorize Grant</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Advanced Settings Modal */}
      <Dialog open={isSettingsModalOpen} onOpenChange={setIsSettingsModalOpen}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden border-none shadow-3xl rounded-3xl">
           <div className="bg-primary/5 p-8 pb-6 border-b border-primary/10">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight">Core Configuration</DialogTitle>
              <DialogDescription className="text-sm font-medium">Administrative parameters for {selectedRestaurant?.restaurant_name}</DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-5">
               <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Trade Name</Label>
                 <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-11 rounded-2xl bg-muted/20 border-none font-bold" />
               </div>
               <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Controller Email</Label>
                 <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="h-11 rounded-2xl bg-muted/20 border-none font-bold" />
               </div>
            </div>
            
            <div className="space-y-6 pt-4 border-t border-border/40">
               <div className="flex items-center gap-2 mb-4">
                  <Coins className="h-4 w-4 text-primary" />
                  <span className="text-xs font-black uppercase tracking-widest">Financial Parameters</span>
               </div>
               
               <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Monthly Floor (₹)
                    </Label>
                    <Input type="number" value={editMonthlyMinimum} onChange={(e) => setEditMonthlyMinimum(e.target.value)} className="h-11 rounded-2xl bg-muted/20 border-none font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Network Fee (%)</Label>
                    <Input type="number" value={editPlatformFee} onChange={(e) => setEditPlatformFee(e.target.value)} className="h-11 rounded-2xl bg-muted/20 border-none font-bold" />
                  </div>
               </div>
            </div>
            
            <div className="space-y-4 pt-4 border-t border-border/40">
               <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="text-xs font-black uppercase tracking-widest">Tier Evolution</span>
               </div>
               <div className="flex gap-2">
                  {['SILVER', 'GOLD', 'DIAMOND'].map((tier) => (
                     <button
                        key={tier}
                        type="button"
                        onClick={() => handlePlanChange(selectedRestaurant!.name, tier as any)}
                        className={cn(
                           "flex-1 h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all",
                           selectedRestaurant?.plan_type === tier 
                              ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" 
                              : "bg-white border-border/50 text-muted-foreground hover:border-primary/40"
                        )}
                        disabled={updating === selectedRestaurant?.name}
                     >
                        {tier}
                     </button>
                  ))}
               </div>
            </div>
          </div>
          <DialogFooter className="p-8 bg-muted/10 border-t border-border/40">
            <Button variant="ghost" onClick={() => setIsSettingsModalOpen(false)} className="rounded-xl h-12 font-bold uppercase text-xs">Dismiss</Button>
            <Button onClick={handleUpdateSettings} className="rounded-xl h-12 px-8 font-bold uppercase text-xs bg-primary text-white hover:bg-primary/90 shadow-xl shadow-primary/20">Commit Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
           <div className="p-6 pt-8 text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <DialogHeader className="text-center">
              <DialogTitle className="text-xl font-bold text-center w-full">Delete Restaurant</DialogTitle>
              <DialogDescription className="text-sm text-center pt-2">
                This action is irreversible. All configurations, balances, and data for <span className="font-bold text-foreground">"{restaurantToDelete?.name}"</span> will be permanently removed.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-8 pb-8 space-y-4">
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground">
                To confirm, please type <span className="font-mono text-red-600 font-bold px-1 bg-red-50 rounded">{restaurantToDelete?.id}</span> below.
              </Label>
              <Input 
                value={verificationInput} 
                onChange={(e) => setVerificationInput(e.target.value)} 
                placeholder="Type restaurant ID here"
                className="h-11 rounded-xl border-muted focus-visible:ring-red-500 font-medium" 
              />
            </div>
          </div>
          <DialogFooter className="p-4 bg-muted/30 border-t flex flex-row gap-2 sm:justify-end">
            <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)} className="rounded-xl flex-1 sm:flex-none">Cancel</Button>
            <Button 
               variant="destructive" 
               disabled={verificationInput !== restaurantToDelete?.id} 
               onClick={handleConfirmDelete}
               className="rounded-xl px-6 flex-1 sm:flex-none bg-red-600 hover:bg-red-700 shadow-sm"
            >
               Delete Restaurant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
