import { useRestaurant } from '@/contexts/RestaurantContext'
import { useFrappePostCall } from '@/lib/frappe'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Send, Plus, Loader2, AlertCircle, ChevronRight, X, Check, Users, Trash2, XCircle, BarChart3, Search } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface Segment { name: string; segment_name: string; estimated_reach: number; criteria_type: string }
interface Campaign {
  name: string; campaign_name: string; channel: string; status: string
  target_segment: string; total_recipients: number; total_sent: number
  total_failed: number; total_conversions: number; total_cost_coins: number
  sent_at: string; creation: string
}

const STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-600',
  Scheduled: 'bg-blue-100 text-blue-700',
  Sending: 'bg-yellow-100 text-yellow-800 animate-pulse',
  Sent: 'bg-green-100 text-green-700',
  Failed: 'bg-red-100 text-red-700',
  Cancelled: 'bg-slate-100 text-slate-500',
}

const TEMPLATES = {
  'win_back': "Hi {{customer_name}}! We miss you at {{restaurant_name}} 🍽️ Come back and enjoy a special offer: {{coupon_code}}. Table's waiting!",
  'loyalty_nudge': "Hey {{customer_name}}! You have {{loyalty_balance}} loyalty coins at {{restaurant_name}} 🎉 Redeem them on your next visit!",
  'new_offer': "📢 Big news from {{restaurant_name}}! We've got something special just for you. Use code {{coupon_code}} for an exclusive deal!",
  'birthday': "🎂 Happy Birthday {{customer_name}}! {{restaurant_name}} wants to celebrate with you. Enjoy a special birthday treat: {{coupon_code}} ❤️",
  'custom': ''
}

type WizardStep = 'audience' | 'message' | 'schedule' | 'review'
const STEPS: WizardStep[] = ['audience', 'message', 'schedule', 'review']
const STEP_LABELS: Record<WizardStep, string> = { audience: 'Audience', message: 'Message', schedule: 'Schedule', review: 'Review' }





