import { useState, useEffect } from 'react'
import { useFrappeGetDoc, useFrappePostCall } from '@/lib/frappe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

  const [restaurantName, setRestaurantName] = useState('')
  const autoDescriptions = true

  const [liveStatus, setLiveStatus] = useState<ExtractionStatus | null>(null)
  const [isPolling, setIsPolling] = useState(false)

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

  const { call: getExtractionStatus } = useFrappePostCall(
    'dinematters.dinematters.doctype.menu_image_extractor.menu_image_extractor.get_extraction_status'
  )

  const { call: approveExtraction } = useFrappePostCall(
    'dinematters.dinematters.doctype.menu_image_extractor.menu_image_extractor.approve_extracted_data'
  )

  useEffect(() => {
    if (extractionDoc?.menu_images?.length) {
      setHasUploadedImages(true)
    }
  }, [extractionDoc?.menu_images?.length])

  useEffect(() => {
    if (extractionDoc && !isPolling) {
      const status = extractionDoc.extraction_status
      if (status === 'Pending Approval' || status === 'Completed') {
        setActiveStep('review')
      } else if (status === 'Processing') {
        if (extractionDocName && activeStep !== 'processing') {
          setActiveStep('processing')
        }
      } else if (extractionDocName) {
        setActiveStep('images')
      }
      if (extractionDoc.restaurant_name) setRestaurantName(extractionDoc.restaurant_name)
    }
  }, [extractionDoc?.name])

  useEffect(() => {
    if (!extractionDocName || activeStep !== 'processing') return
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
          clearInterval(interval)
          setIsPolling(false)
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
    }, 2000)

    return () => clearInterval(interval)
  }, [extractionDocName, activeStep, liveStatus?.status])

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
    <div className="flex items-center justify-center mb-10 gap-4 sm:gap-10 px-2 overflow-x-auto no-scrollbar py-2">
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
          <div key={step.id} className="flex items-center gap-3 sm:gap-6 shrink-0 relative">
            <div className={cn(
              "flex flex-col items-center gap-2 transition-all duration-700",
              isActive ? "scale-110" : "opacity-60"
            )}>
              <div className={cn(
                "h-12 w-12 sm:h-14 sm:w-14 rounded-[1.25rem] flex items-center justify-center transition-all duration-700 relative overflow-hidden",
                isActive 
                  ? "bg-primary text-white shadow-[0_10px_30px_-5px_rgba(var(--primary),0.4)] ring-4 ring-primary/20" 
                  : isPast 
                    ? "bg-green-500/10 text-green-600 border border-green-500/20" 
                    : "bg-muted text-muted-foreground border border-border"
              )}>
                {isPast ? <Check className="h-6 w-6" /> : <Icon className={cn("h-6 w-6", isActive && "animate-pulse")} />}
                {isActive && (
                  <div className="absolute inset-0 bg-white/10 animate-pulse pointer-events-none" />
                )}
              </div>
              <span className={cn(
                "text-[10px] font-black uppercase tracking-[0.2em] sm:text-[11px]",
                isActive ? "text-primary" : isPast ? "text-green-600" : "text-muted-foreground"
              )}>
                {step.label}
              </span>
            </div>
            {idx < 3 && (
              <div className="hidden sm:block">
                <ChevronRight className={cn(
                  "h-5 w-5 transition-colors duration-700",
                  isPast ? "text-green-500" : "text-muted-foreground opacity-10"
                )} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  if (isDocLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 animate-pulse">
        <Loader2 className="h-10 w-10 animate-spin text-primary/30 mb-6" />
        <p className="text-muted-foreground text-sm font-black uppercase tracking-widest">Hydrating AI Environment...</p>
      </div>
    )
  }

  const isFinalState = activeStep === 'review' || extractionDoc?.extraction_status === 'Pending Approval' || extractionDoc?.extraction_status === 'Completed'
  const currentStatus = (isFinalState ? extractionDoc?.extraction_status : liveStatus?.status) || extractionDoc?.extraction_status
  const totalBatches = (isFinalState ? extractionDoc?.total_batches : (liveStatus?.total_batches || extractionDoc?.total_batches)) || 0
  const completedBatches = (isFinalState ? extractionDoc?.completed_batches : (liveStatus?.completed_batches || extractionDoc?.completed_batches)) || 0
  
  const itemsFound = Math.max(liveStatus?.items_created || 0, extractionDoc?.items_created || 0)
  const categoriesFound = Math.max(liveStatus?.categories_created || 0, extractionDoc?.categories_created || 0)

  return (
    <div className="space-y-8">
      {renderSteps()}

      {/* STEP 1: SETUP */}
      {activeStep === 'setup' && (
        <Card className="border-2 border-primary/5 bg-gradient-to-br from-card to-primary/5 shadow-2xl shadow-primary/5 overflow-hidden">
          <CardHeader className="pb-8">
            <CardTitle className="flex items-center gap-3 text-3xl font-black">
              <div className="h-12 w-12 rounded-[1rem] bg-primary/10 text-primary flex items-center justify-center">
                <Settings className="h-7 w-7" />
              </div>
              Session Setup
            </CardTitle>
            <CardDescription className="text-base font-medium text-muted-foreground/80">
              Fine-tune the vision-language models for maximum accuracy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-10">
            <div className="space-y-8">
              <div className="space-y-3">
                <Label className="text-[11px] uppercase font-black tracking-[0.15em] text-muted-foreground">Contextual Identity</Label>
                <Input 
                  placeholder="e.g. The Gourmet Yard"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  className="h-14 text-xl font-bold bg-background/40 border-primary/5 focus-visible:ring-primary/30 focus-visible:border-primary/30 transition-all rounded-2xl px-6"
                />
                <p className="text-[10px] text-muted-foreground leading-relaxed px-1">
                  Providing a restaurant name helps the AI distinguish between brand assets and menu items with 40% higher precision.
                </p>
              </div>
              
              <div className="flex items-start space-x-5 p-6 rounded-[2rem] border border-primary/10 bg-primary/5 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                <div className="h-14 w-14 rounded-2xl bg-primary/10 shrink-0 relative z-10 flex items-center justify-center">
                  <Sparkles className="h-7 w-7 text-primary animate-pulse" />
                </div>
                <div className="grid gap-1.5 relative z-10 py-1">
                  <p className="text-base font-black text-foreground uppercase tracking-tight">
                    Vision-Language Synthesis
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                    Automatically generates profession SEO-optimized descriptions and performs smart category clustering.
                  </p>
                </div>
              </div>
            </div>
            
            <Button 
              className="w-full h-16 text-white font-black text-xl bg-primary hover:bg-primary/90 shadow-2xl shadow-primary/30 rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.98] gap-4" 
              onClick={handleStart}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Play className="h-6 w-6 fill-current" />}
              Initialize Session
            </Button>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: IMAGES */}
      {activeStep === 'images' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <Card className="border-2 border-primary/5 shadow-2xl overflow-hidden rounded-3xl">
            <CardContent className="p-8">
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
            </CardContent>
          </Card>
          
          <div className="flex flex-col gap-4 pt-4">
            <Button 
              size="lg" 
              className="w-full h-16 text-xl font-black bg-primary hover:bg-primary/90 shadow-2xl shadow-primary/20 rounded-2xl gap-4 transition-all hover:scale-[1.01] active:scale-[0.98]"
              onClick={handleExtract}
              disabled={isSaving || (!hasUploadedImages && (!extractionDoc?.menu_images || extractionDoc.menu_images.length === 0))}
            >
              {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Sparkles className="h-6 w-6" />}
              Begin Neural Transformation
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setActiveStep('setup')} 
              size="sm" 
              className="text-muted-foreground hover:text-foreground h-12 rounded-2xl font-bold uppercase tracking-widest text-[11px]"
            >
              <ArrowLeft className="h-4 w-4 mr-3" />
              Return to Settings
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: PROCESSING */}
      {activeStep === 'processing' && (
        <Card className="border-2 border-primary/10 overflow-hidden relative bg-gradient-to-b from-card via-card to-primary/5 shadow-2xl rounded-[2.5rem]">
          {/* Immersive Background Effects */}
          <div className="absolute -top-32 -right-32 w-80 h-80 bg-primary/10 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-purple-500/5 rounded-full blur-[100px] animate-pulse" />
          
          <CardHeader className="text-center pb-4 relative z-10 pt-16">
            <div className="relative w-32 h-32 mx-auto mb-10">
              <div className="absolute inset-0 bg-primary/30 rounded-full blur-[40px] animate-pulse" />
              <div className="relative w-full h-full bg-gradient-to-br from-primary to-orange-500 rounded-[2.25rem] flex items-center justify-center shadow-2xl border border-white/20 transform rotate-12 hover:rotate-0 transition-transform duration-1000">
                <Sparkles className="h-14 w-14 text-white animate-bounce" />
              </div>
            </div>
            <CardTitle className="text-4xl font-black tracking-tighter bg-gradient-to-r from-primary via-orange-500 to-primary bg-clip-text text-transparent">
              AI Magic in Progress
            </CardTitle>
            <CardDescription className="text-base font-bold text-muted-foreground/80 mt-4 max-w-sm mx-auto leading-relaxed">
              Our neural network is synthetically mapping your menu architecture.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-12 py-12 relative z-10 px-10">
            {currentStatus === 'Failed' ? (
              <div className="p-8 rounded-[2rem] bg-destructive/10 border border-destructive/20 text-destructive flex gap-5 items-start backdrop-blur-xl">
                <AlertTriangle className="h-8 w-8 shrink-0 mt-1" />
                <div className="space-y-3">
                  <p className="font-black text-xl tracking-tight">Synthesis Interrupted</p>
                  <p className="text-sm opacity-90 leading-relaxed font-medium">{liveStatus?.extraction_log || extractionDoc?.extraction_log || 'A neural processing exception occurred.'}</p>
                  <Button variant="outline" size="sm" className="mt-6 bg-background text-destructive hover:bg-destructive/5 border-destructive/20 rounded-2xl h-11 px-6 font-bold" onClick={() => setActiveStep('images')}>
                    Back to Image Queue
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-8">
                  <div className="flex flex-col items-center justify-center gap-5">
                    <div className="inline-flex items-center gap-3 px-6 py-2.5 rounded-full bg-primary/10 text-primary border border-primary/20 backdrop-blur-md shadow-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-xs font-black uppercase tracking-[0.2em]">{magicStatuses[magicStatusIdx]}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-4 px-2">
                    <div className="relative h-5 w-full bg-muted rounded-full overflow-hidden border border-border/40 shadow-inner p-1">
                      <div 
                        className="absolute inset-1 bg-gradient-to-r from-primary via-orange-400 to-primary transition-all duration-1000 ease-out flex items-center justify-end pr-2 overflow-hidden rounded-full"
                        style={{ width: `calc(${totalBatches > 0 ? (completedBatches / totalBatches) * 100 : 8}% - 8px)` }}
                      >
                         <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.3)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.3)_50%,rgba(255,255,255,0.3)_75%,transparent_75%,transparent)] bg-[length:40px_40px] animate-[shimmer_2s_linear_infinite]" />
                      </div>
                    </div>
                    <div className="flex justify-between text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] px-2 opacity-50">
                      <span>Neural Entry</span>
                      <span className="text-primary opacity-100">{totalBatches > 0 ? Math.round((completedBatches / totalBatches) * 100) : 8}% Complete</span>
                      <span>Synthesis</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="p-8 rounded-[2.5rem] border border-primary/10 bg-background/40 backdrop-blur-2xl flex flex-col items-center justify-center text-center space-y-3 group transition-all hover:bg-white/10 hover:border-primary/40 hover:scale-[1.03] shadow-md">
                    <div className="text-5xl font-black text-primary drop-shadow-[0_0_20px_rgba(var(--primary),0.3)]">{itemsFound}</div>
                    <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Dishes Found</div>
                  </div>
                  <div className="p-8 rounded-[2.5rem] border border-primary/10 bg-background/40 backdrop-blur-2xl flex flex-col items-center justify-center text-center space-y-3 group transition-all hover:bg-white/10 hover:border-primary/40 hover:scale-[1.03] shadow-md">
                    <div className="text-5xl font-black text-primary drop-shadow-[0_0_20px_rgba(var(--primary),0.3)]">{categoriesFound}</div>
                    <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Categories</div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 4: REVIEW */}
      {activeStep === 'review' && (
        <div className="space-y-10 animate-in zoom-in-95 duration-700">
          <Card className="border-2 border-green-500/10 bg-green-500/5 shadow-2xl shadow-green-500/5 overflow-hidden relative rounded-[2.5rem]">
             <div className="absolute -top-10 -right-10 opacity-5">
               <CheckCircle className="h-48 w-48 text-green-500" />
             </div>
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-10 relative z-10 pt-10 px-10">
              <div className="space-y-2">
                <CardTitle className="flex items-center gap-3 text-3xl font-black text-green-700 dark:text-green-400">
                  <div className="h-12 w-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
                    <CheckCircle className="h-7 w-7" />
                  </div>
                  Synthesis Perfected
                </CardTitle>
                <CardDescription className="text-base font-bold text-muted-foreground/70">
                  Review the neural extraction results and confirm category mappings.
                </CardDescription>
              </div>
              <Badge variant="outline" className="w-fit bg-green-500/10 text-green-600 border-green-500/20 px-6 py-2.5 font-bold uppercase tracking-[0.2em] text-[10px] rounded-full">
                {extractionDoc?.extraction_status}
              </Badge>
            </CardHeader>
            <CardContent className="relative z-10 px-10 pb-10">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Cloud Categories', val: categoriesFound, color: 'text-primary' },
                  { label: 'Neural Dishes', val: itemsFound, color: 'text-primary' },
                  { label: 'Doc Updates', val: extractionDoc?.items_updated, color: 'text-green-600' },
                  { label: 'Neural Skips', val: extractionDoc?.items_skipped, color: 'text-red-600' }
                ].map((stat, i) => (
                  <div key={i} className="flex flex-col bg-background/60 backdrop-blur-xl p-6 rounded-[1.75rem] border border-border/50 shadow-sm transition-all hover:scale-[1.03] group">
                    <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-2 opacity-50 group-hover:opacity-100 transition-opacity">{stat.label}</span>
                    <span className={cn("text-3xl font-black", stat.color)}>{stat.val || 0}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {extractionDoc?.extracted_dishes?.length > 0 && (
            <div className="border-2 border-primary/5 rounded-[2.5rem] overflow-hidden shadow-2xl bg-card transition-all">
              <div className="bg-muted/30 p-8 border-b border-border/50">
                <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                   <div className="h-1.5 w-6 bg-primary rounded-full" />
                   Review Extracted Intelligence
                </h3>
              </div>
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
              className="w-full h-20 text-2xl font-black bg-green-600 hover:bg-green-700 shadow-2xl shadow-green-500/30 rounded-[2rem] gap-5 transition-all hover:scale-[1.01] active:scale-[0.98]"
              onClick={handleApprove}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                <Check className="h-8 w-8" />
              )}
              Finalize & Synchronize Menu Data
            </Button>
          )}
        </div>
      )}

      {ConfirmDialogComponent}
    </div>
  )
}
