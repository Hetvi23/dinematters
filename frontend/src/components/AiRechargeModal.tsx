/**
 * CoinRechargeModal
 * 
 * Allows restaurants to purchase DineMatters Coins using Razorpay.
 * Bundles: 500, 2000, 5000.
 * 1 coin = ₹1 (Base) + 18% GST (Collected Upfront)
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
import { toast } from 'sonner'
import { useFrappePostCall } from 'frappe-react-sdk'
import { Loader2, Sparkles, Zap, Star, Rocket, PenLine, Coins } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CoinRechargeModalProps {
  open: boolean
  onClose: () => void
  restaurant: string
  onSuccess: () => void
}

interface Bundle {
  id: string
  coins: number
  price_inr: number
  label: string
  icon: React.ReactNode
  badge?: string
  highlight?: boolean
}

const BUNDLES: Bundle[] = [
  {
    id: '999',
    coins: 999,
    price_inr: 999,
    label: 'Starter',
    icon: <Zap className="h-5 w-5" />,
    badge: undefined,
    highlight: false,
  },
  {
    id: '2000',
    coins: 2000,
    price_inr: 2000,
    label: 'Popular',
    icon: <Star className="h-5 w-5" />,
    badge: 'POPULAR',
    highlight: true,
  },
  {
    id: '5000',
    coins: 5000,
    price_inr: 5000,
    label: 'Best Value',
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

export function AiRechargeModal({ open, onClose, restaurant, onSuccess }: CoinRechargeModalProps) {
  const [selectedBundle, setSelectedBundle] = useState<string>('2000')
  const [customCoins, setCustomCoins] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)

  const { call: createOrder } = useFrappePostCall(
    'dinematters.dinematters.api.coin_billing.create_coin_purchase_order'
  )
  const { call: verifyPayment } = useFrappePostCall(
    'dinematters.dinematters.api.coin_billing.verify_coin_purchase'
  )

  const isCustom = selectedBundle === 'custom'
  const customCoinCount = parseInt(customCoins || '0', 10)
  const selectedCoins = isCustom ? customCoinCount : BUNDLES.find(b => b.id === selectedBundle)?.coins || 0

  // Upfront GST Calculation: 18% on top of the base coin cost
  const basePrice = selectedCoins
  const gstAmount = Math.round(basePrice * 0.18 * 100) / 100
  const totalPayable = basePrice + gstAmount

  const canPurchase = isCustom
    ? customCoinCount >= 300
    : selectedBundle !== ''

  const handlePurchase = async () => {
    if (!canPurchase) {
      toast.error(isCustom ? 'Minimum 300 coins required.' : 'Please select a bundle.')
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
        amount: selectedCoins
      })

      if (!orderRes.message?.success) {
        throw new Error(orderRes.message?.error || 'Failed to create order')
      }

      const { razorpay_order_id, amount, key_id } = orderRes.message

      // 2. Open Razorpay modal
      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: key_id,
          amount,
          currency: 'INR',
          order_id: razorpay_order_id,
          name: 'DineMatters Coins',
          description: `Purchase ${selectedCoins} Coins (₹${basePrice} + ₹${gstAmount} GST)`,
          theme: { color: '#f97316' },
          handler: async (response: any) => {
            try {
              // 3. Verify Payment on Backend
              const verifyRes = await verifyPayment({
                restaurant,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })

              if (verifyRes.message?.success) {
                toast.success(`✅ Success! ${selectedCoins} coins added to your account.`)
                window.dispatchEvent(new CustomEvent('ai-credits-updated', { detail: { refresh: true } }))
                onSuccess()
                resolve()
              } else {
                throw new Error(verifyRes.message?.error || 'Payment verification failed')
              }
            } catch (err: any) {
              toast.error('Verification failed', { description: err.message })
              reject(err)
            }
          },
          modal: {
            ondismiss: () => {
              resolve()
            }
          }
        })
        onClose() // Close the background modal to allow interaction with Razorpay
        rzp.open()
      })
    } catch (err: any) {
      console.error('Coin purchase error:', err)
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
            <Coins className="h-5 w-5 text-primary" />
            Buy DineMatters Coins
          </DialogTitle>
          <DialogDescription>
            Coins are used for AI services and platform commissions. 1 Coin = ₹1.
            <br />
          </DialogDescription>
        </DialogHeader>

        {/* Bundle Selection */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          {BUNDLES.map((bundle) => (
            <button
              key={bundle.id}
              type="button"
              onClick={() => setSelectedBundle(bundle.id)}
              className={cn(
                'relative flex flex-col items-center justify-center gap-2 rounded-2xl border-2 p-6 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] focus:outline-none group',
                selectedBundle === bundle.id && !isCustom
                  ? 'border-primary bg-primary/[0.03] dark:bg-primary/[0.08] shadow-lg shadow-primary/10'
                  : 'border-border/60 hover:border-primary/40 hover:bg-muted/30'
              )}
            >
              {bundle.badge && (
                <div
                  className={cn(
                    'absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-black tracking-tighter px-3 py-1 rounded-full shadow-sm whitespace-nowrap',
                    'bg-primary text-white border border-primary/20'
                  )}
                >
                  {bundle.badge}
                </div>
              )}
              <div className={cn(
                'p-3 rounded-2xl transition-colors duration-300',
                selectedBundle === bundle.id && !isCustom
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
              )}>
                {bundle.icon}
              </div>
              <div className="flex flex-col items-center">
                <span className="text-2xl font-black tracking-tight">{bundle.coins.toLocaleString()}</span>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest -mt-1">Coins</span>
              </div>
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
              <div className="text-xs text-muted-foreground">Min. 300 coins</div>
            </div>
            {isCustom && (
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={300}
                  step={1}
                  placeholder="e.g. 1500"
                  value={customCoins}
                  onChange={e => {
                    const val = e.target.value
                    if (val === '' || (Number(val) >= 0 && /^\d*$/.test(val))) {
                      setCustomCoins(val)
                    }
                  }}
                  onBlur={e => {
                    const val = parseInt(e.target.value || '0', 10)
                    if (val > 0 && val < 300) setCustomCoins('300')
                  }}
                  onKeyDown={e => {
                    if (e.key === '-' || e.key === '+' || e.key === 'e') e.preventDefault()
                  }}
                  onClick={e => e.stopPropagation()}
                  className={cn('w-24 text-right', customCoins && customCoinCount < 300 && customCoinCount > 0 ? 'border-red-400 focus-visible:ring-red-400' : '')}
                />
                <Label className="text-xs shrink-0">Coins</Label>
              </div>
            )}
          </button>
        </div>

        {/* Summary Bar with GST Breakdown */}
        <div className="rounded-xl bg-muted/50 p-5 space-y-3 mt-2 border border-border/50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Base Coin Amount</span>
            <span className="font-medium">₹{basePrice.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">GST (18%)</span>
            <span className="font-medium text-amber-600 dark:text-amber-400">+₹{gstAmount.toLocaleString()}</span>
          </div>
          <div className="h-px bg-border/50 w-full" />
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <p className="text-sm font-black uppercase tracking-tight">Total Payable</p>
              <p className="text-[10px] text-muted-foreground">Net of all taxes</p>
            </div>
            <p className="text-3xl font-black text-primary tracking-tighter">
              {totalPayable > 0 ? `₹${totalPayable.toLocaleString()}` : '—'}
            </p>
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            disabled={!canPurchase || isProcessing || selectedCoins === 0}
            onClick={handlePurchase}
            className="bg-primary hover:bg-primary/90 text-white gap-2"
          >
            {isProcessing ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Pay ₹{totalPayable}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
