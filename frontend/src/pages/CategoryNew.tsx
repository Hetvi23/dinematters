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

export default function CategoryNew() {
  const navigate = useNavigate()
  const { call, loading } = useFrappePostCall('frappe.client.insert')

  const [formData, setFormData] = useState({
    category_name: '',
    description: '',
    display_order: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.category_name) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      await call({
        doc: {
          doctype: 'Menu Category',
          category_name: formData.category_name,
          description: formData.description,
          display_order: formData.display_order ? parseInt(formData.display_order) : null
        }
      })
      
      toast.success('Category created successfully')
      navigate('/categories')
    } catch (error: any) {
      console.error('Failed to create category:', error)
      toast.error(error?.message || 'Failed to create category')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/categories">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Add New Category</h2>
          <p className="text-muted-foreground">Create a new category for your menu</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Category Details</CardTitle>
            <CardDescription>Enter the information for the new category</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category_name">
                Category Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="category_name"
                value={formData.category_name}
                onChange={(e) => setFormData({ ...formData, category_name: e.target.value })}
                placeholder="Enter category name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter category description"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_order">Display Order</Label>
              <Input
                id="display_order"
                type="number"
                min="0"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Categories with lower numbers appear first
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading}>
                <Plus className="h-4 w-4 mr-2" />
                {loading ? 'Creating...' : 'Create Category'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/categories')}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}

