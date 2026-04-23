import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useRestaurant } from '@/contexts/RestaurantContext'
import DynamicForm from '@/components/DynamicForm'

export default function ProductNew() {
  const navigate = useNavigate()
  const { selectedRestaurant } = useRestaurant()

  const handleSave = () => {
    navigate('/products')
  }

  const handleCancel = () => {
    navigate('/products')
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

      <DynamicForm
        doctype="Menu Product"
        mode="create"
        initialData={{
          restaurant: selectedRestaurant,
          is_active: 1
        }}
        onSave={handleSave}
        onCancel={handleCancel}
        hideFields={['restaurant_id', 'company', 'subdomain', 'category_name', 'main_category']}
        readOnlyFields={['restaurant']}
      />
    </div>
  )
}
