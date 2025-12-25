import { useFrappeGetDocList } from '@/lib/frappe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, User, Shield, UserCheck } from 'lucide-react'
import DynamicForm from './DynamicForm'
import { useState } from 'react'
import { toast } from 'sonner'

interface StaffMembersListProps {
  restaurantId: string
  onAdd?: () => void
}

export default function StaffMembersList({ restaurantId, onAdd }: StaffMembersListProps) {
  const [showAddForm, setShowAddForm] = useState(false)

  const { data: staffMembers, isLoading, mutate } = useFrappeGetDocList(
    'Restaurant User',
    {
      fields: ['name', 'user', 'restaurant', 'role', 'is_default', 'is_active', 'creation'],
      filters: { restaurant: restaurantId },
      orderBy: { field: 'creation', order: 'desc' }
    },
    restaurantId ? `restaurant-users-${restaurantId}` : null
  )

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Loading staff members...</div>
        </CardContent>
      </Card>
    )
  }

  const members = staffMembers || []

  return (
    <div className="space-y-4">
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Staff Members for this Restaurant</CardTitle>
              <CardDescription>
                {members.length} member{members.length !== 1 ? 's' : ''} assigned
              </CardDescription>
            </div>
            {!showAddForm && (
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Staff Member
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No staff members assigned yet.</p>
              <p className="text-sm mt-2">The restaurant owner is automatically created as Restaurant Admin.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.name}>
                    <TableCell className="font-medium">{member.user}</TableCell>
                    <TableCell>
                      <Badge variant={member.role === 'Restaurant Admin' ? 'default' : 'secondary'}>
                        {member.role === 'Restaurant Admin' ? (
                          <Shield className="mr-1 h-3 w-3" />
                        ) : (
                          <User className="mr-1 h-3 w-3" />
                        )}
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.is_active ? 'default' : 'secondary'}>
                        {member.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {member.is_default && (
                        <Badge variant="outline">
                          <UserCheck className="mr-1 h-3 w-3" />
                          Default
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // Navigate to edit
                          window.location.href = `/dinematters/modules/Restaurant User/${member.name}`
                        }}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {showAddForm && (
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Add New Staff Member</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/30 rounded-md p-6 border">
              <DynamicForm
                doctype="Restaurant User"
                mode="create"
                initialData={{ restaurant: restaurantId }}
                onSave={(data) => {
                  setShowAddForm(false)
                  mutate()
                  toast.success('Staff member added successfully')
                  onAdd?.()
                }}
                onCancel={() => setShowAddForm(false)}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

