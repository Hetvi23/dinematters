/**
 * AiRechargeModal
 * 
 * Allows restaurants to purchase additional AI credits using Razorpay.
 * Credit bundles: 20, 50, 100, or a custom amount (min 10 credits).
 * 1 credit = ₹2
 */
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useFrappePostCall } from 'frappe-react-sdk'
import { Loader2, Sparkles, Zap, Star, Rocket, PenLine } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AiRechargeModalProps {
  open: boolean
  onClose: () => void
  restaurant: string
  currentBalance: number
  onSuccess: () => void
}

interface Bundle {
  id: string
  credits: number
  price_inr: number
  label: string
  icon: React.ReactNode
  badge?: string
  highlight?: boolean
}

const BUNDLES: Bundle[] = [
  {
    id: '20',
    credits: 20,
    price_inr: 40,
    label: 'Starter',
    icon: <Zap className="h-5 w-5" />,
    badge: undefined,
    highlight: false,
  },
  {
    id: '50',
    credits: 50,
    price_inr: 100,
    label: 'Popular',
    icon: <Star className="h-5 w-5" />,
    badge: 'POPULAR',
    highlight: true,
  },
  {
    id: '100',
    credits: 100,
    price_inr: 200,
    label: 'Pro',
    icon: <Rocket className="h-5 w-5" />,
    badge: 'BEST VALUE',
    highlight: false,
  },
]

