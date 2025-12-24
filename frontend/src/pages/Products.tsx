import { Link } from 'react-router-dom'
import { useFrappeGetDocList, useFrappeDeleteDoc } from '@/lib/frappe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Eye, Pencil, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'

export default function Products() {
  const { data: products, isLoading, mutate } = useFrappeGetDocList('Menu Product', {
    fields: ['name', 'product_name', 'price', 'original_price', 'is_active'],
    limit: 100,
    orderBy: { field: 'product_name', order: 'asc' }
  })

  const { deleteDoc } = useFrappeDeleteDoc()

  const handleDelete = async (productId: string, productName: string) => {
    if (!confirm(`Are you sure you want to delete "${productName}"?`)) {
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Products</h2>
          <p className="text-muted-foreground">
            View and manage menu products (filtered by your restaurant permissions)
          </p>
        </div>
        <Button asChild>
          <Link to="/products/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Products</CardTitle>
          <CardDescription>
            Products are automatically filtered based on your restaurant access
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading products...</div>
          ) : products && products.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Original Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product: any) => (
                  <TableRow key={product.name}>
                    <TableCell className="font-medium">{product.product_name || product.name}</TableCell>
                    <TableCell>₹{product.price || 0}</TableCell>
                    <TableCell>
                      {product.original_price ? `₹${product.original_price}` : '-'}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        product.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Link to={`/products/${product.name}`}>
                          <Button variant="ghost" size="sm" title="View">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link to={`/products/${product.name}/edit`}>
                          <Button variant="ghost" size="sm" title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          title="Delete"
                          onClick={() => handleDelete(product.name, product.product_name || product.name)}
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
            <div className="text-center py-8 text-muted-foreground">No products found</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}












