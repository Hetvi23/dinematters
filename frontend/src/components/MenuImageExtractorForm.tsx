import { useState, useEffect, useCallback } from 'react'
import { useFrappeGetDoc, useFrappePostCall } from '@/lib/frappe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Loader2, CheckCircle, Play, Check, 
  Settings, Image as ImageIcon, Sparkles, ChevronRight,
  ArrowLeft, AlertTriangle
} from 'lucide-react'
import { toast } from 'sonner'
import MenuImagesTable from './MenuImagesTable'
import EditableExtractedDishesTable from './EditableExtractedDishesTable'
import { useConfirm } from '@/hooks/useConfirm'
import { cn } from '@/lib/utils'

interface MenuImageExtractorFormProps {
  docname?: string
  restaurantId?: string
  onComplete?: (data: any) => void
}

type Step = 'setup' | 'images' | 'processing' | 'review'

// Mirror exactly what works in AIEnhancementPage
interface ExtractionStatus {
  status: string
  total_batches: number
  completed_batches: number
  extraction_log: string
  items_created: number
  categories_created: number
}

export default function MenuImageExtractorForm({ 
  docname, 
  restaurantId,
  onComplete 
}: MenuImageExtractorFormProps) {
  const { confirm, ConfirmDialogComponent } = useConfirm()
  const [extractionDocName, setExtractionDocName] = useState<string | undefined>(docname)
  const [activeStep, setActiveStep] = useState<Step>('setup')
  const [isSaving, setIsSaving] = useState(false)
  const [hasUploadedImages, setHasUploadedImages] = useState(false)

  // Local state for initial setup
  const [restaurantName, setRestaurantName] = useState('')
  const autoDescriptions = true

  // ─── EXACT AI ENHANCEMENT PATTERN ─────────────────────────────────────────
  // Local live status state - gets updated by our dedicated poll API
  const [liveStatus, setLiveStatus] = useState<ExtractionStatus | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  // ──────────────────────────────────────────────────────────────────────────

  // APIs
  // useFrappeGetDoc is only used for the REVIEW step (to get extracted_dishes, etc.)
  const { data: extractionDoc, mutate: refreshExtraction, isLoading: isDocLoading } = useFrappeGetDoc(
    'Menu Image Extractor',
    extractionDocName || '',
    {
      enabled: !!extractionDocName
    }
  )

  const { call: insertDoc } = useFrappePostCall('dinematters.dinematters.api.documents.create_document')
  const { call: updateDocument } = useFrappePostCall('dinematters.dinematters.api.documents.update_document')
  
  const { call: extractMenuData } = useFrappePostCall(
    'dinematters.dinematters.doctype.menu_image_extractor.menu_image_extractor.extract_menu_data'
  )

  // THE KEY FIX: dedicated status poll API - reads directly from DB, no cache
  const { call: getExtractionStatus } = useFrappePostCall(
    'dinematters.dinematters.doctype.menu_image_extractor.menu_image_extractor.get_extraction_status'
  )

  const { call: approveExtraction } = useFrappePostCall(
    'dinematters.dinematters.doctype.menu_image_extractor.menu_image_extractor.approve_extracted_data'
  )

  // Sync hasImages with initial doc state
  useEffect(() => {
    if (extractionDoc?.menu_images?.length) {
      setHasUploadedImages(true)
    }
  }, [extractionDoc?.menu_images?.length])

  // Sync step with doc status (for initial page-load of an existing doc)
  useEffect(() => {
    if (extractionDoc && !isPolling) {
      const status = extractionDoc.extraction_status
      if (status === 'Pending Approval' || status === 'Completed') {
        setActiveStep('review')
      } else if (status === 'Processing') {
        // Don't change to processing here - the poll loop handles this
        // But start polling if not already
        if (extractionDocName && activeStep !== 'processing') {
          setActiveStep('processing')
        }
      } else if (extractionDocName) {
        setActiveStep('images')
      }
      if (extractionDoc.restaurant_name) setRestaurantName(extractionDoc.restaurant_name)
    }
  }, [extractionDoc?.name]) // Only run once on doc load, not on every re-render

  // ─── AI ENHANCEMENT STYLE POLLING LOOP ────────────────────────────────────
  // Runs independently of useFrappeGetDoc. Polls our dedicated status API.
  useEffect(() => {
    if (!extractionDocName || activeStep !== 'processing') return

    // Already done? Don't poll.
    if (liveStatus?.status === 'Pending Approval' || liveStatus?.status === 'Completed' || liveStatus?.status === 'Failed') {
      setIsPolling(false)
      return
    }

    setIsPolling(true)

    const interval = setInterval(async () => {
      try {
        const res = await getExtractionStatus({ docname: extractionDocName })
        if (!res?.message) return

        const newStatus: ExtractionStatus = res.message
        setLiveStatus(newStatus)

        if (newStatus.status === 'Pending Approval' || newStatus.status === 'Completed') {
          // SUCCESS - transition to review and refresh the full doc for child tables
          clearInterval(interval)
          setIsPolling(false)
          
          // Small delay before final refresh to ensure DB consistency across API nodes
          setTimeout(async () => {
            toast.success(`AI Extraction complete! Found ${newStatus.items_created} dishes in ${newStatus.categories_created} categories.`)
            await refreshExtraction()
            setActiveStep('review')
          }, 800)
        } else if (newStatus.status === 'Failed') {
          clearInterval(interval)
          setIsPolling(false)
          toast.error('Extraction failed. Please check the error log and retry.')
        }
      } catch (err) {
        console.error('Extraction status poll error:', err)
      }
    }, 2000) // 2s interval - same as AI Enhancement's 3s but faster for UX

    return () => clearInterval(interval)
  }, [extractionDocName, activeStep, liveStatus?.status])
  // ──────────────────────────────────────────────────────────────────────────

  // Rotating statuses for "Magic" step
  const [magicStatusIdx, setMagicStatusIdx] = useState(0)
  const magicStatuses = [
    'Deep scanning menu images...',
    'Identifying food categories...',
    'Extracting product names & prices...',
    'Generating professional descriptions...',
    'Refining menu structure...',
    'Organizing dish metadata...',
  ]

  useEffect(() => {
    if (activeStep === 'processing') {
      const interval = setInterval(() => {
        setMagicStatusIdx(prev => (prev + 1) % magicStatuses.length)
      }, 2500)
      return () => clearInterval(interval)
    }
  }, [activeStep])

  const handleStart = async () => {
    if (!restaurantId) return
    setIsSaving(true)
    try {
      const result = await insertDoc({
        doctype: 'Menu Image Extractor',
        doc_data: {
          restaurant: restaurantId,
          restaurant_name: restaurantName,
          generate_descriptions: autoDescriptions ? 1 : 0
        }
      })
      if (result?.message?.name) {
        setExtractionDocName(result.message.name)
        setActiveStep('images')
        toast.success('Onboarding session started')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to start session')
    } finally {
      setIsSaving(false)
    }
  }

  const handleExtract = async () => {
    if (!extractionDocName || isSaving) return
    
    const hasImages = hasUploadedImages || (extractionDoc?.menu_images && extractionDoc.menu_images.length > 0)
    
    if (!hasImages) {
      toast.error('Please upload at least one menu image')
      return
    }

    setIsSaving(true)
    try {
      await extractMenuData({ docname: extractionDocName })
      toast.success('AI extraction started!')
      // Reset live status so polling starts fresh
      setLiveStatus(null)
      setActiveStep('processing')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to start extraction')
    } finally {
      setIsSaving(false)
    }
  }

  const handleApprove = async () => {
    if (!extractionDocName || isSaving) return
    const confirmed = await confirm({
      title: 'Final Approval',
      description: 'Create menu categories and products now?',
      confirmText: 'Approve',
      cancelText: 'Wait'
    })
    if (!confirmed) return

    setIsSaving(true)
    try {
      await approveExtraction({ docname: extractionDocName })
      toast.success('Extraction approved! Menu generated.')
      refreshExtraction()
      onComplete?.(extractionDoc)
    } catch (err: any) {
      toast.error(err?.message || 'Approval failed')
    } finally {
      setIsSaving(false)
    }
  }

  const renderSteps = () => (
    <div className="flex items-center justify-center mb-8 gap-2">
      {[
        { id: 'setup', label: 'Setup', icon: Settings },
        { id: 'images', label: 'Images', icon: ImageIcon },
        { id: 'processing', label: 'Magic', icon: Sparkles },
        { id: 'review', label: 'Review', icon: CheckCircle }
      ].map((step, idx) => {
        const Icon = step.icon
        const isActive = activeStep === step.id
        const isPast = ['setup', 'images', 'processing', 'review'].indexOf(activeStep) > idx
        
        return (
          <div key={step.id} className="flex items-center gap-2">
            <div className={cn(
              "flex flex-col items-center gap-1 transition-all duration-300",
              isActive ? "text-primary scale-110" : isPast ? "text-green-500" : "text-muted-foreground opacity-50"
            )}>
              <div className={cn(
                "p-2 rounded-full border-2",
                isActive ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(var(--primary),0.3)]" : 
                isPast ? "border-green-500 bg-green-50" : "border-transparent"
              )}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">{step.label}</span>
            </div>
            {idx < 3 && <ChevronRight className="h-4 w-4 text-muted-foreground opacity-20" />}
          </div>
        )
      })}
    </div>
  )

  if (isDocLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-pulse">
        <Loader2 className="h-8 w-8 animate-spin text-primary/40 mb-4" />
        <p className="text-muted-foreground text-sm font-medium">Preparing AI Environment...</p>
      </div>
    )
  }

  // Use live polled status during processing, but favor doc for review
  // Also ensure we don't flicker back to 0 if one source is briefly empty
  const isFinalState = activeStep === 'review' || extractionDoc?.extraction_status === 'Pending Approval' || extractionDoc?.extraction_status === 'Completed'
  
  const currentStatus = (isFinalState ? extractionDoc?.extraction_status : liveStatus?.status) || extractionDoc?.extraction_status
  const totalBatches = (isFinalState ? extractionDoc?.total_batches : (liveStatus?.total_batches || extractionDoc?.total_batches)) || 0
  const completedBatches = (isFinalState ? extractionDoc?.completed_batches : (liveStatus?.completed_batches || extractionDoc?.completed_batches)) || 0
  
  const itemsFound = Math.max(liveStatus?.items_created || 0, extractionDoc?.items_created || 0)
  const categoriesFound = Math.max(liveStatus?.categories_created || 0, extractionDoc?.categories_created || 0)

  return (
    <div className="space-y-6">
      {renderSteps()}

      {/* STEP 1: SETUP */}
      {activeStep === 'setup' && (
        <Card className="border-2 border-primary/5 bg-gradient-to-b from-white to-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Session Configuration
            </CardTitle>
            <CardDescription>
              Adjust settings before starting the AI-powered menu extraction.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Restaurant Name (Optional)</Label>
                <Input 
                  placeholder="e.g. Test Lite Restaurant"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">Helps AI understand context for better naming accuracy.</p>
              </div>
              
              <div className="flex items-start space-x-3 p-4 rounded-xl border bg-muted/20 opacity-70">
                <div className="p-2 rounded-full bg-primary/10">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="grid gap-1.5 leading-none">
                  <p className="text-sm font-semibold">
                    AI Auto-Descriptions Enabled
                  </p>
                  <p className="text-xs text-muted-foreground">
                    This session will automatically generate professional descriptions for all items.
                  </p>
                </div>
              </div>
            </div>
            
            <Button 
              className="w-full h-12 shadow-lg shadow-primary/20" 
              size="lg"
              onClick={handleStart}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Start Onboarding Session
            </Button>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: IMAGES */}
      {activeStep === 'images' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <MenuImagesTable 
            ownerDoctype="Menu Image Extractor"
            ownerName={extractionDocName}
            value={extractionDoc?.menu_images || []}
            onChange={async (newImages) => {
              if (newImages.length > 0) setHasUploadedImages(true)
              if (extractionDocName) {
                try {
                  await updateDocument({
                    doctype: 'Menu Image Extractor',
                    name: extractionDocName,
                    doc_data: { menu_images: newImages }
                  })
                  refreshExtraction()
                } catch (err: any) {
                  console.error('Failed to update extraction doc:', err)
                  toast.error(err?.message || 'Failed to sync image list')
                }
              }
            }}
          />
          
          <div className="flex flex-col gap-3 pt-4 border-t">
              <Button 
                size="lg" 
                className="w-full h-12 gap-2 shadow-lg shadow-primary/10"
                onClick={handleExtract}
                disabled={isSaving || (!hasUploadedImages && (!extractionDoc?.menu_images || extractionDoc.menu_images.length === 0))}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Begin AI Transformation
              </Button>
            <Button variant="ghost" onClick={() => setActiveStep('setup')} size="sm" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3 w-3 mr-2" />
              Back to Settings
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: PROCESSING - reads from liveStatus, not extractionDoc */}
      {activeStep === 'processing' && (
        <Card className="border-2 border-primary/20 overflow-hidden relative bg-gradient-to-b from-white to-primary/5">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-purple-500 to-primary animate-shimmer" />
          <CardHeader className="text-center pb-2">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-primary/20 shadow-2xl shadow-primary/10 group">
              <Sparkles className="h-10 w-10 text-primary animate-pulse group-hover:scale-110 transition-transform duration-500" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">AI Magic in Progress</CardTitle>
            <CardDescription className="text-sm font-medium">
              We are analyzing your images and building your digital menu...
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 py-6">
            {currentStatus === 'Failed' ? (
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex gap-3 items-start">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <div className="text-sm">
                  <p className="font-bold">Extraction Failed</p>
                  <p className="opacity-80">{liveStatus?.extraction_log || extractionDoc?.extraction_log || 'An unknown error occurred.'}</p>
                  <Button variant="outline" size="sm" className="mt-3 bg-white text-destructive hover:bg-destructive/5" onClick={() => setActiveStep('images')}>
                    Retry Uploads
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <Badge variant="secondary" className="px-3 py-1 bg-primary/10 text-primary border-primary/20 animate-pulse">
                      {magicStatuses[magicStatusIdx]}
                    </Badge>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                       <Loader2 className="h-3 w-3 animate-spin" />
                       Processing Batch {completedBatches} of {totalBatches || '...'}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                     <Progress 
                       value={totalBatches > 0 ? (completedBatches / totalBatches) * 100 : 5} 
                       className="h-3 shadow-inner" 
                     />
                     <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">
                        <span>Start</span>
                        <span>{totalBatches > 0 ? Math.round((completedBatches / totalBatches) * 100) : 5}% Complete</span>
                        <span>Finish</span>
                     </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl border bg-white/50 backdrop-blur-sm flex flex-col items-center justify-center text-center space-y-1 group hover:border-primary/30 transition-all">
                    <span className="text-2xl font-black text-primary group-hover:scale-110 transition-transform">{itemsFound}</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Dishes Found</span>
                  </div>
                  <div className="p-4 rounded-2xl border bg-white/50 backdrop-blur-sm flex flex-col items-center justify-center text-center space-y-1 group hover:border-primary/30 transition-all">
                    <span className="text-2xl font-black text-primary group-hover:scale-110 transition-transform">{categoriesFound}</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Categories</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 4: REVIEW */}
      {activeStep === 'review' && (
        <div className="space-y-6 animate-in zoom-in-95">
          <Card className="border-2 border-green-100 bg-green-50/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <CheckCircle className="h-5 w-5" />
                  Extracted Successfully
                </CardTitle>
                <CardDescription>
                  Review the extracted dishes and categories below.
                </CardDescription>
              </div>
              <Badge variant={extractionDoc?.extraction_status === 'Completed' ? 'default' : 'secondary'} className="bg-green-500 hover:bg-green-600">
                {extractionDoc?.extraction_status}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
                {[
                  { label: 'Categories Found', val: categoriesFound },
                  { label: 'Dishes Found', val: itemsFound },
                  { label: 'Updates', val: extractionDoc?.items_updated },
                  { label: 'Errors/Skips', val: extractionDoc?.items_skipped }
                ].map((stat, i) => (
                  <div key={i} className="flex flex-col bg-white p-3 rounded-lg border shadow-sm">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">{stat.label}</span>
                    <span className="text-xl font-bold text-primary">{stat.val || 0}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {extractionDoc?.extracted_dishes?.length > 0 && (
            <div className="border-2 rounded-xl overflow-hidden shadow-sm bg-white">
              <EditableExtractedDishesTable
                dishes={extractionDoc.extracted_dishes}
                docname={extractionDocName!}
                onUpdate={refreshExtraction}
              />
            </div>
          )}

          {extractionDoc?.extraction_status !== 'Completed' && (
            <Button 
              size="lg" 
              className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700 shadow-xl shadow-green-100"
              onClick={handleApprove}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Check className="h-5 w-5 mr-2" />
              )}
              Final Approve & Push to Menu
            </Button>
          )}
        </div>
      )}

      {ConfirmDialogComponent}
    </div>
  )
}
