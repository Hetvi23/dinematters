import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Package, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Recommendation {
  id: string
  name: string
  category?: string
  price?: number
}

interface ProductRecommendationsTableProps {
  value: string | Recommendation[]
  onChange: (value: string) => void
  disabled?: boolean
}

export default function ProductRecommendationsTable({ value, onChange, disabled }: ProductRecommendationsTableProps) {
  const recommendations: Recommendation[] = React.useMemo(() => {
    if (!value) return []
    if (Array.isArray(value)) return value
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch (e) {
      console.error('Failed to parse recommendations:', e)
      return []
    }
  }, [value])

  const removeRecommendation = (id: string) => {
    const updated = recommendations.filter(r => r.id !== id)
    onChange(JSON.stringify(updated))
  }

  if (recommendations.length === 0) {
    return (
      <div className="p-8 border-2 border-dashed rounded-xl bg-muted/20 flex flex-col items-center justify-center text-center gap-2">
        <Package className="h-8 w-8 text-muted-foreground opacity-20" />
        <p className="text-sm font-medium text-muted-foreground">No recommendations yet</p>
        <p className="text-xs text-muted-foreground/60 max-w-[200px]">AI-generated recommendations will appear here automatically.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {recommendations.map((rec) => (
        <Card key={rec.id} className="group relative overflow-hidden border-primary/10 hover:border-primary/30 transition-all shadow-sm hover:shadow-md bg-card/50">
          <CardContent className="p-3">
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold truncate group-hover:text-primary transition-colors">{rec.name}</h4>
                {rec.category && (
                  <p className="text-[10px] text-muted-foreground truncate uppercase tracking-wider mt-0.5">{rec.category}</p>
                )}
              </div>
              {!disabled && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10"
                  onClick={() => removeRecommendation(rec.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
