import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trash2, Upload, Plus, Image as ImageIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { uploadToR2 } from '@/lib/r2Upload'

interface MenuImageItem {
  name?: string
  media_asset?: string
  menu_image?: string
}

interface MenuImagesTableProps {
  value?: MenuImageItem[]
  onChange?: (items: MenuImageItem[]) => void
  required?: boolean
  disabled?: boolean
  ownerName?: string
  ownerDoctype?: string
}

export default function MenuImagesTable({ 
  value = [], 
  onChange, 
  required, 
  disabled, 
  ownerName,
  ownerDoctype = 'Menu Image Extractor' 
}: MenuImagesTableProps) {
  const [uploading, setUploading] = useState(false)
  const [localItems, setLocalItems] = useState<MenuImageItem[]>(value || [])
  
  // Keep local state in sync with external value prop
  useEffect(() => {
    setLocalItems(value || [])
  }, [JSON.stringify(value)])

  const currentValue = Array.isArray(localItems) ? localItems : []

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // Validate file count
    if (currentValue.length + files.length > 20) {
      toast.error('Maximum 20 images allowed')
      return
    }

    setUploading(true)

    if (!ownerName) {
      toast.error('Document must be saved before uploading images')
      setUploading(false)
      return
    }

    try {
      const uploadedItems = []
      // We use a sequential loop for production stability (avoiding BrokenPipe on dev server)
      for (const file of Array.from(files)) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} is not an image file`)
          continue
        }

        // Upload to R2 (Direct, production-ready path)
        const result = await uploadToR2({
          ownerDoctype: ownerDoctype,
          ownerName: ownerName,
          mediaRole: 'category_image',
          file,
        })

        uploadedItems.push({
          media_asset: result.name, // Link to the Media Asset record
          menu_image: result.primary_url || ''
        })
      }

      // Update local state immediately for snappy UI
      const newItems = [...currentValue, ...uploadedItems]
      setLocalItems(newItems)
      
      // Notify parent to sync with backend
      if (onChange) {
        await onChange(newItems)
      }
      
      toast.success(`${uploadedItems.length} image(s) uploaded successfully`)
    } catch (error: any) {
      console.error('Upload Error:', error)
      toast.error(error?.message || 'Failed to upload images')
    } finally {
      setUploading(false)
      // Reset input
      if (e.target) {
        e.target.value = ''
      }
    }
  }

  const handleRemove = (index: number) => {
    const newItems = currentValue.filter((_, i) => i !== index)
    setLocalItems(newItems)
    onChange?.(newItems)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-1">
        <Label className="text-[11px] uppercase font-black tracking-[0.2em] text-muted-foreground/80">
          Source Material
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <div className="text-xs font-black text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
          {currentValue.length} / 20 <span className="opacity-60 font-medium">Capture Nodes</span>
        </div>
      </div>

      {/* File Upload Input */}
      <div className="flex items-center gap-2">
        <Input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          disabled={disabled || uploading || currentValue.length >= 20}
          className="hidden"
          id="menu-images-upload"
        />
        
        {currentValue.length === 0 && (
          <Label
            htmlFor="menu-images-upload"
            className={cn(
              "flex flex-col items-center justify-center w-full py-12 border-2 border-dashed rounded-[2rem] transition-all cursor-pointer group relative overflow-hidden",
              (disabled || uploading || currentValue.length >= 20) 
                ? "opacity-50 cursor-not-allowed bg-muted/50 border-border" 
                : "bg-background hover:bg-primary/5 hover:border-primary/40 border-border/50 shadow-sm hover:shadow-xl"
            )}
          >
            <div className="p-4 rounded-2xl bg-primary/10 text-primary mb-4 group-hover:scale-110 transition-transform duration-500">
              <Upload className="h-8 w-8" />
            </div>
            <p className="text-lg font-black tracking-tight">Cloud Upload Interface</p>
            <p className="text-xs text-muted-foreground mt-2 font-medium">Select up to 20 high-resolution menu images</p>
          </Label>
        )}
      </div>

      {/* Images List - Horizontal Scrollable Thumbnails */}
      {currentValue.length > 0 && (
        <div className="relative group/scroll-container">
          <div className="flex items-center gap-4 overflow-x-auto pb-4 pt-1 no-scrollbar -mx-2 px-2 scroll-smooth">
            {/* Direct Upload Trigger inside the list when images exist */}
            <label 
              htmlFor="menu-images-upload"
              className={cn(
                "flex-shrink-0 w-28 h-28 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all cursor-pointer",
                (disabled || uploading || currentValue.length >= 20)
                  ? "opacity-30 border-muted pointer-events-none"
                  : "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/40"
              )}
            >
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <Plus className="h-6 w-6" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Add Node</span>
                </>
              )}
            </label>

            {currentValue.map((item, index) => (
              <div 
                key={index} 
                className="relative flex-shrink-0 w-28 h-28 rounded-2xl border border-border/50 bg-muted overflow-hidden group/item shadow-sm hover:shadow-xl transition-all duration-300 ring-primary/20 hover:ring-2"
              >
                {item.menu_image ? (
                  <img
                    src={item.menu_image}
                    alt={`Menu image ${index + 1}`}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover/item:scale-110"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-full">
                    <ImageIcon className="h-8 w-8 text-muted-foreground/20" />
                  </div>
                )}
                
                {/* Deletion Overlay - Premium Style */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center">
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-10 w-10 rounded-2xl shadow-2xl scale-75 group-hover/item:scale-100 transition-transform bg-red-600 hover:bg-red-500 border-none"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemove(index)
                    }}
                    disabled={disabled}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>

                {/* Index Badge */}
                <div className="absolute top-2 left-2 bg-black/80 text-white text-[9px] px-2 py-0.5 rounded-lg backdrop-blur-md font-black border border-white/20">
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
          
          {/* Subtle scroll shadow hints using theme colors */}
          <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-card to-transparent pointer-events-none opacity-50" />
          <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-card to-transparent pointer-events-none opacity-50" />
        </div>
      )}

      {!uploading && currentValue.length >= 20 && (
        <p className="text-[10px] text-center font-bold text-orange-600 uppercase tracking-widest bg-orange-500/5 py-3 rounded-2xl border border-orange-500/10">
           Neural Queue Full - Maximum Nodes Reached
        </p>
      )}
    </div>
  )
}

