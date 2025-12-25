import { useState, useEffect } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useFrappePostCall } from '@/lib/frappe'
import { toast } from 'sonner'
import { Save, X } from 'lucide-react'

interface ExtractedDish {
  name?: string
  dish_id?: string
  dish_name?: string
  product_name?: string
  price?: number
  category?: string
  description?: string
  calories?: number
  is_vegetarian?: boolean
  estimated_time?: number
  serving_size?: string
  main_category?: string
  original_price?: number
  has_no_media?: boolean
  media_json?: string
  customizations_json?: string
}

interface EditableExtractedDishesTableProps {
  dishes: ExtractedDish[]
  docname: string
  onUpdate?: () => void
}

export default function EditableExtractedDishesTable({ 
  dishes, 
  docname,
  onUpdate 
}: EditableExtractedDishesTableProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editedDishes, setEditedDishes] = useState<ExtractedDish[]>(dishes || [])
  const [saving, setSaving] = useState(false)

  const { call: updateDoc } = useFrappePostCall('dinematters.dinematters.api.documents.update_document')

  useEffect(() => {
    setEditedDishes(dishes || [])
  }, [dishes])

  const handleEdit = (index: number) => {
    setEditingIndex(index)
  }

  const handleCancel = () => {
    setEditingIndex(null)
    setEditedDishes(dishes || [])
  }

  const handleFieldChange = (index: number, field: string, value: any) => {
    const updated = [...editedDishes]
    updated[index] = { ...updated[index], [field]: value }
    setEditedDishes(updated)
  }

  const handleSave = async (index: number) => {
    setSaving(true)
    try {
      // Update the entire extracted_dishes child table with all dishes
      const updatedDishes = editedDishes.map((dish, idx) => ({
        doctype: 'Extracted Dish',
        dish_id: dish.dish_id || dish.dish_name || `dish-${idx}`,
        dish_name: dish.dish_name || dish.product_name || dish.name || '',
        price: dish.price || 0,
        category: dish.category || '',
        description: dish.description || '',
        calories: dish.calories,
        is_vegetarian: dish.is_vegetarian ? 1 : 0,
        estimated_time: dish.estimated_time,
        serving_size: dish.serving_size,
        main_category: dish.main_category || '',
        original_price: dish.original_price,
        has_no_media: dish.has_no_media ? 1 : 0,
        media_json: dish.media_json || null,
        customizations_json: dish.customizations_json || null
      }))
      
      await updateDoc({
        doctype: 'Menu Image Extractor',
        name: docname,
        doc_data: {
          extracted_dishes: updatedDishes
        }
      })
      
      toast.success('Dish updated successfully')
      setEditingIndex(null)
      onUpdate?.()
    } catch (error: any) {
      const errorMessage = error?.message || error?.data?.message || 'Failed to update dish'
      toast.error(typeof errorMessage === 'string' ? errorMessage : 'Failed to update dish')
      console.error('Error updating dish:', error)
    } finally {
      setSaving(false)
    }
  }

  if (!dishes || dishes.length === 0) {
    return (
      <Card className="border-2">
        <CardHeader>
          <CardTitle>Extracted Dishes</CardTitle>
          <CardDescription>No dishes extracted yet. Start extraction to see results.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle>Extracted Dishes - Review and Edit</CardTitle>
        <CardDescription>
          {dishes.length} dish{dishes.length !== 1 ? 'es' : ''} extracted. Click on a row to edit.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dish Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {editedDishes.map((dish, index) => {
                const isEditing = editingIndex === index
                const dishName = dish?.dish_name || dish?.product_name || dish?.name || 'N/A'
                const category = dish?.category || ''
                const price = dish?.price || 0
                const description = dish?.description || ''

                return (
                  <TableRow key={dish?.dish_id || `dish-${index}`} className={isEditing ? 'bg-muted/50' : ''}>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={dishName}
                          onChange={(e) => handleFieldChange(index, 'dish_name', e.target.value)}
                          className="w-full"
                        />
                      ) : (
                        <span className="font-medium">{String(dishName)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={category}
                          onChange={(e) => handleFieldChange(index, 'category', e.target.value)}
                          className="w-full"
                          placeholder="Category"
                        />
                      ) : (
                        category ? (
                          <Badge variant="secondary">{String(category)}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={price}
                          onChange={(e) => handleFieldChange(index, 'price', parseFloat(e.target.value) || 0)}
                          className="w-full"
                          step="0.01"
                        />
                      ) : (
                        <span>${Number(price).toFixed(2)}</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {isEditing ? (
                        <Textarea
                          value={description}
                          onChange={(e) => handleFieldChange(index, 'description', e.target.value)}
                          className="w-full min-h-[60px]"
                          rows={2}
                        />
                      ) : (
                        <div className="truncate text-sm text-muted-foreground">
                          {String(description)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSave(index)}
                            disabled={saving}
                          >
                            <Save className="h-3 w-3 mr-1" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancel}
                            disabled={saving}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(index)}
                        >
                          Edit
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

