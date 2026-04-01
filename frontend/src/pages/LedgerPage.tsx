import { useState, useEffect, useMemo } from 'react'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { useFrappePostCall } from '@/lib/frappe'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Search,
  Coins,
  Loader2,
  Sparkles,
  ShoppingCart,
  Zap,
  CreditCard,
  RefreshCcw,
  Plus,
  TrendingUp,
  Download,
  Filter,
  Calendar,
  ChevronRight,
  ExternalLink,
  ArrowRightLeft,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns'
import { useCurrency } from '@/hooks/useCurrency'
import { AiRechargeModal } from '@/components/AiRechargeModal'

interface Transaction {
  name: string
  transaction_type: string
  amount: number
  balance_after: number
  description: string
  payment_id: string | null
  creation: string
}

const PAGE_SIZE = 15

export default function LedgerPage() {
  const { selectedRestaurant } = useRestaurant()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' })
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [showRecharge, setShowRecharge] = useState(false)
  const [balance, setBalance] = useState<number>(0)
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null)
  
  const { formatAmountNoDecimals } = useCurrency()

  const { call: getTransactions } = useFrappePostCall<any>(
    'dinematters.dinematters.api.coin_billing.get_coin_transactions'
  )
  const { call: getBillingInfo } = useFrappePostCall<any>(
    'dinematters.dinematters.api.coin_billing.get_coin_billing_info'
  )

  const loadData = async (reset = false) => {
    if (!selectedRestaurant) return
    if (reset) {
        setLoading(true)
        setPage(0)
    }
    
    try {
      const currentPage = reset ? 0 : page
      const [txnRes, infoRes] = await Promise.all([
        getTransactions({ 
          restaurant: selectedRestaurant, 
          limit: PAGE_SIZE + 1, 
          offset: currentPage * PAGE_SIZE 
        }),
        getBillingInfo({ restaurant: selectedRestaurant })
      ])

      if (txnRes.message) {
        const fetched = txnRes.message
        setHasMore(fetched.length > PAGE_SIZE)
        const items = fetched.slice(0, PAGE_SIZE)
        
        // Accumulate transactions
        setTransactions(prev => reset ? items : [...prev, ...items])
      }
      
      if (infoRes.message) {
        setBalance(infoRes.message.coins_balance || 0)
      }
    } catch (error) {
      toast.error('Failed to load transaction history')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(true)
  }, [selectedRestaurant])

  const handleNextPage = () => {
    if (hasMore) {
        setPage(prev => prev + 1)
    }
  }

  useEffect(() => {
    if (page > 0) {
        loadData()
    }
  }, [page])

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = !searchQuery || 
        t.description?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        t.transaction_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.payment_id?.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesType = typeFilter === 'all' || t.transaction_type === typeFilter
      
      let matchesDate = true
      if (dateRange.start || dateRange.end) {
        const txnDate = new Date(t.creation)
        const start = dateRange.start ? startOfDay(new Date(dateRange.start)) : new Date(0)
        const end = dateRange.end ? endOfDay(new Date(dateRange.end)) : new Date()
        matchesDate = isWithinInterval(txnDate, { start, end })
      }

      return matchesSearch && matchesType && matchesDate
    })
  }, [transactions, searchQuery, typeFilter, dateRange])

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const spentToday = transactions
      .filter(t => t.creation.startsWith(today) && (t.transaction_type.includes('Deduction')))
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)
    
    const totalRecharges = transactions
      .filter(t => t.transaction_type.includes('Purchase') || t.transaction_type.includes('Recharge'))
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)

    return { spentToday, totalRecharges }
  }, [transactions])

  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) {
      toast.error('No transactions to export')
      return
    }

    const headers = ['Date', 'Type', 'Description', 'Amount', 'Balance After', 'Payment ID']
    const rows = filteredTransactions.map(t => [
      format(new Date(t.creation), 'yyyy-MM-dd HH:mm'),
      t.transaction_type,
      t.description.replace(/,/g, ' '),
      t.amount,
      t.balance_after,
      t.payment_id || ''
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `ledger_${selectedRestaurant}_${format(new Date(), 'yyyyMMdd')}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Ledger exported successfully')
  }

  const getTxnIcon = (type: string) => {
    if (type.includes('AI')) return <Sparkles className="h-4 w-4 text-purple-500" />
    if (type.includes('Commission')) return <ShoppingCart className="h-4 w-4 text-blue-500" />
    if (type.includes('Purchase') || type.includes('Recharge')) return <TrendingUp className="h-4 w-4 text-emerald-500" />
    if (type.includes('Refund')) return <RefreshCcw className="h-4 w-4 text-orange-500" />
    return <Zap className="h-4 w-4 text-amber-500" />
  }

  const getTxnColor = (type: string) => {
    if (type.includes('Deduction')) return 'text-destructive'
    if (type.includes('Purchase') || type.includes('Recharge') || type.includes('Refund') || type.includes('Free')) return 'text-emerald-500'
    return 'text-foreground'
  }

  const transactionTypes = useMemo(() => {
    const types = new Set(transactions.map(t => t.transaction_type))
    return Array.from(types)
  }, [transactions])

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Transaction Ledger</h1>
          <p className="text-sm text-muted-foreground">Detailed history of coin usage and fiscal audits.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCSV}>
            <Download className="h-4 w-4" />
            Download CSV
          </Button>
          <Button size="sm" className="gap-2 bg-primary text-white" onClick={() => setShowRecharge(true)}>
            <Plus className="h-4 w-4" />
            Buy Coins
          </Button>
        </div>
      </div>

      {/* Compact Glassmorphism Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-primary/15 via-primary/5 to-background shadow-md backdrop-blur-md p-3">
          <div className="absolute -right-2 -top-2 opacity-5">
            <Coins className="h-20 w-20" />
          </div>
          <div className="space-y-1">
             <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Available Balance</p>
             <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black tabular-nums">{balance.toLocaleString()}</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Coins</span>
             </div>
             <p className="text-[10px] text-muted-foreground font-medium">Approx. {formatAmountNoDecimals(balance)} credits.</p>
          </div>
        </Card>

        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-background shadow-md backdrop-blur-md p-3">
           <div className="absolute -right-2 -top-2 opacity-5">
            <Sparkles className="h-20 w-20 text-purple-500" />
          </div>
          <div className="space-y-1">
             <p className="text-[10px] font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400">Activity Today</p>
             <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black tabular-nums text-purple-600 dark:text-purple-400">-{stats.spentToday.toLocaleString()}</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Spent</span>
             </div>
             <p className="text-[10px] text-muted-foreground font-medium">Last 24 hours of usage.</p>
          </div>
        </Card>

        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-background shadow-md backdrop-blur-md p-3">
           <div className="absolute -right-2 -top-2 opacity-5">
            <TrendingUp className="h-20 w-20 text-emerald-500" />
          </div>
          <div className="space-y-1">
             <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Lifetime Recharges</p>
             <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black tabular-nums text-emerald-600 dark:text-emerald-400">{stats.totalRecharges.toLocaleString()}</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Total</span>
             </div>
             <p className="text-[10px] text-muted-foreground font-medium">Total coins added to wallet.</p>
          </div>
        </Card>
      </div>

      {/* Advanced Filters */}
      <div className="flex flex-col lg:flex-row items-end gap-3 bg-muted/20 p-3 rounded-lg border border-border/50">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
            <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Search Keywords</label>
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        placeholder="ID or Description..."
                        className="h-9 pl-8 text-xs bg-background/50"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>
            <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Transaction Type</label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-9 text-xs bg-background/50">
                        <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Transactions</SelectItem>
                        {transactionTypes.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Start Date</label>
                <DatePicker
                    className="h-9"
                    value={dateRange.start}
                    onChange={(val) => setDateRange(prev => ({ ...prev, start: val }))}
                    placeholder="Pick start date"
                />
            </div>
            <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">End Date</label>
                <DatePicker
                    className="h-9"
                    value={dateRange.end}
                    onChange={(val) => setDateRange(prev => ({ ...prev, end: val }))}
                    placeholder="Pick end date"
                />
            </div>
        </div>
        {(searchQuery || typeFilter !== 'all' || dateRange.start || dateRange.end) && (
            <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 text-[10px] font-bold uppercase"
                onClick={() => {
                    setSearchQuery('')
                    setTypeFilter('all')
                    setDateRange({ start: '', end: '' })
                }}
            >
                Clear
            </Button>
        )}
      </div>

      {/* Transactions Table */}
      <Card className="shadow-lg border-none bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-[10px] uppercase font-bold text-muted-foreground bg-muted/30 border-b">
                <tr>
                  <th className="px-5 py-3.5 tracking-wider">Transaction</th>
                  <th className="px-5 py-3.5 tracking-wider">Category</th>
                  <th className="px-5 py-3.5 tracking-wider text-right">Amount</th>
                  <th className="px-5 py-3.5 tracking-wider text-right">Balance</th>
                  <th className="px-5 py-3.5 tracking-wider">Date</th>
                  <th className="px-5 py-3.5 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading && page === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="px-5 py-6">
                        <div className="h-3 bg-muted rounded w-3/4" />
                      </td>
                    </tr>
                  ))
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-2 opacity-60">
                          <Filter className="h-10 w-10 text-muted-foreground" />
                          <p className="font-bold text-sm">No results match your filters</p>
                          <p className="text-[10px]">Try adjusting your search terms or date range.</p>
                        </div>
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((txn, index) => {
                    const isCredit = txn.amount > 0 && !txn.transaction_type.includes('Deduction')
                    return (
                      <tr 
                        key={txn.name} 
                        className="hover:bg-muted/30 transition-colors group cursor-pointer animate-in fade-in slide-in-from-bottom-1"
                        style={{ animationDelay: `${index * 30}ms` }}
                        onClick={() => setSelectedTxn(txn)}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col max-w-[200px] md:max-w-sm">
                            <span className="font-bold text-foreground group-hover:text-primary transition-colors truncate">
                                {txn.description || txn.transaction_type}
                            </span>
                            {txn.payment_id && (
                              <span className="text-[9px] text-muted-foreground font-medium flex items-center gap-1 uppercase mt-0.5">
                                <CreditCard className="h-2.5 w-2.5" />
                                {txn.payment_id}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                             {getTxnIcon(txn.transaction_type)}
                             <span className="font-medium">{txn.transaction_type}</span>
                          </div>
                        </td>
                        <td className={cn("px-5 py-3.5 text-right font-black tabular-nums", getTxnColor(txn.transaction_type))}>
                           {isCredit ? '+' : ''}{txn.amount.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-right font-medium text-muted-foreground tabular-nums">
                          {txn.balance_after.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground font-medium">
                          {format(new Date(txn.creation), 'MMM d, h:mm a')}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all translate-x-[-4px] group-hover:translate-x-0" />
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          
          {hasMore && (
            <div className="p-3 border-t flex justify-center bg-muted/5">
               <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-[10px] font-bold uppercase gap-2 text-primary hover:bg-primary/10" 
                onClick={handleNextPage}
                disabled={loading}
               >
                 {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
                 Load More Activity
               </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!selectedTxn} onOpenChange={(open) => !open && setSelectedTxn(null)}>
        <SheetContent className="sm:max-w-md bg-background/95 backdrop-blur-xl border-l shadow-2xl">
          <SheetHeader className="mb-6">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                    {selectedTxn && getTxnIcon(selectedTxn.transaction_type)}
                </div>
                <div>
                   <SheetTitle className="text-xl font-black">Transaction Details</SheetTitle>
                   <SheetDescription className="text-xs">Audit log for transaction {selectedTxn?.name}</SheetDescription>
                </div>
            </div>
          </SheetHeader>

          {selectedTxn && (
            <div className="space-y-8">
                {/* Meta Cards */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Impact</p>
                        <p className={cn("text-2xl font-black tabular-nums", getTxnColor(selectedTxn.transaction_type))}>
                            {selectedTxn.amount > 0 && !selectedTxn.transaction_type.includes('Deduction') ? '+' : ''}{selectedTxn.amount.toLocaleString()}
                        </p>
                    </div>
                    <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Running Balance</p>
                        <p className="text-2xl font-black tabular-nums">{selectedTxn.balance_after.toLocaleString()}</p>
                    </div>
                </div>

                {/* Info List */}
                <div className="space-y-6">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                            <Info className="h-3 w-3" /> Description
                        </label>
                        <p className="text-sm font-medium leading-relaxed bg-muted/20 p-3 rounded-lg border">
                            {selectedTxn.description || 'No description provided.'}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                                <Filter className="h-3 w-3" /> Category
                            </label>
                            <Badge variant="secondary" className="font-bold border-primary/20 bg-primary/5 text-primary">
                                {selectedTxn.transaction_type}
                            </Badge>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                                <Calendar className="h-3 w-3" /> Timestamp
                            </label>
                            <p className="text-xs font-bold text-foreground">
                                {format(new Date(selectedTxn.creation), 'MMM dd, yyyy HH:mm:ss')}
                            </p>
                        </div>
                    </div>

                    {selectedTxn.payment_id && (
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                                <CreditCard className="h-3 w-3" /> Payment Identifier
                            </label>
                            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                                <code className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                    {selectedTxn.payment_id}
                                </code>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-emerald-500/10">
                                    <ExternalLink className="h-3 w-3 text-emerald-600" />
                                </Button>
                            </div>
                        </div>
                    )}

                    {selectedTxn.description?.includes('Order #') && (
                        <div className="pt-4 border-t">
                            <Button className="w-full gap-2 font-bold text-xs" variant="default" size="sm">
                                <ArrowRightLeft className="h-3.5 w-3.5" />
                                View Related Order
                                <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                        </div>
                    )}
                </div>

                <div className="pt-10">
                     <div className="flex items-center gap-2 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg text-blue-600 dark:text-blue-400">
                        <Shield className="h-4 w-4 shrink-0" />
                        <p className="text-[9px] font-medium">This transaction is immutable and verified on the blockchain of records for audit safety.</p>
                     </div>
                </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AiRechargeModal 
        open={showRecharge} 
        onClose={() => setShowRecharge(false)} 
        restaurant={selectedRestaurant!} 
        onSuccess={() => loadData(true)}
      />
    </div>
  )
}

function Shield(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  )
}
