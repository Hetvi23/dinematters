import { useState, useEffect } from 'react'
import { useFrappeAuth, useFrappePostCall } from '@/lib/frappe'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { getFrappeError, cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Shield, Users, Crown, Star, RefreshCw, Power, PowerOff, Trash2, TrendingUp, Activity, Coins, Settings, Zap } from 'lucide-react'

interface Restaurant {
  name: string
  restaurant_id: string
  restaurant_name: string
  owner_email?: string
  is_active: number
  plan_type: 'LITE' | 'PRO' | 'LUX'
  coins_balance: number
  platform_fee_percent: number
  creation: string
  modified: string
}

export default function AdminRestaurantManagement() {
  const { currentUser } = useFrappeAuth()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)
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
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')

  // APIs
  const { call: getRestaurants } = useFrappePostCall<{ success: boolean, data: { restaurants: Restaurant[] } }>(
    'dinematters.dinematters.api.admin.get_all_restaurants'
  )
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

  useEffect(() => {
    if (currentUser === 'Administrator') {
      setIsAdmin(true)
    } else {
      setIsAdmin(false)
      setLoading(false)
    }
  }, [currentUser])

  useEffect(() => {
    if (isAdmin) {
      loadRestaurants()
    }
  }, [isAdmin])

  const loadRestaurants = async () => {
    if (!isAdmin) return
    try {
      setLoading(true)
      const result = await getRestaurants({}) as any
      if (result?.message?.data?.restaurants) {
        setRestaurants(result.message.data.restaurants)
      }
    } catch (error) {
      toast.error('Failed to load restaurants', { description: getFrappeError(error) })
    } finally {
      setLoading(false)
    }
  }

  const handlePlanChange = async (restaurantName: string, newPlan: 'LITE' | 'PRO' | 'LUX') => {
    try {
      setUpdating(restaurantName)
      const result = await updateRestaurantPlan({ restaurant_id: restaurantName, plan_type: newPlan }) as any
      if (result?.message?.success) {
        toast.success(`Plan updated to ${newPlan}`)
        await loadRestaurants()
      }
    } catch (error) {
      toast.error('Failed to update plan')
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
        await loadRestaurants()
      }
    } catch (error) {
      toast.error('Failed to update status')
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
        toast.success(`Granted ${coinAmount} coins`)
        setIsCoinModalOpen(false)
        await loadRestaurants()
      }
    } catch (error) {
      toast.error('Failed to grant coins')
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
          restaurant_name: editName,
          owner_email: editEmail
        }
      }) as any
      if (result?.message?.success) {
        toast.success('Settings updated')
        setIsSettingsModalOpen(false)
        await loadRestaurants()
      }
    } catch (error) {
      toast.error('Failed to update settings')
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
        toast.success(`Restaurant deleted`)
        setIsDeleteDialogOpen(false)
        await loadRestaurants()
      }
    } catch (error) {
      toast.error('Failed to delete')
    } finally {
      setUpdating(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-destructive/20 shadow-lg">
          <CardContent className="p-8 text-center">
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
              <Shield className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Access Denied</h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              You don't have permission to access this admin page.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              Restaurant Management
            </h1>
          </div>
          <p className="text-muted-foreground">
            Manage all restaurants and their subscription plans from a central hub
          </p>
        </div>

        {/* Stats Cards - Restored Original Style */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <Card className="overflow-hidden relative group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Total</p>
                  <p className="text-3xl font-bold">{restaurants.length}</p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-xl text-blue-600">
                  <Users className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="overflow-hidden relative group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Active</p>
                  <p className="text-3xl font-bold">{restaurants.filter(r => r.is_active).length}</p>
                </div>
                <div className="p-3 bg-green-500/10 rounded-xl text-green-600">
                  <Crown className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden relative group border-indigo-200 bg-indigo-50/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-indigo-600 mb-1">LUX Plans</p>
                  <p className="text-3xl font-bold text-indigo-700">{restaurants.filter(r => r.plan_type === 'LUX').length}</p>
                </div>
                <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-600">
                  <Zap className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="overflow-hidden relative group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">PRO Plans</p>
                  <p className="text-3xl font-bold">{restaurants.filter(r => r.plan_type === 'PRO').length}</p>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-xl text-purple-600">
                  <Star className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden relative group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">LITE Plans</p>
                  <p className="text-3xl font-bold">{restaurants.filter(r => r.plan_type === 'LITE').length}</p>
                </div>
                <div className="p-3 bg-orange-500/10 rounded-xl text-orange-600">
                  <Shield className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Restaurants Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Restaurants</CardTitle>
              <Button variant="outline" size="sm" onClick={loadRestaurants}>
                <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p>Loading restaurants...</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>RESTAURANT</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>OWNER EMAIL</TableHead>
                    <TableHead>STATUS</TableHead>
                    <TableHead>PLAN</TableHead>
                    <TableHead className="text-right">COINS</TableHead>
                    <TableHead>CREATED</TableHead>
                    <TableHead>ACTIONS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {restaurants.map((restaurant) => (
                    <TableRow key={restaurant.name} className="hover:bg-muted/30 transition-colors group">
                      <TableCell className="font-semibold">{restaurant.restaurant_name}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{restaurant.restaurant_id}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{restaurant.owner_email || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={restaurant.is_active ? 'default' : 'secondary'}
                          className={cn(
                            "shadow-none",
                            restaurant.is_active ? "bg-green-500/10 text-green-600 border-green-200" : "bg-muted text-muted-foreground"
                          )}
                        >
                          {restaurant.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={cn(
                            "shadow-none",
                            restaurant.plan_type === 'LUX' ? "bg-indigo-500/10 text-indigo-600 border-indigo-200" :
                            restaurant.plan_type === 'PRO' ? "bg-primary/10 text-primary border-primary/20" : "bg-muted/50 text-muted-foreground border-transparent"
                          )}
                        >
                          {restaurant.plan_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-sm">
                        {restaurant.coins_balance.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{formatDate(restaurant.creation)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                           <Button
                            variant="ghost" size="icon" className="h-8 w-8 text-orange-500 hover:bg-orange-50"
                            onClick={() => {
                              setSelectedRestaurant(restaurant)
                              setCoinAmount('')
                              setIsCoinModalOpen(true)
                            }}
                            title="Give Coins"
                          >
                            <Coins className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8 text-indigo-500 hover:bg-indigo-50"
                            onClick={() => {
                              setSelectedRestaurant(restaurant)
                              setEditPlatformFee(String(restaurant.platform_fee_percent))
                              setEditName(restaurant.restaurant_name)
                              setEditEmail(restaurant.owner_email || '')
                              setIsSettingsModalOpen(true)
                            }}
                            title="Settings"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost" size="icon"
                            onClick={() => handleStatusToggle(restaurant.name, restaurant.is_active)}
                            disabled={updating === restaurant.name}
                            className={cn("h-8 w-8", restaurant.is_active ? "text-red-500 hover:bg-red-50" : "text-green-500 hover:bg-green-50")}
                          >
                            {restaurant.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                          </Button>

                          <Select
                            value={restaurant.plan_type}
                            onValueChange={(value: 'LITE' | 'PRO' | 'LUX') => handlePlanChange(restaurant.name, value)}
                            disabled={updating === restaurant.name}
                          >
                            <SelectTrigger className="h-8 w-20 text-[10px] font-bold">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="LITE">LITE</SelectItem>
                              <SelectItem value="PRO">PRO</SelectItem>
                              <SelectItem value="LUX">LUX</SelectItem>
                            </SelectContent>
                          </Select>

                          <Button
                            variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              setRestaurantToDelete({ id: restaurant.restaurant_id, name: restaurant.restaurant_name })
                              setVerificationInput('')
                              setIsDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Stats Summary - Restored Style */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card>
            <CardHeader className="py-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <CardTitle className="text-lg">Plan Distribution</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-indigo-500" /> LUX Plans
                  </span>
                  <span className="font-bold">{restaurants.filter(r => r.plan_type === 'LUX').length}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" /> PRO Plans
                  </span>
                  <span className="font-bold">{restaurants.filter(r => r.plan_type === 'PRO').length}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-orange-400" /> LITE Plans
                  </span>
                  <span className="font-bold">{restaurants.filter(r => r.plan_type === 'LITE').length}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-600" />
                <CardTitle className="text-lg">Operational Status</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border bg-muted/20 text-center">
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Active</p>
                  <p className="text-xl font-bold text-green-600">{restaurants.filter(r => r.is_active).length}</p>
                </div>
                <div className="p-3 rounded-lg border bg-muted/20 text-center">
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Inactive</p>
                  <p className="text-xl font-bold text-destructive">{restaurants.filter(r => !r.is_active).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modals - Standard Styling */}
      <Dialog open={isCoinModalOpen} onOpenChange={setIsCoinModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Grant Coins</DialogTitle>
            <DialogDescription>Grant manual coins to {selectedRestaurant?.restaurant_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" value={coinAmount} onChange={(e) => setCoinAmount(e.target.value)} placeholder="Enter amount" />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input value={coinReason} onChange={(e) => setCoinReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCoinModalOpen(false)}>Cancel</Button>
            <Button onClick={handleGiveCoins}>Grant Coins</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSettingsModalOpen} onOpenChange={setIsSettingsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Restaurant Settings (Admin)</DialogTitle>
            <DialogDescription>Update administrative parameters for {selectedRestaurant?.restaurant_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Restaurant Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Owner Email</Label>
              <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Platform Fee %</Label>
              <Input type="number" value={editPlatformFee} onChange={(e) => setEditPlatformFee(e.target.value)} />
              <p className="text-[10px] text-muted-foreground italic">Restricted for restaurant owners.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateSettings}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Critical Deletion</DialogTitle>
            <DialogDescription>
              Permanently delete <strong>{restaurantToDelete?.name}</strong>? This action is irreversible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>To confirm, type the ID: <span className="font-mono font-bold text-primary">{restaurantToDelete?.id}</span></Label>
              <Input value={verificationInput} onChange={(e) => setVerificationInput(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={verificationInput !== restaurantToDelete?.id} onClick={handleConfirmDelete}>Confirm Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
