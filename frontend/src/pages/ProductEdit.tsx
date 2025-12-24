import { useParams, Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useFrappeGetDoc, useFrappeUpdateDoc } from '@/lib/frappe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Save } from 'lucide-react'
import { toast } from 'sonner'

export default function ProductEdit() {
  const { productId } = useParams<{ productId: string }>()
  const navigate = useNavigate()
  const { data: product, isLoading } = useFrappeGetDoc('Menu Product', productId || '', {
    fields: ['*']
  })
  const { updateDoc, loading: updating } = useFrappeUpdateDoc()

  const [formData, setFormData] = useState({
    product_name: '',
    price: '',
    original_price: '',
    description: '',
    is_active: true
  })

  useEffect(() => {
    if (product) {
      setFormData({
        product_name: product.product_name || '',
        price: product.price || '',
        original_price: product.original_price || '',
        description: product.description || '',
        is_active: product.is_active !== undefined ? product.is_active : true
      })
    }
  }, [product])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.product_name || !formData.price) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      await updateDoc('Menu Product', productId || '', {
        product_name: formData.product_name,
        price: parseFloat(formData.price.toString()),
        original_price: formData.original_price ? parseFloat(formData.original_price.toString()) : null,
        description: formData.description,
        is_active: formData.is_active
      })
      
      toast.success('Product updated successfully')
      navigate('/products')
    } catch (error: any) {
      console.error('Failed to update product:', error)
      toast.error(error?.message || 'Failed to update product')
    }
  }

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

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
            <CardDescription>Update the product information below</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="product_name">
                Product Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="product_name"
                value={formData.product_name}
                onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                placeholder="Enter product name"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">
                  Price (₹) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="original_price">Original Price (₹)</Label>
                <Input
                  id="original_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.original_price}
                  onChange={(e) => setFormData({ ...formData, original_price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter product description"
                rows={4}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="is_active" className="font-normal">
                Product is active
              </Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={updating}>
                <Save className="h-4 w-4 mr-2" />
                {updating ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/products')}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}

