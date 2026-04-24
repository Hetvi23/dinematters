import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

import { Switch } from '@/components/ui/switch'
import { useCurrency } from '@/hooks/useCurrency'

interface MenuProductCardProps {
  product: any
  onEdit: () => void
  onDelete: () => void
  onToggleStatus: (status: boolean) => void
}

export const MenuProductCard: React.FC<MenuProductCardProps> = ({
  product,
  onEdit,
  onDelete,
  onToggleStatus,
}) => {
  const { formatAmountNoDecimals } = useCurrency()

  // Support both backend API (camelCase) and direct DocType (snake_case)
  const isVegetarian = product.is_vegetarian ?? product.isVegetarian
  const isActive = product.is_active ?? (product.isActive !== undefined ? (product.isActive ? 1 : 0) : 1)
  const price = product.price
  const originalPrice = product.original_price ?? product.originalPrice
  const name = product.product_name ?? product.name
  const description = product.description

  // Extract thumbnail image
  let thumbnailUrl = null
  if (product.media && Array.isArray(product.media)) {
    const imageMedia = product.media.find((m: any) => m.type === 'image')
    thumbnailUrl = imageMedia?.url
  } else if (product.image) {
    thumbnailUrl = product.image
  }

  const handleToggleStatus = (checked: boolean) => {
    onToggleStatus?.(checked)
  }

  return (
    <div className="group bg-card border rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row gap-4 items-start sm:items-center">
      {/* Product Image Thumbnail */}
      <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden border">
        {thumbnailUrl ? (
          <img 
            src={thumbnailUrl} 
            alt={name} 
            className="h-full w-full object-cover transition-transform group-hover:scale-110 duration-500"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=' + name?.substring(0, 2)
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center">
            <span className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter">
              {name?.substring(0, 2)}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {isVegetarian ? (
             <div className="h-3 w-3 border border-green-600 p-[1px] flex items-center justify-center shrink-0">
                <div className="h-2 w-2 bg-green-600 rounded-full" />
             </div>
          ) : (
             <div className="h-3 w-3 border border-red-600 p-[1px] flex items-center justify-center shrink-0">
                <div className="h-2 w-2 bg-red-600 rounded-full" />
             </div>
          )}
          <h4 className="font-semibold text-foreground truncate">{name}</h4>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
          {description || "No description available."}
        </p>
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm">{formatAmountNoDecimals(price)}</span>
          {originalPrice > price && (
            <span className="text-xs text-muted-foreground line-through decoration-muted-foreground/40">{formatAmountNoDecimals(originalPrice)}</span>
          )}
        </div>
      </div>

      <div className="flex flex-row sm:flex-col items-center sm:items-end gap-3 self-stretch sm:self-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-border/40">
        <div className="flex items-center gap-2 mr-auto sm:mr-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Active</span>
          <Switch 
            checked={!!isActive} 
            onCheckedChange={handleToggleStatus}
            className="scale-75 data-[state=checked]:bg-green-500"
          />
        </div>
        
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

