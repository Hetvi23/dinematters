import { Link } from 'react-router-dom'
import { useFrappeGetDocList, useFrappeDeleteDoc } from '@/lib/frappe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Eye, Pencil, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'

export default function Categories() {
  const { data: categories, isLoading, mutate } = useFrappeGetDocList('Menu Category', {
    fields: ['name', 'category_name', 'description', 'display_order'],
    limit: 100,
    orderBy: { field: 'display_order', order: 'asc' }
  })

  const { deleteDoc } = useFrappeDeleteDoc()

  const handleDelete = async (categoryId: string, categoryName: string) => {
    if (!confirm(`Are you sure you want to delete "${categoryName}"?`)) {
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
          <h2 className="text-xl sm:text-2xl font-semibold text-[#323130] tracking-tight">Categories</h2>
          <p className="text-[#605e5c] text-sm mt-1">
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
          <CardTitle>All Categories</CardTitle>
          <CardDescription>
            Categories are automatically filtered based on your restaurant access
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-[#605e5c]">Loading categories...</div>
          ) : categories && categories.length > 0 ? (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {categories.map((category: any) => (
                  <div key={category.name} className="p-4 border border-[#edebe9] rounded-md bg-white hover:border-[#c8c6c4] transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-[#323130] truncate">{category.category_name || category.name}</h3>
                        {category.description && (
                          <p className="text-sm text-[#605e5c] mt-1 line-clamp-2">{category.description}</p>
                        )}
                        {category.display_order && (
                          <p className="text-xs text-[#a19f9d] mt-1">Order: {category.display_order}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-3 border-t border-[#edebe9]">
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
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
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
                      <TableHead>Category Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Display Order</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category: any) => (
                      <TableRow key={category.name}>
                        <TableCell className="font-medium">{category.category_name || category.name}</TableCell>
                        <TableCell className="text-[#605e5c]">
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
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
            <div className="text-center py-12 text-[#605e5c]">
              <p className="text-sm">No categories found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}












