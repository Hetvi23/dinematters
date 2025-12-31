import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trash2, Plus, Edit2, X, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface CustomizationOption {
  name?: string
  option_id?: string
  label?: string
  price?: number
  is_default?: boolean | number
  is_vegetarian?: boolean | number
  display_order?: number
}

interface CustomizationQuestion {
  name?: string
  question_id?: string
  title?: string
  subtitle?: string
  question_type?: 'single' | 'multiple' | 'checkbox'
  is_required?: boolean | number
  display_order?: number
  options?: CustomizationOption[]
}

interface CustomizationQuestionsTableProps {
  value?: CustomizationQuestion[]
  onChange?: (questions: CustomizationQuestion[]) => void
  required?: boolean
  disabled?: boolean
}

export default function CustomizationQuestionsTable({ 
  value = [], 
  onChange, 
  required, 
  disabled 
}: CustomizationQuestionsTableProps) {
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set())
  const [editingQuestion, setEditingQuestion] = useState<number | null>(null)
  const [editingOption, setEditingOption] = useState<{ questionIndex: number; optionIndex: number } | null>(null)
  
  const currentValue = Array.isArray(value) ? value : []

  const toggleQuestion = (index: number) => {
    const newExpanded = new Set(expandedQuestions)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedQuestions(newExpanded)
  }

  const generateId = () => {
    return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  const handleAddQuestion = () => {
    const newQuestion: CustomizationQuestion = {
      question_id: generateId(),
      title: '',
      subtitle: '',
      question_type: 'multiple',
      is_required: false,
      display_order: currentValue.length,
      options: []
    }
    const updated = [...currentValue, newQuestion]
    onChange?.(updated)
    setEditingQuestion(currentValue.length)
    setExpandedQuestions(new Set([...expandedQuestions, currentValue.length]))
  }

  const handleRemoveQuestion = (index: number) => {
    const updated = currentValue.filter((_, i) => i !== index)
    // Reorder display_order
    const reordered = updated.map((q, idx) => ({
      ...q,
      display_order: idx
    }))
    onChange?.(reordered)
    const newExpanded = new Set(expandedQuestions)
    newExpanded.delete(index)
    setExpandedQuestions(newExpanded)
  }

  const handleQuestionChange = (index: number, field: keyof CustomizationQuestion, newValue: any) => {
    const updated = [...currentValue]
    updated[index] = {
      ...updated[index],
      [field]: newValue
    }
    onChange?.(updated)
  }

  const handleAddOption = (questionIndex: number) => {
    const question = currentValue[questionIndex]
    const newOption: CustomizationOption = {
      option_id: generateId(),
      label: '',
      price: 0,
      is_default: false,
      is_vegetarian: false,
      display_order: (question.options?.length || 0)
    }
    const updated = [...currentValue]
    updated[questionIndex] = {
      ...question,
      options: [...(question.options || []), newOption]
    }
    onChange?.(updated)
    setEditingOption({ questionIndex, optionIndex: question.options?.length || 0 })
  }

  const handleRemoveOption = (questionIndex: number, optionIndex: number) => {
    const question = currentValue[questionIndex]
    const updatedOptions = (question.options || []).filter((_, i) => i !== optionIndex)
    // Reorder display_order
    const reorderedOptions = updatedOptions.map((opt, idx) => ({
      ...opt,
      display_order: idx
    }))
    const updated = [...currentValue]
    updated[questionIndex] = {
      ...question,
      options: reorderedOptions
    }
    onChange?.(updated)
  }

  const handleOptionChange = (
    questionIndex: number, 
    optionIndex: number, 
    field: keyof CustomizationOption, 
    newValue: any
  ) => {
    const question = currentValue[questionIndex]
    const updatedOptions = [...(question.options || [])]
    updatedOptions[optionIndex] = {
      ...updatedOptions[optionIndex],
      [field]: newValue
    }
    const updated = [...currentValue]
    updated[questionIndex] = {
      ...question,
      options: updatedOptions
    }
    onChange?.(updated)
  }

  const handleSaveQuestion = (index: number) => {
    const question = currentValue[index]
    if (!question.title || !question.title.trim()) {
      toast.error('Question title is required')
      return
    }
    if (!question.options || question.options.length === 0) {
      toast.error('At least one option is required for each question')
      return
    }
    // Validate all options have labels
    const invalidOptions = question.options.filter(opt => !opt.label || !opt.label.trim())
    if (invalidOptions.length > 0) {
      toast.error('All options must have a label')
      return
    }
    setEditingQuestion(null)
    toast.success('Question saved')
  }

  const handleSaveOption = (questionIndex: number, optionIndex: number) => {
    const option = currentValue[questionIndex].options?.[optionIndex]
    if (!option?.label || !option.label.trim()) {
      toast.error('Option label is required')
      return
    }
    setEditingOption(null)
    toast.success('Option saved')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>
          Customization Questions
          {required && <span className="text-destructive">*</span>}
        </Label>
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddQuestion}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Question
          </Button>
        )}
      </div>

      {currentValue.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border rounded-md">
          <p>No customization questions added yet</p>
          <p className="text-sm mt-1">Add questions to allow customers to customize this product</p>
        </div>
      ) : (
        <div className="space-y-3">
          {currentValue.map((question, questionIndex) => {
            const isExpanded = expandedQuestions.has(questionIndex)
            const isEditing = editingQuestion === questionIndex
            const questionOptions = question.options || []

            return (
              <Card key={questionIndex} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label>Question ID *</Label>
                              <Input
                                value={question.question_id || ''}
                                onChange={(e) => handleQuestionChange(questionIndex, 'question_id', e.target.value)}
                                placeholder="Question ID"
                                disabled={disabled}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Display Order *</Label>
                              <Input
                                type="number"
                                min="0"
                                value={question.display_order ?? questionIndex}
                                onChange={(e) => handleQuestionChange(questionIndex, 'display_order', parseInt(e.target.value) || 0)}
                                disabled={disabled}
                                required
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Title *</Label>
                            <Input
                              value={question.title || ''}
                              onChange={(e) => handleQuestionChange(questionIndex, 'title', e.target.value)}
                              placeholder="e.g., Choose Size"
                              disabled={disabled}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Subtitle</Label>
                            <Textarea
                              value={question.subtitle || ''}
                              onChange={(e) => handleQuestionChange(questionIndex, 'subtitle', e.target.value)}
                              placeholder="Optional description"
                              disabled={disabled}
                              rows={2}
                            />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label>Question Type *</Label>
                              <Select
                                value={question.question_type || 'multiple'}
                                onValueChange={(value: 'single' | 'multiple' | 'checkbox') => 
                                  handleQuestionChange(questionIndex, 'question_type', value)
                                }
                                disabled={disabled}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="single">Single Choice</SelectItem>
                                  <SelectItem value="multiple">Multiple Choice</SelectItem>
                                  <SelectItem value="checkbox">Checkbox</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2 flex items-end">
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`required-${questionIndex}`}
                                  checked={!!question.is_required}
                                  onChange={(e) => handleQuestionChange(questionIndex, 'is_required', e.target.checked)}
                                  disabled={disabled}
                                  className="h-4 w-4 rounded border-gray-300"
                                />
                                <Label htmlFor={`required-${questionIndex}`} className="font-normal">
                                  Is Required
                                </Label>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">
                              {question.title || `Question ${questionIndex + 1}`}
                            </CardTitle>
                            {question.is_required && (
                              <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-800 rounded">
                                Required
                              </span>
                            )}
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                              {question.question_type === 'single' ? 'Single' : 
                               question.question_type === 'checkbox' ? 'Checkbox' : 'Multiple'}
                            </span>
                          </div>
                          {question.subtitle && (
                            <p className="text-sm text-muted-foreground mt-1">{question.subtitle}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {questionOptions.length} option{questionOptions.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      )}
                    </div>
                    {!disabled && (
                      <div className="flex items-center gap-2 ml-4">
                        {isEditing ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSaveQuestion(questionIndex)}
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingQuestion(questionIndex)}
                          >
                            <Edit2 className="h-4 w-4 text-blue-600" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleQuestion(questionIndex)}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveQuestion(questionIndex)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Options</Label>
                        {!disabled && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddOption(questionIndex)}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Option
                          </Button>
                        )}
                      </div>

                      {questionOptions.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground border rounded-md text-sm">
                          No options added yet. Add at least one option.
                        </div>
                      ) : (
                        <div className="border rounded-md overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-32">Label *</TableHead>
                                <TableHead className="w-32">Additional Price</TableHead>
                                <TableHead className="w-24">Default</TableHead>
                                <TableHead className="w-24">Vegetarian</TableHead>
                                <TableHead className="w-24">Order</TableHead>
                                {!disabled && <TableHead className="w-24">Actions</TableHead>}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {questionOptions.map((option, optionIndex) => {
                                const isEditingOpt = editingOption?.questionIndex === questionIndex && 
                                                   editingOption?.optionIndex === optionIndex

                                return (
                                  <TableRow key={optionIndex}>
                                    <TableCell>
                                      {isEditingOpt ? (
                                        <Input
                                          value={option.label || ''}
                                          onChange={(e) => handleOptionChange(questionIndex, optionIndex, 'label', e.target.value)}
                                          placeholder="Option label"
                                          className="text-xs"
                                          required
                                        />
                                      ) : (
                                        <span className="text-sm font-medium">{option.label || '-'}</span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {isEditingOpt ? (
                                        <Input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={option.price ?? 0}
                                          onChange={(e) => handleOptionChange(questionIndex, optionIndex, 'price', parseFloat(e.target.value) || 0)}
                                          placeholder="0.00"
                                          className="text-xs"
                                        />
                                      ) : (
                                        <span className="text-sm">₹{option.price ?? 0}</span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {isEditingOpt ? (
                                        <input
                                          type="checkbox"
                                          checked={!!option.is_default}
                                          onChange={(e) => handleOptionChange(questionIndex, optionIndex, 'is_default', e.target.checked)}
                                          className="h-4 w-4 rounded border-gray-300"
                                        />
                                      ) : (
                                        <span className={cn(
                                          "text-xs px-2 py-0.5 rounded",
                                          option.is_default ? "bg-green-100 text-green-800" : "text-muted-foreground"
                                        )}>
                                          {option.is_default ? 'Yes' : 'No'}
                                        </span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {isEditingOpt ? (
                                        <input
                                          type="checkbox"
                                          checked={!!option.is_vegetarian}
                                          onChange={(e) => handleOptionChange(questionIndex, optionIndex, 'is_vegetarian', e.target.checked)}
                                          className="h-4 w-4 rounded border-gray-300"
                                        />
                                      ) : (
                                        <span className={cn(
                                          "text-xs px-2 py-0.5 rounded",
                                          option.is_vegetarian ? "bg-green-100 text-green-800" : "text-muted-foreground"
                                        )}>
                                          {option.is_vegetarian ? 'Yes' : 'No'}
                                        </span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {isEditingOpt ? (
                                        <Input
                                          type="number"
                                          min="0"
                                          value={option.display_order ?? optionIndex}
                                          onChange={(e) => handleOptionChange(questionIndex, optionIndex, 'display_order', parseInt(e.target.value) || 0)}
                                          className="w-16 text-xs"
                                        />
                                      ) : (
                                        <span className="text-sm">{option.display_order ?? optionIndex}</span>
                                      )}
                                    </TableCell>
                                    {!disabled && (
                                      <TableCell>
                                        <div className="flex items-center gap-1">
                                          {isEditingOpt ? (
                                            <>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleSaveOption(questionIndex, optionIndex)}
                                              >
                                                <Check className="h-4 w-4 text-green-600" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setEditingOption(null)}
                                              >
                                                <X className="h-4 w-4 text-muted-foreground" />
                                              </Button>
                                            </>
                                          ) : (
                                            <>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setEditingOption({ questionIndex, optionIndex })}
                                              >
                                                <Edit2 className="h-4 w-4 text-blue-600" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleRemoveOption(questionIndex, optionIndex)}
                                              >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                              </Button>
                                            </>
                                          )}
                                        </div>
                                      </TableCell>
                                    )}
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

