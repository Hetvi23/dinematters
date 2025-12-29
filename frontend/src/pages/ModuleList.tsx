import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useFrappeGetDocList } from '@/lib/frappe'
import { usePermissions } from '@/lib/permissions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Eye, Plus, Edit, Trash2 } from 'lucide-react'
import DynamicForm from '@/components/DynamicForm'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useFrappePostCall } from '@/lib/frappe'
import { useConfirm } from '@/hooks/useConfirm'
import { useRestaurant } from '@/contexts/RestaurantContext'

export default function ModuleList() {
  const { confirm, ConfirmDialogComponent } = useConfirm()
  const { doctype } = useParams<{ doctype: string }>()
  const { selectedRestaurant } = useRestaurant()
  const { permissions } = usePermissions(doctype || '')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Restaurant-based doctypes that should be filtered by selected restaurant
  const restaurantBasedDoctypes = [
    'Menu Product', 'Menu Category', 'Order', 'Cart Entry',
    'Coupon', 'Offer', 'Event', 'Game', 'Table Booking',
    'Banquet Booking', 'Restaurant Config', 'Home Feature', 'Legacy Content'
  ]

  // Determine if this doctype should be filtered by restaurant
  const shouldFilterByRestaurant = doctype && restaurantBasedDoctypes.includes(doctype)
  
  // Build filters
  const filters = shouldFilterByRestaurant && selectedRestaurant
    ? { restaurant: selectedRestaurant }
    : undefined

  const { data: docs, isLoading } = useFrappeGetDocList(doctype || '', {
    fields: ['name', 'creation', 'modified'],
    filters,
    limit: 100,
    orderBy: { field: 'modified', order: 'desc' }
  }, {
    refresh: refreshKey,
    key: selectedRestaurant ? `${doctype}-${selectedRestaurant}-${refreshKey}` : `${doctype}-${refreshKey}`
  })

  const { call: deleteDoc } = useFrappePostCall('frappe.client.delete')

  const handleDelete = async (docname: string) => {
    const confirmed = await confirm({
      title: 'Delete Record',
      description: `Are you sure you want to delete this ${doctype}? This action cannot be undone.`,
      variant: 'destructive',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    })

    if (!confirmed) return

    try {
      await deleteDoc({
        doctype: doctype || '',
        name: docname
      })
      toast.success(`${doctype} deleted successfully`)
      setRefreshKey(prev => prev + 1)
    } catch (error: any) {
      toast.error(error?.message || `Failed to delete ${doctype}`)
    }
  }

  if (!doctype) {
    return <div>Invalid module</div>
  }

  // Get title field from first doc or use 'name'
  const titleField = docs?.[0] ? Object.keys(docs[0]).find(k => 
    k !== 'name' && k !== 'creation' && k !== 'modified' && k !== 'owner'
  ) || 'name' : 'name'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight capitalize">
            {doctype.replace(/_/g, ' ')}
          </h2>
          <p className="text-muted-foreground">
            Manage all {doctype.replace(/_/g, ' ')} records
          </p>
        </div>
        {permissions.create && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create New
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Records</CardTitle>
          <CardDescription>
            {permissions.read 
              ? 'View and manage records (filtered by your permissions)'
              : 'You do not have permission to view these records'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!permissions.read ? (
            <div className="text-center py-8 text-muted-foreground">
              You do not have permission to view {doctype}
            </div>
          ) : isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : docs && docs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Modified</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((doc: any) => (
                  <TableRow key={doc.name}>
                    <TableCell className="font-medium">
                      {doc[titleField] || doc.name}
                    </TableCell>
                    <TableCell>
                      {doc.creation ? new Date(doc.creation).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {doc.modified ? new Date(doc.modified).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link to={`/${doctype}/${doc.name}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {permissions.write && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedDoc(doc.name)
                              setShowEditDialog(true)
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {permissions.delete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(doc.name)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No records found
            </div>
          )}
        </CardContent>
      </Card>

      {showCreateDialog && (
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create {doctype}</DialogTitle>
            </DialogHeader>
            <DynamicForm
              doctype={doctype}
              mode="create"
              initialData={shouldFilterByRestaurant && selectedRestaurant
                ? { restaurant: selectedRestaurant }
                : {}}
              onSave={(data) => {
                setShowCreateDialog(false)
                setRefreshKey(prev => prev + 1)
                toast.success(`${doctype} created successfully`)
              }}
              onCancel={() => setShowCreateDialog(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {showEditDialog && selectedDoc && (
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit {doctype}</DialogTitle>
            </DialogHeader>
            <DynamicForm
              doctype={doctype}
              docname={selectedDoc}
              mode="edit"
              onSave={(data) => {
                setShowEditDialog(false)
                setSelectedDoc(null)
                setRefreshKey(prev => prev + 1)
                toast.success(`${doctype} updated successfully`)
              }}
              onCancel={() => {
                setShowEditDialog(false)
                setSelectedDoc(null)
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

