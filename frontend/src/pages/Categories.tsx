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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Categories</h2>
          <p className="text-muted-foreground">
            View and manage menu categories (filtered by your restaurant permissions)
          </p>
        </div>
        <Button asChild>
          <Link to="/categories/new">
            <Plus className="h-4 w-4 mr-2" />
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
            <div className="text-center py-8 text-muted-foreground">Loading categories...</div>
          ) : categories && categories.length > 0 ? (
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
          ) : (
            <div className="text-center py-8 text-muted-foreground">No categories found</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}












