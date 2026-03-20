import { useState, useEffect } from 'react'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { useFrappePostCall, useFrappeGetDoc } from '@/lib/frappe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Truck, ShoppingBag, Clock, DollarSign, Settings } from 'lucide-react'

export default function OrderSettings() {
  const { selectedRestaurant } = useRestaurant()
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    enable_takeaway: 1,
    enable_delivery: 0,
    default_packaging_fee: 0,
    minimum_order_value: 0,
    estimated_prep_time: 30,
    default_delivery_fee: 0
  })

  const { data: restaurantDoc, isValidating, mutate } = useFrappeGetDoc(
    'Restaurant',
    selectedRestaurant || '',
    selectedRestaurant ? `Restaurant-${selectedRestaurant}` : null
  )

  useEffect(() => {
    if (restaurantDoc) {
      setSettings({
        enable_takeaway: restaurantDoc.enable_takeaway ?? 1,
        enable_delivery: restaurantDoc.enable_delivery ?? 0,
        default_packaging_fee: restaurantDoc.default_packaging_fee ?? 0,
        minimum_order_value: restaurantDoc.minimum_order_value ?? 0,
        estimated_prep_time: restaurantDoc.estimated_prep_time ?? 30,
        default_delivery_fee: restaurantDoc.default_delivery_fee ?? 0
      })
    }
  }, [restaurantDoc])

  const { call: updateSettings } = useFrappePostCall<{ success: boolean, data: any }>('dinematters.dinematters.api.config.update_order_settings')

  const handleSave = async () => {
    if (!selectedRestaurant) return
    
    setSaving(true)
    try {
      const response = await updateSettings({
        restaurant_id: selectedRestaurant,
        settings: {
          enable_takeaway: settings.enable_takeaway,
          enable_delivery: settings.enable_delivery,
          default_packaging_fee: settings.default_packaging_fee,
          minimum_order_value: settings.minimum_order_value,
          estimated_prep_time: settings.estimated_prep_time,
          default_delivery_fee: settings.default_delivery_fee
        }
      })
      
      if (response?.success) {
        await mutate()
        toast.success('Order settings saved successfully')
      } else {
        throw new Error(response?.error?.message || 'Failed to save settings')
      }
    } catch (error: any) {
      console.error('Failed to save settings:', error)
      toast.error(error.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = (field: keyof typeof settings) => {
    setSettings(prev => ({
      ...prev,
      [field]: prev[field] ? 0 : 1
    }))
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

  if (isValidating && !restaurantDoc) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Order Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure takeaway, delivery options, and additional charges.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-primary" />
              <CardTitle>Takeaway Options</CardTitle>
            </div>
            <CardDescription>
              Allow customers to order for pickup
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Takeaway</Label>
                <p className="text-sm text-muted-foreground">
                  Show takeaway option on the ordering page
                </p>
              </div>
              <Checkbox
                checked={settings.enable_takeaway === 1}
                onCheckedChange={() => handleToggle('enable_takeaway')}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              <CardTitle>Delivery Options</CardTitle>
            </div>
            <CardDescription>
              Allow customers to order for home delivery
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Delivery</Label>
                <p className="text-sm text-muted-foreground">
                  Show delivery option on the ordering page
                </p>
              </div>
              <Checkbox
                checked={settings.enable_delivery === 1}
                onCheckedChange={() => handleToggle('enable_delivery')}
              />
            </div>

            {settings.enable_delivery === 1 && (
              <>
                <div className="space-y-2">
                  <Label>Default Delivery Fee</Label>
                  <div className="flex items-center rounded-md border border-input bg-background overflow-hidden">
                    <span className="flex h-8 items-center border-r border-input px-3 text-sm leading-none text-muted-foreground font-medium">
                      ₹
                    </span>
                    <Input
                      type="number"
                      className="h-8 border-0 rounded-none shadow-none focus-visible:ring-0 focus-visible:border-0"
                      value={settings.default_delivery_fee || ''}
                      onChange={(e) => handleNumberChange('default_delivery_fee', e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Applied to all delivery orders</p>
                </div>

                <div className="space-y-2">
                  <Label>Minimum Order Value</Label>
                  <div className="flex items-center rounded-md border border-input bg-background overflow-hidden">
                    <span className="flex h-8 items-center border-r border-input px-3 text-sm leading-none text-muted-foreground font-medium">
                      ₹
                    </span>
                    <Input
                      type="number"
                      className="h-8 border-0 rounded-none shadow-none focus-visible:ring-0 focus-visible:border-0"
                      value={settings.minimum_order_value || ''}
                      onChange={(e) => handleNumberChange('minimum_order_value', e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Minimum cart amount required for delivery</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              <CardTitle>General Ordering Settings</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Estimated Preparation Time (mins)
                </Label>
                <Input
                  type="number"
                  value={settings.estimated_prep_time || ''}
                  onChange={(e) => handleNumberChange('estimated_prep_time', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Default estimated time shown to customers</p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Packaging Fee
                </Label>
                <div className="flex items-center rounded-md border border-input bg-background overflow-hidden">
                  <span className="flex h-8 items-center border-r border-input px-3 text-sm leading-none text-muted-foreground font-medium">
                    ₹
                  </span>
                  <Input
                    type="number"
                    className="h-8 border-0 rounded-none shadow-none focus-visible:ring-0 focus-visible:border-0"
                    value={settings.default_packaging_fee || ''}
                    onChange={(e) => handleNumberChange('default_packaging_fee', e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Additional fee applied to takeaway and delivery orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  )
}
