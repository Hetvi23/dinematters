import { useState } from 'react'
import { useFrappeGetDoc, useFrappeGetDocList, useFrappePostCall, useFrappeUpdateDoc, useFrappeDeleteDoc } from '@/lib/frappe'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Edit2, Trash2, Users, Star, Camera, Instagram } from 'lucide-react'
import { toast } from 'sonner'
import { useRestaurant } from '@/contexts/RestaurantContext'

export default function LegacyContentPage() {
  const { selectedRestaurant } = useRestaurant()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)

  // Get the main legacy content document
  const { data: legacyContent, isLoading: contentLoading } = useFrappeGetDoc(
    'Legacy Content',
    selectedRestaurant || '',
    { enabled: !!selectedRestaurant }
  )

  // Get child table data
  const { data: signatureDishes } = useFrappeGetDocList('Legacy Signature Dish', {
    filters: [['parent', '=', selectedRestaurant]],
    fields: ['name', 'dish', 'display_order', 'dish_name'],
    orderBy: { field: 'display_order', order: 'asc' }
  })

  const { data: testimonials } = useFrappeGetDocList('Legacy Testimonial', {
    filters: [['parent', '=', selectedRestaurant]],
    fields: ['name', 'customer_name', 'rating', 'text', 'location', 'avatar', 'display_order'],
    orderBy: { field: 'display_order', order: 'asc' }
  })

  const { data: members } = useFrappeGetDocList('Legacy Member', {
    filters: [['parent', '=', selectedRestaurant]],
    fields: ['name', 'member_name', 'role', 'image', 'display_order'],
    orderBy: { field: 'display_order', order: 'asc' }
  })

  const { data: galleryImages } = useFrappeGetDocList('Legacy Gallery Image', {
    filters: [['parent', '=', selectedRestaurant]],
    fields: ['name', 'image', 'title', 'display_order'],
    orderBy: { field: 'display_order', order: 'asc' }
  })

  const { data: instagramReels } = useFrappeGetDocList('Legacy Instagram Reel', {
    filters: [['parent', '=', selectedRestaurant]],
    fields: ['name', 'reel_link', 'title', 'display_order'],
    orderBy: { field: 'display_order', order: 'asc' }
  })

  // Get menu products for signature dishes selection
  const { data: menuProducts } = useFrappeGetDocList('Menu Product', {
    filters: [['restaurant', '=', selectedRestaurant]],
    fields: ['name', 'product_name', 'image']
  })

  const { call: createDoc, loading: isCreating } = useFrappePostCall('frappe.client.insert')
  const { updateDoc, loading: isUpdating } = useFrappeUpdateDoc()
  const { deleteDoc, loading: isDeleting } = useFrappeDeleteDoc()

  const handleSave = async (data: any, type: string, doctype: string) => {
    try {
      if (editingItem?.name) {
        await updateDoc(doctype, editingItem.name, data)
        toast.success(`${type} updated successfully`)
      } else {
        await createDoc({
          ...data,
          doctype: doctype,
          parent: selectedRestaurant,
          parenttype: 'Legacy Content',
          parentfield: getChildTableField(doctype)
        })
        toast.success(`${type} added successfully`)
      }
      
      setIsDialogOpen(false)
      setEditingItem(null)
      
      // Force a page refresh to show updated data
      window.location.reload()
    } catch (error) {
      toast.error(`Failed to save ${type}`)
    }
  }

  const handleDelete = async (doctype: string, name: string, type: string) => {
    try {
      await deleteDoc(doctype, name)
      toast.success(`${type} deleted successfully`)
      // Force a page refresh to show updated data
      window.location.reload()
    } catch (error) {
      toast.error(`Failed to delete ${type}`)
    }
  }

  const getChildTableField = (doctype: string) => {
    const mapping: Record<string, string> = {
      'Legacy Signature Dish': 'signature_dishes',
      'Legacy Testimonial': 'testimonials',
      'Legacy Member': 'members',
      'Legacy Gallery Image': 'gallery_featured_images',
      'Legacy Instagram Reel': 'instagram_reels'
    }
    return mapping[doctype] || ''
  }

  const renderSection = (title: string, icon: any, data: any[], type: string, doctype: string, renderItem: (item: any) => JSX.Element) => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {icon}
            {title}
            <Badge variant="secondary">{data.length}</Badge>
          </CardTitle>
          <Dialog open={isDialogOpen && editingItem?.type === type} onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) setEditingItem(null)
          }}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setEditingItem({ type, doctype })}>
                <Plus className="h-4 w-4 mr-1" />
                Add {type}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingItem?.name ? `Edit ${type}` : `Add ${type}`}
                </DialogTitle>
              </DialogHeader>
              {renderForm(type, doctype, editingItem)}
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No {title.toLowerCase()} yet. Click `Add {type}` to get started.
          </div>
        ) : (
          <div className="space-y-4">
            {data.map(renderItem)}
          </div>
        )}
      </CardContent>
    </Card>
  )

  const renderForm = (type: string, doctype: string, editingData: any) => {
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault()
      const formData = new FormData(e.target as HTMLFormElement)
      const data: any = {}
      
      switch (type) {
        case 'Signature Dish':
          data.dish = formData.get('dish')
          data.display_order = parseInt(formData.get('display_order') as string) || 0
          break
        case 'Testimonial':
          data.customer_name = formData.get('customer_name')
          data.rating = parseInt(formData.get('rating') as string) || 5
          data.text = formData.get('text')
          data.location = formData.get('location')
          data.avatar = formData.get('avatar')
          data.display_order = parseInt(formData.get('display_order') as string) || 0
          break
        case 'Member':
          data.member_name = formData.get('member_name')
          data.role = formData.get('role')
          data.image = formData.get('image')
          data.display_order = parseInt(formData.get('display_order') as string) || 0
          break
        case 'Gallery Image':
          data.image = formData.get('image')
          data.title = formData.get('title')
          data.display_order = parseInt(formData.get('display_order') as string) || 0
          break
        case 'Instagram Reel':
          data.reel_link = formData.get('reel_link')
          data.title = formData.get('title')
          data.display_order = parseInt(formData.get('display_order') as string) || 0
          break
      }
      
      handleSave(data, type, doctype)
    }

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        {type === 'Signature Dish' && (
          <>
            <div>
              <Label htmlFor="dish">Dish</Label>
              <Select name="dish" defaultValue={editingData?.dish} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a dish" />
                </SelectTrigger>
                <SelectContent>
                  {menuProducts?.map((product: any) => (
                    <SelectItem key={product.name} value={product.name}>
                      {product.product_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="display_order">Display Order</Label>
              <Input type="number" name="display_order" defaultValue={editingData?.display_order || 0} />
            </div>
          </>
        )}
        
        {type === 'Testimonial' && (
          <>
            <div>
              <Label htmlFor="customer_name">Customer Name</Label>
              <Input name="customer_name" defaultValue={editingData?.customer_name} required />
            </div>
            <div>
              <Label htmlFor="rating">Rating</Label>
              <Select name="rating" defaultValue={editingData?.rating?.toString() || '5'}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map(rating => (
                    <SelectItem key={rating} value={rating.toString()}>
                      {rating} {rating === 1 ? 'Star' : 'Stars'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="text">Testimonial</Label>
              <Textarea name="text" defaultValue={editingData?.text} required />
            </div>
            <div>
              <Label htmlFor="location">Location (Optional)</Label>
              <Input name="location" defaultValue={editingData?.location} />
            </div>
            <div>
              <Label htmlFor="avatar">Avatar URL (Optional)</Label>
              <Input name="avatar" defaultValue={editingData?.avatar} />
            </div>
            <div>
              <Label htmlFor="display_order">Display Order</Label>
              <Input type="number" name="display_order" defaultValue={editingData?.display_order || 0} />
            </div>
          </>
        )}
        
        {type === 'Member' && (
          <>
            <div>
              <Label htmlFor="member_name">Member Name</Label>
              <Input name="member_name" defaultValue={editingData?.member_name} required />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Input name="role" defaultValue={editingData?.role} />
            </div>
            <div>
              <Label htmlFor="image">Image URL (Optional)</Label>
              <Input name="image" defaultValue={editingData?.image} />
            </div>
            <div>
              <Label htmlFor="display_order">Display Order</Label>
              <Input type="number" name="display_order" defaultValue={editingData?.display_order || 0} />
            </div>
          </>
        )}
        
        {type === 'Gallery Image' && (
          <>
            <div>
              <Label htmlFor="image">Image URL</Label>
              <Input name="image" defaultValue={editingData?.image} required />
            </div>
            <div>
              <Label htmlFor="title">Title (Optional)</Label>
              <Input name="title" defaultValue={editingData?.title} />
            </div>
            <div>
              <Label htmlFor="display_order">Display Order</Label>
              <Input type="number" name="display_order" defaultValue={editingData?.display_order || 0} />
            </div>
          </>
        )}
        
        {type === 'Instagram Reel' && (
          <>
            <div>
              <Label htmlFor="reel_link">Reel Link</Label>
              <Input name="reel_link" defaultValue={editingData?.reel_link} required />
            </div>
            <div>
              <Label htmlFor="title">Title (Optional)</Label>
              <Input name="title" defaultValue={editingData?.title} />
            </div>
            <div>
              <Label htmlFor="display_order">Display Order</Label>
              <Input type="number" name="display_order" defaultValue={editingData?.display_order || 0} />
            </div>
          </>
        )}
        
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={isCreating || isUpdating}>
            {editingData?.name ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    )
  }

  if (!selectedRestaurant) {
    return (
      <div className="text-center py-8">
        <p>Please select a restaurant to manage legacy content.</p>
      </div>
    )
  }

  if (contentLoading) {
    return (
      <div className="text-center py-8">
        <p>Loading legacy content...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Legacy Content Management</h1>
        <p className="text-muted-foreground">Manage your restaurant's story, heritage, and featured content</p>
      </div>

      <div className="grid gap-6">
        {renderSection(
          'Signature Dishes',
          <Star className="h-5 w-5" />,
          signatureDishes || [],
          'Signature Dish',
          'Legacy Signature Dish',
          (item) => (
            <div key={item.name} className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h4 className="font-semibold">{item.dish_name || item.dish}</h4>
                <p className="text-sm text-muted-foreground">Order: {item.display_order}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditingItem({ ...item, type: 'Signature Dish', doctype: 'Legacy Signature Dish' })}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDelete('Legacy Signature Dish', item.name, 'Signature Dish')}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )
        )}

        {renderSection(
          'Testimonials',
          <Users className="h-5 w-5" />,
          testimonials || [],
          'Testimonial',
          'Legacy Testimonial',
          (item) => (
            <div key={item.name} className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h4 className="font-semibold">{item.customer_name}</h4>
                <div className="flex items-center gap-1 my-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`h-3 w-3 ${i < item.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">{item.location}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditingItem({ ...item, type: 'Testimonial', doctype: 'Legacy Testimonial' })}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDelete('Legacy Testimonial', item.name, 'Testimonial')}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )
        )}

        {renderSection(
          'Members',
          <Users className="h-5 w-5" />,
          members || [],
          'Member',
          'Legacy Member',
          (item) => (
            <div key={item.name} className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h4 className="font-semibold">{item.member_name}</h4>
                <p className="text-sm text-muted-foreground">{item.role}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditingItem({ ...item, type: 'Member', doctype: 'Legacy Member' })}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDelete('Legacy Member', item.name, 'Member')}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )
        )}

        {renderSection(
          'Gallery Images',
          <Camera className="h-5 w-5" />,
          galleryImages || [],
          'Gallery Image',
          'Legacy Gallery Image',
          (item) => (
            <div key={item.name} className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h4 className="font-semibold">{item.title || 'Untitled'}</h4>
                <p className="text-sm text-muted-foreground truncate">{item.image}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditingItem({ ...item, type: 'Gallery Image', doctype: 'Legacy Gallery Image' })}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDelete('Legacy Gallery Image', item.name, 'Gallery Image')}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )
        )}

        {renderSection(
          'Instagram Reels',
          <Instagram className="h-5 w-5" />,
          instagramReels || [],
          'Instagram Reel',
          'Legacy Instagram Reel',
          (item) => (
            <div key={item.name} className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h4 className="font-semibold">{item.title || 'Untitled'}</h4>
                <p className="text-sm text-muted-foreground truncate">{item.reel_link}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditingItem({ ...item, type: 'Instagram Reel', doctype: 'Legacy Instagram Reel' })}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDelete('Legacy Instagram Reel', item.name, 'Instagram Reel')}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}
