import { useState } from 'react'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { Button } from '@/components/ui/button'
import { Input } from "@/components/ui/input"
import { NumberInput } from "@/components/ui/number-input"
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Trash2, Upload, Image as ImageIcon, Video, Edit2, X, Check } from 'lucide-react'
import { toast } from 'sonner'
import { cn, getFrappeError } from '@/lib/utils'
import { uploadToR2, getMediaType } from '@/lib/r2Upload'
import SilverMediaUpload from './SilverMediaUpload'

interface ProductMediaItem {
  name?: string
  media_asset?: string
  media_url?: string
  media_type?: 'image' | 'video'
  display_order?: number
  alt_text?: string
  caption?: string
}

interface ProductMediaTableProps {
  value?: ProductMediaItem[]
  onChange?: (items: ProductMediaItem[]) => void
  required?: boolean
  disabled?: boolean
  productName?: string
}

export default function ProductMediaTable({ value = [], onChange, required, disabled, productName }: ProductMediaTableProps) {
  const { isSilver } = useRestaurant()
  const [uploading, setUploading] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editData, setEditData] = useState<Partial<ProductMediaItem>>({})
  
  // Ensure value is always an array
  const currentValue = Array.isArray(value) ? value : []

  const handleSilverUpload = async (files: File[]) => {
    if (!productName) {
      throw new Error('Product must be saved before uploading media')
    }

    const uploadPromises = files.map(async (file, index) => {
      const mediaType = getMediaType(file)
      const mediaRole = mediaType === 'video' ? 'product_video' : 'product_image'

      // Upload to R2
      const result = await uploadToR2({
        ownerDoctype: 'Menu Product',
        ownerName: productName,
        mediaRole,
        file,
        displayOrder: currentValue.length + index + 1,
      })

      return {
        media_asset: result.name,
        media_url: result.primary_url || '',
        media_type: mediaType,
        display_order: currentValue.length + index + 1,
        alt_text: '',
        caption: ''
      }
    })

    const uploadedItems = await Promise.all(uploadPromises)
    const newItems = [...currentValue, ...uploadedItems]
    onChange?.(newItems)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // Validate file count (max 3 media items)
    if (currentValue.length + files.length > 3) {
      toast.error('Maximum 3 media items allowed per product')
      return
    }

    // Check video count (max 1 video)
    const existingVideoCount = currentValue.filter(item => item.media_type === 'video').length
    const newVideoCount = Array.from(files).filter(file => 
      file.type.startsWith('video/') || 
      ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.flv', '.wmv'].some(ext => 
        file.name.toLowerCase().endsWith(ext)
      )
    ).length

    if (existingVideoCount + newVideoCount > 1) {
      toast.error('Maximum 1 video allowed per product')
      return
    }

    setUploading(true)

    if (!productName) {
      toast.error('Product must be saved before uploading media')
      return
    }

    try {
      const uploadPromises = Array.from(files).map(async (file, index) => {
        const mediaType = getMediaType(file)
        const mediaRole = mediaType === 'video' ? 'product_video' : 'product_image'

        // Upload to R2
        const result = await uploadToR2({
          ownerDoctype: 'Menu Product',
          ownerName: productName,
          mediaRole,
          file,
          displayOrder: currentValue.length + index + 1,
        })

        return {
          media_asset: result.name,
          media_url: result.primary_url || '',
          media_type: mediaType,
          display_order: currentValue.length + index + 1,
          alt_text: '',
          caption: ''
        }
      })

      const uploadedItems = await Promise.all(uploadPromises)
      const newItems = [...currentValue, ...uploadedItems]
      onChange?.(newItems)
      toast.success(`${uploadedItems.length} media file(s) uploaded successfully`)
    } catch (error: any) {
      toast.error('Failed to upload media files', { description: getFrappeError(error) })
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleRemove = (index: number) => {
    const newItems = currentValue.filter((_, i) => i !== index)
    // Reorder display_order
    const reorderedItems = newItems.map((item, idx) => ({
      ...item,
      display_order: idx + 1
    }))
    onChange?.(reorderedItems)
  }

  const handleEdit = (index: number) => {
    setEditingIndex(index)
    setEditData({ ...currentValue[index] })
  }

  const handleSaveEdit = () => {
    if (editingIndex === null) return

    const updatedItems = [...currentValue]
    updatedItems[editingIndex] = {
      ...updatedItems[editingIndex],
      ...editData
    }
    onChange?.(updatedItems)
    setEditingIndex(null)
    setEditData({})
    toast.success('Media item updated')
  }

  const handleCancelEdit = () => {
    setEditingIndex(null)
    setEditData({})
  }


  const getMediaUrl = (url?: string) => {
    if (!url) return ''
    if (url.startsWith('http')) return url
    if (url.startsWith('/files/')) {
      const baseUrl = window.location.origin
      return `${baseUrl}${url}`
    }
    return url
  }

  const canAddMore = currentValue.length < 3
  const videoCount = currentValue.filter(item => item.media_type === 'video').length
  const imageCount = currentValue.filter(item => item.media_type === 'image').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>
          Product Media
          {required && <span className="text-destructive">*</span>}
        </Label>
        <div className="text-sm text-muted-foreground">
          {currentValue.length} / 3 items ({videoCount} video{videoCount !== 1 ? 's' : ''})
        </div>
      </div>

      {/* File Upload - Silver uses SilverMediaUpload, Gold uses regular upload */}
      {!disabled && canAddMore && (
        <>
          {isSilver ? (
            <SilverMediaUpload
              onUpload={handleSilverUpload}
              currentImageCount={imageCount}
              maxImages={200} // Silver plan limit
              disabled={disabled}
            />
          ) : (
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/*,video/*"
                multiple={canAddMore}
                onChange={handleFileSelect}
                disabled={disabled || uploading || !canAddMore}
                className="hidden"
                id="product-media-upload"
              />
              <Label
                htmlFor="product-media-upload"
                className={cn(
                  "flex items-center gap-2 px-4 py-2 border rounded-md transition-colors",
                  (disabled || uploading || !canAddMore) 
                    ? "opacity-50 cursor-not-allowed" 
                    : "cursor-pointer hover:bg-accent"
                )}
              >
                <Upload className="h-4 w-4" />
                {uploading ? 'Uploading...' : 'Upload Media'}
              </Label>
              {!canAddMore && (
                <span className="text-sm text-muted-foreground">Maximum 3 media items reached</span>
              )}
            </div>
          )}
        </>
      )}

      {/* Media List */}
      {currentValue.length > 0 && (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Preview</TableHead>
                <TableHead>Media File</TableHead>
                <TableHead>Media Type</TableHead>
                <TableHead className="w-32">Display Order</TableHead>
                <TableHead>Alt Text</TableHead>
                <TableHead>Caption</TableHead>
                {!disabled && <TableHead className="w-24">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentValue.map((item, index) => {
                const isEditing = editingIndex === index
                const mediaUrl = getMediaUrl(item.media_url)
                const isVideo = item.media_type === 'video'

                return (
                  <TableRow key={index}>
                    <TableCell>
                      {mediaUrl ? (
                        <div className="flex items-center gap-2">
                          {isVideo ? (
                            <div className="relative w-16 h-16 bg-muted rounded border flex items-center justify-center overflow-hidden">
                              <Video className="h-6 w-6 text-muted-foreground absolute z-10" />
                              <video
                                src={mediaUrl}
                                className="absolute inset-0 w-full h-full object-cover rounded"
                                muted
                                playsInline
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                            </div>
                          ) : (
                            <img
                              src={mediaUrl}
                              alt={item.alt_text || `Media ${index + 1}`}
                              className="w-16 h-16 object-cover rounded border"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          )}
                          {isVideo ? (
                            <Video className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No media</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-xs truncate">
                      {isEditing ? (
                        <Input
                          value={editData.media_url || ''}
                          onChange={(e) => setEditData({ ...editData, media_url: e.target.value })}
                          placeholder="Media URL"
                          className="text-xs"
                        />
                      ) : (
                        item.media_url || 'N/A'
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Select
                          value={editData.media_type || 'image'}
                          onValueChange={(value: 'image' | 'video') => setEditData({ ...editData, media_type: value })}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="image">Image</SelectItem>
                            <SelectItem value="video">Video</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={cn(
                          "px-2 py-1 rounded text-xs font-medium",
                          isVideo ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"
                        )}>
                          {isVideo ? 'Video' : 'Image'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <NumberInput
                          
                          min="0"
                          value={editData.display_order ?? index + 1}
                          onChange={(e) => setEditData({ ...editData, display_order: parseInt(e.target.value) || 0 })}
                          className="w-20"
                        />
                      ) : (
                        <span className="text-sm">{item.display_order ?? index + 1}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={editData.alt_text || ''}
                          onChange={(e) => setEditData({ ...editData, alt_text: e.target.value })}
                          placeholder="Alt text"
                          className="text-xs"
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">{item.alt_text || '-'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Textarea
                          value={editData.caption || ''}
                          onChange={(e) => setEditData({ ...editData, caption: e.target.value })}
                          placeholder="Caption"
                          className="text-xs min-h-[60px]"
                          rows={2}
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground line-clamp-2">{item.caption || '-'}</span>
                      )}
                    </TableCell>
                    {!disabled && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {isEditing ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleSaveEdit}
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCancelEdit}
                              >
                                <X className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(index)}
                              >
                                <Edit2 className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemove(index)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {currentValue.length === 0 && (
        <div className="text-center py-8 text-muted-foreground border rounded-md">
          <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No media uploaded yet</p>
          <p className="text-sm mt-1">Upload images or videos (max 3 items, max 1 video)</p>
        </div>
      )}
    </div>
  )
}

