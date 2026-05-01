import { useState, useMemo, useEffect } from 'react'
import { useFrappeGetDocList, useFrappePostCall, useFrappeUpdateDoc, useFrappeDeleteDoc } from '@/lib/frappe'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from "@/components/ui/input"
import { NumberInput } from "@/components/ui/number-input"
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Edit, Trash2, Tag, Percent, DollarSign, Gift, Calendar, Users, TrendingUp, AlertCircle, Zap } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { LockedFeature } from '@/components/FeatureGate/LockedFeature'
import { DatePicker } from '@/components/ui/date-picker'
import { TimePicker } from '@/components/ui/time-picker'
import { Checkbox } from '@/components/ui/checkbox'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { useCurrency } from '@/hooks/useCurrency'
import { toast } from 'sonner'
import { getFrappeError } from '@/lib/utils'
import { useDataTable } from '@/hooks/useDataTable'
import { DataPagination } from '@/components/ui/DataPagination'
import { X } from 'lucide-react'

const DAYS_OF_WEEK = [
  { label: 'Mon', value: 'monday' },
  { label: 'Tue', value: 'tuesday' },
  { label: 'Wed', value: 'wednesday' },
  { label: 'Thu', value: 'thursday' },
  { label: 'Fri', value: 'friday' },
  { label: 'Sat', value: 'saturday' },
  { label: 'Sun', value: 'sunday' },
]

