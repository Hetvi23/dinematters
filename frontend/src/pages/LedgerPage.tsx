import { useState, useEffect, useCallback } from 'react'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { useCurrency } from '@/hooks/useCurrency'
import { useDataTable } from '@/hooks/useDataTable'
import { FilterCondition } from '@/components/ListFilters'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DataPagination } from '@/components/ui/DataPagination'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  Sparkles, 
  TrendingUp, 
  Zap, 
  ChevronRight, 
  ShoppingCart,
  RefreshCcw,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from '@/lib/utils'
import { AiRechargeModal } from '@/components/AiRechargeModal'

interface Transaction {
  name: string
  amount: number
  type: string
  description: string
  balance_after: number
  creation: string
  reference_doctype?: string
  reference_name?: string
  mode?: string
  transaction_type?: string
}

export default function LedgerPage() {
  const { selectedRestaurant } = useRestaurant()
  const { formatAmountNoDecimals } = useCurrency()
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [showRecharge, setShowRecharge] = useState(false)
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null)
  
  const {
    data: activities,
    isLoading,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalCount,
    mutate: refreshTable,
    setFilters: setDataTableFilters
  } = useDataTable({
    doctype: 'Coin Transaction',
    initialFilters: selectedRestaurant ? [
      { fieldname: 'restaurant', operator: '=', value: selectedRestaurant }
    ] : [],
    fields: ['name', 'creation', 'transaction_type', 'amount', 'balance_after', 'description', 'reference_doctype', 'reference_name', 'payment_id'],
    initialPageSize: 20,
    debugId: `ledger-${selectedRestaurant}`
  })

  const { coinsBalance, refreshConfig } = useRestaurant()
  const [balance, setBalance] = useState<number>(coinsBalance)

  useEffect(() => {
    setBalance(coinsBalance)
  }, [coinsBalance])

  const mutate = useCallback(async () => {
    await Promise.all([refreshTable(), refreshConfig()])
  }, [refreshTable, refreshConfig])

  useEffect(() => {
    const baseFilters: FilterCondition[] = selectedRestaurant ? [
      { fieldname: 'restaurant', operator: '=', value: selectedRestaurant }
    ] : []
    
    if (typeFilter !== 'all') {
      // Coin Transaction uses amount sign for Credit/Debit
      baseFilters.push({ 
        fieldname: 'amount', 
        operator: typeFilter === 'credit' ? '>' : '<', 
        value: 0 
      })
    }
    setDataTableFilters(baseFilters)
  }, [typeFilter, selectedRestaurant, setDataTableFilters])

  const filteredActivities = activities || []

  const getTxnIcon = (type: string) => {
    if (type?.includes('AI')) return <Sparkles className="h-4 w-4 text-purple-500" />
    if (type?.includes('Commission')) return <ShoppingCart className="h-4 w-4 text-blue-500" />
    if (type?.includes('Purchase') || type?.includes('Recharge')) return <TrendingUp className="h-4 w-4 text-emerald-500" />
    if (type?.includes('Refund')) return <RefreshCcw className="h-4 w-4 text-orange-500" />
    if (type === 'Lead Unlock') return <Zap className="h-4 w-4 text-amber-500" />
    return <Zap className="h-4 w-4 text-amber-500" />
  }

  const getTxnColor = (amount: number) => {
    return amount > 0 ? 'text-emerald-600' : 'text-red-500'
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Transaction Ledger</h1>
          <p className="text-sm text-muted-foreground">Detailed history of wallet activities and fiscal audits.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 px-4 text-xs"
            onClick={() => setTypeFilter(typeFilter === 'all' ? 'credit' : typeFilter === 'credit' ? 'debit' : 'all')}
          >
            {typeFilter === 'all' ? 'All Activity' : typeFilter === 'credit' ? 'Credits Only' : 'Debits Only'}
          </Button>
          <Button size="sm" className="gap-2 bg-primary text-white" onClick={() => setShowRecharge(true)}>
            <Plus className="h-4 w-4" />
            Top up Wallet
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-primary/15 via-primary/5 to-background shadow-md backdrop-blur-md p-3">
          <div className="absolute -right-2 -top-2 opacity-5">
            <TrendingUp className="h-20 w-20 text-primary" />
          </div>
          <div className="space-y-1">
             <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Available Balance</p>
             <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black tabular-nums">₹{formatAmountNoDecimals(balance)}</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Balance</span>
             </div>
             <p className="text-[10px] text-muted-foreground font-medium">Unified wallet for all charges.</p>
          </div>
        </Card>
      </div>

      <Card className="shadow-lg border-none bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-bold">Date & Time</TableHead>
                <TableHead className="font-bold">Description</TableHead>
                <TableHead className="font-bold">Reference</TableHead>
                <TableHead className="font-bold text-right">Amount</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && activities?.length === 0 ? (
                [1, 2, 3].map(i => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filteredActivities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    No transactions found
                  </TableCell>
                </TableRow>
              ) : filteredActivities.map((log: any) => {
                const isCredit = log.amount > 0
                return (
                  <TableRow 
                    key={log.name} 
                    className="hover:bg-muted/30 transition-colors group cursor-pointer"
                    onClick={() => setSelectedTxn(log)}
                  >
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {new Date(log.creation).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(log.creation).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium leading-tight">{log.description || 'System Adjustment'}</span>
                        <Badge variant="outline" className={`w-fit text-[9px] h-4 py-0 font-bold uppercase ${isCredit ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                          {isCredit ? 'Credit' : 'Debit'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.reference_name ? (
                        <div className="flex flex-col text-[11px]">
                          <span className="text-muted-foreground uppercase tracking-tight">{log.reference_doctype}</span>
                          <span className="font-mono font-bold text-slate-600">#{log.reference_name.slice(-6)}</span>
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className={`text-right font-bold ${isCredit ? 'text-emerald-600' : 'text-red-500'}`}>
                      {isCredit ? '+' : '-'}{formatAmountNoDecimals(log.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all translate-x-[-4px] group-hover:translate-x-0" />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          <div className="p-4 border-t">
            <DataPagination
              currentPage={page}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              isLoading={isLoading}
            />
          </div>
        </CardContent>
      </Card>

      {selectedTxn && (
        <Sheet open={!!selectedTxn} onOpenChange={(open) => !open && setSelectedTxn(null)}>
          <SheetContent className="sm:max-w-md bg-background/95 backdrop-blur-xl border-l shadow-2xl">
            <SheetHeader className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  {getTxnIcon(selectedTxn.transaction_type || selectedTxn.type)}
                </div>
                <div>
                  <SheetTitle className="text-xl font-bold tracking-tight">Transaction Details</SheetTitle>
                  <SheetDescription className="text-xs">Audit log for record #{selectedTxn.name.slice(-8)}</SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Description</p>
                <p className="text-sm font-semibold leading-relaxed text-foreground">
                  {selectedTxn.description || 'System Adjustment'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border bg-card">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Amount</p>
                  <p className={cn("text-lg font-black tabular-nums", getTxnColor(selectedTxn.amount))}>
                    {selectedTxn.amount > 0 ? '+' : ''}{formatAmountNoDecimals(selectedTxn.amount)}
                  </p>
                </div>
                <div className="p-3 rounded-lg border bg-card">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Balance After</p>
                  <p className="text-lg font-black tabular-nums text-slate-600">
                    {formatAmountNoDecimals(selectedTxn.balance_after)}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-xs text-muted-foreground font-medium">Status</span>
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold py-0 h-5 text-emerald-700">SUCCESS</Badge>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-xs text-muted-foreground font-medium">Category</span>
                  <span className="text-xs font-bold text-foreground">{selectedTxn.transaction_type || 'Activity'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-xs text-muted-foreground font-medium">Timestamp</span>
                  <span className="text-xs font-bold text-foreground">
                    {new Date(selectedTxn.creation).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
                {selectedTxn.reference_name && (
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-xs text-muted-foreground font-medium">Reference</span>
                    <span className="text-xs font-mono font-bold text-primary underline cursor-pointer">
                      {selectedTxn.reference_name}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-4">
                <Button variant="outline" className="w-full text-xs font-bold" onClick={() => setSelectedTxn(null)}>
                  Dismiss Details
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}

      {selectedRestaurant && (
        <AiRechargeModal
          open={showRecharge}
          onClose={() => setShowRecharge(false)}
          restaurant={selectedRestaurant}
          onSuccess={() => {
            mutate()
            setBalance(0) // Will refresh via useEffect
          }}
        />
      )}
    </div>
  )
}
