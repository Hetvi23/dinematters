import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useFrappePostCall } from '@/lib/frappe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
  const [selectedNames, setSelectedNames] = useState<string[]>([])
  const [isDeleting, setIsDeleting] = useState(false)

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

  const { call: bulkDelete } = useFrappePostCall('dinematters.dinematters.api.documents.delete_multiple_docs')

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
      title: 'Force Delete Category',
      description: `Are you sure you want to delete "${categoryName}"? This category may be linked to products; force deleting will remove it regardless.`,
      variant: 'destructive',
      confirmText: 'Force Delete',
      cancelText: 'Cancel'
    })

    if (!confirmed) return

    try {
      const result = await bulkDelete({
        doctype: 'Menu Category',
        names: [categoryId],
        force: true
      })

      if (result.success && result.deleted_count > 0) {
        toast.success('Category deleted successfully')
        setSelectedNames(prev => prev.filter(name => name !== categoryId))
        mutate()
      } else if (result.errors && result.errors.length > 0) {
        toast.error('Failed to delete category', { description: result.errors[0] })
      } else {
        throw new Error(result.error || 'Delete failed')
      }
    } catch (error: any) {
      console.error('Failed to delete category:', error)
      toast.error('Failed to delete category', { description: getFrappeError(error) })
    }
  }

  const handleBulkDelete = async () => {
    if (selectedNames.length === 0) return

    const confirmed = await confirm({
      title: 'Force Delete Multiple Categories',
      description: `Are you sure you want to delete ${selectedNames.length} selected categories? This will bypass constraints and delete items even if they are linked to products. This action cannot be undone.`,
      variant: 'destructive',
      confirmText: `Force Delete ${selectedNames.length} Items`,
      cancelText: 'Cancel'
    })

    if (!confirmed) return

    setIsDeleting(true)
    try {
      const result = await bulkDelete({
        doctype: 'Menu Category',
        names: selectedNames,
        force: true
      })

      if (result.success) {
        if (result.deleted_count > 0) {
          toast.success(`Successfully deleted ${result.deleted_count} categories`)
        }
        if (result.errors && result.errors.length > 0) {
          toast.error('Some categories could not be deleted', {
            description: result.errors.join('\n')
          })
        }
        setSelectedNames([])
        mutate()
      } else {
        throw new Error(result.error || 'Bulk delete failed')
      }
    } catch (error: any) {
      console.error('Failed to bulk delete categories:', error)
      toast.error('Failed to bulk delete categories', { description: getFrappeError(error) })
    } finally {
      setIsDeleting(false)
    }
  }

  const toggleSelectAll = () => {
    if (selectedNames.length === categories?.length) {
      setSelectedNames([])
    } else {
      setSelectedNames(categories?.map((c: any) => c.name) || [])
    }
  }

  const toggleSelectRow = (name: string) => {
    setSelectedNames(prev => 
      prev.includes(name) 
        ? prev.filter(n => n !== name) 
        : [...prev, name]
    )
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
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {selectedNames.length > 0 && (
            <Button 
              variant="destructive" 
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="w-full sm:w-auto shadow-sm"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected ({selectedNames.length})
            </Button>
          )}
          <Button asChild className="w-full sm:w-auto shadow-sm">
            <Link to="/categories/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Link>
          </Button>
        </div>
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
                      <TableHead className="w-[50px]">
                        <Checkbox 
                          checked={selectedNames.length > 0 && selectedNames.length === categories?.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
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
                      <TableRow key={category.name} className={selectedNames.includes(category.name) ? 'bg-muted/50' : ''}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedNames.includes(category.name)}
                            onCheckedChange={() => toggleSelectRow(category.name)}
                          />
                        </TableCell>
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












