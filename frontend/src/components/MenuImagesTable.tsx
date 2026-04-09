import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trash2, Upload, Plus, Image as ImageIcon } from 'lucide-react'
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>
          Menu Images
          {required && <span className="text-destructive">*</span>}
        </Label>
        <div className="text-sm text-muted-foreground">
          {currentValue.length} / 20 images
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
        <Label
          htmlFor="menu-images-upload"
          className={cn(
            "flex items-center gap-2 px-4 py-2 border rounded-md transition-colors",
            (disabled || uploading || currentValue.length >= 20) 
              ? "opacity-50 cursor-not-allowed" 
              : "cursor-pointer hover:bg-accent"
          )}
          onClick={(e) => {
            if (disabled || uploading || currentValue.length >= 20) {
              e.preventDefault()
              return false
            }
          }}
        >
          <Upload className="h-4 w-4" />
          {uploading ? 'Uploading...' : 'Upload Images'}
        </Label>
        {currentValue.length >= 20 && (
          <span className="text-sm text-muted-foreground">Maximum 20 images reached</span>
        )}
      </div>

      {/* Images List - Horizontal Scrollable Thumbnails */}
      {currentValue.length > 0 ? (
        <div className="relative group/scroll-container">
          <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-1 no-scrollbar -mx-1 px-1">
            {currentValue.map((item, index) => (
              <div 
                key={index} 
                className="relative flex-shrink-0 w-24 h-24 rounded-xl border bg-muted overflow-hidden group/item shadow-sm hover:shadow-md transition-all duration-200 ring-primary/20 hover:ring-2"
              >
                {item.menu_image ? (
                  <img
                    src={item.menu_image}
                    alt={`Menu image ${index + 1}`}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover/item:scale-110"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-full">
                    <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                  </div>
                )}
                
                {/* Deletion Overlay - Premium Style */}
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center">
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8 rounded-full shadow-lg scale-75 group-hover/item:scale-100 transition-transform"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemove(index)
                    }}
                    disabled={disabled}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Index Badge */}
                <div className="absolute top-1 left-1 bg-black/60 text-white text-[8px] px-1.5 py-0.5 rounded backdrop-blur-sm font-bold">
                  #{index + 1}
                </div>
              </div>
            ))}
            
            {/* Empty Slots Indicator if < 20 */}
            {currentValue.length < 20 && (
               <label 
                htmlFor="menu-images-upload"
                className="flex-shrink-0 w-24 h-24 rounded-xl border-2 border-dashed border-muted-foreground/20 flex flex-col items-center justify-center gap-1 text-muted-foreground/40 hover:text-primary hover:border-primary/40 hover:bg-primary/5 cursor-pointer transition-all"
               >
                 <Plus className="h-5 w-5" />
                 <span className="text-[8px] font-bold uppercase tracking-tighter">Add More</span>
               </label>
            )}
          </div>
          
          {/* Subtle scroll shadow hints */}
          <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent pointer-events-none" />
        </div>
      ) : (
        <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-2xl bg-muted/5">
          <ImageIcon className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="font-semibold text-sm">No images uploaded</p>
          <p className="text-[10px] mt-1 opacity-60">Upload up to 20 menu photos for best AI results</p>
        </div>
      )}
    </div>
  )
}

