import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useFrappeGetDoc, useFrappePostCall } from '@/lib/frappe'
import { usePermissions } from '@/lib/permissions'
import DynamicForm from '@/components/DynamicForm'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Edit, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'

export default function ModuleDetail() {
  const { doctype, docname } = useParams<{ doctype: string; docname: string }>()
  const navigate = useNavigate()
  const { permissions } = usePermissions(doctype || '')
  const { data: doc, isLoading } = useFrappeGetDoc(doctype || '', docname || '')
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const { call: deleteDoc } = useFrappePostCall('frappe.client.delete')

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete this ${doctype}?`)) return

    try {
      await deleteDoc({
        doctype: doctype || '',
        name: docname
      })
      toast.success(`${doctype} deleted successfully`)
      navigate(`/${doctype}`)
    } catch (error: any) {
      toast.error(error?.message || `Failed to delete ${doctype}`)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  if (!doc) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground mb-4">
            {doctype} not found
          </p>
          <Link to={`/${doctype}`}>
            <Button>Back to List</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/${doctype}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h2 className="text-3xl font-bold tracking-tight capitalize">
              {doctype?.replace(/_/g, ' ')}: {docname}
            </h2>
          </div>
        </div>
        <div className="flex gap-2">
          {permissions.write && mode === 'view' && (
            <Button onClick={() => setMode('edit')}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
          {permissions.delete && (
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <DynamicForm
        doctype={doctype || ''}
        docname={docname}
        mode={mode}
        onSave={(data) => {
          setMode('view')
          toast.success(`${doctype} updated successfully`)
        }}
        onCancel={() => setMode('view')}
      />
    </div>
  )
}

