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

export default function Events() {
  const { selectedRestaurant, isDiamond } = useRestaurant()
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

  if (!isDiamond) {
    return <LockedFeature feature="events" requiredPlan={['DIAMOND']} />
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
  const [activeTab, setActiveTab] = useState<'basic' | 'schedule' | 'media'>('basic')
  
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
    setActiveTab('basic')
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
      <DialogContent className="max-w-xl p-0 overflow-hidden border-none shadow-3xl rounded-3xl">
        <div className="bg-black text-white p-8 pb-6 border-b border-white/10">
           <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight uppercase italic">{event ? 'Modify Horizon' : 'Establish New Event'}</DialogTitle>
              <DialogDescription className="text-xs font-bold text-white/50 uppercase tracking-widest mt-1">
                 {event ? `Payload Integrity: ${event.name}` : 'Programming global floor occurrence'}
              </DialogDescription>
           </DialogHeader>
           
           <div className="flex bg-white/10 p-1 rounded-xl mt-6">
              {[
                { label: 'Core', value: 'basic' },
                { label: 'Schedule', value: 'schedule' },
                { label: 'Media', value: 'media' }
              ].map(tab => (
                 <button 
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value as any)}
                  className={cn("flex-1 h-9 rounded-lg text-xs font-black uppercase transition-all", activeTab === tab.value ? "bg-white text-black shadow-xl" : "text-white/40 hover:text-white/60")}
                >
                  {tab.label}
                </button>
              ))}
           </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {activeTab === 'basic' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Network Identifier (Title) *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g. SYNCED JAZZ NIGHT"
                      className="h-12 rounded-2xl bg-muted/30 border-none font-bold placeholder:italic"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="event_type" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Class Identifier</Label>
                      <Select value={formData.event_type} onValueChange={(v) => setFormData({ ...formData, event_type: v })}>
                        <SelectTrigger className="h-11 rounded-2xl bg-muted/30 border-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-2xl">
                          {['Live Music', 'Happy Hour', 'Workshop', 'Pop-up Kitchen', 'Themed Night', 'Private Event'].map(type => (
                             <SelectItem key={type} value={type} className="font-bold">{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="location" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Deployment Sector</Label>
                      <Input
                        id="location"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        placeholder="e.g. ROOFTOP DECK"
                        className="h-11 rounded-2xl bg-muted/30 border-none font-semibold"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mission Brief (Description)</Label>
                    <textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Operational details and engagement goals..."
                      className="w-full min-h-[100px] p-4 rounded-2xl bg-muted/30 border-none text-sm font-medium focus:ring-2 focus:ring-black outline-none italic"
                    />
                  </div>
               </div>
            )}

            {activeTab === 'schedule' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                  <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-2xl border border-border/40">
                     <div className="flex-1 flex items-center gap-3">
                        <Zap className={cn("h-5 w-5", formData.is_recurring ? "text-indigo-600" : "text-muted-foreground/30")} />
                        <div className="flex flex-col">
                           <span className="text-sm font-black uppercase italic tracking-tight">Recurring Logic</span>
                           <span className="text-[10px] font-bold text-muted-foreground uppercase">Enable schedule frequency</span>
                        </div>
                     </div>
                     <input
                        type="checkbox"
                        checked={formData.is_recurring}
                        onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                        className="h-6 w-10 appearance-none bg-muted-foreground/20 rounded-full checked:bg-black transition-all cursor-pointer relative before:content-[''] before:absolute before:h-4 before:w-4 before:bg-white before:rounded-full before:top-1 before:left-1 checked:before:translate-x-4 before:transition-transform"
                      />
                  </div>

                  {formData.is_recurring && (
                     <div className="space-y-4 p-4 border-2 border-dashed border-indigo-100 rounded-2xl animate-in zoom-in-95 duration-200">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Active Duty Shards (Days)</Label>
                        <div className="flex justify-between gap-1">
                           {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                              <button
                                 key={day}
                                 type="button"
                                 onClick={() => toggleDay(day)}
                                 className={cn(
                                    "flex-1 h-10 rounded-xl text-[10px] font-black uppercase border-2 transition-all",
                                    formData.recurring_days.includes(day) 
                                       ? "border-black bg-black text-white shadow-lg" 
                                       : "border-muted/50 text-muted-foreground hover:border-black/20"
                                 )}
                              >
                                 {day}
                              </button>
                           ))}
                        </div>
                     </div>
                  )}

                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="start_date" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Activation Point</Label>
                      <Input
                        id="start_date"
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        className="h-11 rounded-2xl bg-muted/30 border-none font-bold"
                        required
                      />
                    </div>
                    {!formData.is_recurring && (
                       <div className="space-y-2">
                         <Label htmlFor="end_date" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Termination Point</Label>
                         <Input
                           id="end_date"
                           type="date"
                           value={formData.end_date}
                           onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                           className="h-11 rounded-2xl bg-muted/30 border-none font-bold"
                         />
                       </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="start_time" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Operations Start</Label>
                      <Input
                        id="start_time"
                        type="time"
                        value={formData.start_time}
                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                        className="h-11 rounded-2xl bg-muted/30 border-none font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                       <Label htmlFor="end_time" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Operations End</Label>
                       <Input
                         id="end_time"
                         type="time"
                         value={formData.end_time}
                         onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                         className="h-11 rounded-2xl bg-muted/30 border-none font-bold"
                       />
                    </div>
                  </div>
               </div>
            )}

            {activeTab === 'media' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                  <div className="space-y-2">
                    <Label htmlFor="image" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Key Visual Payload (Image URL)</Label>
                    <Input
                      id="image"
                      value={formData.image}
                      onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                      placeholder="https://cloud.infrastructure.io/v1/event-asset.jpg"
                      className="h-11 rounded-2xl bg-muted/30 border-none font-medium"
                    />
                  </div>
                  
                  {formData.image && (
                     <div className="aspect-video rounded-3xl overflow-hidden border-2 border-dashed border-muted/50 p-2">
                        <img src={formData.image} alt="Preview" className="w-full h-full object-cover rounded-2xl shadow-2xl" />
                     </div>
                  )}

                  <div className="flex items-center gap-3 p-4 bg-green-500/5 rounded-2xl border border-green-500/10 mt-6">
                     <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                        <Zap className="h-4 w-4 text-green-600" />
                     </div>
                     <div className="flex-1">
                        <Label htmlFor="is_active_check" className="text-xs font-black uppercase tracking-widest text-green-700">Immediate Broadcast</Label>
                        <p className="text-[9px] font-bold text-green-600/60 uppercase">Establish live connection upon save</p>
                     </div>
                     <input
                        type="checkbox"
                        id="is_active_check"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="h-5 w-5 rounded-full accent-green-600"
                      />
                  </div>
               </div>
            )}
          </div>

          <DialogFooter className="p-8 bg-muted/10 border-t border-border/40">
            <div className="flex justify-between w-full items-center">
               <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl h-12 font-black uppercase text-xs">
                 Abort Programming
               </Button>
               <Button type="submit" className="rounded-xl h-12 px-8 font-black uppercase text-xs bg-black text-white hover:bg-black/90 shadow-2xl shadow-black/20">
                 {event ? 'Commit Changes' : 'Ignite Horizon'}
               </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
