// DocType utilities
import { useFrappeGetCall } from '@/lib/frappe'

export interface DocTypeField {
  fieldname: string
  label: string
  fieldtype: string
  options?: string
  required: boolean
  read_only: boolean
  default?: any
  description?: string
  hidden: boolean
  depends_on?: string
  fetch_from?: string
  child_doctype?: string
}

export interface DocTypeMeta {
  doctype: string
  name_field: string
  autoname?: string
  fields: DocTypeField[]
  permissions: {
    read: boolean
    write: boolean
    create: boolean
    delete: boolean
    submit: boolean
    cancel: boolean
  }
  is_submittable: boolean
  has_workflow: boolean
}

export function useDocTypeMeta(doctype: string) {
  const { data, error, isLoading } = useFrappeGetCall<{ message: DocTypeMeta }>(
    'dinematters.dinematters.api.ui.get_doctype_meta',
    { doctype },
    doctype ? `doctype-meta-${doctype}` : null
  )

  const meta = data?.message || null
  
  // Ensure fields is always an array
  if (meta && !Array.isArray(meta.fields)) {
    meta.fields = []
  }

  // Debug logging
  if (doctype && !isLoading) {
    console.log(`[useDocTypeMeta] ${doctype}:`, {
      hasData: !!data,
      hasMessage: !!data?.message,
      fieldsCount: meta?.fields?.length || 0,
      meta
    })
  }

  return {
    meta: meta || null,
    isLoading,
    error,
  }
}

