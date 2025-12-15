import { useState, useEffect } from 'react'
import { useFrappeGetDocList, useFrappeGetDoc, useFrappePostCall } from '@/lib/frappe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Loader2, CheckCircle, XCircle, Clock, Upload, Play, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import DynamicForm from './DynamicForm'

interface MenuExtractionProps {
  restaurantId: string
  onExtractionComplete?: (data: any) => void
  onNavigateToReview?: () => void
}

export default function MenuExtraction({ restaurantId, onExtractionComplete, onNavigateToReview }: MenuExtractionProps) {
  const [showForm, setShowForm] = useState(false)
  const [extractionDocName, setExtractionDocName] = useState<string | null>(null)

  // Get existing extraction for this restaurant
  const { data: extractions, isLoading } = useFrappeGetDocList(
    'Menu Image Extractor',
    {
      fields: ['name', 'restaurant', 'extraction_status', 'total_batches', 'completed_batches', 'creation'],
      filters: { restaurant: restaurantId },
      orderBy: { field: 'creation', order: 'desc' },
      limit: 1
    },
    restaurantId ? `menu-extraction-${restaurantId}` : null
  )

  const latestExtraction = extractions?.[0]

  // Get full extraction document
  const { data: extractionDoc, mutate: refreshExtraction } = useFrappeGetDoc(
    'Menu Image Extractor',
    latestExtraction?.name || extractionDocName || '',
    {
      enabled: !!(latestExtraction?.name || extractionDocName)
    }
  )

  const { call: extractMenuData } = useFrappePostCall(
    'dinematters.dinematters.doctype.menu_image_extractor.menu_image_extractor.extract_menu_data'
  )

  // Auto-refresh extraction status if processing
  useEffect(() => {
    if (extractionDoc?.extraction_status === 'Processing') {
      const interval = setInterval(() => {
        refreshExtraction()
      }, 5000) // Refresh every 5 seconds

      return () => clearInterval(interval)
    }
  }, [extractionDoc?.extraction_status, refreshExtraction])

  const handleExtract = async () => {
    if (!extractionDoc?.name) {
      toast.error('Please save the extraction document first')
      return
    }

    // Validate images (same as doctype)
    if (!extractionDoc.menu_images || extractionDoc.menu_images.length === 0) {
      toast.error('Please upload at least one menu image before extraction')
      return
    }

    if (extractionDoc.menu_images.length > 20) {
      toast.error(`Maximum 20 images allowed. Currently ${extractionDoc.menu_images.length} images uploaded.`)
      return
    }

    // Confirm extraction (same as doctype)
    if (!confirm(`This will extract menu data from ${extractionDoc.menu_images.length} image(s) and create/update categories and products. Continue?`)) {
      return
    }

    try {
      const result = await extractMenuData({ docname: extractionDoc.name })
      // Handle different response formats
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

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
        Loading...
      </div>
    )
  }

  const status = extractionDoc?.extraction_status || 'Pending'
  const isCompleted = status === 'Completed'
  const isProcessing = status === 'Processing'
  const hasError = status === 'Failed'

  return (
    <div className="space-y-6">
      {/* Existing Extraction Status */}
      {latestExtraction && (
        <Card className="border-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Current Extraction</CardTitle>
                <CardDescription>
                  Status of the latest menu extraction
                </CardDescription>
              </div>
              <Badge 
                variant={
                  isCompleted ? 'default' : 
                  isProcessing ? 'secondary' : 
                  hasError ? 'destructive' : 
                  'outline'
                }
              >
                {isCompleted && <CheckCircle className="mr-1 h-3 w-3" />}
                {isProcessing && <Clock className="mr-1 h-3 w-3" />}
                {hasError && <XCircle className="mr-1 h-3 w-3" />}
                {status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isProcessing && (
              <div className="space-y-2 mb-4">
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
            {extractionDoc?.extraction_log && (
              <div className="p-3 bg-muted rounded text-sm mb-4">
                {extractionDoc.extraction_log}
              </div>
            )}
            {!isProcessing && !isCompleted && (
              <Button onClick={handleExtract} disabled={!extractionDoc?.menu_images?.length}>
                <Play className="mr-2 h-4 w-4" />
                Start Extraction
              </Button>
            )}
            
            {/* Show extracted dishes if available */}
            {extractionDoc?.extracted_dishes && Array.isArray(extractionDoc.extracted_dishes) && extractionDoc.extracted_dishes.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3">Extracted Dishes ({extractionDoc.extracted_dishes.length})</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-2 text-left">Dish Name</th>
                        <th className="p-2 text-left">Category</th>
                        <th className="p-2 text-left">Price</th>
                        <th className="p-2 text-left">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extractionDoc.extracted_dishes.slice(0, 10).map((dish: any, idx: number) => {
                        const dishName = dish?.dish_name || dish?.product_name || 'N/A'
                        const category = dish?.category || '-'
                        const price = dish?.price ? `$${Number(dish.price).toFixed(2)}` : '-'
                        const description = dish?.description || '-'
                        return (
                          <tr key={dish?.dish_id || idx} className="border-t">
                            <td className="p-2">{String(dishName)}</td>
                            <td className="p-2">{String(category)}</td>
                            <td className="p-2">{String(price)}</td>
                            <td className="p-2 text-muted-foreground">{String(description)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {extractionDoc.extracted_dishes.length > 10 && (
                    <div className="p-2 text-center text-sm text-muted-foreground">
                      + {extractionDoc.extracted_dishes.length - 10} more dishes
                    </div>
                  )}
                </div>
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-900">
                        Ready to approve extracted data?
                      </p>
                      <p className="text-sm text-blue-700 mt-1">
                        Go to the "Review Extracted Data" step to see all extracted dishes and approve them to create menu items.
                      </p>
                    </div>
                    <Button 
                      onClick={() => {
                        if (onNavigateToReview) {
                          onNavigateToReview()
                        } else {
                          toast.info('Please navigate to the "Review Extracted Data" step to approve')
                        }
                      }}
                      variant="default"
                      className="ml-4"
                    >
                      Review & Approve
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Extraction Form */}
      {(!latestExtraction || showForm) && (
        <Card className="border-2">
          <CardHeader>
            <CardTitle>
              {latestExtraction ? 'Update Menu Images' : 'Upload Menu Images'}
            </CardTitle>
            <CardDescription>
              Upload menu images to automatically extract categories and products. 
              Images will be processed in batches with a 2-hour timeout per batch.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/30 rounded-lg p-6 border">
              <DynamicForm
                doctype="Menu Image Extractor"
                docname={latestExtraction?.name || undefined}
                mode={latestExtraction ? 'edit' : 'create'}
                initialData={{ restaurant: restaurantId }}
                onSave={(data) => {
                  setExtractionDocName(data.name)
                  setShowForm(false)
                  if (latestExtraction) {
                    refreshExtraction()
                  }
                  toast.success('Menu Image Extractor saved successfully')
                  onExtractionComplete?.(data)
                }}
                onCancel={() => {
                  if (latestExtraction) {
                    setShowForm(false)
                  }
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {latestExtraction && !showForm && (
        <Button variant="outline" onClick={() => setShowForm(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Update Images
        </Button>
      )}
    </div>
  )
}

