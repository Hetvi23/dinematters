import { useState, useEffect } from 'react'
import { useFrappeGetDoc, useFrappePostCall, useFrappeUpdateDoc } from '@/lib/frappe'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { 
  QrCode, 
  Download, 
  Eye, 
  Settings, 
  Loader2,
  AlertCircle,
  Info,
  Trash2
} from 'lucide-react'
import QRCodeScanner from '@/components/QRCodeScanner'

export default function QRCodes() {
  const { selectedRestaurant } = useRestaurant()
  const [baseUrl, setBaseUrl] = useState('')
  const [tables, setTables] = useState(0)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Fetch restaurant document
  const { data: restaurantDoc, mutate: refreshRestaurant } = useFrappeGetDoc('Restaurant', selectedRestaurant || '', {
    enabled: !!selectedRestaurant
  })

  // API calls
  const { call: generateQrCodes } = useFrappePostCall('dinematters.dinematters.doctype.restaurant.restaurant.generate_qr_codes_pdf')
  const { call: getQrCodeUrl } = useFrappePostCall('dinematters.dinematters.doctype.restaurant.restaurant.get_qr_codes_pdf_url')
  const { call: deleteQrCodes } = useFrappePostCall('dinematters.dinematters.doctype.restaurant.restaurant.delete_qr_codes_pdf')
  const { updateDoc: updateRestaurant } = useFrappeUpdateDoc()

  // Load restaurant data
  useEffect(() => {
    if (restaurantDoc) {
      setBaseUrl(restaurantDoc.base_url || 'https://demo.dinematters.com/')
      setTables(restaurantDoc.tables || 0)
      
      // Load QR code URL if available
      if (restaurantDoc.qr_codes_pdf_url) {
        setQrCodeUrl(restaurantDoc.qr_codes_pdf_url)
      } else if (restaurantDoc.tables && restaurantDoc.tables > 0) {
        // Try to fetch QR code URL
        loadQrCodeUrl()
      }
    }
  }, [restaurantDoc])

  const loadQrCodeUrl = async () => {
    if (!selectedRestaurant) return
    
    try {
      const response: any = await getQrCodeUrl({ restaurant: selectedRestaurant })
      if (response?.message) {
        // Handle both old format (direct URL) and new format (JSON object)
        let url = null
        if (typeof response.message === 'string') {
          // Old format - direct URL
          url = response.message
        } else if (response.message.pdf_url) {
          // New format - JSON object with pdf_url
          url = response.message.pdf_url
        }
        setQrCodeUrl(url)
      } else {
        setQrCodeUrl(null)
      }
    } catch (error) {
      setQrCodeUrl(null)
    }
  }

  // Generate QR codes PDF
  const handleGenerateQrCodes = async () => {
    if (!selectedRestaurant) {
      toast.error('Please select a restaurant first')
      return
    }

    if (!tables || tables <= 0) {
      toast.error('Number of tables must be greater than 0')
      return
    }

    setIsGenerating(true)
    try {
      const response: any = await generateQrCodes({ restaurant: selectedRestaurant })
      if (response?.message) {
        // Handle both old format (direct URL) and new format (JSON object)
        let url = null
        if (typeof response.message === 'string') {
          // Old format - direct URL
          url = response.message
        } else if (response.message.pdf_url) {
          // New format - JSON object with pdf_url
          url = response.message.pdf_url
        }
        
        if (url) {
          // Add cache-busting parameter to the URL
          const finalUrl = url.includes('?') 
            ? `${url}&_t=${Date.now()}` 
            : `${url}?_t=${Date.now()}`
          setQrCodeUrl(finalUrl)
          toast.success('QR codes PDF generated successfully!')
          // Refresh restaurant data to get updated URL
          await refreshRestaurant()
        }
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to generate QR codes')
    } finally {
      setIsGenerating(false)
    }
  }


  // Update tables count (without generating QR codes)
  const handleUpdateTables = async () => {
    if (!selectedRestaurant) {
      toast.error('Please select a restaurant first')
      return
    }

    if (!tables || tables <= 0) {
      toast.error('Number of tables must be greater than 0')
      return
    }

    setIsUpdating(true)
    try {
      await updateRestaurant('Restaurant', selectedRestaurant, {
        tables: tables
      })
      toast.success('Tables count updated successfully')
      await refreshRestaurant()
      // Clear QR code URL since tables changed
      setQrCodeUrl(null)
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update tables count')
    } finally {
      setIsUpdating(false)
    }
  }

  // Quick increment functions
  const handleIncrementTables = (increment: number) => {
    const newValue = (tables || 0) + increment
    setTables(Math.max(1, newValue))
  }

  // View QR codes PDF
  const handleViewQrCodes = () => {
    if (qrCodeUrl) {
      // Add cache-busting parameter to force fresh load
      const url = qrCodeUrl.includes('?') 
        ? `${qrCodeUrl}&_t=${Date.now()}` 
        : `${qrCodeUrl}?_t=${Date.now()}`
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  // Download QR codes PDF
  const handleDownloadQrCodes = () => {
    if (qrCodeUrl) {
      const link = document.createElement('a')
      link.href = qrCodeUrl
      link.download = `${restaurantDoc?.restaurant_id || 'restaurant'}_table_qr_codes.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success('QR codes PDF download started')
    }
  }

  // Delete QR codes PDF - show confirmation dialog
  const handleDeleteQrCodes = () => {
    setShowDeleteDialog(true)
  }

  // Confirm and execute deletion
  const confirmDeleteQrCodes = async () => {
    if (!selectedRestaurant || !qrCodeUrl) return

    setShowDeleteDialog(false)
    setIsDeleting(true)
    try {
      const response: any = await deleteQrCodes({ restaurant: selectedRestaurant })
      
      // Check if deletion was successful
      let deleted = false
      if (response?.message) {
        if (typeof response.message === 'boolean') {
          deleted = response.message
        } else if (response.message.status === 'success') {
          deleted = true
        }
      }
      
      if (deleted) {
        setQrCodeUrl(null)
        await refreshRestaurant()
        toast.success('QR codes PDF deleted successfully')
      } else {
        toast.error('Failed to delete QR codes PDF')
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete QR codes PDF')
    } finally {
      setIsDeleting(false)
    }
  }


  if (!selectedRestaurant) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">No Restaurant Selected</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Please select a restaurant from the sidebar to manage QR codes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Manage QR Codes</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Generate and manage QR codes for your restaurant tables
          </p>
        </div>
        {qrCodeUrl && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleViewQrCodes}>
              <Eye className="h-4 w-4 mr-2" />
              View PDF
            </Button>
            <Button variant="outline" onClick={handleDownloadQrCodes}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button 
              variant="outline" 
              onClick={handleDeleteQrCodes}
              disabled={isDeleting}
              className="text-destructive hover:text-destructive"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete PDF
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Settings Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            QR Code Settings
          </CardTitle>
          <CardDescription>
            Configure number of tables for QR code generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Base URL */}
          <div className="space-y-2">
            <Label htmlFor="base-url">Base URL</Label>
            <Input
              id="base-url"
              value={baseUrl}
              readOnly
              disabled
              placeholder="https://demo.dinematters.com/"
              className="bg-muted cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground">
              Base URL for QR codes (read-only). QR codes will be generated as: <code className="px-1 py-0.5 bg-muted rounded">{baseUrl.replace(/\/$/, '')}/restaurant-id/table-number</code>
            </p>
          </div>

          {/* Tables Count */}
          <div className="space-y-2">
            <Label htmlFor="tables">Number of Tables</Label>
            <div className="flex gap-2">
              <Input
                id="tables"
                type="number"
                min="1"
                value={tables}
                onChange={(e) => setTables(parseInt(e.target.value) || 0)}
                placeholder="Enter number of tables"
                disabled={isUpdating}
                className="flex-1"
              />
              <Button 
                onClick={handleUpdateTables} 
                disabled={isUpdating || tables === (restaurantDoc?.tables || 0) || tables <= 0}
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Tables'
                )}
              </Button>
            </div>
            {/* Quick increment buttons */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleIncrementTables(5)}
                disabled={isUpdating}
                className="flex-1"
              >
                +5
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleIncrementTables(10)}
                disabled={isUpdating}
                className="flex-1"
              >
                +10
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleIncrementTables(15)}
                disabled={isUpdating}
                className="flex-1"
              >
                +15
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Number of tables in your restaurant. Click "Update Tables" to save the count, then "Generate QR Codes PDF" to create the QR codes.
            </p>
          </div>

          {/* Generate QR Codes Button */}
          {tables > 0 && (
            <div className="pt-4 border-t">
              <div className="space-y-2">
                <Button 
                  onClick={handleGenerateQrCodes} 
                  disabled={isGenerating || !tables || tables !== (restaurantDoc?.tables || 0)}
                  className="w-full sm:w-auto"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <QrCode className="h-4 w-4 mr-2" />
                      Generate QR Codes PDF
                    </>
                  )}
                </Button>
                {tables !== (restaurantDoc?.tables || 0) && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Please update the tables count first before generating QR codes.
                  </p>
                )}
                {qrCodeUrl && tables === (restaurantDoc?.tables || 0) && (
                  <p className="text-xs text-muted-foreground">
                    QR codes PDF is available. Click "View PDF" or "Download PDF" above to access it.
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-semibold">How QR Codes Work</h3>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Each QR code contains a unique URL that links to your restaurant's menu for that specific table</li>
                <li>Customers scan the QR code with their phone camera to access the menu</li>
                <li>The table number is automatically detected when customers place orders</li>
                <li>QR codes are generated as a PDF that you can print and place on each table</li>
                <li>You can update the base URL if your domain changes</li>
                <li>Updating the number of tables will automatically regenerate all QR codes</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* QR Code Scanner Dialog */}
      <QRCodeScanner
        restaurantId={restaurantDoc?.restaurant_id || ''}
        open={showScanner}
        onOpenChange={setShowScanner}
        onScan={(tableNumber) => {
          toast.success(`Table ${tableNumber} scanned successfully!`)
          setShowScanner(false)
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete QR Codes PDF?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the QR codes PDF? You will need to regenerate it if you want to use it again.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteQrCodes}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete PDF
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}

