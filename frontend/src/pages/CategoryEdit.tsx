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

export default function CategoryEdit() {
  const { categoryId } = useParams<{ categoryId: string }>()
  const navigate = useNavigate()
  const { data: category, isLoading } = useFrappeGetDoc('Menu Category', categoryId || '', {
    fields: ['*']
  })
  const { updateDoc, loading: updating } = useFrappeUpdateDoc()

  const [formData, setFormData] = useState({
    category_name: '',
    description: '',
    display_order: ''
  })

  useEffect(() => {
    if (category) {
      setFormData({
        category_name: category.category_name || '',
        description: category.description || '',
        display_order: category.display_order || ''
      })
    }
  }, [category])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.category_name) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      await updateDoc('Menu Category', categoryId || '', {
        category_name: formData.category_name,
        description: formData.description,
        display_order: formData.display_order ? parseInt(formData.display_order.toString()) : null
      })
      
      toast.success('Category updated successfully')
      navigate('/categories')
    } catch (error: any) {
      console.error('Failed to update category:', error)
      toast.error(error?.message || 'Failed to update category')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8 text-muted-foreground">Loading category...</div>
      </div>
    )
  }

  if (!category) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">Category not found</p>
          <Link to="/categories">
            <Button>Back to Categories</Button>
          </Link>
        </div>
      </div>
    )
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
          <h2 className="text-3xl font-bold tracking-tight">Edit Category</h2>
          <p className="text-muted-foreground">{category.category_name || category.name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Category Details</CardTitle>
            <CardDescription>Update the category information below</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category_name">
                Category Name <span className="text-red-500">*</span>
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
              <Button type="submit" disabled={updating}>
                <Save className="h-4 w-4 mr-2" />
                {updating ? 'Saving...' : 'Save Changes'}
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

