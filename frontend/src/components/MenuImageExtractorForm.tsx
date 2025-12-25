import { useState, useEffect } from 'react'
import { useFrappeGetDoc, useFrappePostCall } from '@/lib/frappe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Loader2, CheckCircle, XCircle, Clock, Play, Check } from 'lucide-react'
import { toast } from 'sonner'
import DynamicForm from './DynamicForm'
import EditableExtractedDishesTable from './EditableExtractedDishesTable'

interface MenuImageExtractorFormProps {
  docname?: string
  restaurantId?: string
  onComplete?: (data: any) => void
}

export default function MenuImageExtractorForm({ 
  docname, 
  restaurantId,
  onComplete 
}: MenuImageExtractorFormProps) {
  const [extractionDocName, setExtractionDocName] = useState<string | undefined>(docname)
  
  // Get extraction document
  const { data: extractionDoc, mutate: refreshExtraction } = useFrappeGetDoc(
    'Menu Image Extractor',
    extractionDocName || '',
    {
      enabled: !!extractionDocName
    }
  )

  const { call: extractMenuData } = useFrappePostCall(
    'dinematters.dinematters.doctype.menu_image_extractor.menu_image_extractor.extract_menu_data'
  )

  const { call: approveExtraction } = useFrappePostCall(
    'dinematters.dinematters.doctype.menu_image_extractor.menu_image_extractor.approve_extracted_data'
  )

  // Auto-refresh if processing
  useEffect(() => {
    if (extractionDoc?.extraction_status === 'Processing') {
      const interval = setInterval(() => {
        refreshExtraction()
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [extractionDoc?.extraction_status, refreshExtraction])

  const handleExtract = async () => {
    if (!extractionDocName) {
      toast.error('Please save the document first')
      return
    }

    if (!extractionDoc?.menu_images || extractionDoc.menu_images.length === 0) {
      toast.error('Please upload at least one menu image before extraction')
      return
    }

    if (extractionDoc.menu_images.length > 20) {
      toast.error(`Maximum 20 images allowed. Currently ${extractionDoc.menu_images.length} images uploaded.`)
      return
    }

    if (!confirm(`This will extract menu data from ${extractionDoc.menu_images.length} image(s). Continue?`)) {
      return
    }

    try {
      const result = await extractMenuData({ docname: extractionDocName })
      let message = 'Extraction started in the background'
      if (result) {
        if (typeof result === 'string') {
          message = result
        } else if (result.message) {
          message = String(result.message)
        } else if (result.data?.message) {
          message = String(result.data.message)
        }
      }
      toast.success(message)
      refreshExtraction()
    } catch (error: any) {
      const errorMessage = error?.message || error?.data?.message || 'Failed to start extraction'
      toast.error(typeof errorMessage === 'string' ? errorMessage : 'Failed to start extraction')
    }
  }

  const handleApprove = async () => {
    if (!extractionDocName) {
      toast.error('Document not found')
      return
    }

    if (!confirm('This will create/update menu categories and products in the database. Continue?')) {
      return
    }

    try {
      const result = await approveExtraction({ docname: extractionDocName })
      let message = 'Extracted data approved and categories/products created successfully'
      if (result) {
        if (typeof result === 'string') {
          message = result
        } else if (result.message) {
          message = String(result.message)
        } else if (result.data?.message) {
          message = String(result.data.message)
        }
      }
      toast.success(message)
      refreshExtraction()
      onComplete?.(extractionDoc)
    } catch (error: any) {
      const errorMessage = error?.message || error?.data?.message || 'Failed to approve extraction'
      toast.error(typeof errorMessage === 'string' ? errorMessage : 'Failed to approve extraction')
    }
  }

  const status = extractionDoc?.extraction_status || 'Draft'
  const isCompleted = status === 'Completed'
  const isProcessing = status === 'Processing'
  const isPendingApproval = status === 'Pending Approval'
  const hasError = status === 'Failed'
  const isDraft = status === 'Draft'

  return (
    <div className="space-y-6">
      {/* Main Form - All Fields */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle>Menu Image Extractor</CardTitle>
          <CardDescription>
            Upload menu images and extract categories and products automatically
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DynamicForm
            doctype="Menu Image Extractor"
            docname={extractionDocName}
            mode={extractionDocName ? 'edit' : 'create'}
            initialData={restaurantId ? { restaurant: restaurantId } : {}}
            onSave={(data) => {
              setExtractionDocName(data.name)
              refreshExtraction()
              toast.success('Document saved successfully')
            }}
          />
        </CardContent>
      </Card>

      {/* Extraction Status and Actions */}
      {extractionDocName && extractionDoc && (
        <Card className="border-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Extraction Status</CardTitle>
                <CardDescription>
                  Current status of menu extraction
                </CardDescription>
              </div>
              <Badge 
                variant={
                  isCompleted ? 'default' : 
                  isPendingApproval ? 'secondary' :
                  isProcessing ? 'secondary' : 
                  hasError ? 'destructive' : 
                  'outline'
                }
              >
                {isCompleted && <CheckCircle className="mr-1 h-3 w-3" />}
                {isPendingApproval && <Clock className="mr-1 h-3 w-3" />}
                {isProcessing && <Clock className="mr-1 h-3 w-3" />}
                {hasError && <XCircle className="mr-1 h-3 w-3" />}
                {status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Processing Progress */}
            {isProcessing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Processing batches...</span>
                  <span>
                    {extractionDoc.completed_batches || 0} / {extractionDoc.total_batches || 0}
                  </span>
                </div>
                <Progress 
                  value={
                    extractionDoc.total_batches 
                      ? ((extractionDoc.completed_batches || 0) / extractionDoc.total_batches) * 100 
                      : 0
                  } 
                  className="h-2"
                />
              </div>
            )}

            {/* Extraction Log */}
            {extractionDoc.extraction_log && (
              <div className="p-3 bg-muted rounded text-sm">
                {extractionDoc.extraction_log}
              </div>
            )}

            {/* Extract Button */}
            {!isProcessing && (
              <Button 
                onClick={handleExtract} 
                disabled={!extractionDoc?.menu_images?.length || isPendingApproval}
                size="lg"
                className="w-full"
              >
                <Play className="mr-2 h-4 w-4" />
                {isCompleted || hasError ? 'Extract Again' : 'Extract Menu Data'}
              </Button>
            )}

            {/* Extraction Results Stats */}
            {(isCompleted || isPendingApproval) && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-md">
                <div>
                  <div className="text-sm text-muted-foreground">Categories</div>
                  <div className="text-2xl font-bold">{extractionDoc.categories_created || 0}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Items Created</div>
                  <div className="text-2xl font-bold">{extractionDoc.items_created || 0}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Items Updated</div>
                  <div className="text-2xl font-bold">{extractionDoc.items_updated || 0}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Items Skipped</div>
                  <div className="text-2xl font-bold">{extractionDoc.items_skipped || 0}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Extracted Dishes - Review and Edit */}
      {isPendingApproval && extractionDoc?.extracted_dishes && extractionDoc.extracted_dishes.length > 0 && (
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle>Extracted Dishes - Review and Edit</CardTitle>
            <CardDescription>
              Review and edit the extracted dishes before approval. Changes will be saved automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EditableExtractedDishesTable
              dishes={extractionDoc.extracted_dishes}
              docname={extractionDocName!}
              onUpdate={refreshExtraction}
            />
          </CardContent>
        </Card>
      )}

      {/* Approve Button */}
      {isPendingApproval && (
        <Card className="border-2 border-green-200 bg-green-50/50">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold mb-1">Ready to Create Categories & Products?</h3>
                <p className="text-sm text-muted-foreground">
                  Approve the extracted data to automatically create menu categories and products in the database.
                </p>
              </div>
              <Button 
                onClick={handleApprove}
                size="lg"
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="mr-2 h-4 w-4" />
                Approve & Create Menu Items
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

