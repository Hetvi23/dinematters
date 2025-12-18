import { Link } from 'react-router-dom'
import { useFrappeGetDocList } from '@/lib/frappe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Eye } from 'lucide-react'

export default function Products() {
  const { data: products, isLoading } = useFrappeGetDocList('Menu Product', {
    fields: ['name', 'product_id', 'product_name', 'price', 'original_price', 'category_name', 'is_active', 'restaurant'],
    limit: 100,
    orderBy: { field: 'product_name', order: 'asc' }
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Products</h2>
        <p className="text-muted-foreground">
          View and manage menu products (filtered by your restaurant permissions)
        </p>
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
                  <TableHead>Product ID</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Original Price</TableHead>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product: any) => (
                  <TableRow key={product.name}>
                    <TableCell className="font-medium">{product.product_name || product.name}</TableCell>
                    <TableCell className="font-mono text-xs">{product.product_id || product.name}</TableCell>
                    <TableCell>{product.category_name || 'N/A'}</TableCell>
                    <TableCell>₹{product.price || 0}</TableCell>
                    <TableCell>
                      {product.original_price ? `₹${product.original_price}` : '-'}
                    </TableCell>
                    <TableCell>{product.restaurant || 'N/A'}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        product.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Link to={`/products/${product.name}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
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










