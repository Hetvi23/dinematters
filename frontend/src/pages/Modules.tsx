import { Link } from 'react-router-dom'
import { useFrappeGetCall } from '@/lib/frappe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { usePermissions } from '@/lib/permissions'
import { Loader2 } from 'lucide-react'

export default function Modules() {
  const { data, isLoading } = useFrappeGetCall<{ message: Record<string, Array<{ name: string; label: string }>> }>(
    'dinematters.dinematters.api.ui.get_all_doctypes',
    {},
    'all-doctypes'
  )

  const categories = data?.message || {}

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">All Modules</h2>
        <p className="text-muted-foreground">
          Access all dinematters modules. Permissions are automatically enforced.
        </p>
      </div>

      {Object.entries(categories).map(([category, doctypes]) => {
        const doctypeArray = Array.isArray(doctypes) ? doctypes : []
        if (doctypeArray.length === 0) return null
        
        return (
          <div key={category} className="space-y-4">
            <h3 className="text-xl font-semibold">{category}</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {doctypeArray.map((doctype) => (
                <ModuleCard key={doctype.name} doctype={doctype.name} label={doctype.label} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ModuleCard({ doctype, label }: { doctype: string; label: string }) {
  const { permissions } = usePermissions(doctype)

  if (!permissions.read) {
    return null // Don't show modules user can't access
  }

  return (
    <Link to={`/${doctype}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
        <CardHeader>
          <CardTitle className="capitalize">{label || doctype.replace(/_/g, ' ')}</CardTitle>
          <CardDescription>
            {permissions.create && permissions.write && 'Create, Edit, View'}
            {!permissions.create && permissions.write && 'Edit, View'}
            {!permissions.write && 'View Only'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {permissions.create && (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Create</span>
            )}
            {permissions.write && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Edit</span>
            )}
            {permissions.read && (
              <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">View</span>
            )}
            {permissions.delete && (
              <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Delete</span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

