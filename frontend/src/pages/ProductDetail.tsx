import { useParams, Link } from 'react-router-dom'
import { useFrappeGetDoc } from '@/lib/frappe'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import DynamicForm from '@/components/DynamicForm'

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

      <DynamicForm
        doctype="Menu Product"
        docname={productId}
        mode="view"
        hideFields={['restaurant_id', 'company', 'subdomain']}
        readOnlyFields={['restaurant']}
      />
    </div>
  )
}