export default function MarketingCampaigns() {
  const { selectedRestaurant } = useRestaurant()
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [segments, setSegments] = useState<Segment[]>([])
  const [loading, setLoading] = useState(true)
  const [showWizard, setShowWizard] = useState(false)
  const [step, setStep] = useState<WizardStep>('audience')
  const [sending, setSending] = useState(false)
  
  // Management states
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  const [confirmDelete, setConfirmDelete] = useState<{open: boolean, id: string, label: string}>({ open: false, id: '', label: '' })
  const [confirmCancel, setConfirmCancel] = useState<{open: boolean, id: string, label: string}>({ open: false, id: '', label: '' })

  // Wizard form state
  const [form, setForm] = useState({
    campaign_name: '',
    channel: 'WhatsApp',
    target_segment: '',
    message_template: '',
    email_subject: '',
    template_key: 'custom',
    include_coupon: false,
    coupon_code: '',
    scheduled_at: '',
    send_now: true,
  })

  const { call: fetchCampaigns } = useFrappePostCall('dinematters.dinematters.api.marketing.get_campaigns')
  const { call: fetchSegments } = useFrappePostCall('dinematters.dinematters.api.marketing.get_segments')
  const { call: createCampaignApi } = useFrappePostCall('dinematters.dinematters.api.marketing.create_campaign')
  const { call: sendCampaignApi } = useFrappePostCall('dinematters.dinematters.api.marketing.send_campaign')
  const { call: deleteCampaignApi } = useFrappePostCall('dinematters.dinematters.api.marketing.delete_campaign')
  const { call: cancelCampaignApi } = useFrappePostCall('dinematters.dinematters.api.marketing.cancel_campaign')

  const load = () => {
    if (!selectedRestaurant) return
    setLoading(true)
    Promise.all([
      fetchCampaigns({ restaurant_id: selectedRestaurant }),
      fetchSegments({ restaurant_id: selectedRestaurant }),
    ]).then(([cRes, sRes]: any[]) => {
      if (cRes?.message?.success) {
        setCampaigns(cRes.message.data || [])
      }
      if (sRes?.message?.success) {
        setSegments(sRes.message.data || [])
      }
    })
    .catch((err) => console.error("Failed to load campaigns/segments:", err))
    .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [selectedRestaurant])

  const selectedSegment = segments.find(s => s.name === form.target_segment)
  const estimatedCoinCost = (selectedSegment?.estimated_reach ?? 0) * (form.channel === 'WhatsApp' ? 1.0 : form.channel === 'SMS' ? 0.25 : 0.05)

  const handleTemplateChange = (key: string) => {
    setForm(f => ({ ...f, template_key: key, message_template: TEMPLATES[key as keyof typeof TEMPLATES] ?? '' }))
  }

  const handleLaunch = async () => {
    if (!form.campaign_name || !form.target_segment || !form.message_template) {
      toast.error('Please fill all required fields')
      return
    }
    setSending(true)
    try {
      const createRes: any = await createCampaignApi({
        restaurant_id: selectedRestaurant,
        campaign_data: {
          campaign_name: form.campaign_name,
          channel: form.channel,
          target_segment: form.target_segment,
          message_template: form.message_template,
          email_subject: form.email_subject || null,
          include_coupon: form.include_coupon ? 1 : 0,
          coupon_code: form.coupon_code || null,
          scheduled_at: form.send_now ? null : form.scheduled_at,
        }
      })
      if (!createRes?.message?.success) throw new Error(createRes?.message?.error || 'Failed to create')

      if (form.send_now) {
        const sendRes: any = await sendCampaignApi({ campaign_id: createRes.message.data.name })
        if (!sendRes?.message?.success) throw new Error(sendRes?.message?.error || 'Failed to send')
        toast.success(`🚀 Campaign "${form.campaign_name}" is being sent to ~${selectedSegment?.estimated_reach} customers!`)
      } else {
        toast.success(`📅 Campaign "${form.campaign_name}" scheduled!`)
      }
      setShowWizard(false)
      setStep('audience')
      setForm({ campaign_name: '', channel: 'WhatsApp', target_segment: '', message_template: '', email_subject: '', template_key: 'custom', include_coupon: false, coupon_code: '', scheduled_at: '', send_now: true })
      load()
    } catch (e: any) {
      toast.error(e.message || 'Campaign failed')
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async () => {
    try {
      const res: any = await deleteCampaignApi({ campaign_id: confirmDelete.id })
      if (res?.message?.success) {
        toast.success('Campaign deleted')
        load()
      } else {
        toast.error(res?.message?.error || 'Failed to delete')
      }
    } catch (e: any) { toast.error(e.message) }
  }

  const handleCancel = async () => {
    try {
      const res: any = await cancelCampaignApi({ campaign_id: confirmCancel.id })
      if (res?.message?.success) {
        toast.success('Campaign cancelled')
        load()
      } else {
        toast.error(res?.message?.error || 'Failed to cancel')
      }
    } catch (e: any) { toast.error(e.message) }
  }

  const filteredCampaigns = campaigns.filter(c => {
    const matchesSearch = c.campaign_name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'All' || c.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const stepIndex = STEPS.indexOf(step)
  const canProceed = step === 'audience'
    ? !!form.target_segment && !!form.campaign_name && !!form.channel
    : step === 'message' ? !!form.message_template
    : true

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase text-muted-foreground/60 mb-2">
        <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
        <ChevronRight className="h-3 w-3" />
        <Link to="/marketing" className="hover:text-foreground transition-colors">Marketing</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Campaigns</span>
      </nav>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-sm text-muted-foreground">Create and manage marketing blasts</p>
        </div>
        <Button onClick={() => { setShowWizard(true); setStep('audience') }} className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
          <Plus className="h-4 w-4" /> New Campaign
        </Button>
      </div>

      {/* Campaign Creator Wizard */}
      {showWizard && (
        <Card className="border-indigo-200 shadow-md">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">New Campaign Wizard</CardTitle>
              <button onClick={() => setShowWizard(false)}><X className="h-4 w-4 text-muted-foreground hover:text-foreground" /></button>
            </div>
            {/* Step bar */}
            <div className="flex gap-1 mt-3">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-1 flex-1">
                  <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full flex-1 justify-center transition-colors
                    ${s === step ? 'bg-indigo-600 text-white' : i < stepIndex ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                    {i < stepIndex ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
                    {STEP_LABELS[s]}
                  </div>
                  {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                </div>
              ))}
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {/* Step 1: Audience */}
            {step === 'audience' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Campaign Name *</Label>
                  <Input placeholder="e.g. Weekend WhatsApp Blast" value={form.campaign_name} onChange={e => setForm(f => ({ ...f, campaign_name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Channel *</Label>
                  <Select value={form.channel} onValueChange={v => setForm(f => ({ ...f, channel: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WhatsApp">💬 WhatsApp (₹1.00/msg)</SelectItem>
                      <SelectItem value="SMS">📱 SMS (₹0.25/msg)</SelectItem>
                      <SelectItem value="Email">📧 Email (₹0.05/msg)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Target Segment *</Label>
                  {segments.length === 0 ? (
                    <div className="p-3 border rounded-md bg-amber-50 text-amber-700 text-sm flex gap-2"><AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>No segments found. <a href="/marketing/segments" className="underline">Create a segment first</a>.</span></div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {segments.map(seg => (
                        <div key={seg.name} onClick={() => setForm(f => ({ ...f, target_segment: seg.name }))}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${form.target_segment === seg.name ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950' : 'hover:border-muted-foreground'}`}>
                          <div className="flex justify-between items-start">
                            <p className="text-sm font-medium">{seg.segment_name}</p>
                            {form.target_segment === seg.name && <Check className="h-4 w-4 text-indigo-600" />}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{seg.criteria_type} · ~{seg.estimated_reach} customers</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {selectedSegment && (
                  <div className="md:col-span-2 p-3 rounded-lg bg-muted/40 text-sm flex items-center gap-2">
                    <Users className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                    <span>Est. Reach: <strong>~{selectedSegment.estimated_reach} customers</strong> · Est. Cost: <strong>{estimatedCoinCost.toFixed(1)} Coins</strong></span>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Message */}
            {step === 'message' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {Object.entries({ win_back: '💔 Win-Back', loyalty_nudge: '🏆 Points Nudge', new_offer: '📢 Offer Blast', birthday: '🎂 Birthday', custom: '✏️ Custom' }).map(([k, label]) => (
                    <button key={k} onClick={() => handleTemplateChange(k)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${form.template_key === k ? 'bg-indigo-600 text-white border-indigo-600' : 'hover:bg-muted'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label>Message Body * <span className="text-muted-foreground text-xs font-normal">supports {'{{customer_name}}'}, {'{{restaurant_name}}'}, {'{{loyalty_balance}}'}, {'{{coupon_code}}'}</span></Label>
                  <Textarea rows={5} placeholder="Type your message..."
                    value={form.message_template} onChange={e => setForm(f => ({ ...f, message_template: e.target.value, template_key: 'custom' }))} />
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Variables will be resolved before sending.</span>
                    <span className={form.channel === 'SMS' && form.message_template.length > 160 ? 'text-amber-500 font-semibold' : 'text-muted-foreground'}>
                      {form.message_template.length} chars
                      {form.channel === 'SMS' && form.message_template.length > 160 && ` ⚠️ Over 160 — will split into ${Math.ceil(form.message_template.length / 160)} SMS parts`}
                    </span>
                  </div>
                </div>
                {/* Email Subject — only shown for Email channel */}
                {form.channel === 'Email' && (
                  <div className="space-y-2">
                    <Label>Email Subject Line *</Label>
                    <Input placeholder="e.g. A special offer just for you from {{restaurant_name}}"
                      value={form.email_subject} onChange={e => setForm(f => ({ ...f, email_subject: e.target.value }))} />
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="inc_coupon" checked={form.include_coupon} onChange={e => setForm(f => ({ ...f, include_coupon: e.target.checked }))} className="rounded" />
                  <Label htmlFor="inc_coupon">Attach a Coupon Code</Label>
                </div>
                {form.include_coupon && (
                  <Input placeholder="Enter coupon code (e.g. WELCOME20)" value={form.coupon_code} onChange={e => setForm(f => ({ ...f, coupon_code: e.target.value }))} />
                )}
              </div>
            )}

            {/* Step 3: Schedule */}
            {step === 'schedule' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[{ label: '🚀 Send Now', value: true, sub: 'Messages dispatch immediately' }, { label: '📅 Schedule', value: false, sub: 'Pick a future date & time' }].map(opt => (
                    <div key={String(opt.value)} onClick={() => setForm(f => ({ ...f, send_now: opt.value }))}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${form.send_now === opt.value ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950' : 'hover:border-muted-foreground'}`}>
                      <p className="font-medium text-sm">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.sub}</p>
                    </div>
                  ))}
                </div>
                {!form.send_now && (
                  <div className="space-y-2">
                    <Label>Schedule At</Label>
                    <Input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} />
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Review */}
            {step === 'review' && (
              <div className="space-y-3">
                <div className="rounded-lg border overflow-hidden">
                  {[
                    ['Campaign', form.campaign_name],
                    ['Channel', form.channel],
                    ['Segment', selectedSegment?.segment_name ?? '—'],
                    ['Estimated Recipients', `~${selectedSegment?.estimated_reach ?? 0} customers`],
                    ['Estimated Cost', `${estimatedCoinCost.toFixed(1)} Coins`],
                    ['Schedule', form.send_now ? 'Send Immediately' : (form.scheduled_at || '—')],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between px-4 py-2.5 even:bg-muted/30 text-sm">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="font-medium">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border text-sm">
                  <p className="font-medium mb-1">Message Preview:</p>
                  <p className="text-muted-foreground text-xs whitespace-pre-wrap">{form.message_template.slice(0, 200)}{form.message_template.length > 200 ? '...' : ''}</p>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-3 border-t">
              <Button variant="outline" onClick={() => step === 'audience' ? setShowWizard(false) : setStep(STEPS[stepIndex - 1])} disabled={sending}>
                {step === 'audience' ? 'Cancel' : 'Back'}
              </Button>
              {step !== 'review' ? (
                <Button onClick={() => setStep(STEPS[stepIndex + 1])} disabled={!canProceed} className="bg-indigo-600 text-white hover:bg-indigo-700">
                  Continue <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleLaunch} disabled={sending} className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white gap-2">
                  {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Launching...</> : <><Send className="h-4 w-4" /> {form.send_now ? 'Launch Campaign' : 'Schedule Campaign'}</>}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campaign List */}
      <Card>
        <CardHeader className="pb-3 border-b space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold">Manage Campaigns</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search campaigns..."
                  className="pl-9 h-9 w-64 text-sm"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-32 bg-muted/50 border-none">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Status</SelectItem>
                  <SelectItem value="Sent">Sent</SelectItem>
                  <SelectItem value="Scheduled">Scheduled</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Failed">Failed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="space-y-3 pt-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3 text-muted-foreground">
              <Send className="h-12 w-12 opacity-20" />
              <p className="text-sm">
                {searchQuery || statusFilter !== 'All' 
                  ? "No campaigns match your filters." 
                  : "No campaigns yet. Click 'New Campaign' to get started."}
              </p>
              {(searchQuery || statusFilter !== 'All') && (
                <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(''); setStatusFilter('All'); }}>Clear Filters</Button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {filteredCampaigns.map(c => (
                <div key={c.name} className="py-4 flex items-center justify-between hover:bg-muted/10 -mx-2 px-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-muted shrink-0 text-xl">
                      {c.channel === 'WhatsApp' ? '💬' : c.channel === 'SMS' ? '📱' : '📧'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={`text-sm font-bold truncate ${c.status === 'Sent' ? 'text-indigo-600 hover:underline cursor-pointer' : ''}`}
                           onClick={() => c.status === 'Sent' && navigate(`/marketing/analytics?campaign=${c.name}`)}>
                          {c.campaign_name}
                        </p>
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${STATUS_COLORS[c.status] ?? ''}`}>
                          {c.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-medium">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {c.total_sent?.toLocaleString() || 0}</span>
                        {c.total_conversions > 0 && <span className="text-emerald-600 font-bold">🎯 {c.total_conversions} conversions</span>}
                        <span>💰 {c.total_cost_coins.toFixed(1)} coins</span>
                        <span>🗓️ {new Date(c.sent_at || c.creation).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {c.status === 'Sent' && (
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="View Analytics" onClick={() => navigate(`/marketing/analytics?campaign=${c.name}`)}>
                        <BarChart3 className="h-4 w-4 text-indigo-500" />
                      </Button>
                    )}
                    {c.status === 'Draft' && (
                      <button className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-red-50 text-red-400" title="Delete Draft" onClick={() => setConfirmDelete({ open: true, id: c.name, label: c.campaign_name })}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    {c.status === 'Scheduled' && (
                      <button className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-amber-50 text-amber-500" title="Cancel Schedule" onClick={() => setConfirmCancel({ open: true, id: c.name, label: c.campaign_name })}>
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(open) => setConfirmDelete(d => ({ ...d, open }))}
        title="Delete Draft?"
        description={`Are you sure you want to delete the draft campaign "${confirmDelete.label}"? This action cannot be undone.`}
        confirmText="Delete Draft"
        variant="destructive"
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={confirmCancel.open}
        onOpenChange={(open) => setConfirmCancel(d => ({ ...d, open }))}
        title="Cancel Schedule?"
        description={`Stop the campaign "${confirmCancel.label}" from being sent?`}
        confirmText="Yes, Cancel it"
        variant="warning"
        onConfirm={handleCancel}
      />
    </div>

  )
}