export default function Coupons() {
  const { selectedRestaurant, isDiamond } = useRestaurant()
  const { formatAmountNoDecimals } = useCurrency()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<any>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [couponToDelete, setCouponToDelete] = useState<{ name: string; code: string } | null>(null)

  const initialFilters = useMemo(() => {
    if (!selectedRestaurant) return []
    const f: any[] = [['restaurant', '=', selectedRestaurant]]
    
    if (filterType === 'active') {
      f.push(['is_active', '=', 1])
    } else if (filterType === 'inactive') {
      f.push(['is_active', '=', 0])
    } else if (filterType !== 'all') {
      f.push(['offer_type', '=', filterType])
    }
    
    return f
  }, [selectedRestaurant, filterType])

  const {
    data: coupons,
    isLoading,
    mutate,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalCount,
    searchQuery,
    setSearchQuery
  } = useDataTable({
    doctype: 'Coupon',
    fields: ['name', 'code', 'description', 'discount_type', 'discount_value', 'min_order_amount', 'is_active', 'valid_from', 'valid_until', 'max_uses', 'usage_count', 'offer_type', 'max_discount_cap', 'priority', 'restaurant', 'valid_days_of_week', 'valid_time_start', 'valid_time_end', 'can_stack', 'free_item', 'required_items', 'combo_price', 'category'],
    initialFilters,
    orderBy: { field: 'creation', order: 'desc' },
    initialPageSize: 12,
  })

  const { call: createCoupon } = useFrappePostCall('frappe.client.insert')
  const { updateDoc: updateCoupon } = useFrappeUpdateDoc()
  const { deleteDoc: deleteCoupon } = useFrappeDeleteDoc()

  const handleCreateCoupon = async (formData: any) => {
    try {
      await createCoupon({
        doc: {
          doctype: 'Coupon',
          ...formData,
          restaurant: selectedRestaurant,
        }
      })
      toast.success('Coupon created successfully')
      mutate()
      setIsCreateDialogOpen(false)
    } catch (error: any) {
      toast.error('Failed to create coupon', { description: getFrappeError(error) })
    }
  }

  const handleUpdateCoupon = async (name: string, formData: any) => {
    try {
      await updateCoupon('Coupon', name, formData)
      toast.success('Coupon updated successfully')
      mutate()
      setEditingCoupon(null)
    } catch (error: any) {
      toast.error('Failed to update coupon', { description: getFrappeError(error) })
    }
  }

  const handleDeleteCoupon = async () => {
    if (!couponToDelete) return
    try {
      await deleteCoupon('Coupon', couponToDelete.name)
      toast.success('Coupon deleted successfully')
      mutate()
      setDeleteDialogOpen(false)
      setCouponToDelete(null)
    } catch (error: any) {
      toast.error('Failed to delete coupon', { description: getFrappeError(error) })
    }
  }

  const openDeleteDialog = (name: string, code: string) => {
    setCouponToDelete({ name, code })
    setDeleteDialogOpen(true)
  }

  const getOfferTypeIcon = (type: string) => {
    switch (type) {
      case 'combo': return <Gift className="h-4 w-4" />
      case 'auto': return <TrendingUp className="h-4 w-4" />
      default: return <Tag className="h-4 w-4" />
    }
  }

  if (!selectedRestaurant) {
    return (
      <div className="p-6">
        <EmptyState
          icon={AlertCircle}
          title="Select a Restaurant"
          description="Please select a restaurant from the sidebar to manage offers and coupons."
        />
      </div>
    )
  }

  if (!isDiamond) {
    return <LockedFeature feature="coupons" requiredPlan={['DIAMOND']} />
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manage Offers & Coupons</h1>
          <p className="text-muted-foreground mt-1">Create and manage discount coupons, auto-offers, and combo deals</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Coupon
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Coupons</p>
                <p className="text-2xl font-bold">{totalCount || 0}</p>
              </div>
              <Tag className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-600">
                  {coupons?.filter((c: any) => c.is_active).length || 0}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Usage</p>
                <p className="text-2xl font-bold">
                  {coupons?.reduce((sum: number, c: any) => sum + (c.usage_count || 0), 0) || 0}
                </p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Combo Offers</p>
                <p className="text-2xl font-bold text-purple-600">
                  {coupons?.filter((c: any) => c.offer_type === 'combo').length || 0}
                </p>
              </div>
              <Gift className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <CardTitle>All Coupons</CardTitle>
              <CardDescription>
                Manage your discount coupons and offers
                {totalCount > 0 && (
                  <span className="ml-2">
                    (Showing {coupons.length} of {totalCount})
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Input
                placeholder="Search coupons..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-[200px]"
              />
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Coupons</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="inactive">Inactive Only</SelectItem>
                  <SelectItem value="coupon">Coupon Codes</SelectItem>
                  <SelectItem value="auto">Auto Offers</SelectItem>
                  <SelectItem value="combo">Combo Deals</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && !coupons.length ? (
            <div className="text-center py-12 text-muted-foreground">Loading coupons...</div>
          ) : !coupons || coupons.length === 0 ? (
            <EmptyState
              icon={Tag}
              title="No Coupons Found"
              description={searchQuery || filterType !== 'all' 
                ? "No coupons match your search or filter criteria. Try adjusting your filters."
                : "Create your first coupon to start offering discounts to your customers."}
              action={{
                label: "Create Coupon",
                onClick: () => setIsCreateDialogOpen(true)
              }}
            />
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {coupons.map((coupon: any) => (
                  <Card key={coupon.name} className={!coupon.is_active ? 'opacity-60' : ''}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {getOfferTypeIcon(coupon.offer_type || 'coupon')}
                          <CardTitle className="text-lg">{coupon.code}</CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={coupon.is_active ? 'default' : 'secondary'}>
                            {coupon.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
                        {coupon.description || 'No description'}
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        {coupon.discount_type === 'percent' ? (
                          <>
                            <Percent className="h-4 w-4 text-green-600" />
                            <span className="font-semibold text-green-600">{coupon.discount_value}% OFF</span>
                          </>
                        ) : coupon.discount_type === 'delivery' ? (
                          <>
                            <Zap className="h-4 w-4 text-blue-600" />
                            <span className="font-semibold text-blue-600">FREE DELIVERY</span>
                          </>
                        ) : (
                          <>
                            <DollarSign className="h-4 w-4 text-green-600" />
                            <span className="font-semibold text-green-600">{formatAmountNoDecimals(coupon.discount_value)} OFF</span>
                          </>
                        )}
                        {coupon.max_discount_cap > 0 && coupon.discount_type !== 'delivery' && (
                          <span className="text-xs text-muted-foreground">(Max: {formatAmountNoDecimals(coupon.max_discount_cap)})</span>
                        )}
                        {coupon.category === 'delivery' && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] py-0 h-4">
                            Delivery Only
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div className="flex flex-col gap-1">
                          {coupon.min_order_amount > 0 && (
                            <span>Min order: {formatAmountNoDecimals(coupon.min_order_amount)}</span>
                          )}
                          <span>Usage: {coupon.usage_count || 0}/{coupon.max_uses || '∞'}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          {coupon.valid_until && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Until {new Date(coupon.valid_until).toLocaleDateString()}
                            </span>
                          )}
                          {coupon.can_stack && (
                            <span className="flex items-center gap-1 text-blue-600 font-medium">
                               <Zap className="h-3 w-3 fill-current" />
                               Stackable
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setEditingCoupon(coupon)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDeleteDialog(coupon.name, coupon.code)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <DataPagination
                currentPage={page}
                totalCount={totalCount}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                isLoading={isLoading}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <CouponDialog
        open={isCreateDialogOpen || !!editingCoupon}
        onClose={() => {
          setIsCreateDialogOpen(false)
          setEditingCoupon(null)
        }}
        coupon={editingCoupon}
        onSave={(data: any) => {
          if (editingCoupon) {
            handleUpdateCoupon(editingCoupon.name, data)
          } else {
            handleCreateCoupon(data)
          }
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Coupon?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the coupon <strong>"{couponToDelete?.code}"</strong>? 
              This action cannot be undone and all usage history will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCouponToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCoupon}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Coupon
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function CouponDialog({ open, onClose, coupon, onSave }: any) {
  const { formatAmountNoDecimals } = useCurrency()
  const { selectedRestaurant } = useRestaurant()
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  
  // Fetch products for combo selection
  const { data: productsData } = useFrappeGetDocList('Menu Product', {
    fields: ['product_id', 'product_name', 'category_name', 'main_category'],
    filters: selectedRestaurant ? ({ restaurant: selectedRestaurant, is_active: 1 } as any) : undefined,
    limit: 500,
    orderBy: { field: 'product_name', order: 'asc' } as any
  })

  const products: { product_id: string; product_name: string; category_name?: string; main_category?: string }[] =
    (productsData as any) || []

  const [formData, setFormData] = useState<any>({
    code: '',
    description: '',
    discount_type: 'percent',
    category: 'best',
    discount_value: 0,
    min_order_amount: 0,
    max_discount_cap: 0,
    is_active: true,
    offer_type: 'coupon',
    priority: 1,
    max_uses: 0,
    max_uses_per_user: 0,
    valid_from: '',
    valid_until: '',
    combo_price: 0,
    required_items: '',
    valid_days_of_week: '',
    valid_time_start: '',
    valid_time_end: '',
    can_stack: false,
    free_item: '',
  })

  useEffect(() => {
    if (coupon) {
      setFormData({
        code: coupon.code || '',
        description: coupon.description || '',
        discount_type: coupon.discount_type || 'percent',
        discount_value: coupon.discount_value || 0,
        min_order_amount: coupon.min_order_amount || 0,
        max_discount_cap: coupon.max_discount_cap || 0,
        is_active: coupon.is_active ?? true,
        offer_type: coupon.offer_type || 'coupon',
        priority: coupon.priority || 1,
        max_uses: coupon.max_uses || 0,
        max_uses_per_user: coupon.max_uses_per_user || 0,
        valid_from: coupon.valid_from || '',
        valid_until: coupon.valid_until || '',
        combo_price: coupon.combo_price || 0,
        required_items: coupon.required_items || '',
        valid_days_of_week: coupon.valid_days_of_week || '',
        valid_time_start: coupon.valid_time_start || '',
        valid_time_end: coupon.valid_time_end || '',
        can_stack: !!coupon.can_stack,
        free_item: coupon.free_item || '',
      })
      if (coupon.required_items) {
        try {
           const parsed = typeof coupon.required_items === 'string' ? JSON.parse(coupon.required_items) : coupon.required_items;
           setSelectedProducts(Array.isArray(parsed) ? parsed : []);
        } catch { setSelectedProducts([]); }
      } else {
        setSelectedProducts([])
      }
    } else {
      setFormData({
        code: '',
        description: '',
        discount_type: 'percent',
        discount_value: 0,
        min_order_amount: 0,
        max_discount_cap: 0,
        is_active: true,
        offer_type: 'coupon',
        priority: 1,
        max_uses: 0,
        max_uses_per_user: 0,
        valid_from: '',
        valid_until: '',
        combo_price: 0,
        required_items: '',
        valid_days_of_week: '',
        valid_time_start: '',
        valid_time_end: '',
        can_stack: false,
        free_item: '',
      })
      setSelectedProducts([])
    }
  }, [coupon, open])

  const toggleDay = (dayValue: string) => {
    let currentDays: string[] = []
    try {
      currentDays = formData.valid_days_of_week ? JSON.parse(formData.valid_days_of_week) : []
    } catch { currentDays = [] }

    if (currentDays.includes(dayValue)) {
      currentDays = currentDays.filter(d => d !== dayValue)
    } else {
      currentDays.push(dayValue)
    }
    setFormData({ ...formData, valid_days_of_week: currentDays.length ? JSON.stringify(currentDays) : '' })
  }

  const isDaySelected = (dayValue: string) => {
    try {
      const currentDays = formData.valid_days_of_week ? JSON.parse(formData.valid_days_of_week) : []
      return currentDays.includes(dayValue)
    } catch { return false }
  }

  useEffect(() => {
    if (formData.offer_type === 'combo') {
      setFormData((prev: any) => ({
        ...prev,
        required_items: JSON.stringify(selectedProducts)
      }))
    }
  }, [selectedProducts, formData.offer_type])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{coupon ? 'Edit Coupon' : 'Create New Coupon'}</DialogTitle>
          <DialogDescription>
            {coupon ? 'Update coupon details' : 'Create a new discount coupon, auto-offer, or combo deal'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Coupon Code *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="SAVE20"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="offer_type">Offer Type</Label>
              <Select value={formData.offer_type} onValueChange={(v) => {
                const updates: any = { offer_type: v }
                if (v === 'delivery') {
                  updates.category = 'delivery'
                  updates.discount_type = 'delivery'
                } else if (v === 'combo') {
                  updates.category = 'best'
                  updates.discount_type = 'flat'
                } else {
                  updates.category = 'best'
                }
                setFormData({ ...formData, ...updates })
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="coupon">Coupon Code</SelectItem>
                  <SelectItem value="auto">Auto-Applied</SelectItem>
                  <SelectItem value="combo">Combo Deal</SelectItem>
                  <SelectItem value="delivery">Delivery Offer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={formData.offer_type === 'combo' ? 'Get 2 Pizzas + 1 Drink for special price' : formData.offer_type === 'delivery' ? 'Free delivery on orders above ₹500' : 'Get 20% off on orders above ₹500'}
            />
          </div>

          {formData.offer_type === 'combo' ? (
            <>
              <div className="space-y-2">
                <Label>Required Products *</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedProducts.map((productId) => {
                    const prod = products.find(p => p.product_id === productId)
                    return (
                      <Badge key={productId} variant="secondary" className="gap-1">
                        {prod?.product_name || productId}
                        <button type="button" onClick={() => setSelectedProducts(prev => prev.filter(p => p !== productId))}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )
                  })}
                </div>
                <Select value="" onValueChange={(pid) => pid && !selectedProducts.includes(pid) && setSelectedProducts(prev => [...prev, pid])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Add product to combo" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.filter(p => !selectedProducts.includes(p.product_id)).map((p) => (
                      <SelectItem key={p.product_id} value={p.product_id}>{p.product_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="combo_price">Combo Price ({formatAmountNoDecimals(0).replace('0', '')})*</Label>
                  <NumberInput id="combo_price"  value={formData.combo_price} onChange={(e) => setFormData({ ...formData, combo_price: parseFloat(e.target.value) })} required min="0" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="free_item">Gift Item (BOGO)</Label>
                  <Select value={formData.free_item} onValueChange={(v) => setFormData({ ...formData, free_item: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="null_item">None</SelectItem>
                      {products.map((p) => <SelectItem key={p.product_id} value={p.product_id}>{p.product_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          ) : formData.offer_type === 'delivery' ? (
            <div className="p-4 rounded-lg border-2 border-orange-500/20 space-y-4">
              <div className="flex items-center gap-2 text-orange-600 font-medium">
                <Zap className="h-4 w-4" />
                Delivery Discount Settings
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="discount_type">Delivery Benefit</Label>
                  <Select value={formData.discount_type} onValueChange={(v) => setFormData({ ...formData, discount_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="delivery">Free Delivery</SelectItem>
                      <SelectItem value="flat">Flat Discount on Fee</SelectItem>
                      <SelectItem value="percent">Percentage off Fee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.discount_type !== 'delivery' && (
                  <div className="space-y-2">
                    <Label htmlFor="discount_value">Discount Value *</Label>
                    <NumberInput id="discount_value"  value={formData.discount_value} onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) })} required min="0" />
                  </div>
                )}
              </div>
              <p className="text-xs text-orange-600/70 italic">
                Note: This discount will be applied directly to the delivery fee calculated at checkout.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discount_type">Discount Type</Label>
                <Select value={formData.discount_type} onValueChange={(v) => setFormData({ ...formData, discount_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentage</SelectItem>
                    <SelectItem value="flat">Flat Amount</SelectItem>
                    <SelectItem value="delivery">Free Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount_value">Discount Value *</Label>
                <NumberInput id="discount_value"  value={formData.discount_value} onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) })} required min="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_discount_cap">Max Cap ({formatAmountNoDecimals(0).replace('0', '')})</Label>
                <NumberInput id="max_discount_cap"  value={formData.max_discount_cap} onChange={(e) => setFormData({ ...formData, max_discount_cap: parseFloat(e.target.value) })} min="0" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min_order_amount">Min Order Amount ({formatAmountNoDecimals(0).replace('0', '')})</Label>
              <NumberInput id="min_order_amount"  value={formData.min_order_amount} onChange={(e) => setFormData({ ...formData, min_order_amount: parseFloat(e.target.value) })} min="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <NumberInput id="priority"  value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })} min="1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <DatePicker label="Valid From" value={formData.valid_from} onChange={(v) => setFormData({ ...formData, valid_from: v })} />
            <DatePicker label="Valid Until" value={formData.valid_until} onChange={(v) => setFormData({ ...formData, valid_until: v })} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-slate-500">Active Days</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <Badge key={day.value} variant={isDaySelected(day.value) ? 'default' : 'outline'} className="cursor-pointer" onClick={() => toggleDay(day.value)}>
                  {day.label}
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TimePicker label="Time Start" value={formData.valid_time_start} onChange={(e) => setFormData({ ...formData, valid_time_start: e.target.value })} />
            <TimePicker label="Time End" value={formData.valid_time_end} onChange={(e) => setFormData({ ...formData, valid_time_end: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="is_active" checked={formData.is_active} onCheckedChange={(c) => setFormData({ ...formData, is_active: !!c })} />
              <Label htmlFor="is_active">Active</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="can_stack" checked={formData.can_stack} onCheckedChange={(c) => setFormData({ ...formData, can_stack: !!c })} />
              <Label htmlFor="can_stack">Stackable</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">{coupon ? 'Update' : 'Create'} Coupon</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
