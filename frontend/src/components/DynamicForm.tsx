import { useState, useEffect, useRef } from 'react'
import { useDocTypeMeta, DocTypeField } from '@/lib/doctype'
import { usePermissions } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ColorPaletteSelector } from '@/components/ui/color-palette-selector'
import { CityStateSelector } from '@/components/ui/CityStateSelector'
import { DatePicker } from '@/components/ui/date-picker'
import { useFrappeGetDoc, useFrappePostCall, useFrappeGetDocList } from '@/lib/frappe'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { toast } from 'sonner'
import { Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import MenuImagesTable from './MenuImagesTable'
import ExtractedDishesTable from './ExtractedDishesTable'
import ProductMediaTable from './ProductMediaTable'
import CustomizationQuestionsTable from './CustomizationQuestionsTable'
import { uploadToR2 } from '@/lib/r2Upload'

interface DynamicFormProps {
  doctype: string
  docname?: string
  onSave?: (data: any) => void
  onCancel?: () => void
  mode?: 'create' | 'edit' | 'view'
  initialData?: Record<string, any>
  onFieldChange?: (fieldname: string, value: any) => void
  onChange?: (hasChanges: boolean) => void // Notify parent when form has changes
  hideFields?: string[] // Fields to hide from the form
  readOnlyFields?: string[] // Fields to make read-only
  showSaveButton?: boolean // Control whether to show save button
  triggerSave?: number // Increment this to trigger save
  skipLoadingState?: boolean // Skip showing loading spinner (useful when parent handles loading via page reload)
}

// Character limits for specific doctype fields to ensure UI consistency
const CHARACTER_LIMITS: Record<string, Record<string, number>> = {
  'Restaurant Config': {
    'tagline': 70,
    'subtitle': 100,
  }
}

export default function DynamicForm({
  doctype,
  docname,
  onSave,
  onCancel,
  mode = 'create',
  initialData = {},
  onFieldChange,
  onChange,
  hideFields = [],
  readOnlyFields = [],
  triggerSave,
  skipLoadingState = false
}: DynamicFormProps) {

  const { meta, isLoading: metaLoading, error: metaError } = useDocTypeMeta(doctype)
  const { permissions, isLoading: permLoading } = usePermissions(doctype)

  const hookEnabled = !!docname && mode !== 'create'
  const { data: docData, isLoading: docLoading, error: docError, mutate: refreshDoc } = useFrappeGetDoc(doctype, docname || '', {
    enabled: hookEnabled,
    fields: ['*'] // Request all fields to ensure we get tagline, subtitle, etc.
  })

  useEffect(() => {
    if (hookEnabled && refreshDoc) {
      void (refreshDoc as any)()
    }
  }, [hookEnabled, refreshDoc])

  // Debug: Log hook state immediately
  console.log(`[DynamicForm] ${doctype} - Hook state (immediate):`, {
    doctype,
    docname,
    mode,
    hookEnabled,
    docLoading,
    hasDocData: !!docData,
    docError,
    docDataKeys: docData ? Object.keys(docData) : [],
    docDataSample: docData ? {
      restaurant: docData.restaurant,
      tagline: docData.tagline,
      subtitle: docData.subtitle,
      default_theme: docData.default_theme,
      primary_color: docData.primary_color
    } : null,
    fullDocData: docData
  })

  // Debug: Log hook state in effect
  useEffect(() => {
    console.log(`[DynamicForm] ${doctype} - Hook state (effect):`, {
      doctype,
      docname,
      mode,
      hookEnabled,
      docLoading,
      hasDocData: !!docData,
      docError,
      docDataKeys: docData ? Object.keys(docData) : [],
      docData: docData
    })
  }, [doctype, docname, mode, hookEnabled, docLoading, docData, docError])

  // Debug logging
  useEffect(() => {
    if (doctype) {
      console.log(`[DynamicForm] ${doctype}:`, {
        metaLoading,
        metaError,
        hasMeta: !!meta,
        fieldsCount: meta?.fields?.length || 0,
        visibleFieldsCount: meta?.fields?.filter(f => !f.hidden).length || 0,
        meta
      })
    }
  }, [doctype, meta, metaLoading, metaError])

  const [formData, setFormData] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(0)

  const { call: insertDoc } = useFrappePostCall('dinematters.dinematters.api.documents.create_document')
  const { call: updateDoc } = useFrappePostCall('dinematters.dinematters.api.documents.update_document')

  // Track if formData has been initialized to prevent overwriting user changes
  const [formDataInitialized, setFormDataInitialized] = useState(false)
  const initialDataRef = useRef(initialData || {})
  const hasUserDataRef = useRef(false)
  const originalDataRef = useRef<Record<string, any>>({}) // Track original data for change detection

  // Update ref when initialData changes
  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      initialDataRef.current = { ...initialData }
    } else {
      initialDataRef.current = {}
    }
  }, [JSON.stringify(initialData)])

  // Track the last hydrated doc to prevent redundant hydration
  const lastHydratedKeyRef = useRef<string | null>(null)
  const currentDocKey = `${doctype}-${docname}`

  useEffect(() => {
    // Never overwrite user edits
    if (hasUserDataRef.current) {
      return
    }

    // When docData becomes available and we haven't hydrated it yet for this specific doc/doctype pair
    if (docData && mode !== 'create' && (lastHydratedKeyRef.current !== currentDocKey || !formDataInitialized)) {
      console.log(`[DynamicForm] ${doctype} - Hydrating docData:`, docname)

      // Load existing document data from backend - this is the source of truth for most fields
      const cleanDocData = { ...docData }
      // Remove metadata fields that shouldn't be compared
      delete cleanDocData.name
      delete cleanDocData.creation
      delete cleanDocData.modified
      delete cleanDocData.modified_by
      delete cleanDocData.owner

      const mergedData = { ...cleanDocData }

      // If meta is available, ensure all fields are initialized (even if NULL in backend)
      if (meta && meta.fields) {
        meta.fields.forEach(field => {
          if (!field.hidden && !(field.fieldname in mergedData)) {
            if (field.default !== undefined && field.default !== null) {
              mergedData[field.fieldname] = field.default
            }
          }
        })
      }

      // Override read-only fields with initialData values
      readOnlyFields.forEach(fieldname => {
        if (initialData[fieldname] !== undefined && initialData[fieldname] !== null && initialData[fieldname] !== '') {
          mergedData[fieldname] = initialData[fieldname]
        } else if (initialDataRef.current[fieldname] !== undefined && initialDataRef.current[fieldname] !== null && initialDataRef.current[fieldname] !== '') {
          mergedData[fieldname] = initialDataRef.current[fieldname]
        }
      })

      // Special handling for restaurant field
      const restaurantFromInitial = initialData.restaurant || initialDataRef.current.restaurant
      if (restaurantFromInitial && typeof restaurantFromInitial === 'string' && !/^[A-Z]{3}$/.test(restaurantFromInitial)) {
        mergedData.restaurant = restaurantFromInitial
      }

      setFormData(mergedData)
      originalDataRef.current = { ...mergedData } 
      setFormDataInitialized(true)
      lastHydratedKeyRef.current = currentDocKey
      hasUserDataRef.current = false 
    } else if (meta && !formDataInitialized && mode === 'create') {
      // Initialize for create mode
      const defaults: Record<string, any> = { ...initialDataRef.current }
      meta.fields.forEach(field => {
        if (field.default !== undefined && field.default !== null && !(field.fieldname in defaults)) {
          defaults[field.fieldname] = field.default
        }
      })
      setFormData(defaults)
      originalDataRef.current = { ...defaults } 
      setFormDataInitialized(true)
      hasUserDataRef.current = false 
    }
  }, [docData, meta, mode, formDataInitialized, docname, initialData])

  // Reset when docname or mode changes
  useEffect(() => {
    setFormDataInitialized(false)
    lastHydratedKeyRef.current = null
    hasUserDataRef.current = false
    setFormData({})
    originalDataRef.current = {}
  }, [docname, mode])

  // Update initialDataRef when initialData changes (separate effect to avoid resetting form)
  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      initialDataRef.current = { ...initialData }
      // If form is not initialized yet, trigger re-initialization with new initialData
      if (!formDataInitialized && mode === 'create') {
        setFormDataInitialized(false) // Force re-initialization
      }
      // Update formData with initialData values for read-only fields in both create and edit mode
      // This ensures restaurant field from context always takes precedence
      if (formDataInitialized && readOnlyFields.length > 0) {
        setFormData(prev => {
          const updated = { ...prev }
          let hasChanges = false
          readOnlyFields.forEach(fieldname => {
            const value = initialData[fieldname]
            if (value !== undefined && value !== null && value !== '') {
              // Special handling for restaurant field to avoid currency codes
              if (fieldname === 'restaurant' && typeof value === 'string' && /^[A-Z]{3}$/.test(value)) {
                // Skip currency codes like USD, INR, etc.
                return
              }
              // Always update read-only fields from initialData (like restaurant from context)
              updated[fieldname] = value
              hasChanges = true
            }
          })
          if (hasChanges) {
            // Also update originalDataRef to keep change detection accurate
            originalDataRef.current = { ...originalDataRef.current, ...updated }
          }
          return hasChanges ? updated : prev
        })
      }
      // Also update formData for any initialData keys that are missing or empty in formData (create mode only)
      if (formDataInitialized && mode === 'create') {
        setFormData(prev => {
          const updated = { ...prev }
          let hasChanges = false
          Object.keys(initialData).forEach(key => {
            // Skip read-only fields - they're handled above
            if (readOnlyFields.includes(key)) return
            // Update if field is missing, undefined, null, or empty string in formData
            if (!(key in prev) || prev[key] === undefined || prev[key] === null || prev[key] === '') {
              if (initialData[key] !== undefined && initialData[key] !== null && initialData[key] !== '') {
                updated[key] = initialData[key]
                hasChanges = true
              }
            }
          })
          if (hasChanges) {
            // Also update originalDataRef to keep change detection accurate
            originalDataRef.current = { ...originalDataRef.current, ...updated }
          }
          return hasChanges ? updated : prev
        })
      }
    } else {
      initialDataRef.current = {}
    }
  }, [JSON.stringify(initialData), formDataInitialized, mode, readOnlyFields])

  // Trigger save when parent requests it
  useEffect(() => {
    if (triggerSave && triggerSave > 0 && canSave) {
      handleSave()
    }
  }, [triggerSave])

  // Check for changes and notify parent
  useEffect(() => {
    if (!onChange) return

    if (!formDataInitialized) {
      // If not initialized yet, notify that there are no changes
      onChange(false)
      return
    }

    const hasChanges = (() => {
      const original = originalDataRef.current
      const current = formData

      // If both are empty, no changes
      if (Object.keys(original).length === 0 && Object.keys(current).length === 0) {
        return false
      }

      // If original is empty and current has data, check if it's meaningful data
      if (Object.keys(original).length === 0) {
        // For new forms, only consider it changed if user has actually entered data
        // Check if any field has a non-empty value
        const hasData = Object.values(current).some(val => {
          if (val === null || val === undefined || val === '') return false
          if (Array.isArray(val)) return val.length > 0
          if (typeof val === 'object') return Object.keys(val).length > 0
          return true
        })
        return hasData && hasUserDataRef.current
      }

      // Compare all keys
      const allKeys = new Set([...Object.keys(original), ...Object.keys(current)])

      for (const key of allKeys) {
        const origValue = original[key]
        const currValue = current[key]

        // Skip comparison for undefined/null/empty differences that don't matter
        if ((origValue === undefined || origValue === null || origValue === '') &&
          (currValue === undefined || currValue === null || currValue === '')) {
          continue
        }

        // Deep comparison for arrays and objects
        if (Array.isArray(origValue) && Array.isArray(currValue)) {
          if (JSON.stringify(origValue) !== JSON.stringify(currValue)) {
            return true
          }
        } else if (typeof origValue === 'object' && typeof currValue === 'object' && origValue !== null && currValue !== null) {
          if (JSON.stringify(origValue) !== JSON.stringify(currValue)) {
            return true
          }
        } else if (origValue !== currValue) {
          return true
        }
      }

      return false
    })()

    onChange(hasChanges)
  }, [formData, formDataInitialized, onChange])

  const isLoading = metaLoading || permLoading || (docLoading && mode !== 'create')

  // Determine actual mode based on permissions
  const actualMode = mode === 'create'
    ? (permissions.create ? 'create' : 'view')
    : mode === 'edit'
      ? (permissions.write ? 'edit' : 'view')
      : 'view'

  const canSave = (actualMode === 'create' && permissions.create) ||
    (actualMode === 'edit' && permissions.write)

  const handleFieldChange = (fieldname: string, value: any) => {
    hasUserDataRef.current = true // Mark that user has entered data
    setFormData(prev => {
      // For Table fields (like menu_images), ensure we preserve the array structure
      if (Array.isArray(value)) {
        return { ...prev, [fieldname]: [...value] }
      }
      return { ...prev, [fieldname]: value }
    })
    // Notify parent component of field changes
    onFieldChange?.(fieldname, value)
  }

  const validateForm = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = []

    if (!meta) {
      return { isValid: false, errors: ['Form metadata not loaded'] }
    }

    // Check required fields
    meta.fields.forEach(field => {
      if (field.required && !field.hidden) {
        const value = formData[field.fieldname]

        // Special handling for Table fields
        if (field.fieldtype === 'Table') {
          if (!value || !Array.isArray(value) || value.length === 0) {
            errors.push(`${field.label} is required`)
          }
        } else if (value === undefined || value === null || value === '' ||
          (Array.isArray(value) && value.length === 0)) {
          errors.push(`${field.label} is required`)
        }
      }
    })

    return { isValid: errors.length === 0, errors }
  }

  const handleSave = async () => {
    if (!canSave) return

    // Validate form before saving
    const validation = validateForm()
    if (!validation.isValid) {
      toast.error('Please fill in all required fields', {
        description: validation.errors.join(', '),
        duration: 5000,
      })
      return
    }

    setSaving(true)
    setProgress(0)

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90))
      }, 100)

      let result
      if (actualMode === 'create') {
        // frappe.client.insert expects doc parameter
        const docData: Record<string, any> = { doctype }

        // Add all form fields, but skip empty strings for optional fields
        Object.keys(formData).forEach(key => {
          const value = formData[key]
          // Only skip if it's empty string and field is not required
          const field = meta?.fields.find(f => f.fieldname === key)
          if (value !== undefined && value !== null) {
            if (value !== '' || field?.required) {
              docData[key] = value
            }
          }
        })

        result = await insertDoc({
          doctype,
          doc_data: docData
        })
      } else {
        // For update, use set_value for each changed field
        const updates: Record<string, any> = {}
        Object.keys(formData).forEach(key => {
          const newValue = formData[key]
          const oldValue = docData?.[key]
          // Only update if value changed
          if (newValue !== oldValue && newValue !== undefined && newValue !== null) {
            updates[key] = newValue
          }
        })

        if (Object.keys(updates).length > 0) {
          result = await updateDoc({
            doctype,
            name: docname,
            doc_data: updates
          })
        } else {
          result = { success: true, message: docData }
        }
      }

      clearInterval(progressInterval)
      setProgress(100)

      // Check if operation was successful
      if (result?.success === false) {
        const errorMsg = result?.error?.message || result?.error || 'Operation failed'
        console.error('Invalid data returned from save:', result)
        throw new Error(errorMsg)
      }

      // Extract the created/updated document from response
      // The API returns { success: true, message: doc.as_dict(), name: doc.name }
      const savedDoc = result?.message || result

      // Ensure we have a valid document
      if (!savedDoc || (typeof savedDoc === 'object' && Object.keys(savedDoc).length === 0)) {
        throw new Error('No data returned from save operation')
      }

      toast.success(`${doctype} ${actualMode === 'create' ? 'created' : 'updated'} successfully`)

      if (onSave) {
        onSave(savedDoc)
      }

      setTimeout(() => {
        setProgress(0)
        setSaving(false)
      }, 500)
    } catch (error: any) {
      setSaving(false)
      setProgress(0)

      // Extract error message from response
      let errorMessage = `Failed to ${actualMode === 'create' ? 'create' : 'update'} ${doctype}`

      if (error?.message) {
        errorMessage = error.message
      } else if (error?.error?.message) {
        errorMessage = error.error.message
      } else if (error?.exc_type) {
        errorMessage = `${error.exc_type}: ${error.exc || error.message || 'Unknown error'}`
      } else if (typeof error === 'string') {
        errorMessage = error
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message
      }

      toast.error(errorMessage, {
        duration: 5000,
      })
      console.error('Form save error:', error)
    }
  }

  // Helper function to enhance description with example values
  const getEnhancedDescription = (field: DocTypeField, doctype: string): string => {
    if (!field.description) return ''

    const fieldname = field.fieldname.toLowerCase()
    const fieldLabel = field.label.toLowerCase()

    // Restaurant doctype specific examples
    if (doctype === 'Restaurant') {
      const examples: Record<string, string> = {
        'restaurant_name': ' (e.g., Pizza Palace)',
        'subdomain': ' (e.g., pizza-palace-nyc)',
        'slug': ' (e.g., pizza-palace)',
        'owner_email': ' (e.g., owner@restaurant.com)',
        'owner_phone': ' (e.g., +1 (555) 123-4567)',
        'owner_name': ' (e.g., John Smith)',
        'address': ' (e.g., 123 Main Street)',
        'city': ' (e.g., New York)',
        'state': ' (e.g., New York)',
        'zip_code': ' (e.g., 10001)',
        'tax_rate': ' (e.g., 18 for 18%)',
        'default_delivery_fee': ' (e.g., 5.00)',
        'timezone': ' (e.g., America/New_York)',
        'tables': ' (e.g., 20)',
        'description': ' (e.g., A cozy Italian restaurant serving authentic pizza...)'
      }
      return field.description + (examples[fieldname] || '')
    }

    // Restaurant Config doctype specific examples
    if (doctype === 'Restaurant Config') {
      const examples: Record<string, string> = {
        'restaurant_name': ' (e.g., Pizza Palace)',
        'tagline': ' (e.g., Authentic Italian Cuisine)',
        'subtitle': ' (e.g., Since 1995)',
        'description': ' (e.g., Experience the finest Italian dining...)',
        'primary_color': ' (e.g., #ea580c)',
        'hero_video': ' (e.g., https://example.com/video.mp4)'
      }
      return field.description + (examples[fieldname] || '')
    }

    // Generic examples based on field type and name
    if (fieldname.includes('email') || fieldLabel.includes('email')) {
      return field.description + ' (e.g., owner@restaurant.com)'
    }
    if (fieldname.includes('phone') || fieldLabel.includes('phone')) {
      return field.description + ' (e.g., +1 (555) 123-4567)'
    }
    if (fieldname.includes('name') && !fieldname.includes('restaurant')) {
      return field.description + ' (e.g., John Smith)'
    }
    if (fieldname.includes('address') || fieldLabel.includes('address')) {
      return field.description + ' (e.g., 123 Main Street)'
    }
    if (fieldname.includes('city') || fieldLabel.includes('city')) {
      return field.description + ' (e.g., New York)'
    }
    if (fieldname.includes('state') || fieldLabel.includes('state')) {
      return field.description + ' (e.g., California)'
    }
    if (fieldname.includes('zip') || fieldname.includes('postal')) {
      return field.description + ' (e.g., 10001)'
    }
    if (fieldname.includes('rate') || fieldname.includes('percent')) {
      return field.description + ' (e.g., 18)'
    }
    if (fieldname.includes('fee') || fieldname.includes('price') || fieldname.includes('cost')) {
      return field.description + ' (e.g., 10.00)'
    }
    if (fieldname.includes('url') || fieldname.includes('link')) {
      return field.description + ' (e.g., https://example.com)'
    }
    if (fieldname.includes('timezone')) {
      return field.description + ' (e.g., America/New_York)'
    }
    if (fieldname.includes('table')) {
      return field.description + ' (e.g., 20)'
    }

    return field.description
  }

  const renderField = (field: DocTypeField) => {
    if (field.hidden) return null
    if (actualMode === 'view' && field.read_only) return null

    const value = formData[field.fieldname] ?? field.default ?? ''

    // Make certain fields read-only after creation (restaurant owner perspective)
    let isReadOnly = field.read_only || actualMode === 'view'

    // Check if field is in readOnlyFields prop
    if (readOnlyFields.includes(field.fieldname)) {
      isReadOnly = true
    }

    // For Restaurant doctype, make IDs and base_url read-only after creation
    if (doctype === 'Restaurant' && mode === 'edit' && docname) {
      const lockedFields = ['restaurant_id', 'slug', 'subdomain', 'base_url']
      if (lockedFields.includes(field.fieldname)) {
        isReadOnly = true
      }
    }

    // Always make base_url read-only regardless of doctype or mode
    if (field.fieldname === 'base_url') {
      isReadOnly = true
    }

    // Always make the Restaurant Link field read-only in forms (we manage restaurant change via the header dropdown only)
    if (field.fieldtype === 'Link' && field.options === 'Restaurant') {
      isReadOnly = true
    }

    switch (field.fieldtype) {
      case 'Data':
      case 'Small Text':
        // Check if this is a color palette field
        // Only show the first one (violet) as a single selector, hide the rest
        if (field.fieldname.startsWith('color_palette_')) {
          // Only render the first color palette field (violet) as the main selector
          if (field.fieldname === 'color_palette_violet') {
            return (
              <ColorPaletteSelector
                key={field.fieldname}
                id={field.fieldname}
                label="Color Palette"
                value={value || ''}
                onChange={(val) => {
                  // Save only to the violet field (single field storage)
                  handleFieldChange(field.fieldname, val)
                }}
                required={field.required}
                readOnly={isReadOnly}
              />
            )
          }
          // Hide all other color palette fields - we only use one field to store the selected color
          return null
        }

        // Special handling for City & State in Restaurant doctype
        if (doctype === 'Restaurant' && field.fieldname === 'city') {
          return (
            <div key={field.fieldname} className="space-y-2">
              <Label htmlFor={field.fieldname}>
                City
                {field.required && <span className="text-destructive">*</span>}
              </Label>
              <CityStateSelector
                cityValue={formData.city}
                stateValue={formData.state}
                onChange={(city, state, lat, lng) => {
                  handleFieldChange('city', city)
                  handleFieldChange('state', state)
                  if (lat) handleFieldChange('city_latitude', parseFloat(lat))
                  if (lng) handleFieldChange('city_longitude', parseFloat(lng))
                }}
                disabled={isReadOnly}
              />
              {field.description && (
                <p className="text-xs text-muted-foreground">{getEnhancedDescription(field, doctype)}</p>
              )}
            </div>
          )
        }

        if (doctype === 'Restaurant' && field.fieldname === 'state') {
          // State is handled by the City selector
          return null
        }

        // Special handling for hero_video - render as file upload instead of URL input
        if (field.fieldname === 'hero_video') {
          return (
            <div key={field.fieldname} className="space-y-2">
              <Label htmlFor={field.fieldname}>
                {field.label.replace('URL', '')}
                {field.required && <span className="text-destructive">*</span>}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id={field.fieldname}
                  type="file"
                  accept="video/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return

                    if (!docname) {
                      toast.error('Please save the document before uploading files')
                      return
                    }

                    try {
                      const result = await uploadToR2({
                        ownerDoctype: doctype,
                        ownerName: docname,
                        mediaRole: 'restaurant_config_hero_video',
                        file,
                      })

                      const uploadedUrl = result.primary_url || ''
                      handleFieldChange(field.fieldname, uploadedUrl)

                      // Auto-save the field to database immediately
                      console.log('[DynamicForm] Auto-saving video upload:', { doctype, docname, field: field.fieldname, uploadedUrl })
                      if (docname && uploadedUrl) {
                        try {
                          const saveResult = await updateDoc({
                            doctype,
                            name: docname,
                            doc_data: { [field.fieldname]: uploadedUrl }
                          })
                          console.log('[DynamicForm] Auto-save result:', saveResult)
                          toast.success('Video uploaded and saved successfully')
                          // Refresh the document to show updated data
                          if (refreshDoc) {
                            await refreshDoc()
                          }
                        } catch (saveError: any) {
                          console.error('[DynamicForm] Auto-save error:', saveError)
                          toast.error(saveError?.message || 'Video uploaded but failed to save')
                        }
                      } else {
                        console.warn('[DynamicForm] Skipping auto-save - missing docname or uploadedUrl')
                        toast.success('Video uploaded successfully')
                      }
                    } catch (error: any) {
                      toast.error(error?.message || 'Failed to upload video')
                    } finally {
                      e.target.value = ''
                    }
                  }}
                  readOnly={isReadOnly}
                  required={field.required}
                  disabled={isReadOnly}
                  className="cursor-pointer"
                />
                {value && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Uploaded: {value.split('/').pop()}</span>
                  </div>
                )}
              </div>
              {field.description && (
                <p className="text-xs text-muted-foreground">Choose a video file from your local system</p>
              )}
            </div>
          )
        }

        const limit = (doctype && CHARACTER_LIMITS[doctype]) ? CHARACTER_LIMITS[doctype][field.fieldname] : undefined

        return (
          <div key={field.fieldname} className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor={field.fieldname}>
                {field.label}
                {field.required && <span className="text-destructive">*</span>}
              </Label>
              {limit && (
                <span className={cn(
                  "text-[10px] font-medium px-1.5 py-0.5 rounded-full transition-colors",
                  value.length >= limit
                    ? "bg-destructive text-white"
                    : value.length > limit * 0.8
                      ? "bg-amber-100 text-amber-700"
                      : "bg-muted text-muted-foreground"
                )}>
                  {value.length}/{limit}
                </span>
              )}
            </div>
            <Input
              id={field.fieldname}
              value={value}
              onChange={(e) => handleFieldChange(field.fieldname, e.target.value)}
              readOnly={isReadOnly}
              required={field.required}
              maxLength={limit}
            />
            {field.description && (
              <p className="text-xs text-muted-foreground space-y-1">
                <span className="block">{getEnhancedDescription(field, doctype)}</span>
                {limit && value.length >= limit && (
                  <span className="block text-destructive font-medium">
                    Maximum limit reached. Keep it short to ensure it fits in 2 lines.
                  </span>
                )}
              </p>
            )}
          </div>
        )

      case 'Text':
      case 'Long Text':
        return (
          <div key={field.fieldname} className="space-y-2">
            <Label htmlFor={field.fieldname}>
              {field.label}
              {field.required && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id={field.fieldname}
              value={value}
              onChange={(e) => handleFieldChange(field.fieldname, e.target.value)}
              readOnly={isReadOnly}
              required={field.required}
              rows={4}
            />
            {field.description && (
              <p className="text-xs text-muted-foreground">{getEnhancedDescription(field, doctype)}</p>
            )}
          </div>
        )

      case 'Link':
        // For read-only Link fields, render as a simple text input instead of dropdown
        if (isReadOnly) {
          return <LinkFieldReadOnly
            key={field.fieldname}
            field={field}
            value={value}
          />
        }

        return <LinkField
          key={field.fieldname}
          field={field}
          value={value}
          onChange={(val) => handleFieldChange(field.fieldname, val)}
          isReadOnly={isReadOnly}
        />

      case 'Select':
        const options = field.options ? field.options.split('\n').filter(Boolean) : []
        return (
          <div key={field.fieldname} className="space-y-2">
            <Label htmlFor={field.fieldname}>
              {field.label}
              {field.required && <span className="text-destructive">*</span>}
            </Label>
            <Select
              value={value}
              onValueChange={(val) => handleFieldChange(field.fieldname, val)}
              disabled={isReadOnly}
            >
              <SelectTrigger id={field.fieldname}>
                <SelectValue placeholder={`Select ${field.label}`} />
              </SelectTrigger>
              <SelectContent>
                {options.map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )

      case 'Check':
        return (
          <div key={field.fieldname} className="flex items-center space-x-2">
            <Checkbox
              id={field.fieldname}
              checked={!!value}
              onCheckedChange={(checked) => handleFieldChange(field.fieldname, checked)}
              disabled={isReadOnly}
            />
            <Label htmlFor={field.fieldname} className="cursor-pointer">
              {field.label}
              {field.required && <span className="text-destructive">*</span>}
            </Label>
          </div>
        )

      case 'Currency':
      case 'Float':
      case 'Int':
        return (
          <div key={field.fieldname} className="space-y-2">
            <Label htmlFor={field.fieldname}>
              {field.label}
              {field.required && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id={field.fieldname}
              type="number"
              value={value}
              onChange={(e) => handleFieldChange(field.fieldname, parseFloat(e.target.value) || 0)}
              readOnly={isReadOnly}
              required={field.required}
            />
            {field.description && (
              <p className="text-xs text-muted-foreground">{getEnhancedDescription(field, doctype)}</p>
            )}
          </div>
        )

      case 'Date':
        return (
          <DatePicker
            key={field.fieldname}
            id={field.fieldname}
            value={value || ''}
            onChange={(dateValue) => handleFieldChange(field.fieldname, dateValue)}
            placeholder="Select a date"
            required={field.required}
            readOnly={isReadOnly}
            label={field.label}
            description={field.description ? getEnhancedDescription(field, doctype) : undefined}
          />
        )

      case 'Time':
        return (
          <div key={field.fieldname} className="space-y-2">
            <Label htmlFor={field.fieldname}>
              {field.label}
              {field.required && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id={field.fieldname}
              type="time"
              value={value}
              onChange={(e) => handleFieldChange(field.fieldname, e.target.value)}
              readOnly={isReadOnly}
              required={field.required}
            />
          </div>
        )

      case 'Datetime':
        // Convert datetime string from backend (YYYY-MM-DD HH:mm:ss) to datetime-local format (YYYY-MM-DDTHH:mm)
        const formatDatetimeForInput = (dt: any) => {
          if (!dt) return ''
          if (typeof dt === 'string') {
            // Handle formats like "2025-12-14 16:38:33.426288" or "2025-12-14T16:38:33"
            const normalized = dt.replace(' ', 'T').split('.')[0] // Remove microseconds
            return normalized.substring(0, 16) // Keep only YYYY-MM-DDTHH:mm
          }
          return ''
        }
        return (
          <div key={field.fieldname} className="space-y-2">
            <Label htmlFor={field.fieldname}>
              {field.label}
              {field.required && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id={field.fieldname}
              type="datetime-local"
              value={formatDatetimeForInput(value)}
              onChange={(e) => handleFieldChange(field.fieldname, e.target.value)}
              readOnly={isReadOnly}
              required={field.required}
            />
          </div>
        )

      case 'Attach Image':
      case 'Attach':
        return (
          <div key={field.fieldname} className="space-y-2">
            <Label htmlFor={field.fieldname}>
              {field.label}
              {field.required && <span className="text-destructive">*</span>}
            </Label>
            {value ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/30">
                  {(field.fieldtype === 'Attach Image' || (field.fieldtype === 'Attach' && field.fieldname?.includes('image'))) && (
                    <img
                      src={value.startsWith('http') ? value : `/${value}`}
                      alt={field.label}
                      className="h-16 w-16 object-cover rounded border bg-white"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">File uploaded</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {value.split('/').pop() || value}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleFieldChange(field.fieldname, '')}
                    disabled={isReadOnly}
                  >
                    Remove
                  </Button>
                </div>
                {!isReadOnly && (
                  <Input
                    type="file"
                    accept={
                      field.fieldtype === 'Attach Image' ||
                        (field.fieldtype === 'Attach' && (field.fieldname?.includes('image') || field.label?.toLowerCase().includes('image')))
                        ? 'image/*'
                        : undefined
                    }
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return

                      if (!docname) {
                        toast.error('Please save the document before uploading files')
                        return
                      }

                      try {
                        const mediaRole = field.fieldname === 'logo' ? 'restaurant_config_logo' :
                          field.fieldname === 'apple_touch_icon' ? 'apple_touch_icon' :
                            `${doctype.toLowerCase().replace(' ', '_')}_${field.fieldname}`

                        const result = await uploadToR2({
                          ownerDoctype: doctype,
                          ownerName: docname,
                          mediaRole,
                          file,
                        })

                        const uploadedUrl = result.primary_url || ''
                        handleFieldChange(field.fieldname, uploadedUrl)

                        // Auto-save the field to database immediately
                        console.log('[DynamicForm] Auto-saving file upload:', { doctype, docname, field: field.fieldname, uploadedUrl })
                        if (docname && uploadedUrl) {
                          try {
                            const saveResult = await updateDoc({
                              doctype,
                              name: docname,
                              doc_data: { [field.fieldname]: uploadedUrl }
                            })
                            console.log('[DynamicForm] Auto-save result:', saveResult)
                            toast.success('File uploaded and saved successfully')
                            // Refresh the document to show updated data
                            if (refreshDoc) {
                              await refreshDoc()
                            }
                          } catch (saveError: any) {
                            console.error('[DynamicForm] Auto-save error:', saveError)
                            toast.error(saveError?.message || 'File uploaded but failed to save')
                          }
                        } else {
                          console.warn('[DynamicForm] Skipping auto-save - missing docname or uploadedUrl')
                          toast.success('File uploaded successfully')
                        }
                      } catch (error: any) {
                        toast.error(error?.message || 'Failed to upload file')
                      } finally {
                        e.target.value = ''
                      }
                    }}
                    className="cursor-pointer"
                  />
                )}
              </div>
            ) : (
              <Input
                id={field.fieldname}
                type="file"
                accept={
                  field.fieldtype === 'Attach Image' ||
                    (field.fieldtype === 'Attach' && (field.fieldname?.includes('image') || field.label?.toLowerCase().includes('image')))
                    ? 'image/*'
                    : undefined
                }
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return

                  if (!docname) {
                    toast.error('Please save the document before uploading files')
                    return
                  }

                  try {
                    const mediaRole = field.fieldname === 'logo' ? 'restaurant_config_logo' :
                      field.fieldname === 'apple_touch_icon' ? 'apple_touch_icon' :
                        `${doctype.toLowerCase().replace(' ', '_')}_${field.fieldname}`

                    const result = await uploadToR2({
                      ownerDoctype: doctype,
                      ownerName: docname,
                      mediaRole,
                      file,
                    })

                    const uploadedUrl = result.primary_url || ''
                    handleFieldChange(field.fieldname, uploadedUrl)

                    // Auto-save the field to database immediately
                    console.log('[DynamicForm] Auto-saving file upload:', { doctype, docname, field: field.fieldname, uploadedUrl })
                    if (docname && uploadedUrl) {
                      try {
                        const saveResult = await updateDoc({
                          doctype,
                          name: docname,
                          doc_data: { [field.fieldname]: uploadedUrl }
                        })
                        console.log('[DynamicForm] Auto-save result:', saveResult)
                        toast.success('File uploaded and saved successfully')
                        // Refresh the document to show updated data
                        if (refreshDoc) {
                          await refreshDoc()
                        }
                      } catch (saveError: any) {
                        console.error('[DynamicForm] Auto-save error:', saveError)
                        toast.error(saveError?.message || 'File uploaded but failed to save')
                      }
                    } else {
                      console.warn('[DynamicForm] Skipping auto-save - missing docname or uploadedUrl')
                      toast.success('File uploaded successfully')
                    }
                  } catch (error: any) {
                    toast.error(error?.message || 'Failed to upload file')
                  } finally {
                    e.target.value = ''
                  }
                }}
                readOnly={isReadOnly}
                required={field.required}
                disabled={isReadOnly}
                className="cursor-pointer"
              />
            )}
            {field.description && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            )}
          </div>
        )

      case 'Table':
        // Handle Table fields (child tables)
        if (field.fieldname === 'menu_images' && field.options === 'Menu Image Item') {
          return (
            <div key={field.fieldname} className="space-y-2">
              <MenuImagesTable
                value={Array.isArray(value) ? value : []}
                onChange={(items) => handleFieldChange(field.fieldname, items)}
                required={field.required}
                disabled={isReadOnly}
                categoryName={docname}
              />
              {field.description && (
                <p className="text-xs text-muted-foreground">{field.description}</p>
              )}
            </div>
          )
        }
        // Handle Product Media table
        if (field.fieldname === 'product_media' && field.options === 'Product Media') {
          return (
            <div key={field.fieldname} className="space-y-2">
              <ProductMediaTable
                value={Array.isArray(value) ? value : []}
                onChange={(items) => handleFieldChange(field.fieldname, items)}
                required={field.required}
                disabled={isReadOnly}
                productName={docname}
              />
              {field.description && (
                <p className="text-xs text-muted-foreground">{field.description}</p>
              )}
            </div>
          )
        }
        // Handle Customization Questions table
        if (field.fieldname === 'customization_questions' && field.options === 'Customization Question') {
          return (
            <div key={field.fieldname} className="space-y-2">
              <CustomizationQuestionsTable
                value={Array.isArray(value) ? value : []}
                onChange={(questions) => handleFieldChange(field.fieldname, questions)}
                required={field.required}
                disabled={isReadOnly}
              />
              {field.description && (
                <p className="text-xs text-muted-foreground">{field.description}</p>
              )}
            </div>
          )
        }
        // Handle Extracted Dishes table - display read-only
        if (field.fieldname === 'extracted_dishes' && field.options === 'Extracted Dish') {
          const dishes = Array.isArray(value) ? value : []
          return (
            <div key={field.fieldname} className="space-y-2">
              <ExtractedDishesTable dishes={dishes} />
            </div>
          )
        }
        // For other table types, show a placeholder
        return (
          <div key={field.fieldname} className="space-y-2">
            <Label htmlFor={field.fieldname}>
              {field.label}
              {field.required && <span className="text-destructive">*</span>}
            </Label>
            <div className="p-4 border rounded-md bg-muted/30 text-sm text-muted-foreground">
              Table field: {field.options || field.fieldname} (not yet implemented)
            </div>
          </div>
        )

      default:
        return (
          <div key={field.fieldname} className="space-y-2">
            <Label htmlFor={field.fieldname}>
              {field.label}
              {field.required && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id={field.fieldname}
              value={value}
              onChange={(e) => handleFieldChange(field.fieldname, e.target.value)}
              readOnly={isReadOnly}
              required={field.required}
            />
            {field.description && (
              <p className="text-xs text-muted-foreground">{getEnhancedDescription(field, doctype)}</p>
            )}
          </div>
        )
    }
  }

  // Skip loading state if skipLoadingState is true (parent handles loading via page reload)
  if (!skipLoadingState && (isLoading || metaLoading)) {
    return (
      <Card>
        <CardContent className="space-y-6 py-8">
          <div className="space-y-2">
            <div className="h-4 w-32 bg-muted rounded animate-pulse" />
            <div className="h-10 w-full bg-muted/60 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                <div className="h-10 w-full bg-muted/40 rounded animate-pulse" />
              </div>
            ))}
          </div>
          <div className="h-32 w-full bg-muted/20 rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  if (!meta && !metaLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            Failed to load form for {doctype}
          </p>
          {metaError && (
            <p className="text-center text-destructive text-sm mt-2">
              Error: {String(metaError)}
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  // Skip loading state if skipLoadingState is true (parent handles loading via page reload)
  if (!skipLoadingState && !meta) {
    return (
      <Card>
        <CardContent className="space-y-6 py-8">
          <div className="space-y-2">
            <div className="h-4 w-32 bg-muted rounded animate-pulse" />
            <div className="h-10 w-full bg-muted/60 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                <div className="h-10 w-full bg-muted/40 rounded animate-pulse" />
              </div>
            ))}
          </div>
          <div className="h-32 w-full bg-muted/20 rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  // Group fields by sections - parse section breaks to create sections
  const sections: Array<{ label?: string, fields: DocTypeField[] }> = []
  let currentSection: { label?: string, fields: DocTypeField[] } = { fields: [] }

  if (meta?.fields) {
    for (const field of meta.fields) {
      if (field.hidden || hideFields.includes(field.fieldname)) {
        continue
      }

      if (field.fieldtype === 'Section Break') {
        // Save current section if it has fields
        if (currentSection.fields.length > 0) {
          sections.push(currentSection)
        }
        // Start new section
        currentSection = {
          label: field.label,
          fields: []
        }
      } else if (field.fieldtype !== 'Column Break') {
        // Add field to current section
        currentSection.fields.push(field)
      }
    }
    // Add last section
    if (currentSection.fields.length > 0) {
      sections.push(currentSection)
    }
  }

  // If no sections were created, create a default section with all visible fields
  if (sections.length === 0 && meta?.fields) {
    const visibleFields = meta.fields.filter(f =>
      !f.hidden &&
      !hideFields.includes(f.fieldname) &&
      f.fieldtype !== 'Column Break' &&
      f.fieldtype !== 'Section Break'
    )
    if (visibleFields.length > 0) {
      sections.push({ fields: visibleFields })
    }
  }

  // Calculate required fields validation - get all fields from all sections
  const allVisibleFields = sections.flatMap(s => s.fields)
  const requiredFields = allVisibleFields.filter((f: DocTypeField) => f.required)
  const requiredFieldsCount = requiredFields.length
  const filledRequiredFields = requiredFields.filter((f: DocTypeField) => {
    const value = formData[f.fieldname]
    return value !== undefined && value !== null && value !== ''
  }).length
  const allRequiredFieldsFilled = requiredFieldsCount === 0 || filledRequiredFields === requiredFieldsCount

  return (
    <div className="space-y-6">
      {/* Validation Status */}
      {mode !== 'view' && requiredFieldsCount > 0 && (
        <div className={cn(
          "p-4 rounded-md border",
          allRequiredFieldsFilled
            ? "bg-green-50 border-green-200"
            : "bg-amber-50 border-amber-200"
        )}>
          <div className="flex items-center gap-2">
            {allRequiredFieldsFilled ? (
              <>
                <Check className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-900">
                  All {requiredFieldsCount} required field(s) filled
                </span>
              </>
            ) : (
              <>
                <span className="text-amber-600 font-bold">!</span>
                <span className="text-sm font-medium text-amber-900">
                  {requiredFieldsCount - filledRequiredFields} of {requiredFieldsCount} required field(s) missing
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Manual Refresh / Header Actions removed as per user request */}

      {/* Saving Progress */}
      {saving && progress > 0 && (
        <div className="space-y-2 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex justify-between text-sm font-medium text-blue-900">
            <span>Saving...</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}


      {/* Form Fields - Grouped by Sections */}
      {sections.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          <p>No fields available for this form.</p>
          <p className="text-xs mt-2">Total fields: {meta?.fields?.length || 0}, Hidden: {meta?.fields?.filter((f: DocTypeField) => f.hidden).length || 0}</p>
        </div>
      ) : (
        sections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="space-y-4">
            {section.label && (
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">{section.label}</h3>
              </div>
            )}
            <div className={cn(
              "grid gap-6",
              // For table fields (like customization_questions, product_media), use full width
              section.fields.some(f => f.fieldtype === 'Table')
                ? "grid-cols-1"
                : "md:grid-cols-2"
            )}>
              {section.fields.map(field => {
                const rendered = renderField(field)
                if (!rendered) {
                  console.warn(`[DynamicForm] Field ${field.fieldname} (${field.fieldtype}) was not rendered`)
                }
                return rendered
              })}
            </div>
          </div>
        ))
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-6 border-t">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
        {canSave && (
          <Button
            onClick={handleSave}
            disabled={
              saving ||
              !allRequiredFieldsFilled ||
              sections.flatMap(s => s.fields).length === 0
            }
            size="lg"
            className="min-w-[120px]"
            title={
              !allRequiredFieldsFilled
                ? `Please fill in all ${requiredFieldsCount - filledRequiredFields} required field(s)`
                : undefined
            }
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              mode === 'create' ? 'Create' : 'Save Changes'
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

// Link Field Read-Only Component - Shows linked record as read-only text
function LinkFieldReadOnly({
  field,
  value
}: {
  field: DocTypeField
  value: any
}) {
  const linkedDoctype = field.options || ''
  const { data: linkedRecord } = useFrappeGetDoc(linkedDoctype, value || '', {
    enabled: !!value && !!linkedDoctype
  })
  // Use selected restaurant from context as a more reliable fallback
  const { selectedRestaurant } = useRestaurant()
  const selectedRestaurantKey = selectedRestaurant || (typeof window !== 'undefined' && localStorage.getItem('dinematters-selected-restaurant')) || ''
  const { data: selectedRestaurantDoc } = useFrappeGetDoc('Restaurant', selectedRestaurantKey || '', {
    enabled: !!selectedRestaurantKey && linkedDoctype === 'Restaurant'
  })

  const getDisplayValue = () => {
    // If we have a valid linked record with a friendly name, use it
    if (linkedRecord) {
      if (linkedDoctype === 'Restaurant' && linkedRecord.restaurant_name) {
        return linkedRecord.restaurant_name
      }
      return linkedRecord.name || value || ''
    }

    // If linkedRecord not found or doesn't match value, but selectedRestaurantDoc is available,
    // prefer showing the selected restaurant's friendly name. This avoids showing raw values
    // like currency codes (e.g., "INR", "USD") which can appear when initialData contains a label.
    if (linkedDoctype === 'Restaurant' && selectedRestaurantDoc) {
      return selectedRestaurantDoc.restaurant_name || selectedRestaurantDoc.name || value || ''
    }

    return value || ''
  }
  // If linkedRecord wasn't found, but we have a selectedRestaurantDoc, show its restaurant_name (render below)
  if (!linkedRecord && selectedRestaurantDoc && linkedDoctype === 'Restaurant') {
    const displayFromSelected = selectedRestaurantDoc.restaurant_name || selectedRestaurantDoc.name
    return (
      <div className="space-y-2">
        <Label htmlFor={field.fieldname}>
          {field.label}
          {field.required && <span className="text-destructive">*</span>}
        </Label>
        <Input
          id={field.fieldname}
          value={displayFromSelected}
          readOnly={true}
          className="bg-muted cursor-not-allowed"
        />
        {field.description && (
          <p className="text-xs text-muted-foreground">{field.description}</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={field.fieldname}>
        {field.label}
        {field.required && <span className="text-destructive">*</span>}
      </Label>
      <Input
        id={field.fieldname}
        value={(function () {
          const raw = getDisplayValue()
          const looksLikeCurrency = typeof raw === 'string' && /^[A-Z]{3}$/.test(raw)
          if (linkedDoctype === 'Restaurant' && looksLikeCurrency) {
            // Prefer selected restaurant friendly name if available, otherwise show loading placeholder
            if (selectedRestaurantDoc) return selectedRestaurantDoc.restaurant_name || selectedRestaurantDoc.name || ''
            return 'Loading...'
          }
          return raw
        })()}
        readOnly={true}
        className="bg-muted cursor-not-allowed"
      />
      {field.description && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}
    </div>
  )
}

// Link Field Component - Fetches and displays linked doctype records
function LinkField({
  field,
  value,
  onChange,
  isReadOnly
}: {
  field: DocTypeField
  value: any
  onChange: (value: string) => void
  isReadOnly: boolean
}) {
  const linkedDoctype = field.options || ''

  // Determine which fields to fetch based on common doctype patterns
  const getFieldsForDoctype = (doctype: string) => {
    switch (doctype) {
      case 'Restaurant':
        return ['name', 'restaurant_name']
      default:
        // Try to get name field and common title fields
        return ['name']
    }
  }

  const fields = getFieldsForDoctype(linkedDoctype)

  // Fetch linked records
  const { data: linkedRecords, isLoading } = useFrappeGetDocList(
    linkedDoctype,
    {
      fields: fields,
      limit: 1000,
      orderBy: { field: fields[1] || 'name', order: 'asc' }
    },
    linkedDoctype ? `link-${linkedDoctype}` : null
  )

  // Get display value for selected record
  const getDisplayValue = (record: any) => {
    if (!record) return ''
    // For Restaurant, use restaurant_name
    if (linkedDoctype === 'Restaurant' && record.restaurant_name) {
      return record.restaurant_name
    }
    // Fallback to name or first available field
    return record[fields[1]] || record.name || ''
  }

  // Get selected record
  const selectedRecord = linkedRecords?.find((r: any) => r.name === value)
  const displayValue = selectedRecord ? getDisplayValue(selectedRecord) : value

  if (isLoading) {
    return (
      <div key={field.fieldname} className="space-y-2">
        <Label htmlFor={field.fieldname}>
          {field.label}
          {field.required && <span className="text-destructive">*</span>}
        </Label>
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Loading options...</span>
        </div>
      </div>
    )
  }

  return (
    <div key={field.fieldname} className="space-y-2">
      <Label htmlFor={field.fieldname}>
        {field.label}
        {field.required && <span className="text-destructive">*</span>}
      </Label>
      <Select
        value={value || ''}
        onValueChange={onChange}
        disabled={isReadOnly}
      >
        <SelectTrigger id={field.fieldname}>
          <SelectValue placeholder={`Select ${field.label}`}>
            {displayValue || `Select ${field.label}`}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {linkedRecords && linkedRecords.length > 0 ? (
            linkedRecords.map((record: any) => {
              const display = getDisplayValue(record)
              return (
                <SelectItem key={record.name} value={record.name}>
                  {display}
                </SelectItem>
              )
            })
          ) : (
            <SelectItem value="" disabled>No options available</SelectItem>
          )}
        </SelectContent>
      </Select>
      {field.description && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}
    </div>
  )
}

