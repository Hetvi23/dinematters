import { useState, useEffect, useRef } from 'react'
import { useDocTypeMeta, DocTypeField } from '@/lib/doctype'
import { usePermissions } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ColorPaletteSelector } from '@/components/ui/color-palette-selector'
import { useFrappeGetDoc, useFrappePostCall } from '@/lib/frappe'
import { toast } from 'sonner'
import { Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import MenuImagesTable from './MenuImagesTable'
import ExtractedDishesTable from './ExtractedDishesTable'

interface DynamicFormProps {
  doctype: string
  docname?: string
  onSave?: (data: any) => void
  onCancel?: () => void
  mode?: 'create' | 'edit' | 'view'
  initialData?: Record<string, any>
}

export default function DynamicForm({ 
  doctype, 
  docname, 
  onSave, 
  onCancel,
  mode = 'create',
  initialData = {}
}: DynamicFormProps) {
  const { meta, isLoading: metaLoading, error: metaError } = useDocTypeMeta(doctype)
  const { permissions, isLoading: permLoading } = usePermissions(doctype)
  const { data: docData, isLoading: docLoading } = useFrappeGetDoc(doctype, docname || '', {
    enabled: !!docname && mode !== 'create'
  })

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

  // Update ref when initialData changes (but don't trigger re-initialization)
  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      initialDataRef.current = { ...initialDataRef.current, ...initialData }
    }
  }, [JSON.stringify(initialData)])

  useEffect(() => {
    // Only initialize if we haven't initialized yet AND user hasn't entered data
    if (formDataInitialized && hasUserDataRef.current) {
      return // Don't overwrite user data
    }

    if (docData && mode !== 'create' && !formDataInitialized) {
      // Load existing document data
      setFormData(docData)
      setFormDataInitialized(true)
      hasUserDataRef.current = true
    } else if (meta && !formDataInitialized && mode === 'create') {
      // Initialize form with defaults and initial data only once
      const defaults: Record<string, any> = { ...initialDataRef.current }
      meta.fields.forEach(field => {
        if (field.default !== undefined && field.default !== null && !defaults[field.fieldname]) {
          defaults[field.fieldname] = field.default
        }
      })
      setFormData(defaults)
      setFormDataInitialized(true)
    } else if (Object.keys(initialDataRef.current).length > 0 && !formDataInitialized && !meta && mode === 'create') {
      // If we have initial data but no meta yet, set it
      setFormData(prev => {
        // Only merge if formData is empty or doesn't have these keys
        const merged = { ...prev }
        Object.keys(initialDataRef.current).forEach(key => {
          if (!(key in merged) || merged[key] === undefined || merged[key] === null || merged[key] === '') {
            merged[key] = initialDataRef.current[key]
          }
        })
        return merged
      })
      setFormDataInitialized(true)
    }
  }, [docData, meta, mode, formDataInitialized])

  // Reset initialization flag when mode or docname changes
  useEffect(() => {
    setFormDataInitialized(false)
    hasUserDataRef.current = false
    setFormData({})
    if (initialData) {
      initialDataRef.current = { ...initialData }
    }
  }, [docname, mode])

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

  const renderField = (field: DocTypeField) => {
    if (field.hidden) return null
    if (actualMode === 'view' && field.read_only) return null

    const value = formData[field.fieldname] ?? field.default ?? ''
    const isReadOnly = field.read_only || actualMode === 'view'

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
              placeholder={field.description}
            />
            {field.description && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
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
              placeholder={field.description}
              rows={4}
            />
            {field.description && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            )}
          </div>
        )

      case 'Link':
        // For Link fields, we'd need to fetch options - simplified for now
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
              placeholder={field.description || `Enter ${field.options || field.label}`}
            />
          </div>
        )

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
              placeholder={field.description}
            />
          </div>
        )

      case 'Date':
        return (
          <div key={field.fieldname} className="space-y-2">
            <Label htmlFor={field.fieldname}>
              {field.label}
              {field.required && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id={field.fieldname}
              type="date"
              value={value}
              onChange={(e) => handleFieldChange(field.fieldname, e.target.value)}
              readOnly={isReadOnly}
              required={field.required}
            />
          </div>
        )

      case 'Datetime':
        return (
          <div key={field.fieldname} className="space-y-2">
            <Label htmlFor={field.fieldname}>
              {field.label}
              {field.required && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id={field.fieldname}
              type="datetime-local"
              value={value}
              onChange={(e) => handleFieldChange(field.fieldname, e.target.value)}
              readOnly={isReadOnly}
              required={field.required}
            />
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
            <div className="p-4 border rounded-lg bg-muted/30 text-sm text-muted-foreground">
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
              placeholder={field.description}
            />
          </div>
        )
    }
  }

  if (isLoading || metaLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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

  if (!meta) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  // Group fields by sections (simplified - in real implementation, parse section breaks)
  const visibleFields = (meta.fields || []).filter(f => !f.hidden)

  // Calculate required fields validation
  const requiredFields = visibleFields.filter(f => f.required)
  const requiredFieldsCount = requiredFields.length
  const filledRequiredFields = requiredFields.filter(f => {
    const value = formData[f.fieldname]
    return value !== undefined && value !== null && value !== ''
  }).length
  const allRequiredFieldsFilled = requiredFieldsCount === 0 || filledRequiredFields === requiredFieldsCount

  return (
    <div className="space-y-6">
      {/* Validation Status */}
      {actualMode !== 'view' && requiredFieldsCount > 0 && (
        <div className={cn(
          "p-4 rounded-lg border",
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

      {/* Saving Progress */}
      {saving && progress > 0 && (
        <div className="space-y-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
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

      {/* Form Fields - Structured Grid */}
      <div className="grid gap-6 md:grid-cols-2">
          {visibleFields.length === 0 ? (
            <div className="col-span-2 text-center text-muted-foreground py-8">
              <p>No fields available for this form.</p>
              <p className="text-xs mt-2">Total fields: {meta.fields?.length || 0}, Hidden: {meta.fields?.filter(f => f.hidden).length || 0}</p>
            </div>
          ) : (
            visibleFields.map(field => {
              const rendered = renderField(field)
              if (!rendered) {
                console.warn(`[DynamicForm] Field ${field.fieldname} (${field.fieldtype}) was not rendered`)
              }
              return rendered
            })
          )}
        </div>

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
              visibleFields.length === 0
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
              actualMode === 'create' ? 'Create' : 'Save Changes'
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

