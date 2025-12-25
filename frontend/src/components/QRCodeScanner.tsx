import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { QrCode, Camera, X } from 'lucide-react'
import { toast } from 'sonner'
import { useFrappePostCall } from '@/lib/frappe'

interface QRCodeScannerProps {
  onScan: (tableNumber: number, restaurantId: string) => void
  restaurantId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function QRCodeScanner({ onScan, restaurantId, open, onOpenChange }: QRCodeScannerProps) {
  const [qrData, setQrData] = useState('')
  const [manualInput, setManualInput] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const { call: parseQrCode } = useFrappePostCall('dinematters.dinematters.api.cart.parse_qr_code')

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const handleParseQrCode = async (qrDataValue: string) => {
    if (!qrDataValue) {
      toast.error('Please enter or scan a QR code')
      return
    }

    try {
      const response: any = await parseQrCode({ qr_data: qrDataValue })
      
      if (response?.message?.success && response?.message?.data) {
        const { restaurantId: parsedRestaurantId, tableNumber } = response.message.data
        
        // Validate restaurant ID matches
        if (parsedRestaurantId !== restaurantId) {
          toast.error(`QR code is for a different restaurant (${parsedRestaurantId})`)
          return
        }

        onScan(tableNumber, parsedRestaurantId)
        onOpenChange(false)
        setQrData('')
        setManualInput('')
        toast.success(`Table ${tableNumber} scanned successfully`)
      } else {
        toast.error(response?.message?.error?.message || 'Invalid QR code')
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to parse QR code')
    }
  }

  const handleManualSubmit = () => {
    // Try to parse as QR code format first
    if (manualInput.includes('/')) {
      handleParseQrCode(manualInput)
    } else {
      // If just a number, construct the QR code format
      const qrDataValue = `${restaurantId}/${manualInput}`
      handleParseQrCode(qrDataValue)
    }
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Use back camera on mobile
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setIsScanning(true)
      }
    } catch (error: any) {
      toast.error('Failed to access camera: ' + (error.message || 'Permission denied'))
      setIsScanning(false)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsScanning(false)
  }

  const handleClose = () => {
    stopCamera()
    onOpenChange(false)
    setQrData('')
    setManualInput('')
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Scan Table QR Code
          </DialogTitle>
          <DialogDescription>
            Scan the QR code on your table or enter the table number manually
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Manual Input */}
          <div className="space-y-2">
            <Label htmlFor="table-input">Enter Table Number or QR Code</Label>
            <div className="flex gap-2">
              <Input
                id="table-input"
                placeholder="e.g., 5 or restaurant-id/5"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleManualSubmit()
                  }
                }}
              />
              <Button onClick={handleManualSubmit} disabled={!manualInput}>
                Submit
              </Button>
            </div>
          </div>

          {/* Camera Scanner (Optional - can be enhanced with actual QR scanning library) */}
          <div className="space-y-2">
            <Label>Camera Scanner</Label>
            <div className="relative bg-black rounded-md overflow-hidden aspect-video">
              {isScanning ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="border-2 border-white rounded-md w-64 h-64" />
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={stopCamera}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Button onClick={startCamera} variant="outline">
                    <Camera className="mr-2 h-4 w-4" />
                    Start Camera
                  </Button>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Note: For full QR code scanning, use your device's camera app to scan the QR code and paste the result above.
            </p>
          </div>

          {/* QR Code Data Input */}
          <div className="space-y-2">
            <Label htmlFor="qr-data">Or Paste QR Code Data</Label>
            <div className="flex gap-2">
              <Input
                id="qr-data"
                placeholder="restaurant-id/table-number"
                value={qrData}
                onChange={(e) => setQrData(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleParseQrCode(qrData)
                  }
                }}
              />
              <Button onClick={() => handleParseQrCode(qrData)} disabled={!qrData}>
                Parse
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

