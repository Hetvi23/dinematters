import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useFrappeDeleteDoc } from '@/lib/frappe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Eye, Pencil, Trash2, Plus, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/hooks/useConfirm'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { ListFilters, FilterCondition } from '@/components/ListFilters'
import { getFrappeError } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { useDataTable } from '@/hooks/useDataTable'
import { DataPagination } from '@/components/ui/DataPagination'

type SortField = 'product_name' | 'price' | 'original_price' | 'category_name' | 'calories' | 'display_order' | 'is_active' | 'is_vegetarian' | 'product_type' | 'main_category'
type SortOrder = 'asc' | 'desc'

export default function Products() {
  const { formatAmountNoDecimals } = useCurrency()
  const { confirm, ConfirmDialogComponent } = useConfirm()
  const { selectedRestaurant } = useRestaurant()
  
  const [sortField, setSortField] = useState<SortField>('product_name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  const {
    data: products,
    isLoading,
    mutate,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalCount,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters
  } = useDataTable({
    doctype: 'Menu Product',
    fields: ['name', 'product_name', 'price', 'original_price', 'is_active', 'category', 'category_name', 'main_category', 'product_type', 'description', 'calories', 'is_vegetarian', 'display_order', 'estimated_time', 'serving_size'],
    initialFilters: selectedRestaurant ? [{ fieldname: 'restaurant', operator: '=', value: selectedRestaurant }] : [],
    orderBy: { field: sortField, order: sortOrder },
    searchFields: ['product_name', 'category_name', 'name'],
    debugId: `products-${selectedRestaurant}`
  })

  const { deleteDoc } = useFrappeDeleteDoc()

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const SortableHeader = ({ field, children }: { field: SortField, children: React.ReactNode }) => {
    const isActive = sortField === field
    return (
      <TableHead className="cursor-pointer select-none hover:bg-muted/50 transition-colors" onClick={() => handleSort(field)}>
        <div className="flex items-center gap-2">
          {children}
          {isActive ? (
            sortOrder === 'asc' ? (
              <ArrowUp className="h-4 w-4 text-primary" />
            ) : (
              <ArrowDown className="h-4 w-4 text-primary" />
            )
          ) : (
            <ArrowUpDown className="h-4 w-4 opacity-30 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </TableHead>
    )
  }

  const handleDelete = async (productId: string, productName: string) => {
    const confirmed = await confirm({
      title: 'Delete Product',
      description: `Are you sure you want to delete "${productName}"? This action cannot be undone.`,
      variant: 'destructive',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    })

    if (!confirmed) return

    try {
      await deleteDoc('Menu Product', productId)
      toast.success('Product deleted successfully')
      mutate()
    } catch (error: any) {
      console.error('Failed to delete product:', error)
      toast.error('Failed to delete product', { description: getFrappeError(error) })
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">Products</h2>
          <p className="text-muted-foreground text-sm mt-1">
            View and manage menu products (filtered by your restaurant permissions)
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:w-auto">
          <Button asChild className="w-full sm:w-auto shadow-sm">
            <Link to="/products/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Products</CardTitle>
              <CardDescription>
                Manage your restaurant products and menu items
              </CardDescription>
            </div>
            <ListFilters
              doctype="Menu Product"
              filters={filters.filter(f => f.fieldname !== 'restaurant')}
              onFiltersChange={(newFilters) => setFilters([
                ...newFilters,
                ...(selectedRestaurant ? [{ fieldname: 'restaurant', operator: '=', value: selectedRestaurant } as FilterCondition] : [])
              ])}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search products..."
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && !products.length ? (
            <div className="py-20 flex justify-center">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : products && products.length > 0 ? (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      <SortableHeader field="product_name">Product Name</SortableHeader>
                      <SortableHeader field="category_name">Category</SortableHeader>
                      <SortableHeader field="price">Price</SortableHeader>
                      <SortableHeader field="is_vegetarian">Type</SortableHeader>
                      <SortableHeader field="is_active">Status</SortableHeader>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product: any, index: number) => (
                      <TableRow key={product.name}>
                        <TableCell className="text-muted-foreground">{(page - 1) * pageSize + index + 1}</TableCell>
                        <TableCell className="font-medium">{product.product_name}</TableCell>
                        <TableCell>{product.category_name || '-'}</TableCell>
                        <TableCell className="font-semibold">{formatAmountNoDecimals(product.price)}</TableCell>
                        <TableCell>
                          {product.is_vegetarian ? (
                            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Veg</Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">Non-Veg</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={product.is_active ? 'default' : 'secondary'}>
                            {product.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Link to={`/products/${product.name}`}>
                              <Button variant="ghost" size="icon" title="View" className="h-8 w-8">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Link to={`/products/${product.name}/edit`}>
                              <Button variant="ghost" size="icon" title="Edit" className="h-8 w-8">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              title="Delete"
                              onClick={() => handleDelete(product.name, product.product_name || product.name)}
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
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
          ) : (
            <div className="py-20 text-center text-muted-foreground">No products found</div>
          )}
        </CardContent>
      </Card>
      {ConfirmDialogComponent}
    </div>
  )
}













