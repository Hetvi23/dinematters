import { useRestaurant } from '@/contexts/RestaurantContext'
import StaffMembersList from '@/components/StaffMembersList'
import { Badge } from '@/components/ui/badge'
import { Crown, Zap, Star, Users, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function TeamManagement() {
  const { selectedRestaurant, isDiamond, isGold, isSilver, isAdmin } = useRestaurant()

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center max-w-sm mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center">
          <Lock className="w-7 h-7 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold">Admin Access Required</h2>
          <p className="text-sm text-muted-foreground">
            Only Restaurant Admins can manage team members.
          </p>
        </div>
      </div>
    )
  }

  const planColor = isDiamond
    ? 'from-fuchsia-600 to-purple-600'
    : isGold
    ? 'from-amber-500 to-orange-500'
    : 'from-slate-500 to-slate-600'

  const PlanBadge = () => {
    if (isDiamond) return (
      <Badge className="bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white border-none gap-1">
        <Crown className="w-3 h-3" /> DIAMOND · 6 Staff Seats
      </Badge>
    )
    if (isGold) return (
      <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-none gap-1">
        <Zap className="w-3 h-3" /> GOLD · 3 Staff Seats
      </Badge>
    )
    return (
      <Badge className="bg-gradient-to-r from-slate-500 to-slate-600 text-white border-none gap-1">
        <Star className="w-3 h-3" /> SILVER · Upgrade to Add Staff
      </Badge>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      {/* Page Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br", planColor)}>
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Team Management</h1>
            <p className="text-sm text-muted-foreground">
              Invite staff to manage orders, bookings, and more.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PlanBadge />
          {!isSilver && (
            <span className="text-xs text-muted-foreground">
              Staff can view and manage orders & bookings. Admins have full dashboard access.
            </span>
          )}
        </div>
      </div>

      {/* Role Explanation */}
      {!isSilver && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <span className="text-sm font-semibold">Restaurant Admin</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Full access: orders, bookings, menu, billing, settings, staff management.
              <br /><span className="font-medium text-foreground/70">That's you.</span>
            </p>
          </div>
          <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-muted/60 flex items-center justify-center">
                <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <span className="text-sm font-semibold">Restaurant Staff</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Limited access: real-time orders, accept orders, past orders, table bookings.
              <br /><span className="font-medium text-foreground/70">Billing and settings are hidden.</span>
            </p>
          </div>
        </div>
      )}

      {/* Staff List */}
      {selectedRestaurant ? (
        <StaffMembersList restaurantId={selectedRestaurant} />
      ) : (
        <div className="text-center text-muted-foreground py-10">
          Select a restaurant to manage its team.
        </div>
      )}
    </div>
  )
}
