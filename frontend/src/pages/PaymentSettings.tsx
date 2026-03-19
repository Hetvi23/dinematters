import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useFrappePostCall } from '@/lib/frappe'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  Activity,
  CheckCircle2,
  CreditCard,
  Info,
  Loader2,
  Lock,
  Save,
  ShieldAlert,
  Wallet,
  AlertCircle
} from 'lucide-react'

interface PaymentStats {
  current_month: string
  total_orders: number
  total_revenue: number
  platform_fee_collected: number
  monthly_minimum: number
  minimum_due: number
  razorpay_customer_id?: string | null
  billing_status?: string | null
  merchant_key_configured?: boolean
  razorpay_keys_updated_at?: string | null
  razorpay_keys_updated_by?: string | null
}

export default function PaymentSettings() {
  const { restaurantId } = useParams()
  const { selectedRestaurant } = useRestaurant()
  const activeRestaurantId = restaurantId || selectedRestaurant

  const [stats, setStats] = useState<PaymentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isAdmin, setIsAdmin] = useState<boolean>(false)

  // Form states for Admin settings
  const [merchantKeyId, setMerchantKeyId] = useState('')
  const [merchantKeySecret, setMerchantKeySecret] = useState('')
  const [merchantWebhookSecret, setMerchantWebhookSecret] = useState('')

  const { call: getPaymentStats } = useFrappePostCall<{ success: boolean; data: PaymentStats }>(
    'dinematters.dinematters.api.payments.get_restaurant_payment_stats'
  )
  const { call: setMerchantKeys } = useFrappePostCall(
    'dinematters.dinematters.api.payments.set_restaurant_razorpay_keys'
  )
  const { call: canSetMerchantKeys } = useFrappePostCall<{ success: boolean; allowed: boolean }>(
    'dinematters.dinematters.api.payments.can_set_merchant_keys'
  )

  const loadData = async () => {
    if (!activeRestaurantId) return
    setLoading(true)
    try {
      const statsResp: any = await getPaymentStats({ restaurant_id: activeRestaurantId })
      const statsBody = statsResp?.message ?? statsResp
      if (statsBody?.success && statsBody?.data) {
        setStats(statsBody.data)
      }

      const adminResp: any = await canSetMerchantKeys({})
      const adminBody = adminResp?.message ?? adminResp
      if (adminBody?.success) {
        setIsAdmin(Boolean(adminBody.allowed))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [activeRestaurantId])

  const handleSaveKeys = async () => {
    if (!activeRestaurantId) return
    if (!merchantKeyId || !merchantKeySecret) {
      toast.error('Key ID and Secret are required')
      return
    }

    setIsSaving(true)
    try {
      const resp: any = await setMerchantKeys({
        restaurant_id: activeRestaurantId,
        key_id: merchantKeyId,
        key_secret: merchantKeySecret,
        webhook_secret: merchantWebhookSecret,
      })
      const body = resp?.message ?? resp
      if (body?.success) {
        toast.success('Merchant gateway keys securely saved')
        setMerchantKeySecret('') // Clear secret from state after save
        setMerchantWebhookSecret('')
        loadData() // Refresh stats to update 'keysConfigured' state
      } else {
        throw new Error(body?.error || 'Failed to save merchant keys')
      }
    } catch (err: any) {
      toast.error('Configuration failed', { description: err?.message })
    } finally {
      setIsSaving(false)
    }
  }

  if (!activeRestaurantId) {
    return <div className="p-8 text-center text-muted-foreground">Please select a restaurant to view usage and settings.</div>
  }

  const keysConfigured = Boolean(stats?.merchant_key_configured)
  const keysLastUpdatedLabel = stats?.razorpay_keys_updated_at
    ? new Date(stats.razorpay_keys_updated_at).toLocaleDateString()
    : 'Not configured yet'

  return (
    <div className="space-y-8 pb-10">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Customer Pay & Usage</h1>
            {keysConfigured ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-200">Gateway Active</Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-200">Setup Required</Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Configure the payment gateway your customers use at checkout and understand how settlement works for your restaurant.
          </p>
        </div>
      </div>

      {/* High-level Gateway Status Row */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading gateway status...
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="relative overflow-hidden transition-all duration-300 border-none bg-card shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Gateway Status
              </CardTitle>
              {keysConfigured ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertCircle className="h-4 w-4 text-amber-500" />}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">{keysConfigured ? 'Configured' : 'Pending setup'}</div>
              <div className="mt-1 flex items-center gap-2">
                <p className="text-[11px] text-muted-foreground">{keysConfigured ? 'Customer checkout can route through your merchant account.' : 'Add your merchant keys to enable customer checkout.'}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden transition-all duration-300 border-none bg-card shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Configuration Access
              </CardTitle>
              <Lock className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">{isAdmin ? 'Admin enabled' : 'Restricted'}</div>
              <div className="mt-1 flex items-center gap-2">
                <p className="text-[11px] text-muted-foreground">{isAdmin ? `Last updated ${keysLastUpdatedLabel}` : 'Only system managers can update gateway keys.'}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden transition-all duration-300 border-none bg-card shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Settlement Model
              </CardTitle>
              <Wallet className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">Direct to you</div>
              <div className="mt-1 flex items-center gap-2">
                <p className="text-[11px] text-muted-foreground">Customer payments settle into your linked Razorpay account, while Dinematters billing is handled separately.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Configuration Area */}
      <div className="grid gap-6 lg:grid-cols-7">
        <div className="lg:col-span-4 space-y-6">
          {!isAdmin ? (
            <Card className="shadow-sm border-none bg-card">
              <CardContent className="p-10 flex flex-col items-center justify-center text-center space-y-4">
                <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center">
                  <ShieldAlert className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold">Admin Access Required</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Only system administrators can configure customer payment gateways. 
                    Please contact Dinematters support to update your merchant keys.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-sm border-none bg-card overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div className="space-y-1">
                  <CardTitle className="text-lg font-bold">Payment Gateway Keys</CardTitle>
                  <CardDescription>Configure where customer payments are routed</CardDescription>
                </div>
                <Lock className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-6">
                {keysConfigured && stats?.razorpay_keys_updated_at && (
                  <div className="p-3 rounded-xl bg-muted/50 text-xs text-muted-foreground flex items-center justify-between">
                    <span>Keys are configured.</span>
                    <span>Last updated: {new Date(stats.razorpay_keys_updated_at).toLocaleDateString()} by {stats.razorpay_keys_updated_by}</span>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="key-id" className="text-xs uppercase tracking-wide text-muted-foreground font-bold">Razorpay Key ID</Label>
                    <Input 
                      id="key-id" 
                      value={merchantKeyId} 
                      onChange={(e) => setMerchantKeyId(e.target.value)} 
                      placeholder="rzp_live_..." 
                      className="bg-muted/50 border-transparent focus-visible:bg-background focus-visible:border-primary font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="key-secret" className="text-xs uppercase tracking-wide text-muted-foreground font-bold">Razorpay Key Secret</Label>
                    <Input 
                      id="key-secret" 
                      type="password"
                      value={merchantKeySecret} 
                      onChange={(e) => setMerchantKeySecret(e.target.value)} 
                      placeholder="••••••••••••••••" 
                      className="bg-muted/50 border-transparent focus-visible:bg-background focus-visible:border-primary font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="webhook-secret" className="text-xs uppercase tracking-wide text-muted-foreground font-bold">Webhook Secret (Optional)</Label>
                    <Input 
                      id="webhook-secret" 
                      type="password"
                      value={merchantWebhookSecret} 
                      onChange={(e) => setMerchantWebhookSecret(e.target.value)} 
                      placeholder="Optional webhook validation secret" 
                      className="bg-muted/50 border-transparent focus-visible:bg-background focus-visible:border-primary font-mono"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-start gap-3">
                  <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Zero-Trust Storage</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Your secrets are encrypted at rest in the database. They are never exposed to the frontend after saving. Ensure you have copied them from your Razorpay Dashboard.
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-border flex justify-end">
                  <Button 
                    onClick={handleSaveKeys} 
                    disabled={isSaving} 
                    className="rounded-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all gap-2 min-w-[140px]"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Configuration
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Supporting Info Section */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="shadow-sm border-none bg-card">
            <CardHeader>
              <CardTitle className="text-lg font-bold">How Customer Payments Work</CardTitle>
              <CardDescription>Understanding the payment flow</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                  <div className="h-8 w-8 rounded-full bg-background border border-border flex items-center justify-center shrink-0">
                    <CreditCard className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">1. Customer Checkout</p>
                    <p className="text-[11px] text-muted-foreground">Customers complete orders using the gateway keys defined on this page.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                  <div className="h-8 w-8 rounded-full bg-background border border-border flex items-center justify-center shrink-0">
                    <Wallet className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">2. Direct Settlement</p>
                    <p className="text-[11px] text-muted-foreground">100% of the funds go directly into your linked Razorpay account instantly.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                  <div className="h-8 w-8 rounded-full bg-background border border-border flex items-center justify-center shrink-0">
                    <Activity className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">3. Platform Tracking</p>
                    <p className="text-[11px] text-muted-foreground">We track the GMV to calculate the 1.5% end-of-month platform commission.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-none bg-card bg-gradient-to-br from-indigo-500/5 to-blue-500/5">
            <CardContent className="p-5 flex items-start gap-3">
              <Info className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-indigo-900 dark:text-indigo-400">Where do I pay my fees?</p>
                <p className="text-indigo-800/80 dark:text-indigo-300/80 leading-relaxed text-xs">
                  This page only controls your incoming customer revenue. To configure your automatic monthly platform fee payment to Dinematters, visit the <span className="font-bold">Billing & Autopay</span> section.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
