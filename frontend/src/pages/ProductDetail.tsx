import { useParams, Link } from 'react-router-dom'
import { useFrappeGetDoc } from '@/lib/frappe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function ProductDetail() {
  const { productId } = useParams<{ productId: string }>()
  const { data: product, isLoading } = useFrappeGetDoc('Menu Product', productId || '', {
    fields: ['*']
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8 text-muted-foreground">Loading product details...</div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">Product not found</p>
          <Link to="/products">
            <Button>Back to Products</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/products">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{product.product_name || product.name}</h2>
          <p className="text-muted-foreground">
            {product.product_id || product.name}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Product Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Product ID</p>
              <p className="font-mono text-sm">{product.product_id || product.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Category</p>
              <p className="font-medium">{product.category_name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Restaurant</p>
              <p className="font-medium">{product.restaurant || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                product.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {product.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            {product.description && (
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p>{product.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Current Price</p>
              <p className="text-2xl font-bold">₹{product.price || 0}</p>
            </div>
            {product.original_price && product.original_price > product.price && (
              <div>
                <p className="text-sm text-muted-foreground">Original Price</p>
                <p className="text-lg line-through text-muted-foreground">₹{product.original_price}</p>
                <p className="text-sm text-green-600">
                  Save ₹{product.original_price - product.price}
                </p>
              </div>
            )}
            {product.is_vegetarian !== undefined && (
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <p className="font-medium">{product.is_vegetarian ? 'Vegetarian' : 'Non-Vegetarian'}</p>
              </div>
            )}
            {product.calories && (
              <div>
                <p className="text-sm text-muted-foreground">Calories</p>
                <p className="font-medium">{product.calories} kcal</p>
              </div>
            )}
            {product.serving_size && (
              <div>
                <p className="text-sm text-muted-foreground">Serving Size</p>
                <p className="font-medium">{product.serving_size}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}












