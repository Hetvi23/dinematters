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
import { Shield, Users, Crown, Star, RefreshCw, Power, PowerOff, Trash2, TrendingUp, Activity, AlertTriangle } from 'lucide-react'

interface Restaurant {
  name: string
  restaurant_id: string
  restaurant_name: string
  owner_email?: string
  is_active: number
  plan_type: 'LITE' | 'PRO'
  creation: string
  modified: string
}

export default function AdminRestaurantManagement() {
  const { currentUser } = useFrappeAuth()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  
  // Delete modal state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [restaurantToDelete, setRestaurantToDelete] = useState<{ id: string, name: string } | null>(null)
  const [verificationInput, setVerificationInput] = useState('')

  // Use the correct admin API
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

  // Simple admin check - using same pattern as Layout.tsx
  useEffect(() => {
    console.log('Admin page - Current user from useFrappeAuth:', currentUser)
    
    // Simple check: if user is Administrator, set admin to true
    if (currentUser === 'Administrator') {
      setIsAdmin(true)
      console.log('Admin page access granted for Administrator')
    } else {
      setIsAdmin(false)
      console.log('Admin page access denied for user:', currentUser)
      setLoading(false)
    }
  }, [currentUser])

  // Load restaurants when admin access is granted
  useEffect(() => {
    if (isAdmin) {
      loadRestaurants()
    }
  }, [isAdmin])

  // Load restaurants
  const loadRestaurants = async () => {
    if (!isAdmin) return
    try {
      setLoading(true)
      const result = await getRestaurants({}) as any
      console.log('API response:', result)
      
      // Fix: Data is under result.message.data.restaurants
      if (result?.message?.data?.restaurants && Array.isArray(result.message.data.restaurants)) {
        setRestaurants(result.message.data.restaurants)
        console.log('Loaded restaurants:', result.message.data.restaurants)
        console.log('Number of restaurants:', result.message.data.restaurants.length)
      } else {
        console.log('No restaurants found in:', result?.message?.data?.restaurants)
        setRestaurants([])
      }
    } catch (error) {
      console.error('Error loading restaurants:', error)
      toast.error('Failed to load restaurants', { description: getFrappeError(error) })
      setRestaurants([])
    } finally {
      setLoading(false)
    }
  }

  // Handle plan change
  const handlePlanChange = async (restaurantName: string, newPlan: 'LITE' | 'PRO') => {
    if (!isAdmin) return
    try {
      setUpdating(restaurantName)
      const result = await updateRestaurantPlan({
        restaurant_id: restaurantName,
        plan_type: newPlan
      }) as any
      console.log('Plan update result:', result)
      
      // Fix: Check result.message.success instead of result.success
      if (result?.message?.success) {
        toast.success(`Plan updated to ${newPlan}`)
        // Reload restaurants to get updated data
        await loadRestaurants()
      } else {
        toast.error(result?.message?.error || 'Failed to update plan', { description: getFrappeError(result) })
      }
    } catch (error) {
      console.error('Error updating plan:', error)
      toast.error('Failed to update plan', { description: getFrappeError(error) })
    } finally {
      setUpdating(null)
    }
  }

  // Handle active/inactive toggle
  const handleStatusToggle = async (restaurantName: string, currentStatus: number) => {
    if (!isAdmin) return
    try {
      setUpdating(restaurantName)
      const newStatus = currentStatus ? 0 : 1
      const result = await toggleRestaurantStatus({
        restaurant_id: restaurantName,
        is_active: newStatus
      }) as any
      console.log('Status toggle result:', result)
      
      if (result?.message?.success) {
        toast.success(`Restaurant ${newStatus ? 'activated' : 'deactivated'}`)
        // Reload restaurants to get updated data
        await loadRestaurants()
      } else {
        toast.error(result?.message?.error || 'Failed to update status', { description: getFrappeError(result) })
      }
    } catch (error) {
      console.error('Error toggling status:', error)
      toast.error('Failed to update status', { description: getFrappeError(error) })
    } finally {
      setUpdating(null)
    }
  }

  // Function to open delete confirmation dialog
  const handleDeleteRestaurant = (restaurantId: string, restaurantName: string) => {
    if (!isAdmin) return
    setRestaurantToDelete({ id: restaurantId, name: restaurantName })
    setVerificationInput('')
    setIsDeleteDialogOpen(true)
  }

  // Handle final deletion after modal confirmation
  const handleConfirmDelete = async () => {
    if (!isAdmin || !restaurantToDelete || verificationInput !== restaurantToDelete.id) return

    try {
      setUpdating(restaurantToDelete.id)
      const result = await deleteRestaurant({
        restaurant_id: restaurantToDelete.id
      }) as any
      
      if (result?.message?.success) {
        toast.success(`Restaurant ${restaurantToDelete.id} deleted successfully`)
        setIsDeleteDialogOpen(false)
        await loadRestaurants()
      } else {
        toast.error(result?.message?.error || 'Failed to delete restaurant', { description: getFrappeError(result) })
      }
    } catch (error) {
      console.error('Error deleting restaurant:', error)
      toast.error('Failed to delete restaurant', { description: getFrappeError(error) })
    } finally {
      setUpdating(null)
    }
  }

  // Format date
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
            <p className="text-muted-foreground leading-relaxed">
              You don't have permission to access this admin page. 
              This area is strictly restricted to system administrators.
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Total Restaurants</p>
                  <p className="text-3xl font-bold">{restaurants.length}</p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400">
                  <Users className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Active</p>
                  <p className="text-3xl font-bold">{restaurants.filter(r => r.is_active).length}</p>
                </div>
                <div className="p-3 bg-green-500/10 rounded-xl text-green-600 dark:text-green-400">
                  <Crown className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">PRO Plans</p>
                  <p className="text-3xl font-bold">{restaurants.filter(r => r.plan_type === 'PRO').length}</p>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-xl text-purple-600 dark:text-purple-400">
                  <Star className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">LITE Plans</p>
                  <p className="text-3xl font-bold">{restaurants.filter(r => r.plan_type === 'LITE').length}</p>
                </div>
                <div className="p-3 bg-orange-500/10 rounded-xl text-orange-600 dark:text-orange-400">
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
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
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
            ) : restaurants.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No restaurants found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Owner Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {restaurants.map((restaurant) => (
                    <TableRow key={restaurant.name} className="hover:bg-muted/30 transition-colors group">
                      <TableCell className="font-semibold">
                        {restaurant.restaurant_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs tracking-tight">{restaurant.restaurant_id}</TableCell>
                      <TableCell className="text-muted-foreground">{restaurant.owner_email || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={restaurant.is_active ? 'default' : 'secondary'}
                          className={cn(
                            "shadow-none",
                            restaurant.is_active ? "bg-green-500/10 text-green-600 border-green-200 dark:border-green-800" : "bg-muted text-muted-foreground"
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
                            restaurant.plan_type === 'PRO' ? "bg-primary/10 text-primary border-primary/20" : "bg-muted/50 text-muted-foreground border-transparent"
                          )}
                        >
                          {restaurant.plan_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(restaurant.creation)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleStatusToggle(restaurant.name, restaurant.is_active)}
                            disabled={updating === restaurant.name}
                            className={cn(
                              "h-8 w-8",
                              restaurant.is_active ? "text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" : "text-green-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
                            )}
                            title={restaurant.is_active ? "Deactivate restaurant" : "Activate restaurant"}
                          >
                            {restaurant.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                          </Button>
                          <Select
                            value={restaurant.plan_type}
                            onValueChange={(value: 'LITE' | 'PRO') => 
                              handlePlanChange(restaurant.name, value)
                            }
                            disabled={updating === restaurant.name}
                          >
                            <SelectTrigger className="h-8 w-24 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="LITE">LITE</SelectItem>
                              <SelectItem value="PRO">PRO</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteRestaurant(restaurant.restaurant_id, restaurant.restaurant_name)}
                            disabled={updating === restaurant.name}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Permanently delete restaurant"
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="shadow-sm border-muted">
            <CardHeader className="border-b bg-muted/20 py-4 px-6">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-primary/10 rounded-md">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="text-lg">Plan Distribution</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <span className="text-sm font-medium">Total registered</span>
                  <span className="text-xl font-bold">{restaurants.length}</span>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center group">
                    <span className="flex items-center gap-2.5 text-muted-foreground group-hover:text-foreground transition-colors">
                      <div className="h-2 w-2 rounded-full bg-orange-400" />
                      LITE Plan
                    </span>
                    <span className="font-bold">
                      {restaurants.filter(r => r.plan_type === 'LITE').length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center group">
                    <span className="flex items-center gap-2.5 text-muted-foreground group-hover:text-foreground transition-colors">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      PRO Plan
                    </span>
                    <span className="font-bold">
                      {restaurants.filter(r => r.plan_type === 'PRO').length}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-muted">
            <CardHeader className="border-b bg-muted/20 py-4 px-6">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-green-500/10 rounded-md">
                  <Activity className="h-4 w-4 text-green-600" />
                </div>
                <CardTitle className="text-lg">Operational Health</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border bg-muted/20 text-center space-y-1">
                    <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Active</p>
                    <p className="text-2xl font-bold text-green-600 leading-none">
                      {restaurants.filter(r => r.is_active).length}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border bg-muted/20 text-center space-y-1">
                    <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Inactive</p>
                    <p className="text-2xl font-bold text-destructive leading-none">
                      {restaurants.filter(r => !r.is_active).length}
                    </p>
                  </div>
                </div>
                
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
                  <div 
                    className="bg-green-500 h-full transition-all duration-500" 
                    style={{ width: `${(restaurants.filter(r => r.is_active).length / (restaurants.length || 1)) * 100}%` }} 
                  />
                  <div 
                    className="bg-destructive/60 h-full transition-all duration-500" 
                    style={{ width: `${(restaurants.filter(r => !r.is_active).length / (restaurants.length || 1)) * 100}%` }} 
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive mb-2">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle>Critical Deletion</DialogTitle>
            </div>
            <DialogDescription className="text-foreground/90 font-medium">
              You are about to permanently delete <strong>{restaurantToDelete?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg space-y-2">
              <p className="text-xs text-destructive font-semibold uppercase tracking-wider">Warning: Data Loss</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This will purge all menus, orders, images, and configuration records. This action is <strong className="text-foreground">irreversible</strong>.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="verification" className="text-sm">
                To confirm, type the restaurant ID: <code className="bg-muted px-1.5 py-0.5 rounded text-primary font-bold">{restaurantToDelete?.id}</code>
              </Label>
              <Input
                id="verification"
                value={verificationInput}
                onChange={(e) => setVerificationInput(e.target.value)}
                placeholder="Type restaurant ID here"
                className="font-mono"
                autoComplete="off"
              />
            </div>
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={verificationInput !== restaurantToDelete?.id || updating === restaurantToDelete?.id}
              onClick={handleConfirmDelete}
              className="px-6"
            >
              {updating === restaurantToDelete?.id ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Confirm Deletion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
