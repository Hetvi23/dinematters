import { useState, useMemo, useEffect } from 'react'
import { useFrappeGetDocList, useFrappePostCall, useFrappeUpdateDoc, useFrappeDeleteDoc } from '@/lib/frappe'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
import { Plus, Edit, Trash2, Tag, Search, Gift, Zap, AlertCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LockedFeature } from '@/components/FeatureGate/LockedFeature'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { useCurrency } from '@/hooks/useCurrency'
import { toast } from 'sonner'
import { getFrappeError } from '@/lib/utils'
import { useDataTable } from '@/hooks/useDataTable'
import { DataPagination } from '@/components/ui/DataPagination'

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
    fields: ['name', 'code', 'description', 'discount_type', 'discount_value', 'min_order_amount', 'is_active', 'valid_from', 'valid_until', 'max_uses', 'usage_count', 'offer_type', 'max_discount_cap', 'priority', 'restaurant'],
    initialFilters,
    orderBy: { field: 'creation', order: 'desc' },
    initialPageSize: 12,
    debugId: `coupons-${selectedRestaurant}-${filterType}`
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

  const openDeleteDialog = (name: string, code: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setCouponToDelete({ name, code })
    setDeleteDialogOpen(true)
  }

  if (!selectedRestaurant) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
        <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mb-4">
           <Tag className="h-10 w-10 text-muted-foreground/30" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Select a Restaurant</h3>
        <p className="text-muted-foreground max-w-sm">Pick a restaurant to manage your marketing campaigns and offers.</p>
      </div>
    )
  }

  if (!isDiamond) {
    return <LockedFeature feature="coupons" requiredPlan={['DIAMOND']} />
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Campaign Center</h2>
          <p className="text-muted-foreground text-sm flex items-center gap-2">
            <Zap className="h-3.5 w-3.5" />
            Launch and monitor high-conversion restaurant offers
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="rounded-xl h-11 px-6 shadow-lg shadow-primary/20">
          <Plus className="h-4 w-4 mr-2" />
          Create New Offer
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Coupons</CardTitle>
              <CardDescription>
                Manage your marketing campaigns and offers
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search coupons..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-9 w-[120px]">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="coupon">Coupon</SelectItem>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="combo">Combo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && !coupons.length ? (
            <div className="py-20 flex justify-center">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : !coupons || coupons.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground">No coupons found</div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coupons.map((coupon: any) => (
                      <TableRow key={coupon.name}>
                        <TableCell className="font-bold">{coupon.code}</TableCell>
                        <TableCell className="capitalize">{coupon.offer_type || 'Coupon'}</TableCell>
                        <TableCell>
                          {coupon.discount_type === 'percent' 
                            ? `${coupon.discount_value}%` 
                            : formatAmountNoDecimals(coupon.discount_value)}
                        </TableCell>
                        <TableCell>
                          {coupon.usage_count || 0} / {coupon.max_uses > 0 ? coupon.max_uses : '∞'}
                        </TableCell>
                        <TableCell>
                          {coupon.is_active ? (
                            <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => setEditingCoupon(coupon)}
                              className="h-8 w-8"
                            >
                               <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive"
                              onClick={(e) => openDeleteDialog(coupon.name, coupon.code, e)}
                            >
                               <Trash2 className="h-4 w-4" />
                            </Button>
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
        <AlertDialogContent className="rounded-3xl border-none shadow-2xl p-0 overflow-hidden">
          <div className="p-8 pb-0">
             <AlertDialogHeader className="space-y-3">
               <div className="h-14 w-14 bg-red-100 rounded-2xl flex items-center justify-center mb-2">
                 <AlertCircle className="h-8 w-8 text-red-600" />
               </div>
               <AlertDialogTitle className="text-2xl font-black tracking-tight">Deactivate Campaign?</AlertDialogTitle>
               <AlertDialogDescription className="text-base font-medium leading-relaxed">
                 You are about to permanently delete <strong>{couponToDelete?.code}</strong>. 
                 This will disable the offer in the menu immediately and purge all usage metrics.
               </AlertDialogDescription>
             </AlertDialogHeader>
          </div>
          <AlertDialogFooter className="p-6 bg-muted/20 mt-4 flex justify-between sm:justify-start gap-4">
            <AlertDialogCancel onClick={() => setCouponToDelete(null)} className="flex-1 rounded-xl h-11 font-bold uppercase text-xs border-none shadow-none bg-card">Stay Live</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCoupon}
              className="flex-1 rounded-xl h-11 font-bold uppercase text-xs bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-200"
            >
              Delete Offer
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
  const [activeTab, setActiveTab] = useState<'basic' | 'config' | 'combo'>('basic')
  
  // Fetch products for combo selection
  const { data: productsData } = useFrappeGetDocList('Menu Product', {
    fields: ['product_id', 'product_name', 'category_name', 'main_category'],
    filters: selectedRestaurant ? ({ restaurant: selectedRestaurant, is_active: 1 } as any) : undefined,
    limit: 500,
    orderBy: { field: 'product_name', order: 'asc' } as any
  }, `combo-products-list-${selectedRestaurant}`)

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
      if (coupon.required_items) {
        setSelectedProducts(coupon.required_items.split(',').map((s: string) => s.trim()).filter(Boolean))
      } else {
        setSelectedProducts([])
      }
      setActiveTab(coupon.offer_type === 'combo' ? 'combo' : 'basic')
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
      })
      setSelectedProducts([])
      setActiveTab('basic')
    }
  }, [coupon, open])

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
      <DialogContent className="max-w-xl p-0 overflow-hidden border-none shadow-3xl box-shadow-xl rounded-3xl">
        <div className="bg-primary/5 p-8 pb-6 border-b border-primary/10">
           <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight">{coupon ? 'Configure Offer' : 'Launch Campaign'}</DialogTitle>
              <DialogDescription className="text-sm font-medium">
                {coupon ? `Updating mechanics for ${coupon.code}` : 'Design a reward system to boost your restaurant sales'}
              </DialogDescription>
           </DialogHeader>
           
           <div className="flex bg-muted/50 p-1 rounded-xl mt-6">
              <button 
                type="button"
                onClick={() => setActiveTab('basic')}
                className={cn("flex-1 h-9 rounded-lg text-xs font-bold uppercase transition-all", activeTab === 'basic' ? "bg-card shadow-sm shadow-primary/5" : "text-muted-foreground")}
              >
                Core Details
              </button>
              <button 
                 type="button"
                 onClick={() => setActiveTab('config')}
                 className={cn("flex-1 h-9 rounded-lg text-xs font-bold uppercase transition-all", activeTab === 'config' ? "bg-card shadow-sm shadow-primary/5" : "text-muted-foreground")}
              >
                 Mechanics
              </button>
              {formData.offer_type === 'combo' && (
                 <button 
                  type="button"
                  onClick={() => setActiveTab('combo')}
                  className={cn("flex-1 h-9 rounded-lg text-xs font-bold uppercase transition-all", activeTab === 'combo' ? "bg-card shadow-sm shadow-primary/5" : "text-muted-foreground")}
                 >
                   Combo Items
                 </button>
              )}
           </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {activeTab === 'basic' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="code" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Unique Reward Code *</Label>
                      <Input
                        id="code"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        placeholder="e.g. SUMMER50"
                        className="h-11 rounded-2xl bg-muted/20 border-none font-bold placeholder:font-normal"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="offer_type" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Offer Strategy</Label>
                      <Select value={formData.offer_type} onValueChange={(v) => {
                        setFormData({ ...formData, offer_type: v })
                        if (v === 'combo') setActiveTab('combo')
                      }}>
                        <SelectTrigger className="h-11 rounded-2xl bg-muted/20 border-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-2xl">
                          <SelectItem value="coupon" className="font-semibold">Coupon Code</SelectItem>
                          <SelectItem value="auto" className="font-semibold">Auto-Applied</SelectItem>
                          <SelectItem value="combo" className="font-semibold">Combo Deal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Internal Description</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="e.g. Free delivery on orders above ₹1000"
                      className="h-11 rounded-2xl bg-muted/20 border-none"
                    />
                  </div>

                  {formData.offer_type === 'combo' ? (
                     <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
                        <Label htmlFor="combo_price" className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2 block">Bundle Price ({formatAmountNoDecimals(0).replace('0', '')}) *</Label>
                        <Input
                          id="combo_price"
                          type="number"
                          value={formData.combo_price}
                          onChange={(e) => setFormData({ ...formData, combo_price: parseFloat(e.target.value) })}
                          required
                          className="h-11 rounded-xl border-dashed border-primary/20 bg-background text-lg font-black"
                          placeholder="299"
                        />
                     </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <Label htmlFor="discount_type" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Value Type</Label>
                        <Select value={formData.discount_type} onValueChange={(v) => setFormData({ ...formData, discount_type: v })}>
                          <SelectTrigger className="h-11 rounded-2xl bg-muted/20 border-none">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl">
                            <SelectItem value="percent" className="font-semibold">Percentage</SelectItem>
                            <SelectItem value="flat" className="font-semibold">Flat Amount</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="discount_value" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Magnitude *</Label>
                        <Input
                          id="discount_value"
                          type="number"
                          value={formData.discount_value}
                          onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) })}
                          className="h-11 rounded-2xl bg-muted/20 border-none font-bold"
                          required
                        />
                      </div>
                    </div>
                  )}
               </div>
            )}

            {activeTab === 'config' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                  <div className="grid grid-cols-2 gap-5">
                     <div className="space-y-2">
                        <Label htmlFor="min_order_amount" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Min Purchase Required</Label>
                        <Input
                          id="min_order_amount"
                          type="number"
                          value={formData.min_order_amount}
                          onChange={(e) => setFormData({ ...formData, min_order_amount: parseFloat(e.target.value) })}
                          className="h-11 rounded-2xl bg-muted/20 border-none font-bold"
                        />
                     </div>
                     <div className="space-y-2">
                        <Label htmlFor="max_discount_cap" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Reward Cap (Max ₹)</Label>
                        <Input
                          id="max_discount_cap"
                          type="number"
                          value={formData.max_discount_cap}
                          onChange={(e) => setFormData({ ...formData, max_discount_cap: parseFloat(e.target.value) })}
                          className="h-11 rounded-2xl bg-muted/20 border-none font-bold"
                          placeholder="No upper limit"
                        />
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                     <div className="space-y-2">
                        <Label htmlFor="max_uses" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Campaign Budget (Total Uses)</Label>
                        <Input
                          id="max_uses"
                          type="number"
                          value={formData.max_uses}
                          onChange={(e) => setFormData({ ...formData, max_uses: parseInt(e.target.value) })}
                          className="h-11 rounded-2xl bg-muted/20 border-none font-bold"
                          placeholder="0 = Unlimited"
                        />
                     </div>
                     <div className="space-y-2">
                        <Label htmlFor="max_uses_per_user" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Usage Per Customer</Label>
                        <Input
                          id="max_uses_per_user"
                          type="number"
                          value={formData.max_uses_per_user}
                          onChange={(e) => setFormData({ ...formData, max_uses_per_user: parseInt(e.target.value) })}
                          className="h-11 rounded-2xl bg-muted/20 border-none font-bold"
                          placeholder="0 = Unlimited"
                        />
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                     <div className="space-y-2">
                        <Label htmlFor="valid_from" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Activation Date</Label>
                        <Input
                          id="valid_from"
                          type="date"
                          value={formData.valid_from}
                          onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                          className="h-11 rounded-2xl bg-muted/20 border-none font-bold"
                        />
                     </div>
                     <div className="space-y-2">
                        <Label htmlFor="valid_until" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Expiry Date</Label>
                        <Input
                          id="valid_until"
                          type="date"
                          value={formData.valid_until}
                          onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                          className="h-11 rounded-2xl bg-muted/20 border-none font-bold"
                        />
                     </div>
                  </div>

                  <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-xl border border-primary/10">
                     <input
                        type="checkbox"
                        id="is_active_check"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="h-4 w-4 rounded-full accent-primary"
                      />
                      <Label htmlFor="is_active_check" className="text-xs font-bold uppercase tracking-widest text-primary">Immediately Live and Active</Label>
                  </div>
               </div>
            )}

            {activeTab === 'combo' && formData.offer_type === 'combo' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                   <div className="space-y-3">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Gift className="h-3 w-3" /> Bundle Components
                      </Label>
                      
                      <div className="flex flex-wrap gap-2 min-h-[50px] p-3 bg-muted/20 rounded-2xl border border-dashed border-border">
                        {selectedProducts.length > 0 ? (
                          selectedProducts.map((productName) => (
                            <Badge
                              key={productName}
                              variant="secondary"
                              className="pl-3 pr-1 py-1.5 h-8 rounded-lg shadow-sm font-semibold text-xs border bg-card"
                            >
                              {productName}
                              <button
                                type="button"
                                onClick={() => setSelectedProducts(prev => prev.filter(p => p !== productName))}
                                className="ml-2 h-5 w-5 rounded-md hover:bg-muted hover:text-red-500 transition-colors flex items-center justify-center"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))
                        ) : (
                          <div className="flex items-center justify-center w-full py-2">
                             <p className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground/40">No items added to bundle</p>
                          </div>
                        )}
                      </div>

                      <Select
                        value=""
                        onValueChange={(productName) => {
                          if (productName && !selectedProducts.includes(productName)) {
                            setSelectedProducts(prev => [...prev, productName])
                          }
                        }}
                      >
                        <SelectTrigger className="h-12 rounded-2xl border-none bg-muted/20 pl-4 font-semibold text-sm">
                          <SelectValue placeholder="Add menu item to bundle..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl shadow-3xl border-none">
                          {products.filter(p => !selectedProducts.includes(p.product_name)).map((product) => (
                            <SelectItem key={product.product_id} value={product.product_name} className="py-2.5">
                                <div className="flex flex-col">
                                   <span className="font-bold text-sm tracking-tight">{product.product_name}</span>
                                   <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">{product.category_name}</span>
                                </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] font-medium text-muted-foreground/60 px-1 italic">* Customers must have all these items in cart for the special price to trigger.</p>
                   </div>
                   
                   <div className="space-y-2">
                      <Label htmlFor="priority_combo" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Conflict Resolution (Priority)</Label>
                      <Input
                        id="priority_combo"
                        type="number"
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                        className="h-11 rounded-2xl bg-muted/20 border-none"
                      />
                   </div>
               </div>
            )}
          </div>

          <DialogFooter className="p-8 bg-muted/10 border-t border-border/40">
            <div className="flex justify-between w-full items-center">
               <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl h-12 font-bold uppercase text-xs">
                 Discard Changes
               </Button>
               <Button type="submit" className="rounded-xl h-12 px-8 font-bold uppercase text-xs shadow-xl shadow-primary/20">
                 {coupon ? 'Save Configuration' : 'Launch Campaign'}
               </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
