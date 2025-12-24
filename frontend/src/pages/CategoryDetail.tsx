import { useParams, Link } from 'react-router-dom'
import { useFrappeGetDoc } from '@/lib/frappe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function CategoryDetail() {
  const { categoryId } = useParams<{ categoryId: string }>()
  const { data: category, isLoading } = useFrappeGetDoc('Menu Category', categoryId || '', {
    fields: ['*']
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8 text-muted-foreground">Loading category details...</div>
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
          <h2 className="text-3xl font-bold tracking-tight">{category.category_name || category.name}</h2>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Category Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Category Name</p>
            <p className="font-medium text-lg">{category.category_name || category.name}</p>
          </div>
          {category.description && (
            <div>
              <p className="text-sm text-muted-foreground">Description</p>
              <p>{category.description}</p>
            </div>
          )}
          <div>
            <p className="text-sm text-muted-foreground">Display Order</p>
            <p className="font-medium">{category.display_order || 'Not set'}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

