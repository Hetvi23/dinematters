import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { useRestaurant } from '@/contexts/RestaurantContext'
import { useFrappePostCall } from '@/lib/frappe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertCircle,
  IndianRupee,
  Loader2,
  ShieldCheck,
  Zap,
  Info,
  Plus,
  Coins,
  History,
  ShieldAlert,
  Crown,
  CheckCircle2,
  Smartphone,
} from 'lucide-react'
import { toast } from 'sonner'
import { AiRechargeModal } from '@/components/AiRechargeModal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { format, addDays } from 'date-fns'

interface BillingInfo {
  coins_balance: number
  auto_recharge_enabled: boolean
  auto_recharge_threshold: number
  auto_recharge_amount: number
  mandate_active: boolean
  daily_limit: number
  current_daily_vol: number
  deferred_plan_type?: 'SILVER' | 'GOLD' | 'DIAMOND' | null
  plan_change_date?: string | null
  monthly_minimum: number
  platform_fee_percent: number
  plan_defaults: {
    pro_monthly: number   // GOLD monthly minimum
    lux_monthly: number   // DIAMOND monthly minimum
    lux_commission: number
    lux_barrier: number   // DIAMOND upgrade entry requirement
  }
}

export default function AutopaySetupPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { selectedRestaurant, restaurants, planType, refreshConfig } = useRestaurant()

  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isChangingPlan, setIsChangingPlan] = useState(false)
  const [isSettingUpMandate, setIsSettingUpMandate] = useState(false)
  const [showRecharge, setShowRecharge] = useState(false)
  
  // Local form state
  const [enabled, setEnabled] = useState(false)
  const [threshold, setThreshold] = useState('200')
  const [amount, setAmount] = useState('1000')

  // Plan change confirmation state
  const [showConfirm, setShowConfirm] = useState(false)
  const [newPlanSelection, setNewPlanSelection] = useState<'SILVER' | 'GOLD' | 'DIAMOND' | null>(null)

  const { call: getInfo } = useFrappePostCall<any>(
    'dinematters.dinematters.api.coin_billing.get_coin_billing_info'
  )
  const { call: updateSettings } = useFrappePostCall<any>(
    'dinematters.dinematters.api.coin_billing.update_autopay_settings'
  )
  const { call: updatePlan } = useFrappePostCall<any>(
    'dinematters.dinematters.api.coin_billing.update_subscription_plan'
  )
  const { call: createTokenOrder } = useFrappePostCall<any>(
    'dinematters.dinematters.api.payments.create_tokenization_order'
  )
  const { call: confirmMandate } = useFrappePostCall<any>(
    'dinematters.dinematters.api.payments.confirm_mandate_setup'
  )

  const activeRes = restaurants.find(r => r.name === selectedRestaurant)

  const loadInfo = async () => {
    if (!selectedRestaurant) return
    setLoading(true)
    try {
      const res = await getInfo({ restaurant: selectedRestaurant })
      if (res.message) {
        setBillingInfo(res.message)
        setEnabled(res.message.auto_recharge_enabled)
        setThreshold(res.message.auto_recharge_threshold.toString())
        setAmount(res.message.auto_recharge_amount.toString())
      }
    } catch (error) {
      toast.error('Failed to load billing info')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInfo()
  }, [selectedRestaurant])
  
  // Auto-trigger recharge modal if buy=true is in the URL
  useEffect(() => {
    if (searchParams.get('buy') === 'true') {
      setShowRecharge(true)
      // Clean up the parameter so it doesn't re-trigger on fresh refresh
      searchParams.delete('buy')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const handlePlanToggle = async (newPlan: 'SILVER' | 'GOLD' | 'DIAMOND') => {
    if (!selectedRestaurant || newPlan === planType) return
    
    // 1. Check for pending changes
    if (billingInfo?.deferred_plan_type) {
      toast.error('A plan change is already scheduled for tomorrow.')
      return
    }

    // 2. Entrance Barrier Check
    const proMin = billingInfo?.plan_defaults?.pro_monthly || 999;
    const luxBarrier = billingInfo?.plan_defaults?.lux_barrier || 1299;

    if (newPlan === 'GOLD' && (billingInfo?.coins_balance || 0) < proMin) {
      toast.error('Insufficient Coins', {
        description: `You need at least ${proMin} coins in your wallet to upgrade to GOLD.`
      })
      setShowRecharge(true)
      return
    }
    
    if (newPlan === 'DIAMOND' && (billingInfo?.coins_balance || 0) < luxBarrier) {
      toast.error('Insufficient Coins', {
        description: `You need at least ${luxBarrier} coins in your wallet to upgrade to DIAMOND.`
      })
      setShowRecharge(true)
      return
    }


    // 3. Trigger Modern Confirmation Dialog
    setNewPlanSelection(newPlan)
    setShowConfirm(true)
  }

  const confirmPlanChange = async () => {
    if (!selectedRestaurant || !newPlanSelection) return
    
    setIsChangingPlan(true)
    try {
      const res = await updatePlan({
        restaurant: selectedRestaurant,
        plan_type: newPlanSelection
      })
      
      if (res.message?.success) {
        toast.success(`Success! Plan change scheduled.`, {
          description: res.message.message
        })
      }
      
      await loadInfo()
      await refreshConfig()
    } catch (error: any) {
      toast.error('Failed to schedule plan change', { description: error.message })
    } finally {
      setIsChangingPlan(false)
      setShowConfirm(false)
      setNewPlanSelection(null)
    }
  }

  const handleSaveSettings = async () => {
    if (!selectedRestaurant) return
    setIsUpdating(true)
    try {
      await updateSettings({
        restaurant: selectedRestaurant,
        enabled,
        threshold: parseFloat(threshold),
        amount: parseFloat(amount)
      })
      toast.success('Autopay settings updated')
      loadInfo()
    } catch (error) {
      toast.error('Failed to update settings')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleSetupMandate = async () => {
    setIsSettingUpMandate(true)
    try {
      const loaded = await new Promise<boolean>((resolve) => {
        if ((window as any).Razorpay) return resolve(true)
        const script = document.createElement('script')
        script.src = 'https://checkout.razorpay.com/v1/checkout.js'
        script.onload = () => resolve(true)
        script.onerror = () => resolve(false)
        document.body.appendChild(script)
      })

      if (!loaded) throw new Error('Razorpay failed to load')

      const res = await createTokenOrder({
        restaurant_id: selectedRestaurant,
        customer_name: activeRes?.restaurant_name || activeRes?.name,
        customer_email: (activeRes as any)?.owner_email || ''
      })

      if (!res.message?.success) throw new Error(res.message?.error || 'Failed to start mandate setup')

      const { key_id, razorpay_subscription_id } = res.message.data

      const rzp = new (window as any).Razorpay({
        key: key_id,
        subscription_id: razorpay_subscription_id,
        name: 'DineMatters Autopay',
        description: 'Authorize Mandate (Safety Cap: ₹15,000) — ₹1 verification fee',
        theme: { color: '#f97316' },
        handler: async (response: any) => {
          // Verify signature and save token immediately
          try {
            const confirmRes = await confirmMandate({
              restaurant_id: selectedRestaurant,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: razorpay_subscription_id, // Pass sub_id as order_id ref
              razorpay_signature: response.razorpay_signature,
            })
            if (confirmRes.message?.mandate_active) {
              toast.success('✅ Autopay mandate activated!', {
                description: 'Your payment method is saved for automatic top-ups.'
              })
            } else {
              toast.success('Payment verified! Mandate will activate shortly.', {
                description: 'We will confirm via webhook within a few minutes.'
              })
            }
          } catch {
            toast.success('Payment done! Mandate activating...', {
              description: 'This may take a few minutes to reflect.'
            })
          }
          setTimeout(loadInfo, 2000)
        },
        modal: {
          ondismiss: () => toast.error('Mandate setup cancelled.'),
        },
      })
      rzp.open()
    } catch (error: any) {
      toast.error('Mandate setup failed', { description: error.message })
    } finally {
      setIsSettingUpMandate(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Billing & Subscription</h1>
          <p className="text-sm text-muted-foreground">Manage your DineMatters tier, wallet and automatic recharge.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/ledger')}>
             <History className="h-4 w-4" />
             Ledger
          </Button>
          <Button size="sm" className="gap-2 bg-primary text-white" onClick={() => setShowRecharge(true)}>
             <Plus className="h-4 w-4" />
             Buy Coins
          </Button>
        </div>
      </div>

      {/* Pending Change Alert */}
      {billingInfo?.deferred_plan_type && (
        <Card className="border-primary/20 bg-primary/5 dark:bg-primary/10 overflow-hidden animate-in slide-in-from-top-4 duration-500">
           <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                 <Loader2 className="h-5 w-5 text-primary animate-spin" />
              </div>
              <div className="flex-1">
                 <h4 className="text-sm font-black uppercase tracking-tight text-primary">Plan switch scheduled</h4>
                  <p className="text-xs text-muted-foreground">
                    Your {billingInfo.deferred_plan_type} plan will be effective from <b>{format(new Date(billingInfo.plan_change_date!), 'do MMMM')} at 12:00 AM</b>. 
                    {(billingInfo.deferred_plan_type === 'GOLD' || billingInfo.deferred_plan_type === 'DIAMOND') && " Premium features will unlock then."}
                  </p>
              </div>
              <Badge variant="outline" className="border-primary/30 text-primary">
                 Effective {new Date(billingInfo.plan_change_date!).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </Badge>
           </CardContent>
        </Card>
      )}

      {/* Subscription Tier Switcher */}
      <Card className="border-none shadow-lg bg-gradient-to-r from-primary/5 via-background to-primary/5 overflow-hidden">
        <CardContent className="p-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-1">
             <button
              onClick={() => handlePlanToggle('SILVER')}
              disabled={isChangingPlan}
              className={cn(
                "flex items-center justify-center gap-3 py-4 px-6 rounded-xl transition-all",
                planType === 'SILVER' 
                  ? "bg-background shadow-sm border border-border/50" 
                  : "hover:bg-primary/5 text-muted-foreground opacity-60"
              )}
             >
                <div className={cn("p-2 rounded-lg", planType === 'SILVER' ? "bg-primary/10 text-primary" : "bg-muted")}>
                   <Smartphone className="h-5 w-5" />
                </div>
                <div className="text-left">
                   <p className="text-sm font-black uppercase tracking-tight">SILVER PLAN</p>
                   <p className="text-[10px] font-medium opacity-70">Free • Basic Features</p>
                </div>
                {planType === 'SILVER' && <CheckCircle2 className="h-4 w-4 text-primary ml-auto" />}
             </button>

             <button
              onClick={() => handlePlanToggle('GOLD')}
              disabled={isChangingPlan}
              className={cn(
                "flex items-center justify-center gap-3 py-4 px-6 rounded-xl transition-all",
                planType === 'GOLD' 
                  ? "bg-background shadow-sm border border-border/50" 
                  : "hover:bg-primary/5 text-muted-foreground opacity-60"
              )}
             >
                <div className={cn("p-2 rounded-lg", planType === 'GOLD' ? "bg-primary/10 text-primary" : "bg-muted")}>
                   {isChangingPlan ? <Loader2 className="h-5 w-5 animate-spin" /> : <Crown className="h-5 w-5" />}
                </div>
                <div className="text-left">
                   <div className="flex items-center gap-2">
                       <p className="text-sm font-black uppercase tracking-tight">GOLD PLAN</p>
                       <Badge className="bg-primary/20 text-primary text-[8px] h-4 hover:bg-primary/20">POPULAR</Badge>
                   </div>
                   <p className="text-[10px] font-medium opacity-70">Min {billingInfo?.plan_defaults?.pro_monthly || 999} / month • Gold Features</p>
                </div>
                {planType === 'GOLD' && <CheckCircle2 className="h-4 w-4 text-primary ml-auto" />}
             </button>

             <button
              onClick={() => handlePlanToggle('DIAMOND')}
              disabled={isChangingPlan}
              className={cn(
                "flex items-center justify-center gap-3 py-4 px-6 rounded-xl transition-all",
                planType === 'DIAMOND' 
                  ? "bg-background shadow-sm border border-border/50" 
                  : "hover:bg-indigo-500/5 text-muted-foreground opacity-60"
              )}
             >
                <div className={cn("p-2 rounded-lg", planType === 'DIAMOND' ? "bg-indigo-500/10 text-indigo-500" : "bg-muted")}>
                   {isChangingPlan ? <Loader2 className="h-5 w-5 animate-spin" /> : <Crown className="h-5 w-5" />}
                </div>
                <div className="text-left">
                   <div className="flex items-center gap-2">
                       <p className="text-sm font-black uppercase tracking-tight">DIAMOND PLAN</p>
                       <Badge className="bg-indigo-500 text-white text-[8px] h-4 hover:bg-indigo-600">ELITE</Badge>
                   </div>
                   <p className="text-[10px] font-medium opacity-70">Min {billingInfo?.plan_defaults?.lux_monthly || 1299} / month • Full Ordering</p>
                </div>
                {planType === 'DIAMOND' && <CheckCircle2 className="h-4 w-4 text-indigo-500 ml-auto" />}
             </button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Balance Card */}
        <Card className="md:col-span-1 shadow-sm border-none bg-primary/10 dark:bg-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-primary">Current Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Coins className="h-8 w-8 text-primary" />
              <div className="text-4xl font-bold tracking-tighter">{billingInfo?.coins_balance.toLocaleString()}</div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">1 Coin = ₹1. Unified wallet for all charges.</p>
          </CardContent>
        </Card>

        {/* Mandate Status */}
        <Card className="md:col-span-2 shadow-sm border-none bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Autopay Mandate Status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${billingInfo?.mandate_active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                {billingInfo?.mandate_active ? <ShieldCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
              </div>
              <div>
                <p className="font-bold text-lg">{billingInfo?.mandate_active ? 'Active' : 'Not Setup'}</p>
                <p className="text-xs text-muted-foreground">
                  {billingInfo?.mandate_active 
                    ? 'Your account is linked for automatic top-ups.' 
                    : 'Mandate required for automatic threshold-based recharging.'}
                </p>
              </div>
            </div>
            <Button 
              variant={billingInfo?.mandate_active ? "outline" : "default"} 
              onClick={handleSetupMandate}
              disabled={isSettingUpMandate}
            >
              {isSettingUpMandate ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Securing Connection...
                </>
              ) : (
                billingInfo?.mandate_active ? 'Update Card' : 'Setup Autopay'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Main Settings */}
      <Card className="shadow-sm border-none bg-card overflow-hidden">
        <CardHeader className="border-b bg-muted/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Automatic Recharge Context
              </CardTitle>
              <CardDescription>Invisible billing to ensure your AI and Order flow stays uninterrupted.</CardDescription>
            </div>
            <div className="flex items-center gap-2 bg-background p-2 rounded-lg border shadow-sm">
              <Checkbox id="auto-recharge-toggle" checked={enabled} onCheckedChange={(checked) => setEnabled(!!checked)} />
              <Label htmlFor="auto-recharge-toggle" className="font-bold text-xs uppercase tracking-widest cursor-pointer">{enabled ? 'Enabled' : 'Disabled'}</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-8">
          <div className={cn("grid gap-8 md:grid-cols-2 transition-all duration-300", !enabled && "opacity-60 grayscale-[0.5] pointer-events-none select-none")}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-bold">Auto-Recharge Threshold (₹)</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="number" 
                    min="300"
                    className={cn(
                      "pl-9 bg-muted/30 border-transparent focus:bg-background focus:border-primary",
                      parseFloat(threshold) < 300 && "border-destructive focus:border-destructive"
                    )} 
                    value={threshold} 
                    onChange={e => setThreshold(e.target.value)}
                  />
                </div>
                {parseFloat(threshold) < 300 ? (
                  <p className="text-[11px] text-destructive flex items-center gap-1 font-medium animate-pulse">
                    <AlertCircle className="h-3 w-3" />
                    Minimum threshold must be ₹300 for system stability.
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Trigger recharge when balance drops below this amount.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-bold">Recharge Amount (₹)</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="number" 
                    min="500"
                    className={cn(
                      "pl-9 bg-muted/30 border-transparent focus:bg-background focus:border-primary",
                      parseFloat(amount) < 500 && "border-destructive focus:border-destructive"
                    )} 
                    value={amount} 
                    onChange={e => setAmount(e.target.value)}
                  />
                </div>
                {parseFloat(amount) < 500 ? (
                  <p className="text-[11px] text-destructive flex items-center gap-1 font-medium animate-pulse">
                    <AlertCircle className="h-3 w-3" />
                    Minimum recharge amount must be ₹500.
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Every time threshold is hit, we will recharge this much.</p>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border p-4 bg-muted/20 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Daily Safety Limit</Label>
                  <Badge variant="secondary">₹{billingInfo?.daily_limit.toLocaleString()}</Badge>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span>Used Today: ₹{billingInfo?.current_daily_vol.toLocaleString()}</span>
                    <span>Remaining: ₹{(billingInfo?.daily_limit! - billingInfo?.current_daily_vol!).toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 w-full bg-background rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all" 
                      style={{ width: `${(billingInfo?.current_daily_vol! / billingInfo?.daily_limit!) * 100}%` }} 
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground flex gap-1 items-start">
                  <Info className="h-3 w-3 shrink-0" />
                  This hard limit prevents runaway charges in case of high volume. Contact support to increase.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
               <ShieldCheck className="h-4 w-4 text-emerald-500" />
               PCI-DSS Compliant • SSL Encrypted • Razorpay Secure
            </div>
            <Button 
              className="gap-2" 
              onClick={handleSaveSettings} 
              disabled={isUpdating || (enabled && (parseFloat(threshold) < 300 || parseFloat(amount) < 500))}
            >
              {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Configuration
            </Button>
          </div>
        </CardContent>
      </Card>

      <AiRechargeModal 
        open={showRecharge} 
        onClose={() => setShowRecharge(false)} 
        restaurant={selectedRestaurant!} 
        onSuccess={loadInfo}
      />

      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title={`Switch to ${newPlanSelection} plan?`}
        description={`Your ${newPlanSelection} plan will be effective from tomorrow ${format(addDays(new Date(), 1), 'do MMMM')} at 12:00 AM.`}
        confirmText="Yes, Switch Now"
        cancelText="Maybe Later"
        variant="info"
        onConfirm={confirmPlanChange}
        loading={isChangingPlan}
      />
    </div>
  )
}
