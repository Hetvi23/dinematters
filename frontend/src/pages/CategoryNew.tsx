import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useRestaurant } from '@/contexts/RestaurantContext'
import DynamicForm from '@/components/DynamicForm'

export default function CategoryNew() {
  const navigate = useNavigate()
  const { selectedRestaurant } = useRestaurant()

  const handleSave = (data: any) => {
    toast.success('Category created successfully')
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
          <h2 className="text-3xl font-bold tracking-tight">Add New Category</h2>
          <p className="text-muted-foreground">Create a new category for your menu</p>
        </div>
      </div>

      <DynamicForm
        doctype="Menu Category"
        mode="create"
        onSave={handleSave}
        onCancel={handleCancel}
        initialData={selectedRestaurant ? { restaurant: selectedRestaurant } : {}}
        hideFields={['company', 'subdomain']}
        readOnlyFields={selectedRestaurant ? [] : ['restaurant']}
      />
    </div>
  )
}

