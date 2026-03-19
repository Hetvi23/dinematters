import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrappePostCall } from '@/lib/frappe'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AiRechargeModal } from '@/components/AiRechargeModal'
import {
  Sparkles,
  Upload,
  Loader2,
  Eye,
  Image as ImageIcon,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Download,
  Grid3x3,
} from 'lucide-react'
import { format } from 'date-fns'

interface ThemeHistoryItem {
  id: string
  image_url: string
  source_images?: string[]
  created_on?: string
  active?: boolean
}

interface ThemeStatusResponse {
  success: boolean
  enabled?: boolean
  status: 'Idle' | 'Pending' | 'Processing' | 'Completed' | 'Failed'
  active_image?: string | null
  preview_image?: string | null
  source_images?: string[]
  history?: ThemeHistoryItem[]
  error_message?: string | null
}

const CREDITS_REQUIRED = 15
const MIN_IMAGES = 1
const MAX_IMAGES = 3

export default function AIMenuThemeBackgroundPage() {
  const { selectedRestaurant, restaurantConfig } = useRestaurant()
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [status, setStatus] = useState<ThemeStatusResponse | null>(null)
  const [creditBalance, setCreditBalance] = useState(0)
  const [creditLoading, setCreditLoading] = useState(false)
  const [showRechargeModal, setShowRechargeModal] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [isBackgroundEnabled, setIsBackgroundEnabled] = useState(true)
  const [isTogglingEnabled, setIsTogglingEnabled] = useState(false)
  const [isStartingGeneration, setIsStartingGeneration] = useState(false)
  const [lastKnownStatus, setLastKnownStatus] = useState<ThemeStatusResponse['status']>('Idle')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const { call: uploadFile } = useFrappePostCall('dinematters.dinematters.api.ai_media.upload_base64_image')
  const { call: generateThemeBackground, loading: isGenerating } = useFrappePostCall('dinematters.dinematters.api.ai_media.generate_menu_theme_background')
  const { call: getThemeStatus } = useFrappePostCall<ThemeStatusResponse>('dinematters.dinematters.api.ai_media.get_menu_theme_background_status')
  const { call: setThemeBackgroundEnabled } = useFrappePostCall('dinematters.dinematters.api.ai_media.set_menu_theme_background_enabled')
  const { call: activateThemeBackground, loading: isActivating } = useFrappePostCall('dinematters.dinematters.api.ai_media.activate_menu_theme_background')
  const { call: getBillingInfo } = useFrappePostCall('dinematters.dinematters.api.ai_billing.get_ai_billing_info')

  const activeImage = status?.active_image || restaurantConfig?.branding?.menuThemeBackground || ''
  const previewOutput = status?.preview_image || restaurantConfig?.branding?.menuThemeBackgroundPreview || ''
  const history = useMemo(() => status?.history || restaurantConfig?.branding?.menuThemeBackgroundHistory || [], [status, restaurantConfig])
  const isProcessing = status?.status === 'Pending' || status?.status === 'Processing'
  const isBusy = isUploading || isGenerating || isStartingGeneration || isProcessing

  const fetchCredits = useCallback(async () => {
    if (!selectedRestaurant) return
    setCreditLoading(true)
    try {
      const res: any = await getBillingInfo({ restaurant: selectedRestaurant })
      const balance = res?.message?.ai_credits ?? 0
      setCreditBalance(balance)
      window.dispatchEvent(new CustomEvent('ai-credits-updated', { detail: { balance } }))
    } catch {
      toast.error('Failed to load AI credits')
    } finally {
      setCreditLoading(false)
    }
  }, [getBillingInfo, selectedRestaurant])

  const fetchStatus = useCallback(async () => {
    if (!selectedRestaurant) return
    try {
      const res: any = await getThemeStatus({ restaurant: selectedRestaurant })
      const payload = res?.message || res
      if (payload?.success) {
        setStatus(payload)
        setIsBackgroundEnabled(payload?.enabled ?? true)
      }
    } catch (error: any) {
      toast.error('Failed to load background status', { description: error?.message })
    }
  }, [getThemeStatus, selectedRestaurant])

  useEffect(() => {
    fetchCredits()
    fetchStatus()
  }, [fetchCredits, fetchStatus])

  useEffect(() => {
    if (!status?.status) return

    if ((lastKnownStatus === 'Pending' || lastKnownStatus === 'Processing') && status.status === 'Completed') {
      toast.success('Preview generated successfully')
    }

    if ((lastKnownStatus === 'Pending' || lastKnownStatus === 'Processing') && status.status === 'Failed') {
      toast.error('Preview generation failed', {
        description: status.error_message || 'The AI background generation could not be completed.',
      })
    }

    setLastKnownStatus(status.status)
    if (status.status === 'Completed' || status.status === 'Failed') {
      setIsStartingGeneration(false)
    }
  }, [lastKnownStatus, status])

  useEffect(() => {
    if (!isProcessing || !selectedRestaurant) return
    const interval = setInterval(() => {
      fetchStatus()
      fetchCredits()
    }, 3000)
    return () => clearInterval(interval)
  }, [fetchCredits, fetchStatus, isProcessing, selectedRestaurant])

  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [previews])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []).slice(0, MAX_IMAGES)
    if (!selected.length) return

    previews.forEach((url) => URL.revokeObjectURL(url))
    const nextPreviews = selected.map((file) => URL.createObjectURL(file))
    setFiles(selected)
    setPreviews(nextPreviews)
    setUploadedUrls([])
  }

  const readFileAsBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result.split(',')[1] : ''
      resolve(result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const uploadSelectedFiles = async () => {
    if (files.length < MIN_IMAGES || files.length > MAX_IMAGES) {
      toast.error(`Please select between ${MIN_IMAGES} and ${MAX_IMAGES} images`)
      return []
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      const urls: string[] = []
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]
        const filedata = await readFileAsBase64(file)
        const res: any = await uploadFile({ filename: file.name, filedata })
        const fileUrl = res?.message?.file_url || res?.file_url
        if (!fileUrl) {
          throw new Error(`Upload failed for ${file.name}`)
        }
        urls.push(fileUrl)
        setUploadProgress(Math.round(((index + 1) / files.length) * 100))
      }
      setUploadedUrls(urls)
      toast.success(`${urls.length} menu image(s) uploaded`)
      return urls
    } catch (error: any) {
      toast.error('Failed to upload menu images', { description: error?.message })
      return []
    } finally {
      setIsUploading(false)
    }
  }

  const handleGenerate = async () => {
    if (!selectedRestaurant) {
      toast.error('Please select a restaurant')
      return
    }

    if (!isBackgroundEnabled) {
      toast.error('Menu background is turned off')
      return
    }

    if (creditBalance < CREDITS_REQUIRED) {
      setShowRechargeModal(true)
      return
    }

    let sourceImages = uploadedUrls
    if (!sourceImages.length) {
      sourceImages = await uploadSelectedFiles()
    }

    if (sourceImages.length < MIN_IMAGES || sourceImages.length > MAX_IMAGES) {
      return
    }

    try {
      setIsStartingGeneration(true)
      await generateThemeBackground({
        restaurant: selectedRestaurant,
        source_images: JSON.stringify(sourceImages),
        activate: 0,
      })
      toast.success('AI theme background generation started')
      await fetchStatus()
      await fetchCredits()
    } catch (error: any) {
      setIsStartingGeneration(false)
      toast.error('Failed to start generation', { description: error?.message })
    }
  }

  const handleActivate = async (imageUrl: string) => {
    if (!selectedRestaurant || !imageUrl) return
    if (!isBackgroundEnabled) {
      toast.error('Menu background is turned off')
      return
    }
    try {
      await activateThemeBackground({ restaurant: selectedRestaurant, image_url: imageUrl })
      toast.success('Theme background activated')
      await fetchStatus()
    } catch (error: any) {
      toast.error('Failed to activate background', { description: error?.message })
    }
  }

  const handleDownload = (url: string, filename: string) => {
    const proxyUrl = `/api/method/dinematters.dinematters.api.ai_media.download_proxy?file_url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`
    const link = document.createElement('a')
    link.href = proxyUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Download started')
  }

  const handleToggleBackground = async () => {
    if (!selectedRestaurant || isTogglingEnabled) return
    const nextEnabled = !isBackgroundEnabled
    setIsTogglingEnabled(true)
    try {
      await setThemeBackgroundEnabled({ restaurant: selectedRestaurant, enabled: nextEnabled ? 1 : 0 })
      setIsBackgroundEnabled(nextEnabled)
      toast.success(nextEnabled ? 'Menu background enabled' : 'Menu background disabled')
      await fetchStatus()
    } catch (error: any) {
      toast.error('Failed to update menu background setting', { description: error?.message })
    } finally {
      setIsTogglingEnabled(false)
    }
  }

  const statusTone = useMemo(() => {
    switch (status?.status) {
      case 'Completed':
        return 'bg-green-500/10 text-green-600 border-green-200'
      case 'Failed':
        return 'bg-red-500/10 text-red-600 border-red-200'
      case 'Processing':
      case 'Pending':
        return 'bg-amber-500/10 text-amber-600 border-amber-200'
      default:
        return 'bg-muted text-muted-foreground border-border'
    }
  }, [status?.status])

  const processingProgress = useMemo(() => {
    if (status?.status === 'Pending') return 25
    if (status?.status === 'Processing') return 70
    if (status?.status === 'Completed') return 100
    if (status?.status === 'Failed') return 100
    if (isStartingGeneration) return 15
    return 0
  }, [isStartingGeneration, status?.status])

  if (!selectedRestaurant) {
    return <div className="p-8 text-center text-muted-foreground">Please select a restaurant</div>
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Menu Theme Background</h1>
          <p className="text-muted-foreground mt-2">
            Generate a personalized decorative menu background for <strong>{CREDITS_REQUIRED} credits</strong>.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant={isBackgroundEnabled ? 'default' : 'outline'} onClick={handleToggleBackground} disabled={isTogglingEnabled || isBusy} className="gap-2">
            {isTogglingEnabled ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Menu BG {isBackgroundEnabled ? 'ON' : 'OFF'}
          </Button>
          <Link to="/ai-menu-theme-history">
            <Button variant="outline" className="gap-2">
              <Grid3x3 className="h-4 w-4" />
              View Theme History
            </Button>
          </Link>
          <Badge variant="outline" className={statusTone}>{status?.status || 'Idle'}</Badge>
          <Button variant="outline" onClick={fetchStatus} disabled={isBusy} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {!creditLoading && creditBalance < CREDITS_REQUIRED && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 px-4 py-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">
              <strong>Low AI credits.</strong> You need at least {CREDITS_REQUIRED} credits to generate a theme background.
            </p>
          </div>
          <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white shrink-0" onClick={() => setShowRechargeModal(true)}>
            Recharge Now
          </Button>
        </div>
      )}

      {!isBackgroundEnabled && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-muted-foreground shrink-0" />
            <p className="text-sm text-muted-foreground">
              <strong>Menu background is OFF.</strong> Dinematters will not apply the generated theme background</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
        <Card className="shadow-xs border-muted/60">
          <CardHeader>
            <CardTitle>1. Upload Menu References</CardTitle>
            <CardDescription>Upload 1 to 3 JPG or PNG images of your menu pages.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-6">
              <div className="flex flex-col items-center justify-center text-center gap-3">
                <div className="rounded-full bg-background p-3 shadow-sm border">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Upload menu design samples</p>
                </div>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  multiple
                  className="max-w-md"
                  onChange={handleFileChange}
                />
              </div>
            </div>

            {files.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Selected Menu Images</Label>
                  <span className="text-xs text-muted-foreground">{files.length}/{MAX_IMAGES}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {previews.map((url, index) => (
                    <div key={url} className="relative rounded-xl overflow-hidden border bg-muted/10 aspect-[3/4]">
                      <img src={url} alt={`Menu reference ${index + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute bottom-2 left-2 right-2 rounded-md bg-black/55 text-white text-[10px] px-2 py-1 backdrop-blur-sm truncate">
                        {files[index]?.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Uploading reference images</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} />
              </div>
            )}

            {(isStartingGeneration || isProcessing || status?.status === 'Completed' || status?.status === 'Failed') && (
              <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {(isStartingGeneration || isProcessing) ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : status?.status === 'Completed' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    )}
                    <span>
                      {isStartingGeneration
                        ? 'Starting preview generation...'
                        : status?.status === 'Pending'
                          ? 'Preview request queued...'
                          : status?.status === 'Processing'
                            ? 'Generating preview in realtime...'
                            : status?.status === 'Completed'
                              ? 'Preview generation completed'
                              : 'Preview generation failed'}
                    </span>
                  </div>
                  <Badge variant="outline" className={statusTone}>{status?.status || 'Idle'}</Badge>
                </div>
                <Progress value={processingProgress} />
                <p className="text-sm text-muted-foreground">
                  {status?.status === 'Completed'
                    ? 'Your latest generated preview is ready in the preview panel.'
                    : status?.status === 'Failed'
                      ? (status.error_message || 'Please retry with a clearer menu image or recharge credits if required.')
                      : 'We will keep this page updated automatically until the preview finishes.'}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleGenerate} disabled={isBusy || !isBackgroundEnabled || files.length < MIN_IMAGES} className="gap-2">
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate Preview
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-xs border-muted/60">
            <CardHeader>
              <CardTitle>2. Preview & Activate</CardTitle>
              <CardDescription>Review the latest generated background and apply it to the customer menu.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="mx-auto w-full max-w-[280px] rounded-xl overflow-hidden border bg-muted/10 aspect-[9/16] relative">
                {previewOutput || activeImage ? (
                  <>
                    <img src={previewOutput || activeImage} alt="Generated menu theme background" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/20" />
                    <div className="absolute top-4 left-4 right-4 rounded-2xl border border-white/40 bg-white/65 backdrop-blur-md p-4 shadow-lg">
                      <div className="h-5 w-24 rounded-full bg-white/80 mb-3" />
                      <div className="space-y-2">
                        <div className="h-16 rounded-2xl bg-white/85" />
                        <div className="h-16 rounded-2xl bg-white/80" />
                        <div className="h-16 rounded-2xl bg-white/75" />
                      </div>
                    </div>
                  </>
                ) : isStartingGeneration || isProcessing ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 gap-4 bg-muted/20">
                    <div className="rounded-full bg-background p-3 border shadow-sm">
                      <Loader2 className="h-6 w-6 text-primary animate-spin" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">Generating live preview</p>
                      <p className="text-sm text-muted-foreground">
                        {status?.status === 'Pending' ? 'Queued for AI processing...' : 'Creating your decorative menu background...'}
                      </p>
                    </div>
                    <div className="w-full max-w-xs space-y-2">
                      <Progress value={processingProgress} />
                      <p className="text-xs text-muted-foreground">This panel will update automatically when the preview is ready.</p>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground gap-3">
                    <div className="rounded-full bg-background p-3 border shadow-sm">
                      <ImageIcon className="h-6 w-6 text-primary/70" />
                    </div>
                    <p>No generated background yet</p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button variant="outline" disabled={!previewOutput && !activeImage} onClick={() => { setPreviewImage(previewOutput || activeImage); setShowPreviewModal(true) }} className="gap-2">
                  <Eye className="h-4 w-4" />
                  Preview Fullscreen
                </Button>
                <Button variant="outline" disabled={!(previewOutput || activeImage)} onClick={() => handleDownload(previewOutput || activeImage, 'menu-theme-background.png')} className="gap-2">
                  <Download className="h-4 w-4" />
                  Download
                </Button>
                <Button disabled={!isBackgroundEnabled || !previewOutput || isActivating} onClick={() => handleActivate(previewOutput)} className="gap-2">
                  {isActivating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Set as Active
                </Button>
              </div>

              {status?.error_message && status.status === 'Failed' && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {status.error_message}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AiRechargeModal
        open={showRechargeModal}
        onClose={() => setShowRechargeModal(false)}
        restaurant={selectedRestaurant}
        currentBalance={creditBalance}
        onSuccess={fetchCredits}
      />

      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-4xl p-0 border-none bg-transparent shadow-none overflow-visible">
          <DialogHeader className="sr-only">
            <DialogTitle>Generated menu theme background preview</DialogTitle>
            <DialogDescription>Preview the generated restaurant menu theme background image.</DialogDescription>
          </DialogHeader>
          <div className="relative group overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/20">
            {previewImage && (
              <img src={previewImage} alt="Generated menu theme background" className="w-full h-auto max-h-[85vh] object-contain rounded-xl" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
