import { useState, useEffect } from 'react'
import { useFrappeAuth, useFrappePostCall } from '@/lib/frappe'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { Shield, Users, Crown, Star, RefreshCw, Power, PowerOff } from 'lucide-react'

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
      toast.error('Failed to load restaurants')
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
        toast.error(result?.message?.error || 'Failed to update plan')
      }
    } catch (error) {
      console.error('Error updating plan:', error)
      toast.error('Failed to update plan')
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
        toast.error(result?.message?.error || 'Failed to update status')
      }
    } catch (error) {
      console.error('Error toggling status:', error)
      toast.error('Failed to update status')
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-8 text-center">
            <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-gray-600">
              You don't have permission to access this admin page. 
              This page is restricted to system administrators only.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold tracking-tight">
              Restaurant Management
            </h1>
          </div>
          <p className="text-muted-foreground">
            Manage all restaurants and their subscription plans
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Restaurants</p>
                  <p className="text-2xl font-bold">{restaurants.length}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold">{restaurants.filter(r => r.is_active).length}</p>
                </div>
                <Crown className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">PRO Plans</p>
                  <p className="text-2xl font-bold">{restaurants.filter(r => r.plan_type === 'PRO').length}</p>
                </div>
                <Star className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">LITE Plans</p>
                  <p className="text-2xl font-bold">{restaurants.filter(r => r.plan_type === 'LITE').length}</p>
                </div>
                <Shield className="h-8 w-8 text-orange-600" />
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
                    <TableRow key={restaurant.name}>
                      <TableCell className="font-medium">
                        {restaurant.restaurant_name}
                      </TableCell>
                      <TableCell>{restaurant.restaurant_id}</TableCell>
                      <TableCell>{restaurant.owner_email || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={restaurant.is_active ? 'default' : 'secondary'}>
                          {restaurant.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={restaurant.plan_type === 'PRO' ? 'default' : 'secondary'}>
                          {restaurant.plan_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(restaurant.creation)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusToggle(restaurant.name, restaurant.is_active)}
                            disabled={updating === restaurant.name}
                            className={restaurant.is_active ? "text-red-600 hover:text-red-700" : "text-green-600 hover:text-green-700"}
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
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="LITE">LITE</SelectItem>
                              <SelectItem value="PRO">PRO</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Plan Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Total Restaurants:</span>
                  <span className="font-bold">{restaurants.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    LITE Plan:
                  </span>
                  <span className="font-bold">
                    {restaurants.filter(r => r.plan_type === 'LITE').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="flex items-center gap-2">
                    <Crown className="h-4 w-4" />
                    PRO Plan:
                  </span>
                  <span className="font-bold">
                    {restaurants.filter(r => r.plan_type === 'PRO').length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Active Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Active Restaurants:</span>
                  <span className="font-bold text-green-600">
                    {restaurants.filter(r => r.is_active).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Inactive Restaurants:</span>
                  <span className="font-bold text-red-600">
                    {restaurants.filter(r => !r.is_active).length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
