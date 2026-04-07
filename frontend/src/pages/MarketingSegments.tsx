import { useRestaurant } from '@/contexts/RestaurantContext'
import { useFrappePostCall } from '@/lib/frappe'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Plus, Trash2, RefreshCw, X, Check, Loader2, Edit2, Search, UserX, ChevronRight, Calculator } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface Segment {
  name: string;
  segment_name: string;
  description: string;
  criteria_type: string;
  estimated_reach: number;
  last_computed_at: string;
  days_since_last_visit: number;
  min_visit_count: number;
  min_total_spent: number;
}

const CRITERIA_DESCRIPTIONS: Record<string, string> = {
  'All Customers': 'Everyone who has ever ordered at your restaurant.',
  'New Customers': 'Customers who placed their first order in the last 14 days.',
  'At-Risk': 'Customers who haven\'t ordered in N days.',
  'Loyal Regulars': 'Customers who have visited at least N times.',
  'High Spenders': 'Customers whose lifetime spend exceeds ₹N.',
  'Birthday This Month': 'Customers whose birthday falls this calendar month.',
  'Manual': 'Hand-pick specific phone numbers.',
  'Custom SQL': 'Advanced: custom SQL WHERE clause on tabCustomer.',
}

const CRITERIA_COLOR: Record<string, string> = {
  'All Customers': 'bg-blue-100 text-blue-700',
  'New Customers': 'bg-green-100 text-green-700',
  'At-Risk': 'bg-red-100 text-red-700',
  'Loyal Regulars': 'bg-purple-100 text-purple-700',
  'High Spenders': 'bg-amber-100 text-amber-700',
  'Birthday This Month': 'bg-pink-100 text-pink-700',
  'Manual': 'bg-slate-100 text-slate-700',
  'Custom SQL': 'bg-orange-100 text-orange-700',
}

