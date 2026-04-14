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
import { useDataTable } from '@/hooks/useDataTable'
import { DataPagination } from '@/components/ui/DataPagination'
import { getFrappeError } from '@/lib/utils'

type SortField = 'category_name' | 'display_name' | 'display_order' | 'is_special'
type SortOrder = 'asc' | 'desc'

export default function Categories() {
  const { confirm, ConfirmDialogComponent } = useConfirm()
  const { selectedRestaurant } = useRestaurant()
  
  const [sortField, setSortField] = useState<SortField>('display_order')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  const {
    data: categories,
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
    doctype: 'Menu Category',
    fields: ['name', 'category_id', 'category_name', 'display_name', 'description', 'display_order', 'is_special'],
    initialFilters: selectedRestaurant ? [{ fieldname: 'restaurant', operator: '=', value: selectedRestaurant }] : [],
    orderBy: { field: sortField, order: sortOrder },
    debugId: `categories-${selectedRestaurant}`
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
            <ArrowUpDown className="h-4 w-4 opacity-30" />
          )}
        </div>
      </TableHead>
    )
  }

  const handleDelete = async (categoryId: string, categoryName: string) => {
    const confirmed = await confirm({
      title: 'Delete Category',
      description: `Are you sure you want to delete "${categoryName}"? This action cannot be undone.`,
      variant: 'destructive',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    })

    if (!confirmed) return

    try {
      await deleteDoc('Menu Category', categoryId)
      toast.success('Category deleted successfully')
      mutate()
    } catch (error: any) {
      console.error('Failed to delete category:', error)
      toast.error('Failed to delete category', { description: getFrappeError(error) })
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">Categories</h2>
          <p className="text-muted-foreground text-sm mt-1">
            View and manage menu categories (filtered by your restaurant permissions)
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto shadow-sm">
          <Link to="/categories/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Categories</CardTitle>
              <CardDescription>
                Manage your menu categories and organization
              </CardDescription>
            </div>
            <ListFilters
              doctype="Menu Category"
              filters={filters.filter(f => f.fieldname !== 'restaurant')}
              onFiltersChange={(newFilters) => setFilters([
                ...newFilters,
                ...(selectedRestaurant ? [{ fieldname: 'restaurant', operator: '=', value: selectedRestaurant } as FilterCondition] : [])
              ])}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search categories..."
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && !categories.length ? (
            <div className="py-20 flex justify-center">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : categories && categories.length > 0 ? (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      <SortableHeader field="category_name">Category Name</SortableHeader>
                      <TableHead>Description</TableHead>
                      <SortableHeader field="display_order">Order</SortableHeader>
                      <SortableHeader field="is_special">Type</SortableHeader>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category: any, index: number) => (
                      <TableRow key={category.name}>
                        <TableCell className="text-muted-foreground">{(page - 1) * pageSize + index + 1}</TableCell>
                        <TableCell className="font-medium">{category.category_name || category.name}</TableCell>
                        <TableCell className="max-w-[300px] truncate">{category.description || '-'}</TableCell>
                        <TableCell>{category.display_order || '-'}</TableCell>
                        <TableCell>
                          {category.is_special ? (
                            <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">Special</Badge>
                          ) : (
                            <Badge variant="outline">Standard</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Link to={`/categories/${category.name}`}>
                              <Button variant="ghost" size="icon" title="View" className="h-8 w-8">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Link to={`/categories/${category.name}/edit`}>
                              <Button variant="ghost" size="icon" title="Edit" className="h-8 w-8">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              title="Delete"
                              onClick={() => handleDelete(category.name, category.category_name || category.name)}
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
            <div className="py-20 text-center text-muted-foreground">No categories found</div>
          )}
        </CardContent>
      </Card>
      {ConfirmDialogComponent}
    </div>
  )
}












