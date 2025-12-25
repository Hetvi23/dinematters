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
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-[#323130] tracking-tight">Products</h2>
          <p className="text-[#605e5c] text-sm mt-1">
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
          <CardTitle>All Products</CardTitle>
          <CardDescription>
            Products are automatically filtered based on your restaurant access
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-[#605e5c]">Loading products...</div>
          ) : products && products.length > 0 ? (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {products.map((product: any) => (
                  <div key={product.name} className="p-4 border border-[#edebe9] rounded-md bg-white hover:border-[#c8c6c4] transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-[#323130] truncate">{product.product_name || product.name}</h3>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-lg font-semibold text-[#323130]">₹{product.price || 0}</span>
                          {product.original_price && (
                            <span className="text-sm text-[#605e5c] line-through">₹{product.original_price}</span>
                          )}
                        </div>
                      </div>
                      <span className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium border flex-shrink-0 ${
                        product.is_active ? 'bg-[#dff6dd] text-[#107c10] border-[#92c5f7]' : 'bg-[#f3f2f1] text-[#605e5c] border-[#edebe9]'
                      }`}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex gap-2 pt-3 border-t border-[#edebe9]">
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
              <div className="hidden md:block overflow-x-auto">
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
                          <span className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium border ${
                            product.is_active ? 'bg-[#dff6dd] text-[#107c10] border-[#92c5f7]' : 'bg-[#f3f2f1] text-[#605e5c] border-[#edebe9]'
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
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No products found</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}












