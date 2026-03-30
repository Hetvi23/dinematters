import { useEffect, useMemo, useState } from 'react'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { useFrappePostCall } from '@/lib/frappe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  IndianRupee,
  Loader2,
  ShieldCheck,
  Wallet,
  Calendar,
  ArrowRight,
  Zap,
  Activity,
  Info,
  Link as LinkIcon,
  Fingerprint,
  CircleDashed,
} from 'lucide-react'
import { toast } from 'sonner'
import { format, endOfMonth, parseISO } from 'date-fns'
import { getFrappeError } from '@/lib/utils'

interface PaymentStats {
  current_month: string
  total_orders: number
  total_revenue: number
  platform_fee_collected: number
  monthly_minimum: number
  minimum_due: number
  razorpay_customer_id?: string | null
  razorpay_token_id?: string | null
  mandate_status?: string | null
  masked_customer_id?: string | null
  masked_token_id?: string | null
  merchant_key_configured?: boolean
  billing_status?: string | null
}

const statusToneMap: Record<string, string> = {
  active: 'bg-green-500/10 text-green-700 border-green-200',
  paid: 'bg-green-500/10 text-green-700 border-green-200',
  overdue: 'bg-red-500/10 text-red-700 border-red-200',
  pending: 'bg-amber-500/10 text-amber-700 border-amber-200',
}

const mandateToneMap: Record<string, string> = {
  active: 'bg-green-500/10 text-green-700 border-green-200',
  inactive: 'bg-muted text-muted-foreground border-border',
  failed: 'bg-red-500/10 text-red-700 border-red-200',
  pending: 'bg-amber-500/10 text-amber-700 border-amber-200',
}

