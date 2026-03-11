import { useState, useMemo, useEffect } from 'react'
import { useFrappeGetDocList, useFrappePostCall, useFrappeUpdateDoc, useFrappeDeleteDoc } from '@/lib/frappe'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Plus, Edit, Trash2, Tag, Percent, DollarSign, Gift, Calendar, Users, TrendingUp, AlertCircle } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { useCurrency } from '@/hooks/useCurrency'
import { toast } from 'sonner'

export default function Coupons() {
  const { selectedRestaurant } = useRestaurant()
  const { formatAmountNoDecimals } = useCurrency()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<any>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [couponToDelete, setCouponToDelete] = useState<{ name: string; code: string } | null>(null)

  // Fetch coupons
  const { data: coupons, mutate, isLoading } = useFrappeGetDocList('Coupon', {
    fields: ['name', 'code', 'description', 'discount_type', 'discount_value', 'min_order_amount', 'is_active', 'valid_from', 'valid_until', 'max_uses', 'usage_count', 'offer_type', 'max_discount_cap', 'priority', 'restaurant'],
    filters: selectedRestaurant ? [['restaurant', '=', selectedRestaurant]] : undefined,
    orderBy: { field: 'creation', order: 'desc' },
    limit: 100,
  })

  const { call: createCoupon } = useFrappePostCall('frappe.client.insert')
  const { updateDoc: updateCoupon } = useFrappeUpdateDoc()
  const { deleteDoc: deleteCoupon } = useFrappeDeleteDoc()

  // Filter coupons
  const filteredCoupons = useMemo(() => {
    if (!coupons) return []
    
    let filtered = coupons

    // Filter by type
    if (filterType !== 'all') {
      if (filterType === 'active') {
        filtered = filtered.filter(c => c.is_active)
      } else if (filterType === 'inactive') {
        filtered = filtered.filter(c => !c.is_active)
      } else {
        filtered = filtered.filter(c => c.offer_type === filterType)
      }
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(c => 
        c.code?.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [coupons, filterType, searchQuery])

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
      toast.error(error.message || 'Failed to create coupon')
    }
  }

  const handleUpdateCoupon = async (name: string, formData: any) => {
    try {
      await updateCoupon('Coupon', name, formData)
      toast.success('Coupon updated successfully')
      mutate()
      setEditingCoupon(null)
    } catch (error: any) {
      toast.error(error.message || 'Failed to update coupon')
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
      toast.error(error.message || 'Failed to delete coupon')
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
                <p className="text-2xl font-bold">{coupons?.length || 0}</p>
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
                  {coupons?.filter(c => c.is_active).length || 0}
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
                  {coupons?.reduce((sum, c) => sum + (c.usage_count || 0), 0) || 0}
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
                  {coupons?.filter(c => c.offer_type === 'combo').length || 0}
                </p>
              </div>
              <Gift className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search coupons..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full md:w-[200px]">
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
        </CardContent>
      </Card>

      {/* Coupons List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading coupons...</div>
      ) : filteredCoupons.length === 0 ? (
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCoupons.map((coupon) => (
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
                <p className="text-sm text-muted-foreground">{coupon.description || 'No description'}</p>
                
                <div className="flex items-center gap-2 text-sm">
                  {coupon.discount_type === 'percent' ? (
                    <>
                      <Percent className="h-4 w-4 text-green-600" />
                      <span className="font-semibold text-green-600">{coupon.discount_value}% OFF</span>
                    </>
                  ) : (
                    <>
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <span className="font-semibold text-green-600">{formatAmountNoDecimals(coupon.discount_value)} OFF</span>
                    </>
                  )}
                  {coupon.max_discount_cap && (
                    <span className="text-xs text-muted-foreground">(Max: {formatAmountNoDecimals(coupon.max_discount_cap)})</span>
                  )}
                </div>

                {coupon.min_order_amount > 0 && (
                  <p className="text-xs text-muted-foreground">Min order: {formatAmountNoDecimals(coupon.min_order_amount)}</p>
                )}

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {coupon.max_uses && (
                    <span>Usage: {coupon.usage_count || 0}/{coupon.max_uses}</span>
                  )}
                  {coupon.valid_until && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Until {new Date(coupon.valid_until).toLocaleDateString()}
                    </span>
                  )}
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
      )}

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

  const [formData, setFormData] = useState({
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
  })

  // Update form when coupon changes - FIXED with useEffect
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
      })
      // Parse selected products from comma-separated string
      if (coupon.required_items) {
        setSelectedProducts(coupon.required_items.split(',').map((s: string) => s.trim()).filter(Boolean))
      } else {
        setSelectedProducts([])
      }
    } else {
      // Reset form for new coupon
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
      })
      setSelectedProducts([])
    }
  }, [coupon])

  // Update required_items when selected products change
  useEffect(() => {
    if (formData.offer_type === 'combo') {
      setFormData(prev => ({
        ...prev,
        required_items: selectedProducts.join(', ')
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
              <Select value={formData.offer_type} onValueChange={(v) => setFormData({ ...formData, offer_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="coupon">Coupon Code</SelectItem>
                  <SelectItem value="auto">Auto-Applied</SelectItem>
                  <SelectItem value="combo">Combo Deal</SelectItem>
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
              placeholder={formData.offer_type === 'combo' ? 'Get 2 Pizzas + 1 Drink for special price' : 'Get 20% off on orders above ₹500'}
            />
          </div>

          {/* Conditional fields based on offer type */}
          {formData.offer_type === 'combo' ? (
            // COMBO DEAL FIELDS
            <>
              <div className="space-y-2">
                <Label>Required Products *</Label>
                
                {/* Selected Products Display */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedProducts.length > 0 ? (
                    selectedProducts.map((productName) => (
                      <span
                        key={productName}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm"
                      >
                        {productName}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProducts(prev => prev.filter(p => p !== productName))
                          }}
                          className="ml-1 hover:bg-primary-foreground/20 rounded-full p-0.5 text-lg leading-none"
                        >
                          ×
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground py-2">No products selected</span>
                  )}
                </div>

                {/* Product Selector Dropdown */}
                <Select
                  value=""
                  onValueChange={(productName) => {
                    if (productName && !selectedProducts.includes(productName)) {
                      setSelectedProducts(prev => [...prev, productName])
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Add another product as requirement" />
                  </SelectTrigger>
                  <SelectContent>
                    {products && products.length > 0 ? (
                      products
                        .filter(p => !selectedProducts.includes(p.product_name))
                        .map((product) => (
                          <SelectItem key={product.product_id} value={product.product_name}>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sm">{product.product_name}</span>
                              <span className="text-[11px] text-muted-foreground">
                                {product.category_name || 'Uncategorised'} · {product.main_category || 'menu item'}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                    ) : (
                      <SelectItem value="no-products" disabled>
                        No products available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Select products that must be in the cart for this combo deal</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="combo_price">Combo Price ({formatAmountNoDecimals(0).replace('0', '')})*</Label>
                  <Input
                    id="combo_price"
                    type="number"
                    value={formData.combo_price}
                    onChange={(e) => setFormData({ ...formData, combo_price: parseFloat(e.target.value) })}
                    required
                    min="0"
                    placeholder="299"
                  />
                  <p className="text-xs text-muted-foreground">Fixed price for the combo</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Input
                    id="priority"
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                    min="1"
                  />
                </div>
              </div>
            </>
          ) : (
            // REGULAR COUPON/AUTO-OFFER FIELDS
            <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="discount_type">Discount Type</Label>
              <Select value={formData.discount_type} onValueChange={(v) => setFormData({ ...formData, discount_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percentage</SelectItem>
                  <SelectItem value="flat">Flat Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discount_value">Discount Value *</Label>
              <Input
                id="discount_value"
                type="number"
                value={formData.discount_value}
                onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) })}
                required
                min="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_discount_cap">Max Cap ({formatAmountNoDecimals(0).replace('0', '')})</Label>
              <Input
                id="max_discount_cap"
                type="number"
                value={formData.max_discount_cap}
                onChange={(e) => setFormData({ ...formData, max_discount_cap: parseFloat(e.target.value) })}
                min="0"
              />
            </div>
          </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {formData.offer_type !== 'combo' && (
              <div className="space-y-2">
                <Label htmlFor="min_order_amount">Min Order Amount ({formatAmountNoDecimals(0).replace('0', '')})</Label>
                <Input
                  id="min_order_amount"
                  type="number"
                  value={formData.min_order_amount}
                  onChange={(e) => setFormData({ ...formData, min_order_amount: parseFloat(e.target.value) })}
                  min="0"
                />
              </div>
            )}

            {formData.offer_type !== 'combo' && (
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Input
                  id="priority"
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                  min="1"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="max_uses">Max Total Uses</Label>
              <Input
                id="max_uses"
                type="number"
                value={formData.max_uses}
                onChange={(e) => setFormData({ ...formData, max_uses: parseInt(e.target.value) })}
                min="0"
                placeholder="0 = unlimited"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_uses_per_user">Max Uses Per Customer</Label>
              <Input
                id="max_uses_per_user"
                type="number"
                value={formData.max_uses_per_user}
                onChange={(e) => setFormData({ ...formData, max_uses_per_user: parseInt(e.target.value) })}
                min="0"
                placeholder="0 = unlimited"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valid_from">Valid From</Label>
              <Input
                id="valid_from"
                type="date"
                value={formData.valid_from}
                onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="valid_until">Valid Until</Label>
              <Input
                id="valid_until"
                type="date"
                value={formData.valid_until}
                onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="is_active">Active</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {coupon ? 'Update' : 'Create'} Coupon
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
