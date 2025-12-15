import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ExtractedDish {
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
}

interface ExtractedDishesTableProps {
  dishes: ExtractedDish[]
}

export default function ExtractedDishesTable({ dishes }: ExtractedDishesTableProps) {
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
        <CardTitle>Extracted Dishes</CardTitle>
        <CardDescription>
          {dishes.length} dish{dishes.length !== 1 ? 'es' : ''} extracted from menu images
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dish Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dishes.map((dish, index) => {
                const dishName = dish?.dish_name || dish?.product_name || 'N/A'
                const category = dish?.category || null
                const price = dish?.price ? Number(dish.price) : null
                const description = dish?.description || '-'
                const calories = dish?.calories
                const isVegetarian = dish?.is_vegetarian
                const estimatedTime = dish?.estimated_time
                const servingSize = dish?.serving_size
                
                return (
                  <TableRow key={dish?.dish_id || `dish-${index}`}>
                    <TableCell className="font-medium">
                      {String(dishName)}
                    </TableCell>
                    <TableCell>
                      {category ? (
                        <Badge variant="secondary">{String(category)}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {price !== null ? `$${price.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate text-sm text-muted-foreground">
                        {String(description)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                        {calories && <span>Calories: {Number(calories)}</span>}
                        {isVegetarian && (
                          <Badge variant="outline" className="w-fit">Vegetarian</Badge>
                        )}
                        {estimatedTime && <span>Time: {Number(estimatedTime)} min</span>}
                        {servingSize && <span>Size: {String(servingSize)}</span>}
                      </div>
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

