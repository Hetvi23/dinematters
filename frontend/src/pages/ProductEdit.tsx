import { useParams, Link, useNavigate } from 'react-router-dom'
import { useFrappeGetDoc } from '@/lib/frappe'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import DynamicForm from '@/components/DynamicForm'

export default function ProductEdit() {
  const { productId } = useParams<{ productId: string }>()
  const navigate = useNavigate()
  const { data: product, isLoading } = useFrappeGetDoc('Menu Product', productId || '', {
    fields: ['*']
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8 text-muted-foreground">Loading product...</div>
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

  const handleSave = (data: any) => {
    toast.success('Product updated successfully')
    navigate('/products')
  }

  const handleCancel = () => {
    navigate('/products')
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
          <h2 className="text-3xl font-bold tracking-tight">Edit Product</h2>
          <p className="text-muted-foreground">{product.product_name || product.name}</p>
        </div>
      </div>

      <DynamicForm
        doctype="Menu Product"
        docname={productId}
        mode="edit"
        onSave={handleSave}
        onCancel={handleCancel}
        hideFields={['restaurant_id', 'company', 'subdomain']}
        readOnlyFields={['restaurant']}
      />
    </div>
  )
}

