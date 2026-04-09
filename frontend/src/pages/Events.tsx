import { useState } from 'react'
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Plus, 
  Edit2, 
  Trash2, 
  Star, 
  Filter, 
  Image as ImageIcon,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Repeat
} from 'lucide-react'
import { useFrappeGetDocList, useFrappePostCall } from '@/lib/frappe'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { uploadToR2 } from '@/lib/r2Upload'
import { LockedFeature } from '@/components/FeatureGate/LockedFeature'
import { DatePicker } from '@/components/ui/date-picker'
import { TimeInput } from '@/components/ui/time-input'

interface EventRecurring {
  repeatThisEvent: boolean
  repeatOn: string
  repeatTill?: string
  weekdays?: string[]
}

interface Event {
  id: string
  title: string
  description?: string
  date?: string
  time?: string
  location?: string
  google_maps_link?: string
  registration_link?: string
  category?: string
  featured: boolean
  status: 'upcoming' | 'recurring' | 'past'
  imageSrc?: string
  imageAlt?: string
  recurring: EventRecurring
}

const CATEGORIES = ['Coffee', 'Party', 'Music', 'Holiday', 'Festival']
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function Events() {
  const { selectedRestaurant, isSilver } = useRestaurant()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Partial<Event> | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // API Hooks
  const { data: events, mutate: mutateEvents, isLoading } = useFrappeGetDocList('Event', {
    fields: ['name as id', 'title', 'description', 'date', 'time', 'location', 'google_maps_link', 'registration_link', 'category', 'featured', 'status', 'is_active', 'image_src', 'repeat_this_event', 'repeat_on', 'repeat_till', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    filters: [['restaurant', '=', selectedRestaurant]],
    orderBy: { field: 'display_order', order: 'asc' }
  }, selectedRestaurant ? `events-list-${selectedRestaurant}` : null)

  const { call: saveEventAPI } = useFrappePostCall('dinematters.dinematters.api.events.save_event')
  const { call: deleteEventAPI } = useFrappePostCall('dinematters.dinematters.api.events.delete_event')
  const { call: toggleStatusAPI } = useFrappePostCall('dinematters.dinematters.api.events.toggle_event_status')

  const handleOpenDialog = (event?: any) => {
    if (event) {
      // Map backend fields to frontend structure
      const weekdays: string[] = []
      if (event.monday) weekdays.push('Monday')
      if (event.tuesday) weekdays.push('Tuesday')
      if (event.wednesday) weekdays.push('Wednesday')
      if (event.thursday) weekdays.push('Thursday')
      if (event.friday) weekdays.push('Friday')
      if (event.saturday) weekdays.push('Saturday')
      if (event.sunday) weekdays.push('Sunday')

      setEditingEvent({
        ...event,
        imageSrc: event.image_src,
        recurring: {
          repeatThisEvent: !!event.repeat_this_event,
          repeatOn: event.repeat_on || 'Weekly',
          repeatTill: event.repeat_till,
          weekdays
        }
      })
    } else {
      setEditingEvent({
        title: '',
        description: '',
        category: 'Party',
        status: 'upcoming',
        featured: false,
        recurring: {
          repeatThisEvent: false,
          repeatOn: 'Weekly',
          weekdays: []
        }
      })
    }
    setIsDialogOpen(true)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const result: any = await uploadToR2({
        file,
        ownerDoctype: 'Event',
        ownerName: editingEvent?.id || 'new_event',
        mediaRole: 'event_image'
      })

      if (result?.primary_url) {
        setEditingEvent(prev => prev ? { ...prev, imageSrc: result.primary_url } : null)
        toast.success('Image uploaded successfully')
      }
    } catch (error) {
      console.error('Upload failed:', error)
      toast.error('Failed to upload image')
    } finally {
      setIsUploading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRestaurant || !editingEvent?.title) return

    setIsSaving(true)
    try {
      // Map frontend recurring structure back to backend fields for saving
      const eventData = {
        ...editingEvent,
        image_src: editingEvent.imageSrc
      }

      const result = await saveEventAPI({
        restaurant_id: selectedRestaurant,
        event_data: eventData
      })

      if (result?.success || result?.message?.success) {
        toast.success(editingEvent.id ? 'Event updated' : 'Event created')
        setIsDialogOpen(false)
        mutateEvents()
      } else {
        throw new Error(result?.error?.message || 'Failed to save event')
      }
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return

    try {
      const result = await deleteEventAPI({
        restaurant_id: selectedRestaurant,
        event_id: id
      })
      if (result?.success || result?.message?.success) {
        toast.success('Event deleted')
        mutateEvents()
      }
    } catch (error) {
      toast.error('Failed to delete event')
    }
  }

  const handleToggle = async (id: string, field: 'is_active' | 'featured') => {
    try {
      const result = await toggleStatusAPI({
        restaurant_id: selectedRestaurant,
        event_id: id,
        field
      })
      if (result?.success || result?.message?.success) {
        mutateEvents()
      }
    } catch (error) {
      toast.error('Failed to update status')
    }
  }

  const filteredEvents = events?.filter(event => {
    if (statusFilter === 'all') return true
    return event.status === statusFilter
  })

  if (isSilver) {
    return <LockedFeature feature="events" requiredPlan={['GOLD', 'DIAMOND']} />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-6 border-b border-border/50">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Events Management</h1>
          <p className="text-muted-foreground mt-1 text-sm">Create and manage upcoming happenings at your restaurant</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2 shadow-lg shadow-primary/20 transition-all hover:scale-105">
          <Plus className="h-4 w-4" />
          Add Event
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 bg-card/40 backdrop-blur-md p-3 rounded-xl border border-border/50 shadow-sm">
        <div className="flex items-center gap-2 text-muted-foreground px-2">
          <Filter className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Status</span>
        </div>
        <div className="flex gap-1">
          {['all', 'upcoming', 'recurring', 'past'].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter(status)}
              className={cn(
                "capitalize text-xs font-medium px-4 h-8 rounded-lg transition-all",
                statusFilter === status ? "shadow-md" : "hover:bg-accent/50"
              )}
            >
              {status}
            </Button>
          ))}
        </div>
      </div>

      {/* Events Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-muted animate-pulse rounded-xl border" />
          ))}
        </div>
      ) : filteredEvents?.length === 0 ? (
        <div className="bg-card rounded-xl border p-12 text-center">
          <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">No events found</p>
          <Button variant="link" onClick={() => handleOpenDialog()} className="mt-2">
            Create your first event
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents?.map((event: any) => (
            <Card key={event.id} className="overflow-hidden group hover:shadow-lg transition-all duration-300 border-none bg-card/50 backdrop-blur-sm shadow-sm ring-1 ring-border">
              <div className="relative h-48 overflow-hidden">
                {event.image_src ? (
                  <img src={event.image_src} alt={event.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
                  </div>
                )}
                <div className="absolute top-3 right-3 flex gap-2">
                  {event.featured && (
                    <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-none shadow-md">
                      <Star className="h-3 w-3 mr-1 fill-white" />
                      Featured
                    </Badge>
                  )}
                  <Badge variant={event.status === 'upcoming' ? 'default' : event.status === 'recurring' ? 'secondary' : 'outline'} className="shadow-md">
                    {event.status}
                  </Badge>
                </div>
              </div>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start gap-2">
                  <CardTitle className="text-xl line-clamp-1">{event.title}</CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => handleOpenDialog(event)}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit Event
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggle(event.id, 'featured')}>
                        <Star className="h-4 w-4 mr-2" />
                        {event.featured ? 'Remove Featured' : 'Make Featured'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggle(event.id, 'is_active')}>
                        {event.is_active ? <XCircle className="h-4 w-4 mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                        {event.is_active ? 'Deactivate' : 'Activate'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(event.id)} className="text-destructive focus:text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Event
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                  {event.date && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {event.date}
                    </div>
                  )}
                  {event.time && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {event.time}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pb-4">
                <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                  {event.description || 'No description provided.'}
                </p>
                {event.repeat_this_event && (
                  <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-full w-fit">
                    <Repeat className="h-3 w-3" />
                    {event.repeat_on} Event
                  </div>
                )}
              </CardContent>
              <CardFooter className="pt-0 border-t bg-muted/30 py-3 flex justify-between items-center">
                 <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="truncate">{event.location || 'At Restaurant'}</span>
                 </div>
                 <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider">
                    {event.category || 'General'}
                 </Badge>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEvent?.id ? 'Edit Event' : 'Add New Event'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="title">Event Title</Label>
                <Input 
                  id="title" 
                  value={editingEvent?.title || ''} 
                  onChange={(e) => setEditingEvent(prev => prev ? { ...prev, title: e.target.value } : null)}
                  placeholder="Saturday Night Party"
                  required
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea 
                  id="description" 
                  value={editingEvent?.description || ''} 
                  onChange={(e) => setEditingEvent(prev => prev ? { ...prev, description: e.target.value } : null)}
                  placeholder="Describe the event details, activities, etc."
                  className="min-h-[100px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select 
                  value={editingEvent?.category} 
                  onValueChange={(val) => setEditingEvent(prev => prev ? { ...prev, category: val } : null)}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select 
                  value={editingEvent?.status} 
                  onValueChange={(val: any) => setEditingEvent(prev => prev ? { ...prev, status: val } : null)}
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="recurring">Recurring</SelectItem>
                    <SelectItem value="past">Past</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <DatePicker
                  label="Date (if one-time)"
                  value={editingEvent?.date || ''}
                  onChange={(val) => setEditingEvent(prev => prev ? { ...prev, date: val } : null)}
                  placeholder="Select Event Date"
                />
              </div>

              <div className="space-y-2">
                <TimeInput
                  label="Time"
                  value={editingEvent?.time || ''}
                  onChange={(e) => setEditingEvent(prev => prev ? { ...prev, time: e.target.value } : null)}
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="location">Location</Label>
                <Input 
                  id="location" 
                  value={editingEvent?.location || ''} 
                  onChange={(e) => setEditingEvent(prev => prev ? { ...prev, location: e.target.value } : null)}
                  placeholder="Main Hall / Rooftop / Garden"
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="google_maps_link">Google Maps Link</Label>
                <Input 
                  id="google_maps_link" 
                  value={editingEvent?.google_maps_link || ''} 
                  onChange={(e) => setEditingEvent(prev => prev ? { ...prev, google_maps_link: e.target.value } : null)}
                  placeholder="https://goo.gl/maps/..."
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="registration_link">Registration Link (External Form)</Label>
                <Input 
                  id="registration_link" 
                  value={editingEvent?.registration_link || ''} 
                  onChange={(e) => setEditingEvent(prev => prev ? { ...prev, registration_link: e.target.value } : null)}
                  placeholder="https://forms.gle/..."
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label>Event Image</Label>
                <div className="flex items-center gap-4">
                  {editingEvent?.imageSrc ? (
                    <div className="relative h-20 w-20 rounded-lg overflow-hidden border">
                      <img src={editingEvent.imageSrc} alt="Preview" className="h-full w-full object-cover" />
                      <button 
                        type="button" 
                        onClick={() => setEditingEvent(prev => prev ? { ...prev, imageSrc: '' } : null)}
                        className="absolute top-0 right-0 bg-destructive text-white p-0.5"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center border border-dashed border-muted-foreground/50">
                      <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="flex-1">
                    <Input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageUpload} 
                      disabled={isUploading}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Recommended: 1200x800px. Max 2MB.</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between col-span-2 p-3 bg-muted/50 rounded-lg border">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Featured Event</Label>
                  <p className="text-xs text-muted-foreground">Highlight this event on your digital menu</p>
                </div>
                <Switch 
                  checked={editingEvent?.featured} 
                  onCheckedChange={(val) => setEditingEvent(prev => prev ? { ...prev, featured: val } : null)}
                />
              </div>
            </div>

            {/* Recurring Section */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-semibold">Recurring Event</Label>
                  <p className="text-sm text-muted-foreground">Set if this event repeats automatically</p>
                </div>
                <Switch 
                  checked={editingEvent?.recurring?.repeatThisEvent} 
                  onCheckedChange={(val) => setEditingEvent(prev => prev ? { ...prev, recurring: { ...prev.recurring!, repeatThisEvent: val } } : null)}
                />
              </div>

              {editingEvent?.recurring?.repeatThisEvent && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-2">
                    <Label>Repeat Every</Label>
                    <Select 
                      value={editingEvent?.recurring?.repeatOn} 
                      onValueChange={(val) => setEditingEvent(prev => prev ? { ...prev, recurring: { ...prev.recurring!, repeatOn: val } } : null)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Daily">Daily</SelectItem>
                        <SelectItem value="Weekly">Weekly</SelectItem>
                        <SelectItem value="Monthly">Monthly</SelectItem>
                        <SelectItem value="Yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <DatePicker
                      label="Repeat Until (Optional)"
                      value={editingEvent?.recurring?.repeatTill || ''}
                      onChange={(val) => setEditingEvent(prev => prev ? { ...prev, recurring: { ...prev.recurring!, repeatTill: val } } : null)}
                      placeholder="Select End Date"
                      description="Leave blank to repeat always"
                    />
                  </div>

                  {editingEvent.recurring.repeatOn === 'Weekly' && (
                    <div className="col-span-2 space-y-2">
                      <Label>Days of the week</Label>
                      <div className="flex flex-wrap gap-3">
                        {WEEKDAYS.map(day => (
                          <div key={day} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`day-${day}`} 
                              checked={editingEvent.recurring?.weekdays?.includes(day)}
                              onCheckedChange={(checked) => {
                                const current = editingEvent.recurring?.weekdays || []
                                const next = checked 
                                  ? [...current, day]
                                  : current.filter(d => d !== day)
                                setEditingEvent(prev => prev ? { ...prev, recurring: { ...prev.recurring!, weekdays: next } } : null)
                              }}
                            />
                            <Label htmlFor={`day-${day}`} className="text-xs font-normal">{day.substring(0, 3)}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSaving || isUploading}>
                {isSaving ? 'Saving...' : editingEvent?.id ? 'Update Event' : 'Create Event'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
