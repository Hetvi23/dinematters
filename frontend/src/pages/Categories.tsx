import { Link } from 'react-router-dom'
import { useState, useMemo } from 'react'
import { useFrappeGetDocList, useFrappeDeleteDoc } from '@/lib/frappe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Eye, Pencil, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/hooks/useConfirm'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { ListFilters, FilterCondition } from '@/components/ListFilters'

export default function Categories() {
  const { confirm, ConfirmDialogComponent } = useConfirm()
  const { selectedRestaurant } = useRestaurant()
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<FilterCondition[]>([])
  
  const { data: categories, isLoading, mutate } = useFrappeGetDocList('Menu Category', {
    fields: ['name', 'category_id', 'category_name', 'display_name', 'description', 'display_order', 'is_special'],
    filters: selectedRestaurant ? { restaurant: selectedRestaurant } : undefined,
    limit: 1000,
    orderBy: { field: 'display_order', order: 'asc' }
  }, selectedRestaurant ? `categories-${selectedRestaurant}` : null)

  const { deleteDoc } = useFrappeDeleteDoc()

  // Apply search and filters
  const filteredCategories = useMemo(() => {
    if (!categories) return []
    
    let filtered = [...categories]
    
    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((category: any) => {
        return (
          (category.category_name || '').toLowerCase().includes(query) ||
          (category.display_name || '').toLowerCase().includes(query) ||
          (category.name || '').toLowerCase().includes(query) ||
          (category.category_id || '').toLowerCase().includes(query) ||
          (category.description || '').toLowerCase().includes(query) ||
          String(category.display_order || '').includes(query)
        )
      })
    }
    
    // Apply filters
    filters.forEach((filter) => {
      // Skip empty filters, but allow false, 0, and empty string as valid values
      if (filter.value === '' || filter.value === null || filter.value === undefined) {
        // For 'is' and 'is not' operators, empty value is valid
        if (filter.operator !== 'is' && filter.operator !== 'is not') {
          return
        }
      }
      
      filtered = filtered.filter((category: any) => {
        const fieldValue = category[filter.fieldname]
        const filterValue = filter.value
        
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
    
    return filtered
  }, [categories, searchQuery, filters])

  const handleDelete = async (categoryId: string, categoryName: string) => {
    const confirmed = await confirm({
      title: 'Delete Category',
      description: `Are you sure you want to delete "${categoryName}"? This action cannot be undone.`,
      variant: 'destructive',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    })

    if (!confirmed) {
      return
    }

    try {
      await deleteDoc('Menu Category', categoryId)
      toast.success('Category deleted successfully')
      mutate()
    } catch (error: any) {
      console.error('Failed to delete category:', error)
      toast.error(error?.message || 'Failed to delete category')
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">Categories</h2>
          <p className="text-muted-foreground text-sm mt-1">
            View and manage menu categories (filtered by your restaurant permissions)
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link to="/categories/new">
            <Plus className="h-4 w-4" />
            Add Category
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>All Categories</CardTitle>
              <CardDescription>
                Categories are automatically filtered based on your restaurant access
                {filteredCategories.length !== categories?.length && (
                  <span className="ml-2">
                    (Showing {filteredCategories.length} of {categories?.length || 0})
                  </span>
                )}
              </CardDescription>
            </div>
            <ListFilters
              doctype="Menu Category"
              filters={filters}
              onFiltersChange={setFilters}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search categories..."
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading categories...</div>
          ) : filteredCategories && filteredCategories.length > 0 ? (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {filteredCategories.map((category: any, index: number) => (
                  <div key={category.name} className="p-4 border border-border rounded-md bg-card hover:border-border/80 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground">#{index + 1}</span>
                          <h3 className="font-semibold text-foreground truncate">{category.category_name || category.name}</h3>
                        </div>
                        {category.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{category.description}</p>
                        )}
                        {category.display_order && (
                          <p className="text-xs text-muted-foreground/70 mt-1">Order: {category.display_order}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-3 border-t border-border">
                      <Link to={`/categories/${category.name}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                      </Link>
                      <Link to={`/categories/${category.name}/edit`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </Link>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDelete(category.name, category.category_name || category.name)}
                        className="text-destructive hover:text-destructive/80 hover:bg-destructive/10 border-destructive/20 dark:border-destructive/30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Sr. No.</TableHead>
                  <TableHead>Category Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Display Order</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCategories.map((category: any, index: number) => (
                  <TableRow key={category.name}>
                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-medium">{category.category_name || category.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                      {category.description || '-'}
                    </TableCell>
                    <TableCell>{category.display_order || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Link to={`/categories/${category.name}`}>
                          <Button variant="ghost" size="sm" title="View">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link to={`/categories/${category.name}/edit`}>
                          <Button variant="ghost" size="sm" title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          title="Delete"
                          onClick={() => handleDelete(category.name, category.category_name || category.name)}
                          className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
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
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No categories found</p>
            </div>
          )}
        </CardContent>
          </Card>
          {ConfirmDialogComponent}
        </div>
      )
    }