export default function AutopaySetupPage() {
  const { selectedRestaurant, restaurants } = useRestaurant()
  const [stats, setStats] = useState<PaymentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSettingUp, setIsSettingUp] = useState(false)
  const [ownerName, setOwnerName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')

  const { call: getPaymentStats } = useFrappePostCall<{ success: boolean; data: PaymentStats }>(
    'dinematters.dinematters.api.payments.get_restaurant_payment_stats'
  )
  const { call: createTokenOrder } = useFrappePostCall(
    'dinematters.dinematters.api.payments.create_tokenization_order'
  )

  const activeRestaurant = useMemo(
    () => restaurants.find((item: any) => item.name === selectedRestaurant || item.restaurant_id === selectedRestaurant),
    [restaurants, selectedRestaurant]
  )

  const loadRazorpay = async () => {
    if ((window as any).Razorpay) return true
    return new Promise<boolean>((resolve) => {
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })
  }

  const loadStats = async () => {
    if (!selectedRestaurant) return
    setLoading(true)
    try {
      const response: any = await getPaymentStats({ restaurant_id: selectedRestaurant })
      const body = response?.message ?? response
      if (body?.success && body?.data) {
        setStats(body.data)
        toast.error(body?.error || 'Failed to load autopay status')
      }
    } catch (error: any) {
      toast.error('Failed to load autopay status', { description: getFrappeError(error) })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!selectedRestaurant) return
    setOwnerName(activeRestaurant?.restaurant_name || activeRestaurant?.name || '')
    setOwnerEmail((activeRestaurant as any)?.owner_email || '')
  }, [activeRestaurant, selectedRestaurant])

  useEffect(() => {
    loadStats()
  }, [selectedRestaurant])

  const handleSetupAutopay = async () => {
    if (!selectedRestaurant) {
      toast.error('Please select a restaurant')
      return
    }
    if (!ownerName || !ownerEmail) {
      toast.error('Please provide account holder name and email')
      return
    }

    setIsSettingUp(true)
    try {
      const razorpayLoaded = await loadRazorpay()
      if (!razorpayLoaded) {
        throw new Error('Failed to load Razorpay Checkout')
      }

      const response: any = await createTokenOrder({
        restaurant_id: selectedRestaurant,
        amount: 1,
        customer_name: ownerName,
        customer_email: ownerEmail,
      })

      const body = response?.message ?? response
      if (!body?.success || !body?.data) {
        throw new Error(body?.error || 'Failed to initiate autopay setup')
      }

      const { key_id, razorpay_order_id } = body.data
      const options = {
        key: key_id,
        order_id: razorpay_order_id,
        name: 'Dinematters',
        description: 'Autopay setup for monthly commission billing',
        prefill: {
          name: ownerName,
          email: ownerEmail,
        },
        theme: {
          color: '#f97316',
        },
        modal: {
          ondismiss: () => {
            toast('Autopay setup was closed before completion')
          },
        },
        handler: async () => {
          toast.success('Autopay authorization submitted. We are verifying the mandate details.')
          setTimeout(() => {
            loadStats()
          }, 3000)
        },
      }

      const rzp = new (window as any).Razorpay(options)
      rzp.on('payment.failed', (failure: any) => {
        toast.error(failure?.error?.description || 'Autopay setup failed')
      })
      rzp.open()
    } catch (error: any) {
      toast.error('Failed to start autopay setup', { description: getFrappeError(error) })
    } finally {
      setIsSettingUp(false)
    }
  }

  if (!selectedRestaurant) {
    return <div className="p-8 text-center text-muted-foreground">Please select a restaurant</div>
  }

  const billingStatus = stats?.billing_status || 'pending'
  const statusTone = statusToneMap[billingStatus] || 'bg-muted text-muted-foreground border-border'
  const autopayEnabled = Boolean(stats?.razorpay_customer_id)
  const mandateStatus = stats?.mandate_status || (autopayEnabled ? 'active' : 'inactive')
  const mandateTone = mandateToneMap[mandateStatus] || 'bg-muted text-muted-foreground border-border'
  const currentMonthLabel = stats?.current_month || '—'
  const ordersCount = stats?.total_orders ?? 0
  const totalRevenue = (stats?.total_revenue ?? 0).toFixed(2)
  const platformFee = (stats?.platform_fee_collected ?? 0).toFixed(2)
  const minimumDue = (stats?.minimum_due ?? 0).toFixed(2)

  // Calculate Next Billing Date
  let nextBillingDate = 'End of current month'
  if (stats?.current_month) {
    try {
      // current_month is "YYYY-MM", parse it to get the last day
      const date = parseISO(`${stats.current_month}-01`)
      nextBillingDate = format(endOfMonth(date), 'MMM do, yyyy')
    } catch (e) {
      // fallback if parsing fails
    }
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Autopay Setup</h1>
            <Badge variant="outline" className={statusTone}>{billingStatus}</Badge>
          </div>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Authorize Dinematters to collect your monthly platform commission seamlessly at the end of each billing cycle.
          </p>
        </div>

        {!autopayEnabled && !loading && (
          <div className="flex items-center gap-4 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 p-4 rounded-xl border border-orange-100 dark:border-orange-900/30 group">
            <div className="h-10 w-10 bg-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Zap className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-bold text-orange-700 dark:text-orange-400">Action Required</p>
              <p className="text-[11px] text-orange-600/80 dark:text-orange-500/80">Configure your billing mandate to prevent account suspension.</p>
            </div>
          </div>
        )}
      </div>

      {/* High-level Status Row - Following Dashboard StatCard Pattern */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden transition-all duration-300 border-none bg-card shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Current Month
            </CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">{currentMonthLabel}</div>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-[11px] text-muted-foreground">
                Cycle ends <span className="font-medium text-foreground">{nextBillingDate}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden transition-all duration-300 border-none bg-card shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Orders Tracked
            </CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">{ordersCount}</div>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-[11px] text-muted-foreground">Contributing to platform fee</p>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden transition-all duration-300 border-none bg-card shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Est. Platform Fee
            </CardTitle>
            <IndianRupee className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">₹{platformFee}</div>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-[11px] text-muted-foreground">From GMV ₹{totalRevenue}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden transition-all duration-300 border-none bg-card shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Minimum Due Guard
            </CardTitle>
            <ShieldCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">₹{minimumDue}</div>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-[11px] text-muted-foreground">Floor amount if fees fall short</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Configuration Area */}
      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-4 shadow-sm border-none bg-card overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold">Mandate Configuration</CardTitle>
              <CardDescription>Link your account via Razorpay for automatic monthly billing</CardDescription>
            </div>
            {autopayEnabled && (
               <span className="flex items-center text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md">
                 <CheckCircle2 className="h-3 w-3 mr-1" />
                 Active
               </span>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="autopay-name" className="text-xs uppercase tracking-wide text-muted-foreground font-bold">Account Holder Name</Label>
                <Input 
                  id="autopay-name" 
                  value={ownerName} 
                  onChange={(e) => setOwnerName(e.target.value)} 
                  placeholder="Restaurant owner name" 
                  className="bg-muted/50 border-transparent focus-visible:bg-background focus-visible:border-primary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="autopay-email" className="text-xs uppercase tracking-wide text-muted-foreground font-bold">Billing Email</Label>
                <Input 
                  id="autopay-email" 
                  type="email" 
                  value={ownerEmail} 
                  onChange={(e) => setOwnerEmail(e.target.value)} 
                  placeholder="owner@example.com" 
                  className="bg-muted/50 border-transparent focus-visible:bg-background focus-visible:border-primary"
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-start gap-3">
              <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Secure Vaulting</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your payment details are processed and stored securely by Razorpay. Dinematters does not store your card information directly.
                </p>
              </div>
            </div>

            {autopayEnabled && (
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Linked Mandate Details</p>
                    <p className="text-xs text-muted-foreground">Safe masked details from your Razorpay autopay linkage.</p>
                  </div>
                  <Badge variant="outline" className={mandateTone}>{mandateStatus}</Badge>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border bg-background/70 px-3 py-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground font-bold">
                      <LinkIcon className="h-3.5 w-3.5" />
                      Razorpay Customer
                    </div>
                    <p className="mt-2 text-sm font-semibold text-foreground">{stats?.masked_customer_id || 'Linked'}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Customer reference stored for recurring billing.</p>
                  </div>

                  <div className="rounded-lg border bg-background/70 px-3 py-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground font-bold">
                      <Fingerprint className="h-3.5 w-3.5" />
                      Token Reference
                    </div>
                    <p className="mt-2 text-sm font-semibold text-foreground">{stats?.masked_token_id || 'Available after mandate capture'}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Masked token identifier used for secure recurring debit.</p>
                  </div>

                  <div className="rounded-lg border bg-background/70 px-3 py-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground font-bold">
                      <CircleDashed className="h-3.5 w-3.5" />
                      Mandate Status
                    </div>
                    <p className="mt-2 text-sm font-semibold capitalize text-foreground">{mandateStatus}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Current authorization state received from saved billing records.</p>
                  </div>

                  <div className="rounded-lg border bg-background/70 px-3 py-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground font-bold">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Merchant Integration
                    </div>
                    <p className="mt-2 text-sm font-semibold text-foreground">{stats?.merchant_key_configured ? 'Configured' : 'Using default billing integration'}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">No raw card or bank account values are stored or displayed here.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-border flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Clicking setup will open Razorpay checkout.</p>
              <Button 
                onClick={handleSetupAutopay} 
                disabled={isSettingUp} 
                className="rounded-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all gap-2"
              >
                {isSettingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                {autopayEnabled ? 'Update Mandate' : 'Setup Autopay'}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Supporting Info Section */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="shadow-sm border-none bg-card">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Billing Lifecycle</CardTitle>
              <CardDescription>How monthly collections work</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                  <div className="h-8 w-8 rounded-full bg-background border border-border flex items-center justify-center shrink-0">
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">1. End of Month</p>
                    <p className="text-[11px] text-muted-foreground">We finalize your total order count and calculate the platform fee.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                  <div className="h-8 w-8 rounded-full bg-background border border-border flex items-center justify-center shrink-0">
                    <CreditCard className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">2. Secure Charge</p>
                    <p className="text-[11px] text-muted-foreground">Razorpay securely processes the charge against your saved mandate.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                  <div className="h-8 w-8 rounded-full bg-background border border-border flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">3. Account Good Standing</p>
                    <p className="text-[11px] text-muted-foreground">Successful payment ensures your restaurant remains active on the platform.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-none bg-card bg-gradient-to-br from-amber-500/5 to-orange-500/5">
            <CardContent className="p-5 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-amber-900 dark:text-amber-400">Important Distinction</p>
                <p className="text-amber-800/80 dark:text-amber-300/80 leading-relaxed text-xs">
                  This page configures the billing mandate for <span className="font-bold">Dinematters platform fees</span>. 
                  To manage how your customers pay you, please visit the <span className="font-bold">Customer pay & Usage</span> section.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
