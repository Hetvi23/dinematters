import { Link } from 'react-router-dom'
import { useState, useMemo } from 'react'
import { useFrappeGetDocList, useFrappeDeleteDoc } from '@/lib/frappe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Eye, Pencil, Trash2, Plus, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/hooks/useConfirm'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { ListFilters, FilterCondition } from '@/components/ListFilters'
import { cn } from '@/lib/utils'

type SortField = 'product_name' | 'price' | 'original_price' | 'category_name' | 'calories' | 'display_order' | 'is_active' | 'is_vegetarian' | 'product_type' | 'main_category'
type SortOrder = 'asc' | 'desc' | null

export default function Products() {
  const { confirm, ConfirmDialogComponent } = useConfirm()
  const { selectedRestaurant } = useRestaurant()
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<FilterCondition[]>([])
  const [sortField, setSortField] = useState<SortField>('product_name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  
  const { data: products, isLoading, mutate } = useFrappeGetDocList('Menu Product', {
    fields: ['name', 'product_name', 'price', 'original_price', 'is_active', 'category', 'category_name', 'main_category', 'product_type', 'description', 'calories', 'is_vegetarian', 'display_order', 'estimated_time', 'serving_size'],
    filters: selectedRestaurant ? { restaurant: selectedRestaurant } : undefined,
    limit: 1000,
    orderBy: { field: sortField, order: sortOrder || 'asc' }
  }, selectedRestaurant ? `products-${selectedRestaurant}` : null)

  const { deleteDoc } = useFrappeDeleteDoc()

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle sort order
      if (sortOrder === 'asc') {
        setSortOrder('desc')
      } else if (sortOrder === 'desc') {
        setSortOrder(null)
        setSortField('product_name')
      } else {
        setSortOrder('asc')
      }
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const SortableHeader = ({ field, children }: { field: SortField, children: React.ReactNode }) => {
    const isActive = sortField === field
    return (
      <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort(field)}>
        <div className="flex items-center gap-2">
          {children}
          {isActive ? (
            sortOrder === 'asc' ? (
              <ArrowUp className="h-4 w-4" />
            ) : (
              <ArrowDown className="h-4 w-4" />
            )
          ) : (
            <ArrowUpDown className="h-4 w-4 opacity-50" />
          )}
        </div>
      </TableHead>
    )
  }

  // Apply search, filters, and sorting
  const filteredProducts = useMemo(() => {
    if (!products) return []
    
    let filtered = [...products]
    
    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((product: any) => {
        return (
          (product.product_name || '').toLowerCase().includes(query) ||
          (product.name || '').toLowerCase().includes(query) ||
          (product.category_name || '').toLowerCase().includes(query) ||
          (product.product_type || '').toLowerCase().includes(query) ||
          (product.main_category || '').toLowerCase().includes(query) ||
          String(product.price || '').includes(query) ||
          String(product.original_price || '').includes(query) ||
          String(product.calories || '').includes(query)
        )
      })
    }
    
    // Apply filters
    filters.forEach((filter) => {
      // Skip empty filters, but allow false, 0, and empty string as valid values
      if (filter.value === '' || filter.value === null || filter.value === undefined) {
        // For 'is' and 'is not' operators, empty value is valid
        if (filter.operator !== 'is' && filter.operator !== 'is not') {
          console.log('[Products Filter] Skipping empty filter:', filter)
          return
        }
      }
      
      const beforeCount = filtered.length
      filtered = filtered.filter((product: any) => {
        const fieldValue = product[filter.fieldname]
        const filterValue = filter.value
        
        // Debug logging for troubleshooting
        console.log('[Products Filter] Checking:', {
          fieldname: filter.fieldname,
          operator: filter.operator,
          fieldValue: fieldValue,
          filterValue: filterValue,
          productName: product.product_name || product.name,
          fieldExists: filter.fieldname in product
        })
        
        // Handle null/undefined field values
        if (fieldValue === null || fieldValue === undefined) {
          if (filter.operator === 'is') return true
          if (filter.operator === 'is not') return false
          if (filter.operator === '=' && (filterValue === null || filterValue === undefined || filterValue === '')) return true
          if (filter.operator === '!=' && (filterValue !== null && filterValue !== undefined && filterValue !== '')) return true
          return false
        }
        
        switch (filter.operator) {
          case '=':
            // Handle boolean comparison
            if (typeof fieldValue === 'boolean' || typeof filterValue === 'boolean') {
              return Boolean(fieldValue) === Boolean(filterValue)
            }
            // Case-insensitive string comparison for text fields
            return String(fieldValue).trim().toLowerCase() === String(filterValue).trim().toLowerCase()
          case '!=':
            // Handle boolean comparison
            if (typeof fieldValue === 'boolean' || typeof filterValue === 'boolean') {
              return Boolean(fieldValue) !== Boolean(filterValue)
            }
            // Case-insensitive string comparison for text fields
            return String(fieldValue).trim().toLowerCase() !== String(filterValue).trim().toLowerCase()
          case '>':
            return Number(fieldValue) > Number(filterValue)
          case '<':
            return Number(fieldValue) < Number(filterValue)
          case '>=':
            return Number(fieldValue) >= Number(filterValue)
          case '<=':
            return Number(fieldValue) <= Number(filterValue)
          case 'like':
            return String(fieldValue || '').toLowerCase().includes(String(filterValue).toLowerCase())
          case 'not like':
            return !String(fieldValue || '').toLowerCase().includes(String(filterValue).toLowerCase())
          case 'in':
            const inValues = Array.isArray(filterValue) ? filterValue : [filterValue]
            return inValues.some(v => String(fieldValue).trim().toLowerCase() === String(v).trim().toLowerCase())
          case 'not in':
            const notInValues = Array.isArray(filterValue) ? filterValue : [filterValue]
            return !notInValues.some(v => String(fieldValue).trim().toLowerCase() === String(v).trim().toLowerCase())
          case 'is':
            return fieldValue === null || fieldValue === undefined || fieldValue === ''
          case 'is not':
            return fieldValue !== null && fieldValue !== undefined && fieldValue !== ''
          default:
            return true
        }
      })
    })
    
    // Apply client-side sorting (in case server-side sorting doesn't work as expected)
    if (sortField && sortOrder) {
      filtered.sort((a: any, b: any) => {
        let aValue = a[sortField]
        let bValue = b[sortField]
        
        // Handle null/undefined values
        if (aValue === null || aValue === undefined) aValue = ''
        if (bValue === null || bValue === undefined) bValue = ''
        
        // Handle boolean values
        if (typeof aValue === 'boolean') {
          aValue = aValue ? 1 : 0
          bValue = bValue ? 1 : 0
        }
        
        // Handle numeric values
        if (sortField === 'price' || sortField === 'original_price' || sortField === 'calories' || sortField === 'display_order') {
          aValue = Number(aValue) || 0
          bValue = Number(bValue) || 0
        }
        
        // Handle string values
        if (typeof aValue === 'string') {
          aValue = aValue.toLowerCase()
          bValue = bValue.toLowerCase()
        }
        
        let comparison = 0
        if (aValue < bValue) comparison = -1
        if (aValue > bValue) comparison = 1
        
        return sortOrder === 'asc' ? comparison : -comparison
      })
    }
    
    // Debug: Log filter results
    if (filters.length > 0) {
      console.log('[Products Filter Results]', {
        totalProducts: products.length,
        filteredCount: filtered.length,
        activeFilters: filters.filter(f => f.value !== '' && f.value !== null && f.value !== undefined),
        filters: filters.map(f => ({
          fieldname: f.fieldname,
          operator: f.operator,
          value: f.value,
          valueType: typeof f.value
        }))
      })
    }
    
    return filtered
  }, [products, searchQuery, filters, sortField, sortOrder])

  const handleDelete = async (productId: string, productName: string) => {
    const confirmed = await confirm({
      title: 'Delete Product',
      description: `Are you sure you want to delete "${productName}"? This action cannot be undone.`,
      variant: 'destructive',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    })

    if (!confirmed) {
      return
    }

    try {
      await deleteDoc('Menu Product', productId)
      toast.success('Product deleted successfully')
      mutate()
    } catch (error: any) {
      console.error('Failed to delete product:', error)
      toast.error(error?.message || 'Failed to delete product')
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">Products</h2>
          <p className="text-muted-foreground text-sm mt-1">
            View and manage menu products (filtered by your restaurant permissions)
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link to="/products/new">
            <Plus className="h-4 w-4" />
            Add Product
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>All Products</CardTitle>
              <CardDescription>
                Products are automatically filtered based on your restaurant access
                {filteredProducts.length !== products?.length && (
                  <span className="ml-2">
                    (Showing {filteredProducts.length} of {products?.length || 0})
                  </span>
                )}
              </CardDescription>
            </div>
            <ListFilters
              doctype="Menu Product"
              filters={filters}
              onFiltersChange={setFilters}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search products..."
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading products...</div>
          ) : filteredProducts && filteredProducts.length > 0 ? (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {filteredProducts.map((product: any, index: number) => (
                  <div key={product.name} className="p-4 border border-border rounded-md bg-card hover:border-border/80 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground">#{index + 1}</span>
                          <h3 className="font-semibold text-foreground truncate">{product.product_name || product.name}</h3>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-lg font-semibold text-foreground">₹{product.price || 0}</span>
                          {product.original_price && (
                            <span className="text-sm text-muted-foreground line-through">₹{product.original_price}</span>
                          )}
                        </div>
                      </div>
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium border flex-shrink-0 ${
                        product.is_active ? 'bg-[#dff6dd] dark:bg-[#1b5e20] text-[#107c10] dark:text-[#81c784] border-[#92c5f7] dark:border-[#4caf50]' : 'bg-muted text-muted-foreground border-border'
                      }`}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex gap-2 pt-3 border-t border-border">
                      <Link to={`/products/${product.name}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                      </Link>
                      <Link to={`/products/${product.name}/edit`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </Link>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDelete(product.name, product.product_name || product.name)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <SortableHeader field="product_name">Product Name</SortableHeader>
                      <SortableHeader field="category_name">Category</SortableHeader>
                      <SortableHeader field="price">Price</SortableHeader>
                      <SortableHeader field="original_price">Original</SortableHeader>
                      <SortableHeader field="is_vegetarian">Type</SortableHeader>
                      <SortableHeader field="is_active">Status</SortableHeader>
                      <TableHead className="w-28">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product: any, index: number) => (
                      <TableRow key={product.name}>
                        <TableCell className="text-muted-foreground text-sm">{index + 1}</TableCell>
                        <TableCell className="font-medium">{product.product_name || product.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {product.category_name || '-'}
                        </TableCell>
                        <TableCell className="font-semibold">₹{product.price || 0}</TableCell>
                        <TableCell className="text-sm">
                          {product.original_price ? `₹${product.original_price}` : '-'}
                        </TableCell>
                        <TableCell>
                          {product.is_vegetarian ? (
                            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-800">
                              Veg
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-800">
                              Non-Veg
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
                            product.is_active ? 'bg-[#dff6dd] dark:bg-[#1b5e20] text-[#107c10] dark:text-[#81c784]' : 'bg-muted text-muted-foreground'
                          }`}>
                            {product.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Link to={`/products/${product.name}`}>
                              <Button variant="ghost" size="sm" title="View" className="h-8 w-8 p-0">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Link to={`/products/${product.name}/edit`}>
                              <Button variant="ghost" size="sm" title="Edit" className="h-8 w-8 p-0">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              title="Delete"
                              onClick={() => handleDelete(product.name, product.product_name || product.name)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
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
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No products found</div>
          )}
        </CardContent>
      </Card>
      {ConfirmDialogComponent}
    </div>
  )
}













