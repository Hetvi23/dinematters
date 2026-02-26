import { useState, useEffect } from 'react'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trash2, Edit, Eye } from 'lucide-react'

export default function HomeFeaturesManager() {
  const { selectedRestaurant, restaurantConfig } = useRestaurant()
  const [features, setFeatures] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    if (restaurantConfig?.homeFeatures) {
      setFeatures(restaurantConfig.homeFeatures)
      return
    }
    if (!selectedRestaurant) return
    setLoading(true)
    fetch(`/api/method/dinematters.dinematters.api.config.get_home_features?restaurant_id=${encodeURIComponent(selectedRestaurant)}`)
      .then(r => r.json())
      .then(j => {
        const payload = j?.message ?? j
        if (payload?.success) setFeatures(payload.data.features || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [restaurantConfig, selectedRestaurant])

  const openEdit = (f: any) => {
    setEditing({ ...f, newImageFile: null })
  }

  const handleDelete = async (name: string) => {
    if (!confirm('Delete this feature?')) return
    try {
      const csrf = (window as any).frappe?.csrf_token || (window as any).csrf_token
      const resp = await fetch('/api/method/dinematters.dinematters.api.documents.delete_doc', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Frappe-CSRF-Token': csrf
        },
        body: JSON.stringify({ doctype: 'Home Feature', name })
      })
      const j = await resp.json()
      if (j?.message || j?.success) {
        setFeatures(prev => prev.filter(f => f.name !== name))
      } else {
        throw new Error(JSON.stringify(j))
      }
    } catch (e: any) {
      alert('Delete failed: ' + (e.message || e))
    }
  }

  const uploadFile = async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    form.append('is_private', '0')
    form.append('folder', 'Home/Attachments')
    const csrf = (window as any).frappe?.csrf_token || (window as any).csrf_token
    const res = await fetch('/api/method/upload_file', {
      method: 'POST',
      body: form,
      headers: { 'X-Frappe-CSRF-Token': csrf }
    })
    if (!res.ok) throw new Error('Upload failed')
    const j = await res.json()
    return j.message?.file_url || j.message?.name
  }

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    try {
      let imageSrc = editing.imageSrc
      if (editing.newImageFile) {
        imageSrc = await uploadFile(editing.newImageFile)
      }

      const docData: any = {
        title: editing.title,
        subtitle: editing.subtitle,
        image_src: imageSrc
      }

      const csrf = (window as any).frappe?.csrf_token || (window as any).csrf_token
      const resp = await fetch('/api/method/dinematters.dinematters.api.documents.update_document', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Frappe-CSRF-Token': csrf
        },
        body: JSON.stringify({
          doctype: 'Home Feature',
          name: editing.name,
          doc_data: docData
        })
      })
      const json = await resp.json()
      if (!json.success && json.error) throw new Error(json.error.message || JSON.stringify(json))
      // update local list
      setFeatures(prev => prev.map(p => p.name === editing.name ? { ...p, title: editing.title, subtitle: editing.subtitle, imageSrc: imageSrc } : p))
      setEditing(null)
    } catch (e: any) {
      console.error('Save failed', e)
      alert('Save failed: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-semibold mb-4">Home Features</h2>
      {!selectedRestaurant && <div className="text-sm text-muted-foreground">Select a restaurant first</div>}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button onClick={() => setViewMode('grid')} variant={viewMode==='grid' ? 'default' : 'ghost'}>Grid</Button>
          <Button onClick={() => setViewMode('list')} variant={viewMode==='list' ? 'default' : 'ghost'}>List</Button>
        </div>
      </div>

      {loading ? <div>Loading…</div> : (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {features.map(f => (
              <div key={f.id || f.name} className="p-4 bg-card rounded shadow-sm">
                {f.imageSrc ? <img src={f.imageSrc} alt={f.title} className="h-36 w-full object-cover rounded mb-2" /> : <div className="h-36 w-full bg-muted rounded mb-2 flex items-center justify-center text-xs">No image</div>}
                <div className="font-semibold">{f.title || f.id}</div>
                <div className="text-xs text-muted-foreground mb-2">{f.subtitle}</div>
                <div className="flex gap-2">
                  <Button onClick={() => openEdit(f)}><Edit className="h-4 w-4" /></Button>
                  <a className="inline-flex items-center px-3 py-1 rounded border text-sm" target="_blank" rel="noreferrer" href={`/app/home-feature/${encodeURIComponent(f.name)}`}><Eye className="h-4 w-4" /></a>
                  <Button variant="destructive" onClick={() => handleDelete(f.name)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-auto bg-card rounded p-4">
            <table className="w-full table-auto">
              <thead>
                <tr className="text-left text-sm text-muted-foreground">
                  <th className="p-2">Feature ID</th>
                  <th className="p-2">Title</th>
                  <th className="p-2">Subtitle</th>
                  <th className="p-2">Image</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {features.map(f => (
                  <tr key={f.id || f.name} className="border-t">
                    <td className="p-2">{f.id}</td>
                    <td className="p-2 font-semibold">{f.title}</td>
                    <td className="p-2 text-xs text-muted-foreground">{f.subtitle}</td>
                    <td className="p-2">{f.imageSrc ? <img src={f.imageSrc} alt={f.title} className="h-12 rounded object-cover" /> : '—'}</td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <Button onClick={() => openEdit(f)}><Edit className="h-4 w-4" /></Button>
                        <a className="inline-flex items-center px-3 py-1 rounded border text-sm" target="_blank" rel="noreferrer" href={`/app/home-feature/${encodeURIComponent(f.name)}`}><Eye className="h-4 w-4" /></a>
                        <Button variant="destructive" onClick={() => handleDelete(f.name)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null) }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Feature</DialogTitle>
            <DialogDescription>
              Update the feature details and image
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input value={editing.title} onChange={(e: any) => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div>
                <Label>Subtitle</Label>
                <Input value={editing.subtitle} onChange={(e: any) => setEditing({ ...editing, subtitle: e.target.value })} />
              </div>
              <div>
                <Label>Image</Label>
                <input type="file" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) setEditing({ ...editing, newImageFile: file })
                }} />
                {editing.imageSrc && <img src={editing.imageSrc} alt="preview" className="h-24 mt-2 rounded object-cover" />}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

