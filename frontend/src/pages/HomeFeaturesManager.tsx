import { useState, useEffect, useCallback } from 'react'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trash2, Edit, Eye } from 'lucide-react'
import { uploadToR2 } from '@/lib/r2Upload'

export default function HomeFeaturesManager() {
  const { selectedRestaurant, restaurantConfig, isLite } = useRestaurant()
  const [features, setFeatures] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Filter features based on membership tier
  const filteredFeatures = isLite 
    ? features.filter(f => f.id === 'menu' || f.id === 'legacy') 
    : features.filter(f => {
        // Shared features for PRO and LUX
        const sharedFeatures = ['menu', 'legacy', 'dine-play', 'offers-events', 'book-table']
        return sharedFeatures.includes(f.id)
      })

  const fetchFeatures = useCallback(async () => {
    if (!selectedRestaurant) return
    setLoading(true)
    try {
      const response = await fetch(
        `/api/method/dinematters.dinematters.api.config.get_home_features?restaurant_id=${encodeURIComponent(selectedRestaurant)}`
      )
      const json = await response.json()
      const payload = json?.message ?? json
      if (payload?.success) {
        setFeatures(payload.data.features || [])
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [selectedRestaurant])

  useEffect(() => {
    if (restaurantConfig?.homeFeatures) {
      setFeatures(restaurantConfig.homeFeatures)
      return
    }
    fetchFeatures()
  }, [restaurantConfig, fetchFeatures])

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
    if (!editing?.name) throw new Error('Missing Home Feature id')

    return await uploadToR2({
      ownerDoctype: 'Home Feature',
      ownerName: editing.name,
      mediaRole: 'home_feature_image',
      file,
    })
  }

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const docData: any = {
        title: editing.title,
        subtitle: editing.subtitle,
      }

      let imageUrl = editing.imageSrc

      // If there's a new image file, upload it first
      if (editing.newImageFile) {
        console.log('Starting CDN upload for file:', editing.newImageFile.name)
        console.log('File details:', {
          name: editing.newImageFile.name,
          size: editing.newImageFile.size,
          type: editing.newImageFile.type
        })
        
        try {
          // Try CDN upload first
          const uploadResult: any = await uploadFile(editing.newImageFile)
          
          // Add this debug to see if the issue is with the await
          
          if (uploadResult && typeof uploadResult === 'object') {
          }
          
          if (uploadResult && uploadResult.primary_url) {
            imageUrl = uploadResult.primary_url
            docData.image_src = imageUrl
          } else {
            console.error('CDN upload failed - no primary_url:', uploadResult)
            console.error('Expected primary_url in result but got:', uploadResult)
            throw new Error('Upload failed: No URL returned')
          }
        } catch (uploadError: any) {
          console.error('CDN upload failed:', uploadError)
          console.error('Upload error details:', {
            message: uploadError.message,
            stack: uploadError.stack,
            name: uploadError.name,
            toString: uploadError.toString()
          })
          
          // Check if it's a network error
          if (uploadError.name === 'TypeError' && uploadError.message.includes('fetch')) {
            console.error('This appears to be a network error - check CORS or connectivity')
          }
          
          // Fallback to regular Frappe upload
          try {
            const formData = new FormData()
            formData.append('file', editing.newImageFile)
            formData.append('doctype', 'Home Feature')
            formData.append('docname', editing.name)
            formData.append('fieldname', 'image_src')
            
            const csrf = (window as any).frappe?.csrf_token || (window as any).csrf_token
            const uploadResponse = await fetch('/api/method/upload_file', {
              method: 'POST',
              body: formData,
              headers: {
                'X-Frappe-CSRF-Token': csrf
              }
            })
            
            
            if (uploadResponse.ok) {
              const uploadResult = await uploadResponse.json()
              
              if (uploadResult.message && uploadResult.message.file_url) {
                imageUrl = uploadResult.message.file_url
                docData.image_src = imageUrl
              } else {
                console.error('Fallback upload failed - no file URL:', uploadResult)
                throw new Error('Fallback upload failed: No file URL returned')
              }
            } else {
              const errorText = await uploadResponse.text()
              console.error('Fallback upload HTTP error:', errorText)
              throw new Error('Fallback upload failed: ' + uploadResponse.statusText)
            }
          } catch (fallbackError: any) {
            console.error('Fallback upload also failed:', fallbackError)
            throw new Error('Failed to upload image: Both CDN and regular upload failed')
          }
        }
      } else if (editing.imageSrc) {
        docData.image_src = editing.imageSrc
      }

      const csrf = (window as any).frappe?.csrf_token || (window as any).csrf_token
      const updateDocPromise = fetch('/api/method/dinematters.dinematters.api.documents.update_document', {
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
      }).then(resp => resp.json())

      const [json] = await Promise.all([updateDocPromise])

      if (!json.success && json.error) throw new Error(json.error.message || JSON.stringify(json))

      // After updating the document, also trigger Media Asset sync
      if (imageUrl && imageUrl !== editing.imageSrc) {
        try {
          const syncResponse = await fetch('/api/method/dinematters.dinematters.doctype.home_feature.home_feature.update_media_assets_from_ui', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'X-Frappe-CSRF-Token': csrf
            },
            body: JSON.stringify({
              home_feature_name: editing.name,
              image_src: imageUrl
            })
          })
          
          const syncResult = await syncResponse.json()
          if (syncResult.message?.success) {
          }
        } catch (syncError) {
          console.error('Failed to sync Media Assets:', syncError)
        }
      }

      setFeatures(prev => prev.map(p => p.name === editing.name ? {
        ...p,
        title: editing.title,
        subtitle: editing.subtitle,
        imageSrc: imageUrl
      } : p))
      setEditing(null)
      await fetchFeatures()
    } catch (e: any) {
      console.error('Save failed', e)
      alert('Save failed: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-semibold mb-4">
        Home Features 
        {isLite && <span className="ml-2 text-sm text-muted-foreground">(Lite Plan - Limited Features)</span>}
      </h2>
      {!selectedRestaurant && <div className="text-sm text-muted-foreground">Select a restaurant first</div>}
      
      {isLite && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Lite Plan:</strong> Only "Explore our Menu" and "The Place & Legacy" features are available. 
            Upgrade to <strong>Pro</strong> or <strong>Lux</strong> to unlock engagement features like Dine & Play and Events.
          </p>
        </div>
      )}
      
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button onClick={() => setViewMode('grid')} variant={viewMode==='grid' ? 'default' : 'ghost'}>Grid</Button>
          <Button onClick={() => setViewMode('list')} variant={viewMode==='list' ? 'default' : 'ghost'}>List</Button>
        </div>
        <div className="text-sm text-muted-foreground">
          {filteredFeatures.length} feature{filteredFeatures.length !== 1 ? 's' : ''} shown
        </div>
      </div>

      {loading ? <div>Loading…</div> : (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredFeatures.map(f => (
              <div key={f.id || f.name} className="p-4 bg-card rounded shadow-sm">
                {f.imageSrc ? <img src={f.imageSrc} alt={f.title} className="h-36 w-full object-cover rounded mb-2" /> : <div className="h-36 w-full bg-muted rounded mb-2 flex items-center justify-center text-xs">No image</div>}
                <div className="font-semibold">{f.title || f.id}</div>
                <div className="text-xs text-muted-foreground mb-2">{f.subtitle}</div>
                <div className="flex gap-2">
                  <Button onClick={() => openEdit(f)}><Edit className="h-4 w-4" /></Button>
                  <a className="inline-flex items-center px-3 py-1 rounded border text-sm" target="_blank" rel="noreferrer" href={`/app/home-feature/${encodeURIComponent(f.name)}`}><Eye className="h-4 w-4" /></a>
                  {!isLite && <Button variant="destructive" onClick={() => handleDelete(f.name)}><Trash2 className="h-4 w-4" /></Button>}
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
                {filteredFeatures.map(f => (
                  <tr key={f.id || f.name} className="border-t">
                    <td className="p-2">{f.id}</td>
                    <td className="p-2 font-semibold">{f.title}</td>
                    <td className="p-2 text-xs text-muted-foreground">{f.subtitle}</td>
                    <td className="p-2">{f.imageSrc ? <img src={f.imageSrc} alt={f.title} className="h-12 rounded object-cover" /> : '—'}</td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <Button onClick={() => openEdit(f)}><Edit className="h-4 w-4" /></Button>
                        <a className="inline-flex items-center px-3 py-1 rounded border text-sm" target="_blank" rel="noreferrer" href={`/app/home-feature/${encodeURIComponent(f.name)}`}><Eye className="h-4 w-4" /></a>
                        {!isLite && <Button variant="destructive" onClick={() => handleDelete(f.name)}><Trash2 className="h-4 w-4" /></Button>}
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
                {(editing.newImageFile || editing.imageSrc) && (
                  <img
                    src={editing.newImageFile ? URL.createObjectURL(editing.newImageFile) : editing.imageSrc}
                    alt="preview"
                    className="h-24 mt-2 rounded object-cover"
                  />
                )}
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