declare global {
  interface Window {
    Razorpay: any
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export function AiRechargeModal({ open, onClose, restaurant, currentBalance, onSuccess }: AiRechargeModalProps) {
  const [selectedBundle, setSelectedBundle] = useState<string>('50')
  const [customCredits, setCustomCredits] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)

  const { call: createOrder } = useFrappePostCall(
    'dinematters.dinematters.api.ai_billing.create_credit_purchase_order'
  )
  const { call: verifyPayment } = useFrappePostCall(
    'dinematters.dinematters.api.ai_billing.verify_credit_purchase'
  )

  const isCustom = selectedBundle === 'custom'
  const customCreditCount = parseInt(customCredits || '0', 10)
  const selectedCredits = isCustom ? customCreditCount : BUNDLES.find(b => b.id === selectedBundle)?.credits || 0
  const selectedPrice = isCustom ? customCreditCount * 2 : BUNDLES.find(b => b.id === selectedBundle)?.price_inr || 0

  const canPurchase = isCustom
    ? customCreditCount >= 10
    : selectedBundle !== ''

  const handlePurchase = async () => {
    if (!canPurchase) {
      toast.error(isCustom ? 'Minimum 10 credits required.' : 'Please select a bundle.')
      return
    }

    setIsProcessing(true)
    try {
      const loaded = await loadRazorpayScript()
      if (!loaded) {
        toast.error('Failed to load Razorpay. Check your internet connection.')
        setIsProcessing(false)
        return
      }

      // 1. Create Razorpay order
      const orderRes = await createOrder({
        restaurant,
        bundle_id: selectedBundle,
        custom_credits: isCustom ? customCreditCount : undefined,
      })

      if (!orderRes.message?.success) {
        throw new Error(orderRes.message?.error || 'Failed to create order')
      }

      const { razorpay_order_id, amount, key_id, pending_txn_id, credits, price_inr } = orderRes.message

      // 2. Open Razorpay modal — hide our dialog first so it doesn't block
      let paymentCompleted = false
      onClose() // hide the recharge modal behind Razorpay

      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: key_id,
          amount,
          currency: 'INR',
          order_id: razorpay_order_id,
          name: 'Dinematters AI Credits',
          description: `${credits} AI Credits @ ₹${price_inr}`,
          theme: { color: '#f97316' },
          handler: async (response: any) => {
            try {
              paymentCompleted = true
              // 3. Verify payment and credit wallet
              const verifyRes = await verifyPayment({
                razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                pending_txn_id,
              })

              if (verifyRes.message?.success) {
                const newBalance = verifyRes.message.new_balance
                toast.success(`✅ ${verifyRes.message.credits_added} credits added! New balance: ${newBalance}`)
                // Notify other components (Layout, AIEnhancementPage, etc.)
                window.dispatchEvent(new CustomEvent('ai-credits-updated', { detail: { balance: newBalance } }))
                onSuccess()
                resolve()
              } else {
                reject(new Error(verifyRes.message?.error || 'Payment verification failed'))
              }
            } catch (err: any) {
              reject(err)
            }
          },
          modal: {
            ondismiss: () => {
              if (!paymentCompleted) {
                // User closed Razorpay without paying — nothing to do, modal already closed
              }
              resolve()
            }
          }
        })
        rzp.open()
      })
    } catch (err: any) {
      console.error('Credit purchase error:', err)
      toast.error('Purchase failed', { description: err.message })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Recharge AI Credits
          </DialogTitle>
          <DialogDescription>
            Current balance:{' '}
            <span className="font-semibold text-foreground">{currentBalance} credits</span>
          </DialogDescription>
        </DialogHeader>

        {/* Bundle Selection */}
        <div className="grid grid-cols-3 gap-3 mt-2">
          {BUNDLES.map((bundle) => (
            <button
              key={bundle.id}
              type="button"
              onClick={() => setSelectedBundle(bundle.id)}
              className={cn(
                'relative flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-4 transition-all focus:outline-none',
                selectedBundle === bundle.id && !isCustom
                  ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-md shadow-primary/10'
                  : 'border-border hover:border-primary/40 hover:bg-muted/40'
              )}
            >
              {bundle.badge && (
                <Badge
                  className={cn(
                    'absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold px-2 py-0.5 rounded-full',
                    'bg-primary text-white'
                  )}
                >
                  {bundle.badge}
                </Badge>
              )}
              <div className={cn(
                'p-2 rounded-full',
                selectedBundle === bundle.id && !isCustom ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
              )}>
                {bundle.icon}
              </div>
              <span className="text-2xl font-bold">{bundle.credits}</span>
              <span className="text-xs text-muted-foreground">credits</span>
              <span className="text-sm font-semibold text-foreground">₹{bundle.price_inr}</span>
            </button>
          ))}
        </div>

        {/* Custom Amount */}
        <div className="mt-1">
          <button
            type="button"
            onClick={() => setSelectedBundle('custom')}
            className={cn(
              'w-full flex items-center gap-3 rounded-xl border-2 p-4 transition-all text-left focus:outline-none',
              isCustom
                ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-md'
                : 'border-border hover:border-primary/40 hover:bg-muted/40'
            )}
          >
            <div className={cn(
              'p-2 rounded-full shrink-0',
              isCustom ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
            )}>
              <PenLine className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">Custom Amount</div>
              <div className="text-xs text-muted-foreground">Min. 10 credits</div>
            </div>
            {isCustom && (
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={10}
                  step={1}
                  placeholder="e.g. 30"
                  value={customCredits}
                  onChange={e => {
                    const val = e.target.value
                    if (val === '' || (Number(val) >= 0 && /^\d*$/.test(val))) {
                      setCustomCredits(val)
                    }
                  }}
                  onBlur={e => {
                    const val = parseInt(e.target.value || '0', 10)
                    if (val > 0 && val < 10) setCustomCredits('10')
                  }}
                  onKeyDown={e => {
                    if (e.key === '-' || e.key === '+' || e.key === 'e') e.preventDefault()
                  }}
                  onClick={e => e.stopPropagation()}
                  className={cn('w-24 text-right', customCredits && customCreditCount < 10 && customCreditCount > 0 ? 'border-red-400 focus-visible:ring-red-400' : '')}
                />
                <Label className="text-xs shrink-0">credits</Label>
              </div>
            )}
            {isCustom && customCredits !== '' && customCreditCount > 0 && customCreditCount < 10 && (
              <p className="text-xs text-red-500 mt-1 text-right">Minimum is 10 credits</p>
            )}
          </button>

            {isCustom && customCreditCount > 0 && (
              <p className="text-xs text-muted-foreground mt-1.5 text-right">
                {customCreditCount} credits
              </p>
            )}
        </div>

        {/* Summary Bar */}
        <div className="rounded-lg bg-muted/50 p-4 flex items-center justify-between mt-2">
          <div>
            <p className="text-sm font-medium">Total</p>
            <p className="text-xs text-muted-foreground">
              {selectedCredits > 0 ? `+${selectedCredits} credits` : '—'}
            </p>
          </div>
          <p className="text-2xl font-bold text-primary">
            {selectedPrice > 0 ? `₹${selectedPrice}` : '—'}
          </p>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            disabled={!canPurchase || isProcessing || selectedCredits === 0}
            onClick={handlePurchase}
            className="bg-primary hover:bg-primary/90 text-white gap-2"
          >
            {isProcessing ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Pay ₹{selectedPrice}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
