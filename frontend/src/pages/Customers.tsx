import { useFrappeGetCall } from '@/lib/frappe'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Users, Loader2, CheckCircle, XCircle } from 'lucide-react'

interface RestaurantCustomer {
  id: string
  phone: string | null
  customerName: string
  verifiedAt: string | null
}

interface CustomersResponse {
  message?: {
    success: boolean
    data?: { customers: RestaurantCustomer[] }
  }
}

export default function Customers() {
  const { selectedRestaurant } = useRestaurant()

  const { data, isLoading } = useFrappeGetCall<CustomersResponse>(
    'dinematters.dinematters.api.customers.get_restaurant_customers',
    selectedRestaurant ? { restaurant_id: selectedRestaurant } : undefined,
    selectedRestaurant ? `restaurant-customers-${selectedRestaurant}` : null
  )

  const customers: RestaurantCustomer[] = data?.message?.data?.customers ?? []
  const success = data?.message?.success ?? false

  if (!selectedRestaurant) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">
              Select a restaurant from the dropdown to view customers.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Customers</h1>
        <p className="text-muted-foreground mt-1">
          Customers who have placed orders or bookings at this restaurant
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Restaurant Customers
          </CardTitle>
          <CardDescription>
            Name, phone, and verification status for each customer
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !success ? (
            <p className="text-muted-foreground text-center py-8">
              Unable to load customers. Please try again.
            </p>
          ) : customers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No customers yet. Customers appear here once they place an order or booking.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-center">Verified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.customerName || '—'}
                    </TableCell>
                    <TableCell>{c.phone || '—'}</TableCell>
                    <TableCell className="text-center">
                      {c.verifiedAt ? (
                        <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Yes
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 bg-muted text-muted-foreground">
                          <XCircle className="h-3.5 w-3.5" />
                          No
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