export default function MarketingSegments() {
  const { selectedRestaurant } = useRestaurant()
  const [segments, setSegments] = useState<Segment[]>([])
  const [loading, setLoading] = useState(true)
  const [showBuilder, setShowBuilder] = useState(false)
  const [saving, setSaving] = useState(false)
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [previewing, setPreviewing] = useState(false)

  const [form, setForm] = useState({
    segment_name: '',
    description: '',
    criteria_type: 'All Customers',
    days_since_last_visit: 30,
    min_visit_count: 5,
    min_total_spent: 1000,
    customer_ids: '',
  })

  // Management states
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('segments')
  const [optOutStats, setOptOutStats] = useState<{total_opted_out: number, recent: any[]}>({ total_opted_out: 0, recent: [] })
  const [editingName, setEditingName] = useState<string | null>(null)
  
  const [confirmDelete, setConfirmDelete] = useState<{open: boolean, name: string, label: string}>({ open: false, name: '', label: '' })

  const { call: fetchSegments } = useFrappePostCall('dinematters.dinematters.api.marketing.get_segments')
  const { call: saveSegmentApi } = useFrappePostCall('dinematters.dinematters.api.marketing.save_segment')
  const { call: deleteSegmentApi } = useFrappePostCall('dinematters.dinematters.api.marketing.delete_segment')
  const { call: previewApi } = useFrappePostCall('dinematters.dinematters.api.marketing.preview_segment_reach')
  const { call: fetchOptOutStatsApi } = useFrappePostCall('dinematters.dinematters.api.marketing.get_optout_stats')

  const load = () => {
    if (!selectedRestaurant) return
    setLoading(true)
    Promise.all([
      fetchSegments({ restaurant_id: selectedRestaurant }),
      fetchOptOutStatsApi({ restaurant_id: selectedRestaurant })
    ]).then(([sRes, oRes]: any[]) => {
      if (sRes?.message?.success) {
        setSegments(sRes.message.data || [])
      }
      if (oRes?.message?.success) {
        setOptOutStats(oRes.message.data)
      }
    }).catch((err) => {
      console.error("Failed to load segments:", err)
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [selectedRestaurant])

  const handlePreview = async () => {
    if (!selectedRestaurant) return
    setPreviewing(true)
    try {
      const res = await previewApi({ 
        restaurant_id: selectedRestaurant,
        criteria_type: form.criteria_type,
        filters: {
           days_since_last_visit: form.days_since_last_visit,
           min_visit_count: form.min_visit_count,
           min_total_spent: form.min_total_spent,
           customer_ids: form.customer_ids
        }
      })
      if (res?.message?.success) {
        setPreviewCount(res.message.data.reach)
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setPreviewing(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRestaurant) return
    setSaving(true)
    try {
      const res = await saveSegmentApi({ 
        restaurant_id: selectedRestaurant, 
        segment_data: { 
          ...form, 
          name: editingName 
        } 
      })
      if (res?.message?.success) {
        toast.success(editingName ? 'Segment updated' : 'Segment created')
        setShowBuilder(false)
        setEditingName(null)
        setForm({
          segment_name: '',
          description: '',
          criteria_type: 'All Customers',
          days_since_last_visit: 30,
          min_visit_count: 5,
          min_total_spent: 1000,
          customer_ids: '',
        })
        load()
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteSegmentApi({ restaurant_id: selectedRestaurant, segment_name: confirmDelete.name })
      toast.success('Segment deleted')
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const filteredSegments = segments.filter(s => 
    s.segment_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.criteria_type.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Breadcrumbs */}
      <nav className="flex items-center text-sm text-muted-foreground mb-2">
        <Link to="/marketing" className="hover:text-foreground transition-colors">Marketing</Link>
        <ChevronRight className="h-4 w-4 mx-2" />
        <span className="text-foreground font-medium">Segments</span>
      </nav>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            Audience Segments
          </h1>
          <p className="text-muted-foreground mt-1">Group your customers into targeted segments for focused marketing.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => { setEditingName(null); setShowBuilder(true); }} className="font-bold">
            <Plus className="h-4 w-4 mr-2" />
            New Segment
          </Button>
        </div>
      </div>

      {showBuilder ? (
        <Card className="border-2 border-primary/20 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
          <CardHeader className="bg-primary/5 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold">{editingName ? 'Edit' : 'Create'} Segment</CardTitle>
                <p className="text-sm text-muted-foreground">Define who you want to reach with this group.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowBuilder(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="segment_name" className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Segment Name</Label>
                    <Input 
                      id="segment_name" 
                      placeholder="e.g. High Value Customers" 
                      value={form.segment_name}
                      onChange={e => setForm(f => ({ ...f, segment_name: e.target.value }))}
                      required 
                      className="h-12 text-lg font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description" className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Description</Label>
                    <Textarea 
                      id="description" 
                      placeholder="Optional: what is this group for?" 
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      className="min-h-[100px] resize-none"
                    />
                  </div>
                </div>

                <div className="space-y-4 bg-muted/30 p-6 rounded-xl border">
                  <div className="space-y-2">
                    <Label className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Selection Criteria</Label>
                    <Select 
                      value={form.criteria_type}
                      onValueChange={v => setForm(f => ({ ...f, criteria_type: v }))}
                    >
                      <SelectTrigger className="h-12 bg-background border-2 border-primary/10">
                        <SelectValue placeholder="Select logic" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(CRITERIA_DESCRIPTIONS).map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1 px-1">
                      {CRITERIA_DESCRIPTIONS[form.criteria_type]}
                    </p>
                  </div>

                  {form.criteria_type === 'Loyal Regulars' && (
                    <div className="space-y-2 animate-in fade-in zoom-in-95">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Minimum Visits</Label>
                      <Input type="number" value={form.min_visit_count} onChange={e => setForm(f => ({ ...f, min_visit_count: parseInt(e.target.value) }))} className="bg-background" />
                    </div>
                  )}

                  {form.criteria_type === 'At-Risk' && (
                    <div className="space-y-2 animate-in fade-in zoom-in-95">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Days Since Last Visit</Label>
                      <Input type="number" value={form.days_since_last_visit} onChange={e => setForm(f => ({ ...f, days_since_last_visit: parseInt(e.target.value) }))} className="bg-background" />
                    </div>
                  )}

                  {form.criteria_type === 'High Spenders' && (
                    <div className="space-y-2 animate-in fade-in zoom-in-95">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Minimum Lifetime Spend (₹)</Label>
                      <Input type="number" value={form.min_total_spent} onChange={e => setForm(f => ({ ...f, min_total_spent: parseInt(e.target.value) }))} className="bg-background" />
                    </div>
                  )}

                  {form.criteria_type === 'Manual' && (
                    <div className="space-y-2 animate-in fade-in zoom-in-95">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Customer IDs/Phones (comma separated)</Label>
                      <Textarea value={form.customer_ids} onChange={e => setForm(f => ({ ...f, customer_ids: e.target.value }))} className="bg-background min-h-[80px]" placeholder="+919876543210, +918888888888..." />
                    </div>
                  )}

                  <div className="pt-4 border-t flex items-center justify-between">
                    <div>
                      {previewCount !== null && (
                        <div className="text-sm font-black text-primary flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          Est. Reach: {previewCount} customers
                        </div>
                      )}
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={handlePreview} disabled={previewing} className="text-[10px] uppercase font-black tracking-widest px-2 h-7">
                      {previewing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Calculator className="h-3 w-3 mr-1" />}
                      Refresh Estimate
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t">
                <Button type="button" variant="outline" onClick={() => setShowBuilder(false)}>Cancel</Button>
                <Button type="submit" disabled={saving} className="min-w-[140px] font-bold">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingName ? 'Update Segment' : 'Create Segment'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList className="bg-muted/50 p-1">
              <TabsTrigger value="segments" className="px-6 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Manage Segments
              </TabsTrigger>
              <TabsTrigger value="optouts" className="px-6 flex items-center gap-2">
                <UserX className="h-4 w-4" />
                Opt-out List
              </TabsTrigger>
            </TabsList>

            {activeTab === 'segments' && (
              <div className="relative w-full max-w-xs hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search segments..." 
                  className="pl-9 h-10 rounded-full bg-muted/30 border-none focus-visible:ring-1"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            )}
          </div>

          <TabsContent value="segments" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="border-dashed"><CardContent className="h-40 flex items-center justify-center"><Skeleton className="h-full w-full" /></CardContent></Card>
                ))
              ) : filteredSegments.length === 0 ? (
                <Card className="col-span-full border-dashed border-2 py-16 text-center bg-muted/10">
                  <div className="flex flex-col items-center gap-3">
                    <Users className="h-12 w-12 text-muted-foreground opacity-20" />
                    <p className="text-muted-foreground font-medium">No segments found.</p>
                    <Button variant="link" onClick={() => setShowBuilder(true)}>Create your first segment</Button>
                  </div>
                </Card>
              ) : (
                filteredSegments.map(seg => (
                  <Card key={seg.name} className="group hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md border-muted">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${CRITERIA_COLOR[seg.criteria_type] || 'bg-slate-100 text-slate-700'}`}>
                          {seg.criteria_type}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => {
                            setEditingName(seg.name)
                            setForm({
                              segment_name: seg.segment_name,
                              description: seg.description || '',
                              criteria_type: seg.criteria_type,
                              days_since_last_visit: seg.days_since_last_visit || 30,
                              min_visit_count: seg.min_visit_count || 5,
                              min_total_spent: seg.min_total_spent || 1000,
                              customer_ids: '',
                            })
                            setShowBuilder(true)
                          }}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete({ open: true, name: seg.name, label: seg.segment_name })}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <CardTitle className="text-lg font-black mt-2">{seg.segment_name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">{seg.description || 'No description provided.'}</p>
                      <div className="mt-6 pt-4 border-t flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-10 w-10 rounded-full bg-primary/5 flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="text-lg font-black leading-none">{seg.estimated_reach}</div>
                            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">Reach</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[9px] uppercase font-black text-muted-foreground">Computed</div>
                          <div className="text-[11px] font-medium">{seg.last_computed_at ? new Date(seg.last_computed_at).toLocaleDateString() : 'Never'}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="optouts" className="space-y-6">
            <Card className="border-none shadow-none bg-muted/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                  <UserX className="h-5 w-5 text-red-500" />
                  Opt-out Management
                </CardTitle>
                <p className="text-xs text-muted-foreground">Customers who have replied with "STOP" or "UNSUBSCRIBE" are automatically excluded from all campaigns.</p>
              </CardHeader>
              <CardContent>
                {optOutStats.recent.length === 0 ? (
                  <div className="flex flex-col items-center py-12 gap-2 text-muted-foreground">
                    <Check className="h-10 w-10 text-green-500 opacity-20" />
                    <p className="text-sm font-medium">Zero opt-outs! Your audience is highly engaged.</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          <th className="text-left py-3 px-4 font-bold text-xs uppercase tracking-wider text-muted-foreground">Customer</th>
                          <th className="text-left py-3 px-4 font-bold text-xs uppercase tracking-wider text-muted-foreground">Phone</th>
                          <th className="text-left py-3 px-4 font-bold text-xs uppercase tracking-wider text-muted-foreground">Date</th>
                          <th className="text-left py-3 px-4 font-bold text-xs uppercase tracking-wider text-muted-foreground">Keyword</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-[13px]">
                        {optOutStats.recent.map((opt, i) => (
                          <tr key={i} className="hover:bg-muted/5 transition-colors">
                            <td className="py-3 px-4 font-bold">{opt.customer_name || 'Walk-in Customer'}</td>
                            <td className="py-3 px-4 font-mono text-muted-foreground">{opt.phone}</td>
                            <td className="py-3 px-4 text-muted-foreground">{new Date(opt.opted_out_at).toLocaleDateString()}</td>
                            <td className="py-3 px-4"><span className="bg-red-50 text-red-700 px-2 py-0.5 rounded font-black text-[10px] uppercase">{opt.opted_out_keyword}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(open) => setConfirmDelete(d => ({ ...d, open }))}
        title="Delete Segment?"
        description={`This will permanently delete the group "${confirmDelete.label}". Existing campaigns using this segment will not be affected, but you won't be able to target it in new campaigns.`}
        confirmText="Delete Segment"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}
