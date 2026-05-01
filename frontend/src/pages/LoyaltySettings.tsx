import { useState, useEffect } from 'react'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { useFrappePostCall, useFrappeGetDoc } from '@/lib/frappe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from "@/components/ui/input"
import { NumberInput } from "@/components/ui/number-input"
import { toast } from 'sonner'
import { Coins, Share2, TrendingUp, Gift, Info, Trophy, Settings } from 'lucide-react'
import { LockedFeature } from '@/components/FeatureGate/LockedFeature'

export default function LoyaltySettings() {
  const { selectedRestaurant, isDiamond } = useRestaurant()
  const [saving, setSaving] = useState(false)
  const [programName, setProgramName] = useState('')
  const [enableLoyalty, setEnableLoyalty] = useState(false)
  const [settings, setSettings] = useState({
    points_per_inr: 0.1,
    min_redemption_threshold: 0,
    min_billing_for_redemption: 0,
    share_reward_coins: 20,
    min_unique_opens_for_reward: 2,
    coins_per_unique_open: 2,
    max_opens_rewarded_per_share: 5,
    referral_order_reward_coins: 100,
    new_user_welcome_reward_coins: 50,
    welcome_coupon_discount: 0
  })

  // Fetch Restaurant Config for enable_loyalty
  const { data: restaurantDoc, mutate: mutateRestaurant } = useFrappeGetDoc(
    'Restaurant',
    selectedRestaurant || '',
    selectedRestaurant ? `Restaurant-${selectedRestaurant}` : null
  )

  // Fetch Loyalty Program config
  const { call: getLoyaltyConfig } = useFrappePostCall('dinematters.dinematters.api.loyalty.get_loyalty_config')
  const { call: updateLoyaltyConfig } = useFrappePostCall('dinematters.dinematters.api.loyalty.update_loyalty_config')

  useEffect(() => {
    if (restaurantDoc) {
      setEnableLoyalty(!!restaurantDoc.enable_loyalty)
    }
  }, [restaurantDoc])

  useEffect(() => {
    if (selectedRestaurant) {
      getLoyaltyConfig({ restaurant_id: selectedRestaurant })
        .then((res: any) => {
          const body = res?.message || res?.data
          const config = body?.data
          if (config) {
            setProgramName(config.program_name || '')
            setSettings({
               points_per_inr: config.points_per_inr ?? 0.1,
               min_redemption_threshold: config.min_redemption_threshold ?? 0,
               min_billing_for_redemption: config.min_billing_for_redemption ?? 0,
               share_reward_coins: config.share_reward_coins ?? 20,
               min_unique_opens_for_reward: config.min_unique_opens_for_reward ?? 2,
               coins_per_unique_open: config.coins_per_unique_open ?? 2,
               max_opens_rewarded_per_share: config.max_opens_rewarded_per_share ?? 5,
               referral_order_reward_coins: config.referral_order_reward_coins ?? 100,
               new_user_welcome_reward_coins: config.new_user_welcome_reward_coins ?? 50,
               welcome_coupon_discount: config.welcome_coupon_discount ?? 0
            })
          }
        })
    }
  }, [selectedRestaurant])

  const handleSave = async () => {
    if (!selectedRestaurant) return
    
    setSaving(true)
    try {
      const response: any = await updateLoyaltyConfig({
        restaurant_id: selectedRestaurant,
        enable_loyalty: enableLoyalty,
        config: {
          ...settings,
          program_name: programName,
          coin_value_in_inr: 1 // Hardcoded as per user request
        }
      })

      const body = response?.message || response?.data || response
      if (body?.success) {
        await mutateRestaurant()
        toast.success('Loyalty settings saved successfully')
      } else {
        const errorMsg = typeof body?.error === 'string' ? body.error : body?.error?.message || 'Failed to save settings'
        throw new Error(errorMsg)
      }
    } catch (error: any) {
      console.error('Failed to save loyalty settings:', error)
      toast.error(error.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleNumberChange = (field: keyof typeof settings, value: string) => {
    const num = parseFloat(value)
    if (!isNaN(num) && num >= 0) {
      setSettings(prev => ({
        ...prev,
        [field]: num
      }))
    } else if (value === '') {
      setSettings(prev => ({
        ...prev,
        [field]: 0
      }))
    }
  }

  if (!isDiamond) {
    return <LockedFeature feature="loyalty" requiredPlan={['DIAMOND']} />
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Loyalty & Growth</h1>
          </div>
          <p className="text-muted-foreground mt-2">
            Goldfessional reward and referral engine to drive repeat business and viral growth.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-muted/50 p-2 px-4 rounded-lg border h-11">
          <Label htmlFor="enable-loyalty" className="text-sm font-medium whitespace-nowrap">Enable Loyalty Engine</Label>
          <Checkbox 
            id="enable-loyalty"
            checked={enableLoyalty}
            onCheckedChange={(checked) => setEnableLoyalty(!!checked)}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="w-5 h-5 text-muted-foreground" />
            Program Configuration
          </CardTitle>
          <CardDescription>Basic identification and core settings for your loyalty program.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2">
            <Label htmlFor="programName" className="text-sm font-medium">Program Name <span className="text-destructive">*</span></Label>
            <Input
              id="programName"
              placeholder="e.g. Gallery Elite Rewards"
              value={programName}
              onChange={(e) => setProgramName(e.target.value)}
              className="max-w-md"
            />
            <p className="text-[12px] text-muted-foreground">This name will be visible to customers on their loyalty dashboard.</p>
          </div>
        </CardContent>
      </Card>

      {!enableLoyalty && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 text-amber-900 dark:bg-amber-900/10 dark:border-amber-900/20 dark:text-amber-400">
          <Info className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">Loyalty engine is currently disabled. Customers won't earn points or see the loyalty wallet.</p>
        </div>
      )}

      <div className={enableLoyalty ? 'opacity-100' : 'opacity-50 pointer-events-none'}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Earning & Redemption */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Coins className="w-5 h-5 text-orange-500" />
                Earning & Redemption
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between gap-4 p-3 bg-muted/40 rounded-lg border border-dashed">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">10% Cashback on Billing</Label>
                  <p className="text-[11px] text-muted-foreground">Customers earn 0.1 coin for every ₹1 spent (Fixed)</p>
                </div>
                <Checkbox 
                  checked={settings.points_per_inr === 0.1}
                  onCheckedChange={(checked) => {
                    setSettings(prev => ({
                      ...prev,
                      points_per_inr: checked ? 0.1 : 0
                    }))
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label>Minimum Billing to use points (₹)</Label>
                <NumberInput 
                   
                  value={settings.min_billing_for_redemption}
                  onChange={(e) => handleNumberChange('min_billing_for_redemption', e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">Order subtotal must be above this value to redeem points.</p>
              </div>
              <div className="grid gap-2">
                <Label>Minimum Redemption Threshold (Coins)</Label>
                <NumberInput 
                   
                  value={settings.min_redemption_threshold}
                  onChange={(e) => handleNumberChange('min_redemption_threshold', e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">Threshold required to start using balance.</p>
              </div>
            </CardContent>
          </Card>

          {/* Social Sharing */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Share2 className="w-5 h-5 text-blue-500" />
                Referral (Viral Growth)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-2 p-3 bg-blue-50/50 rounded-lg border border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/20">
                <Label className="text-blue-700 dark:text-blue-400">Viral Growth Logic</Label>
                <p className="text-[11px] text-muted-foreground">
                  Rewards are given for <strong>Unique Opens</strong> only. Sharing the link alone grants no coins. 
                  The limit resets after the customer places a new order.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-[11px]">Max Rewards per Cycle</Label>
                  <NumberInput 
                     
                    value={settings.max_opens_rewarded_per_share}
                    onChange={(e) => handleNumberChange('max_opens_rewarded_per_share', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">Limit resets on order.</p>
                </div>
                <div className="grid gap-2">
                  <Label className="text-[11px]">Points per unique open</Label>
                  <NumberInput 
                     
                    value={settings.coins_per_unique_open}
                    onChange={(e) => handleNumberChange('coins_per_unique_open', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ROI Rewards */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                Growth & Conversion Rewards
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-2">
                <Label className="flex items-center gap-2">Referrer Bonus (friend orders)</Label>
                <NumberInput 
                   
                  value={settings.referral_order_reward_coins}
                  onChange={(e) => handleNumberChange('referral_order_reward_coins', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>New User Reward (Points)</Label>
                <NumberInput 
                   
                  value={settings.new_user_welcome_reward_coins}
                  onChange={(e) => handleNumberChange('new_user_welcome_reward_coins', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Welcome Discount (₹)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">₹</span>
                  <NumberInput 
                     
                    className="pl-7"
                    value={settings.welcome_coupon_discount}
                    onChange={(e) => handleNumberChange('welcome_coupon_discount', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Loyalty Policy */}
          <Card className="bg-muted/30 border-dashed">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Gift className="w-5 h-5 text-purple-500" />
                Loyalty Policy
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-4">
              <p>• 1 Coin = ₹1 Fixed value.</p>
              <p>• Reward logic is applied per-restaurant.</p>
              <p>• Fraud protection monitors IP & browser fingerprinting.</p>
              <p>• Changes affect future transactions only.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-end pt-6 border-t border-gray-100">
        <Button 
          size="lg"
          onClick={handleSave} 
          disabled={saving || !programName.trim()}
          className="px-12 font-semibold shadow-sm h-12"
        >
          {saving ? 'Saving...' : 'Save Loyalty Settings'}
        </Button>
      </div>
    </div>
  )
}
