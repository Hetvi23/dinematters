import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Trash2, Upload, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface MenuImageItem {
  name?: string
  menu_image?: string
}

interface MenuImagesTableProps {
  value?: MenuImageItem[]
  onChange?: (items: MenuImageItem[]) => void
  required?: boolean
  disabled?: boolean
}

export default function MenuImagesTable({ value = [], onChange, required, disabled }: MenuImagesTableProps) {
  const [uploading, setUploading] = useState(false)
  
  // Ensure value is always an array
  const currentValue = Array.isArray(value) ? value : []

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // Validate file count
    if (currentValue.length + files.length > 20) {
      toast.error('Maximum 20 images allowed')
      return
    }

    setUploading(true)

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          throw new Error(`${file.name} is not an image file`)
        }

        // Upload file to Frappe
        const formData = new FormData()
        formData.append('file', file)
        formData.append('is_private', '0')
        formData.append('folder', 'Home/Attachments')

        const csrfToken = (window as any).frappe?.csrf_token || (window as any).csrf_token

        const response = await fetch('/api/method/upload_file', {
          method: 'POST',
          body: formData,
          headers: {
            'X-Frappe-CSRF-Token': csrfToken,
          },
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.message?.message || error.message || 'Upload failed')
        }

        const result = await response.json()
        return {
          menu_image: result.message?.file_url || result.message?.name || ''
        }
      })

      const uploadedItems = await Promise.all(uploadPromises)
      // Ensure we preserve existing items and add new ones
      const newItems = [...currentValue, ...uploadedItems]
      onChange?.(newItems)
      toast.success(`${uploadedItems.length} image(s) uploaded successfully`)
    } catch (error: any) {
      toast.error(error?.message || 'Failed to upload images')
    } finally {
      setUploading(false)
      // Reset input
      e.target.value = ''
    }
  }

  const handleRemove = (index: number) => {
    const newItems = currentValue.filter((_, i) => i !== index)
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

      {/* Images List */}
      {currentValue.length > 0 && (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>File URL</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentValue.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>
                    {item.menu_image ? (
                      <div className="flex items-center gap-2">
                        <img
                          src={item.menu_image}
                          alt={`Menu image ${index + 1}`}
                          className="w-16 h-16 object-cover rounded border"
                          onError={(e) => {
                            // Fallback if image fails to load
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">No image</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {item.menu_image || 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(index)}
                      disabled={disabled}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {currentValue.length === 0 && (
        <div className="text-center py-8 text-muted-foreground border rounded-md">
          <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No images uploaded yet</p>
          <p className="text-sm mt-1">Upload PNG, JPEG, or WebP images (max 20)</p>
        </div>
      )}
    </div>
  )
}

