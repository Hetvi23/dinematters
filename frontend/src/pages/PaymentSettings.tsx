import React, { useState, useEffect } from 'react'
import { useFrappePostCall } from 'frappe-react-sdk'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { toast } from 'sonner'

const PaymentSettings: React.FC = () => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [merchantKeyId, setMerchantKeyId] = useState('')
  const [merchantKeySecret, setMerchantKeySecret] = useState('')
  const [merchantWebhookSecret, setMerchantWebhookSecret] = useState('')

  const { call: createCustomer } = useFrappePostCall('dinematters.dinematters.api.payments.create_razorpay_customer_and_token')
  const { call: createTokenOrder } = useFrappePostCall('dinematters.dinematters.api.payments.create_tokenization_order')
  const { call: getPaymentStats } = useFrappePostCall('dinematters.dinematters.api.payments.get_restaurant_payment_stats')
  const { call: setMerchantKeys } = useFrappePostCall('dinematters.dinematters.api.payments.set_restaurant_razorpay_keys')
  const [keysConfigured, setKeysConfigured] = useState<boolean | null>(null)
  const [keysUpdatedAt, setKeysUpdatedAt] = useState<string | null>(null)
  const [keysUpdatedBy, setKeysUpdatedBy] = useState<string | null>(null)
  const { call: canSetMerchantKeys } = useFrappePostCall('dinematters.dinematters.api.payments.can_set_merchant_keys')
  const [isAdmin, setIsAdmin] = useState<boolean>(false)

  const handleSave = async () => {
    if (!name || !email) {
      toast.error('Please provide name and email')
      return
    }
    setIsSaving(true)
    try {
      // Create a tokenization order and open Razorpay Checkout to let merchant save card
      const resp = await createTokenOrder({
        restaurant_id: (window as any).currentRestaurantId || 'unvind',
        amount: 1,
        customer_name: name,
        customer_email: email
      })
      // SDK may return { message: { success, data } } or directly { success, data }
      const body = resp?.message ?? resp
      if (!body?.success || !body?.data) {
        throw new Error(body?.error || 'Failed to create tokenization order')
      }

      const { key_id, razorpay_order_id, order_doc } = body.data

      // Open Razorpay Checkout
      const options = {
        key: key_id,
        order_id: razorpay_order_id,
        name: 'Dinematters',
        description: 'Save card for recurring billing',
        modal: { ondismiss: () => { toast('Checkout closed') } },
        handler: function (paymentResponse: any) {
          // Checkout succeeded — tokenization will be persisted by webhook.
          toast.success('Checkout complete — tokenization will be saved after webhook processing')
          // Poll restaurant billing status to reflect saved token (worker may take a moment)
          setTimeout(async () => {
            try {
              const stats = await getPaymentStats({ restaurant_id: (window as any).currentRestaurantId || 'unvind' })
              if (stats?.success && stats.data?.razorpay_customer_id) {
                toast.success('Token saved successfully')
              } else {
                toast('Tokenization pending — refresh in a few seconds')
              }
            } catch (err) {
              // ignore
            }
          }, 3000)
        },
        prefill: { name, email },
        theme: { color: '#3B82F6' }
      }

      // Load Razorpay script if needed
      if (!(window as any).Razorpay) {
        await new Promise((resolve) => {
          const s = document.createElement('script')
          s.src = 'https://checkout.razorpay.com/v1/checkout.js'
          s.onload = () => resolve(true)
          document.body.appendChild(s)
        })
      }
      const rzp = new (window as any).Razorpay(options)
      rzp.open()

    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Failed to initiate tokenization')
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    ;(async () => {
      try {
        const resp = await getPaymentStats({ restaurant_id: (window as any).currentRestaurantId || 'unvind' })
        const body = resp?.message ?? resp
        if (body?.success && body.data) {
          setKeysConfigured(Boolean(body.data.merchant_key_configured))
          setKeysUpdatedAt(body.data.razorpay_keys_updated_at || null)
          setKeysUpdatedBy(body.data.razorpay_keys_updated_by || null)
        }
      } catch (e) {
        // ignore
      }
    })()
    ;(async () => {
      try {
        const resp = await canSetMerchantKeys({})
        const body = resp?.message ?? resp
        if (body?.success) setIsAdmin(Boolean(body.allowed))
      } catch (e) {
        // ignore
      }
    })()
  }, [getPaymentStats])

  return (
    <Card className="max-w-xl mx-auto">
      <CardHeader>
        <CardTitle>Billing Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="mt-1 block w-full bg-gray-800 text-white border border-gray-700 px-3 py-2 rounded"
              placeholder="Merchant name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white">Email</label>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="mt-1 block w-full bg-gray-800 text-white border border-gray-700 px-3 py-2 rounded"
              placeholder="owner@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white">Token ID (dev)</label>
            <input
              value={token}
              onChange={e => setToken(e.target.value)}
              className="mt-1 block w-full bg-gray-800 text-white border border-gray-700 px-3 py-2 rounded"
              placeholder="Enter token id for testing"
            />
            <p className="text-xs text-gray-400 mt-1">In production, tokenization should be performed via Razorpay Checkout and stored automatically.</p>
          </div>
          {isAdmin && (
          <div>
            <h4 className="text-sm font-medium text-white mt-4">Merchant Razorpay Keys (Admin only)</h4>
            {keysConfigured ? (
              <div className="text-sm text-green-400 mb-2">
                Merchant keys are configured.
                {keysUpdatedAt && <span className="ml-2 text-xs text-gray-400">Updated at: {new Date(keysUpdatedAt).toLocaleString()}</span>}
                {keysUpdatedBy && <div className="text-xs text-gray-500">By: {keysUpdatedBy}</div>}
              </div>
            ) : (
              <div className="text-sm text-yellow-400 mb-2">Merchant keys not configured.</div>
            )}
            <label className="block text-xs text-gray-400">Key ID</label>
            <input
              value={merchantKeyId}
              onChange={e => setMerchantKeyId(e.target.value)}
              className="mt-1 block w-full bg-gray-800 text-white border border-gray-700 px-3 py-2 rounded"
              placeholder="rzp_live_XXXX or rzp_test_XXXX"
            />
            <label className="block text-xs text-gray-400 mt-2">Key Secret</label>
            <input
              value={merchantKeySecret}
              onChange={e => setMerchantKeySecret(e.target.value)}
              type="password"
              className="mt-1 block w-full bg-gray-800 text-white border border-gray-700 px-3 py-2 rounded"
              placeholder="******"
            />
            <label className="block text-xs text-gray-400 mt-2">Webhook Secret (optional)</label>
            <input
              value={merchantWebhookSecret}
              onChange={e => setMerchantWebhookSecret(e.target.value)}
              type="password"
              className="mt-1 block w-full bg-gray-800 text-white border border-gray-700 px-3 py-2 rounded"
              placeholder="Optional: merchant webhook secret"
            />
            <p className="text-xs text-gray-400 mt-1">Only System Managers may set merchant keys. Secrets are stored encrypted and not exposed to users.</p>
            <Button
              onClick={async () => {
                try {
                  setIsSaving(true)
                  const resp = await setMerchantKeys({
                    restaurant_id: (window as any).currentRestaurantId || 'unvind',
                    key_id: merchantKeyId,
                    key_secret: merchantKeySecret,
                    webhook_secret: merchantWebhookSecret
                  })
                  if (resp?.success) {
                    toast.success('Merchant keys saved')
                    setMerchantKeySecret('')
                  } else {
                    throw new Error(resp?.error || 'Failed to save merchant keys')
                  }
                } catch (err: any) {
                  console.error(err)
                  toast.error(err?.message || 'Failed to save merchant keys')
                } finally {
                  setIsSaving(false)
                }
              }}
              className="mt-2"
              disabled={isSaving}
            >
              Save Merchant Keys
            </Button>
          </div>
          )}
          <div>
            <Button onClick={handleSave} className="w-full" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Billing Details'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default PaymentSettings

