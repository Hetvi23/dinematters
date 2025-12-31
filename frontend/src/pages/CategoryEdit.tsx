import { useParams, Link, useNavigate } from 'react-router-dom'
import { useFrappeGetDoc } from '@/lib/frappe'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import DynamicForm from '@/components/DynamicForm'

export default function CategoryEdit() {
  const { categoryId } = useParams<{ categoryId: string }>()
  const navigate = useNavigate()
  const { data: category, isLoading } = useFrappeGetDoc('Menu Category', categoryId || '', {
    fields: ['*']
  })

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

  const handleSave = (data: any) => {
    toast.success('Category updated successfully')
    navigate('/categories')
  }

  const handleCancel = () => {
    navigate('/categories')
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

      <DynamicForm
        doctype="Menu Category"
        docname={categoryId}
        mode="edit"
        onSave={handleSave}
        onCancel={handleCancel}
        hideFields={['company', 'subdomain']}
        readOnlyFields={['restaurant']}
      />
    </div>
  )
}
