import { useState, useMemo, useEffect } from 'react'
import { useFrappeGetDocList, useFrappePostCall } from 'frappe-react-sdk'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Plus, Pencil, HelpCircle } from 'lucide-react'

import { MenuCategoryItem } from '@/components/MenuCategoryItem'
import { MenuProductCard } from '@/components/MenuProductCard'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useConfirm } from '@/hooks/useConfirm'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import DynamicForm from '@/components/DynamicForm'
import { useFrappeGetCall } from '@/lib/frappe'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'

export default function MenuManagement() {
  const { selectedRestaurant } = useRestaurant()
  const { confirm, ConfirmDialogComponent } = useConfirm()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // UI State
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  
  // Resizable Sidebar State
  const [sidebarWidth, setSidebarWidth] = useState(320)
  const [isResizing, setIsResizing] = useState(false)

  // Form handling
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formConfig, setFormConfig] = useState<{
    doctype: string
    docname?: string
    mode: 'create' | 'edit'
    title: string
  } | null>(null)

  // API Hooks
  const { call: updateDoc } = useFrappePostCall('dinematters.dinematters.api.documents.update_document')
  const { call: deleteDoc } = useFrappePostCall('dinematters.dinematters.api.documents.delete_multiple_docs')
  const { call: updateOrder } = useFrappePostCall('dinematters.dinematters.api.categories.update_category_order')

  // Fetch Categories
  const { 
    data: categories, 
    isLoading: categoriesLoading, 
    mutate: mutateCategories 
  } = useFrappeGetDocList('Menu Category', {
    fields: ['name', 'category_name', 'display_name', 'display_order', 'is_special', 'is_active'],
    filters: selectedRestaurant ? [['restaurant', '=', selectedRestaurant]] : [],
    orderBy: { field: 'display_order', order: 'asc' },
    limit: 100
  })

  // Set initial category selection
  useMemo(() => {
    if (!selectedCategoryId && categories && categories.length > 0) {
      setSelectedCategoryId(categories[0].name)
    }
  }, [categories, selectedCategoryId])

  const activeCategory = useMemo(() => 
    categories?.find(c => c.name === selectedCategoryId),
    [categories, selectedCategoryId]
  )

  // Fetch Products
  const { 
    data: productsData, 
    isLoading: productsLoading, 
    mutate: mutateProducts 
  } = useFrappeGetCall('dinematters.dinematters.api.products.get_products', {
    restaurant_id: selectedRestaurant,
    category: searchQuery ? undefined : activeCategory?.category_name,
    search: searchQuery || undefined,
    include_inactive: 1,
    limit: 500
  }, (selectedRestaurant && (activeCategory || searchQuery)) ? `menu-products-${activeCategory?.name || 'search'}-${searchQuery}` : null)

  const products = productsData?.message?.data?.products || []

  const editingProduct = useMemo(() => {
    if (formConfig?.doctype === 'Menu Product' && formConfig?.docname && products) {
      return products.find((p: any) => p.docname === formConfig.docname || p.id === formConfig.docname)
    }
    return null
  }, [formConfig, products])

  // Resize Handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      const newWidth = e.clientX - 260 // Sidebar offset (assuming sidebar is roughly at 260px from left)
      if (newWidth > 200 && newWidth < 600) {
        setSidebarWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id && categories) {
      const oldIndex = categories.findIndex((c: any) => c.name === active.id)
      const newIndex = categories.findIndex((c: any) => c.name === over.id)

      const newOrder = arrayMove(categories, oldIndex, newIndex)
      mutateCategories(newOrder, false)

      try {
        const updates = newOrder.map((c: any, index: number) => ({
          name: c.name,
          display_order: index + 1
        }))
        await updateOrder({ category_orders: updates })
        toast.success('Category order updated')
      } catch (error) {
        toast.error('Failed to update order')
        mutateCategories()
      }
    }
  }

  const handleToggleProductStatus = async (product: any, status: boolean) => {
    try {
      await updateDoc({
        doctype: 'Menu Product',
        name: product.docname,
        doc_data: { is_active: status ? 1 : 0 }
      })
      mutateProducts()
      toast.success(`${product.name} status updated`)
    } catch (error) {
      toast.error('Failed to update status')
    }
  }

  const handleToggleCategoryStatus = async (category: any, status: boolean) => {
    try {
      await updateDoc({
        doctype: 'Menu Category',
        name: category.name,
        doc_data: { is_active: status ? 1 : 0 }
      })
      toast.success(`${category.display_name || category.category_name} status updated`)
      mutateCategories()
    } catch (error) {
      toast.error('Failed to update status')
    }
  }

  const handleDeleteCategory = async (category: any) => {
    const confirmed = await confirm({
      title: 'Delete Category',
      description: `Are you sure you want to delete "${category.display_name || category.category_name}"? This will permanently delete ALL products within this category and all their data. This action cannot be undone.`,
      variant: 'destructive'
    })

    if (confirmed) {
      try {
        const response = await deleteDoc({
          doctype: 'Menu Category',
          names: [category.name]
        })
        
        if (response.message?.success) {
          toast.success('Category deleted')
          mutateCategories()
          if (selectedCategoryId === category.name) {
            setSelectedCategoryId(null)
          }
        } else {
          const errorMsg = response.message?.errors?.[0] || 'Failed to delete category'
          toast.error(errorMsg)
        }
      } catch (error) {
        toast.error('Failed to delete category')
      }
    }
  }

  const handleDeleteProduct = async (product: any) => {
    const confirmed = await confirm({
      title: 'Delete Product',
      description: `Are you sure you want to delete "${product.name}"?`,
      variant: 'destructive'
    })
    if (!confirmed) return

    try {
      const response = await deleteDoc({
        doctype: 'Menu Product',
        names: [product.docname],
        force: true
      })

      if (response.message?.success) {
        mutateProducts()
        toast.success('Product deleted')
      } else {
        const errorMsg = response.message?.errors?.[0] || 'Failed to delete product'
        toast.error(errorMsg)
      }
    } catch (error) {
      toast.error('Failed to delete product')
    }
  }

  const openForm = (doctype: string, mode: 'create' | 'edit', docname?: string) => {
    setFormConfig({
      doctype,
      docname,
      mode,
      title: `${mode === 'create' ? 'Add' : 'Edit'} ${doctype === 'Menu Category' ? 'Category' : 'Item'}`
    })
    setIsFormOpen(true)
  }

  const handleFormSave = () => {
    setIsFormOpen(false)
    if (formConfig?.doctype === 'Menu Category') {
      mutateCategories()
    } else {
      mutateProducts()
    }
  }

  const filteredCategories = categories?.filter(c => 
    (c.display_name || c.category_name || c.name).toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] -m-4 sm:-m-6 overflow-hidden">
      <header className="bg-[#1e2433] dark:bg-card text-white dark:text-foreground p-4 flex items-center justify-between shadow-lg z-10 border-b dark:border-border">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-lg font-bold tracking-tight uppercase">Menu Management</h1>
            <p className="text-[10px] text-slate-400 dark:text-muted-foreground uppercase tracking-widest">
              Centralized Menu Control
            </p>
          </div>
          <Badge variant="outline" className="bg-slate-700/50 dark:bg-muted border-slate-600 dark:border-border text-slate-300 dark:text-muted-foreground gap-1.5 px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Live
          </Badge>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden bg-muted/30 dark:bg-background">
        {/* Resizable Sidebar */}
        <div 
          className="flex flex-col bg-card border-r relative"
          style={{ width: `${sidebarWidth}px` }}
        >
          <div className="p-4 border-b space-y-4 bg-muted/20">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search category and product" 
                className="pl-9 bg-background shadow-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button 
              className="w-full bg-[#ea580c] hover:bg-[#c2410c] text-white shadow-md" 
              onClick={() => openForm('Menu Category', 'create')}
            >
              <Plus className="h-4 w-4 mr-2" />
              ADD NEW CATEGORY
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
             {categoriesLoading ? (
               Array(6).fill(0).map((_, i) => (
                 <Skeleton key={i} className="h-14 w-full rounded-lg" />
               ))
             ) : (
               <DndContext 
                 sensors={sensors}
                 collisionDetection={closestCenter}
                 onDragEnd={handleDragEnd}
               >
                 <SortableContext 
                   items={filteredCategories?.map((c: any) => c.name) || []}
                   strategy={verticalListSortingStrategy}
                   disabled={!!searchQuery}
                 >
                   {filteredCategories?.map(category => (
                     <MenuCategoryItem 
                       key={category.name}
                       category={category}
                       isActive={selectedCategoryId === category.name}
                       onClick={() => setSelectedCategoryId(category.name)}
                       onToggleStatus={(status) => handleToggleCategoryStatus(category, status)}
                       onEdit={() => openForm('Menu Category', 'edit', category.name)}
                       onDelete={() => handleDeleteCategory(category)}
                     />
                   ))}
                 </SortableContext>
               </DndContext>
             )}
          </div>

          {/* Resize Handle */}
          <div 
            className={cn(
              "absolute top-0 -right-1 w-2 h-full cursor-col-resize hover:bg-primary/20 transition-colors z-20",
              isResizing && "bg-primary/40"
            )}
            onMouseDown={() => setIsResizing(true)}
          />
        </div>

        {/* Main Product List */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {activeCategory || searchQuery ? (
            <>
              <header className="p-4 sm:p-6 bg-card border-b flex items-center justify-between sticky top-0 z-[5]">
                <h2 className="text-xl font-bold text-foreground uppercase tracking-tight">
                  {searchQuery ? `Results for "${searchQuery}"` : (activeCategory?.display_name || activeCategory?.category_name)}
                </h2>
                <Button 
                  className="bg-[#ea580c] hover:bg-[#c2410c]"
                  onClick={() => openForm('Menu Product', 'create')}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  ADD NEW ITEM
                </Button>
              </header>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
                {productsLoading ? (
                  Array(4).fill(0).map((_, i) => (
                    <Skeleton key={i} className="h-28 w-full rounded-xl" />
                  ))
                ) : products.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {products.map((product: any) => (
                      <MenuProductCard 
                        key={product.docname}
                        product={product}
                        onEdit={() => openForm('Menu Product', 'edit', product.docname)}
                        onDelete={() => handleDeleteProduct(product)}
                        onToggleStatus={(status) => handleToggleProductStatus(product, status)}
                       />
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-10">
                    <p className="text-muted-foreground italic">No products found.</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
               <h3 className="text-xl font-bold text-foreground">Select a Category</h3>
               <p className="text-muted-foreground mt-2">Choose a category to start managing items.</p>
            </div>
          )}
        </main>
      </div>

      {/* Slide-over Form */}
      <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-2xl font-bold">{formConfig?.title}</SheetTitle>
          </SheetHeader>
          {formConfig && (
            <DynamicForm 
              doctype={formConfig.doctype}
              docname={formConfig.docname}
              mode={formConfig.mode}
              onSave={handleFormSave}
              onCancel={() => setIsFormOpen(false)}
              hideFields={
                formConfig.doctype === 'Menu Category' 
                  ? ['category_id', 'restaurant', 'display_name'] 
                  : ['product_id', 'seo_slug', 'category_name', 'restaurant', 'main_category', 'has_no_media']
              }
              readOnlyFields={['restaurant']}
              initialData={
                formConfig.mode === 'create' 
                  ? { 
                      restaurant: selectedRestaurant, 
                      category: formConfig.doctype === 'Menu Product' ? selectedCategoryId : undefined,
                      is_active: 1 
                    } 
                  : (editingProduct || {})
              }
            />
          )}
        </SheetContent>
      </Sheet>

      {ConfirmDialogComponent}

      {/* Help Trigger */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button 
          variant="secondary" size="icon" className="h-12 w-12 rounded-full shadow-2xl bg-card border-2 border-border hover:scale-110 transition-all"
          onClick={() => setIsHelpOpen(true)}
        >
          <HelpCircle className="h-6 w-6 text-foreground" />
        </Button>
      </div>

      <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Management Guide</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
             <div className="p-4 bg-muted/50 rounded-xl space-y-2">
                <h4 className="font-bold text-sm">Resize Sidebar</h4>
                <p className="text-xs text-muted-foreground">Drag the right edge of the category list to adjust width if names are long.</p>
             </div>
             <div className="p-4 bg-muted/50 rounded-xl space-y-2">
                <h4 className="font-bold text-sm">Product View</h4>
                <p className="text-xs text-muted-foreground">Click the eye icon on any product to see a detailed summary and preview.</p>
             </div>
             <div className="p-4 bg-muted/50 rounded-xl space-y-2">
                <h4 className="font-bold text-sm">Category Deletion</h4>
                <p className="text-xs text-muted-foreground">Use the trash icon on categories to remove them. This is permanent.</p>
             </div>
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }
      `}</style>
    </div>
  )
}
