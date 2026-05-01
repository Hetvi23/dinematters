import { useState, useMemo, useEffect } from 'react'
import { useFrappePostCall, useFrappeUpdateDoc, useFrappeDeleteDoc } from '@/lib/frappe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Edit, Trash2, Calendar, AlertCircle, Search, Zap } from 'lucide-react'
import { LockedFeature } from '@/components/FeatureGate/LockedFeature'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { toast } from 'sonner'
import { cn, getFrappeError } from '@/lib/utils'
import { useDataTable } from '@/hooks/useDataTable'
import { DataPagination } from '@/components/ui/DataPagination'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePicker } from '@/components/ui/date-picker'
import { TimeInput } from '@/components/ui/time-input'
import { Textarea } from '@/components/ui/textarea'

export default function Events() {
  const { selectedRestaurant, isGold } = useRestaurant()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<any>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [eventToDelete, setEventToDelete] = useState<{ name: string; title: string } | null>(null)

  const initialFilters = useMemo(() => {
    if (!selectedRestaurant) return []
    const f: any[] = [['restaurant', '=', selectedRestaurant]]
    
    if (filterType === 'active') {
      f.push(['is_active', '=', 1])
    } else if (filterType === 'inactive') {
      f.push(['is_active', '=', 0])
    }
    
    return f
  }, [selectedRestaurant, filterType])

  const {
    data: events,
    isLoading,
    mutate,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalCount,
    searchQuery,
    setSearchQuery
  } = useDataTable({
    doctype: 'Restaurant Event',
    fields: ['name', 'title', 'description', 'event_type', 'is_active', 'start_date', 'end_date', 'start_time', 'end_time', 'location', 'image', 'is_recurring', 'recurring_days', 'restaurant'],
    initialFilters,
    orderBy: { field: 'creation', order: 'desc' },
    initialPageSize: 12,
    debugId: `events-${selectedRestaurant}-${filterType}`
  })

  const { call: createEvent } = useFrappePostCall('frappe.client.insert')
  const { updateDoc: updateEvent } = useFrappeUpdateDoc()
  const { deleteDoc: deleteEvent } = useFrappeDeleteDoc()

  const handleCreateEvent = async (formData: any) => {
    try {
      await createEvent({
        doc: {
          doctype: 'Restaurant Event',
          ...formData,
          restaurant: selectedRestaurant,
        }
      })
      toast.success('Event launched successfully')
      mutate()
      setIsCreateDialogOpen(false)
    } catch (error: any) {
      toast.error('Failed to launch event', { description: getFrappeError(error) })
    }
  }

  const handleUpdateEvent = async (name: string, formData: any) => {
    try {
      await updateEvent('Restaurant Event', name, formData)
      toast.success('Event details updated')
      mutate()
      setEditingEvent(null)
    } catch (error: any) {
      toast.error('Update failed', { description: getFrappeError(error) })
    }
  }

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return
    try {
      await deleteEvent('Restaurant Event', eventToDelete.name)
      toast.success('Event eradicated')
      mutate()
      setDeleteDialogOpen(false)
      setEventToDelete(null)
    } catch (error: any) {
      toast.error('Eradication failed', { description: getFrappeError(error) })
    }
  }

  const openDeleteDialog = (name: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setEventToDelete({ name, title })
    setDeleteDialogOpen(true)
  }


  if (!selectedRestaurant) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
        <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mb-4">
           <Calendar className="h-10 w-10 text-muted-foreground/30" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Select a Restaurant</h3>
        <p className="text-muted-foreground max-w-sm">Pick a restaurant to start managing floor events and special occasions.</p>
      </div>
    )
  }

  if (!isGold) {
    return <LockedFeature feature="events" requiredPlan={['GOLD']} />
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Event Horizon</h2>
          <p className="text-muted-foreground text-sm flex items-center gap-2">
            <Zap className="h-3.5 w-3.5" />
            Programmatic floor events and recurring schedule management
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="rounded-xl h-11 px-6 shadow-lg shadow-primary/20 bg-black text-white hover:bg-black/90">
          <Plus className="h-4 w-4 mr-2" />
          Establish Event
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Events</CardTitle>
              <CardDescription>
                Manage your restaurant events and special occasions
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-9 w-[120px]">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && !events.length ? (
            <div className="py-20 flex justify-center">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : !events || events.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground">No events found</div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event: any) => (
                      <TableRow key={event.name}>
                        <TableCell className="font-bold">{event.title}</TableCell>
                        <TableCell className="capitalize">{event.event_type || 'Standard'}</TableCell>
                        <TableCell>
                          {new Date(event.start_date).toLocaleDateString()}
                          {event.is_recurring && <Badge variant="secondary" className="ml-2 text-[10px]">Recurring</Badge>}
                        </TableCell>
                        <TableCell>
                          {event.is_active ? (
                            <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => setEditingEvent(event)}
                              className="h-8 w-8"
                            >
                               <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive"
                              onClick={(e) => openDeleteDialog(event.name, event.title, e)}
                            >
                               <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <DataPagination
                currentPage={page}
                totalCount={totalCount}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                isLoading={isLoading}
              />
            </>
          )}
        </CardContent>
      </Card>

      <EventDialog
        open={isCreateDialogOpen || !!editingEvent}
        onClose={() => {
          setIsCreateDialogOpen(false)
          setEditingEvent(null)
        }}
        event={editingEvent}
        onSave={(data: any) => {
          if (editingEvent) {
            handleUpdateEvent(editingEvent.name, data)
          } else {
            handleCreateEvent(data)
          }
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl border-none shadow-2xl p-0 overflow-hidden">
          <div className="p-8 pb-0">
             <AlertDialogHeader className="space-y-3">
               <div className="h-14 w-14 bg-red-100 rounded-2xl flex items-center justify-center mb-2">
                 <AlertCircle className="h-8 w-8 text-red-600" />
               </div>
               <AlertDialogTitle className="text-2xl font-black tracking-tight text-red-600 uppercase italic">Terminate Stream?</AlertDialogTitle>
               <AlertDialogDescription className="text-base font-semibold leading-relaxed">
                 You are about to permanently purge <strong>{eventToDelete?.title}</strong> from the global shard cluster. 
                 This action is irreversible and will deactivate associated floor controls.
               </AlertDialogDescription>
             </AlertDialogHeader>
          </div>
          <AlertDialogFooter className="p-6 bg-muted/20 mt-4 flex justify-between sm:justify-start gap-4">
            <AlertDialogCancel onClick={() => setEventToDelete(null)} className="flex-1 rounded-xl h-11 font-black uppercase text-xs border-none shadow-none bg-card">Abort Command</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEvent}
              className="flex-1 rounded-xl h-11 font-black uppercase text-xs bg-red-600 text-white hover:bg-red-700 shadow-xl shadow-red-200"
            >
              Execute Purge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function EventDialog({ open, onClose, event, onSave }: any) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_type: 'Live Music',
    is_active: true,
    start_date: '',
    end_date: '',
    start_time: '19:00:00',
    end_time: '23:00:00',
    location: '',
    image: '',
    is_recurring: false,
    recurring_days: '',
  })

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title || '',
        description: event.description || '',
        event_type: event.event_type || 'Live Music',
        is_active: event.is_active ?? true,
        start_date: event.start_date || '',
        end_date: event.end_date || '',
        start_time: event.start_time || '19:00:00',
        end_time: event.end_time || '23:00:00',
        location: event.location || '',
        image: event.image || '',
        is_recurring: event.is_recurring ?? false,
        recurring_days: event.recurring_days || '',
      })
    } else {
      setFormData({
        title: '',
        description: '',
        event_type: 'Live Music',
        is_active: true,
        start_date: '',
        end_date: '',
        start_time: '19:00:00',
        end_time: '23:00:00',
        location: '',
        image: '',
        is_recurring: false,
        recurring_days: '',
      })
    }
  }, [event, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  const toggleDay = (day: string) => {
    const days = formData.recurring_days ? formData.recurring_days.split(',') : []
    const newDays = days.includes(day) ? days.filter(d => d !== day) : [...days, day]
    setFormData({ ...formData, recurring_days: newDays.join(',') })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? 'Edit Event' : 'Add New Event'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="title">Event Title</Label>
              <Input 
                id="title" 
                value={formData.title} 
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Saturday Night Party"
                required
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea 
                id="description" 
                value={formData.description} 
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the event details, activities, etc."
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event_type">Category</Label>
              <Select 
                value={formData.event_type} 
                onValueChange={(val) => setFormData({ ...formData, event_type: val })}
              >
                <SelectTrigger id="event_type">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {['Live Music', 'Happy Hour', 'Workshop', 'Pop-up Kitchen', 'Themed Night', 'Private Event'].map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="is_active">Status</Label>
              <Select 
                value={formData.is_active ? 'active' : 'inactive'} 
                onValueChange={(val) => setFormData({ ...formData, is_active: val === 'active' })}
              >
                <SelectTrigger id="is_active">
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <DatePicker
                label="Start Date"
                value={formData.start_date}
                onChange={(val) => setFormData({ ...formData, start_date: val })}
                placeholder="Select Event Date"
              />
            </div>

            <div className="space-y-2">
              <DatePicker
                label="End Date (Optional)"
                value={formData.end_date}
                onChange={(val) => setFormData({ ...formData, end_date: val })}
                placeholder="Select End Date"
              />
            </div>

            <div className="space-y-2">
              <TimeInput
                label="Start Time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <TimeInput
                label="End Time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="location">Location</Label>
              <Input 
                id="location" 
                value={formData.location} 
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Main Hall / Rooftop / Garden"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Event Image (URL)</Label>
              <Input 
                value={formData.image} 
                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                placeholder="https://example.com/image.jpg"
              />
              {formData.image && (
                <div className="mt-2 relative h-32 w-48 rounded-lg overflow-hidden border">
                  <img src={formData.image} alt="Preview" className="h-full w-full object-cover" />
                </div>
              )}
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
                checked={formData.is_recurring} 
                onCheckedChange={(val) => setFormData({ ...formData, is_recurring: val })}
              />
            </div>

            {formData.is_recurring && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
                <div className="space-y-2">
                  <Label>Days of the week</Label>
                  <div className="flex flex-wrap gap-3">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                      <div key={day} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`day-${day}`} 
                          checked={formData.recurring_days?.includes(day)}
                          onCheckedChange={() => toggleDay(day)}
                        />
                        <Label htmlFor={`day-${day}`} className="text-xs font-normal">{day}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">
              {event ? 'Update Event' : 'Create Event'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
