import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useFrappePostCall } from '@/lib/frappe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { useCurrency } from '@/hooks/useCurrency'

export default function ProductNew() {
  const navigate = useNavigate()
  const { selectedRestaurant } = useRestaurant()
  const { symbol } = useCurrency()
  const { call, loading } = useFrappePostCall('frappe.client.insert')

  const [formData, setFormData] = useState({
    product_name: '',
    price: '',
    original_price: '',
    description: '',
    is_active: true
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.product_name || !formData.price) {
      toast.error('Please fill in all required fields')
      return
    }

    if (!selectedRestaurant) {
      toast.error('Please select a restaurant first')
      return
    }

    try {
      await call({
        doc: {
          doctype: 'Menu Product',
          restaurant: selectedRestaurant,
          product_name: formData.product_name,
          price: parseFloat(formData.price),
          original_price: formData.original_price ? parseFloat(formData.original_price) : null,
          description: formData.description,
          is_active: formData.is_active
        }
      })
      
      toast.success('Product created successfully')
      navigate('/products')
    } catch (error: any) {
      console.error('Failed to create product:', error)
      toast.error(error?.message || 'Failed to create product')
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Link to="/products">
          <Button variant="ghost" size="sm" className="w-full sm:w-auto">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Add New Product</h2>
          <p className="text-muted-foreground text-sm sm:text-base">Create a new product for your menu</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
            <CardDescription>Enter the information for the new product</CardDescription>
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
                  Price ({symbol}) <span className="text-red-500">*</span>
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
                <Label htmlFor="original_price">Original Price ({symbol})</Label>
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

            <div className="flex flex-col sm:flex-row gap-2 pt-4">
              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                {loading ? 'Creating...' : 'Create Product'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/products')} className="w-full sm:w-auto">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}

