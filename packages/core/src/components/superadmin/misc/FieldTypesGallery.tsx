"use client"

import React, { useState } from 'react'
import { Card } from '../../ui/card'
import { Badge } from '../../ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs'
import { EntityFieldRenderer } from '../../entities/EntityFieldRenderer'
import { ArrayField } from '../../dashboard/block-editor/array-field'
import type { EntityField } from '../../../lib/entities/types'
import type { FieldDefinition } from '../../../types/blocks'

/**
 * Field Types Gallery Component
 * 
 * Displays all available entity field types with examples and variants
 */
export function FieldTypesGallery() {
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({})
  const [blockEditorValues, setBlockEditorValues] = useState<Record<string, unknown[]>>({
    repeater_items: [],
  })

  const updateFieldValue = (fieldName: string, value: unknown) => {
    setFieldValues(prev => ({ ...prev, [fieldName]: value }))
  }

  const updateBlockEditorValue = (fieldName: string, value: unknown[]) => {
    setBlockEditorValues(prev => ({ ...prev, [fieldName]: value }))
  }

  // Block Editor Array Field Example (for Data tab)
  const repeaterFieldExample: FieldDefinition = {
    name: 'repeater_items',
    type: 'array',
    label: 'Repeater Field',
    tab: 'content',
    helpText: 'Add, remove, and reorder items',
    minItems: 0,
    maxItems: 5,
    itemFields: [
      { name: 'title', type: 'text', label: 'Title', tab: 'content', placeholder: 'Item title', required: true },
      { name: 'description', type: 'textarea', label: 'Description', tab: 'content', placeholder: 'Item description...', rows: 2 },
      { name: 'url', type: 'url', label: 'Link', tab: 'content', placeholder: 'https://...' },
    ],
  }

  // Basic text fields
  const basicFields: EntityField[] = [
    {
      name: 'text_example',
      type: 'text',
      required: false,
      display: {
        label: 'Text Field',
        placeholder: 'Enter text...',
        description: 'Basic text input for short strings',
        showInForm: true,
        showInList: true,
        showInDetail: true,
        order: 1,
      },
      api: { searchable: true, sortable: true, readOnly: false },
    },
    {
      name: 'textarea_example',
      type: 'textarea',
      required: false,
      display: {
        label: 'Textarea Field',
        placeholder: 'Enter long text...',
        description: 'Multi-line text input for longer content',
        showInForm: true,
        showInList: false,
        showInDetail: true,
        order: 2,
      },
      api: { searchable: true, sortable: false, readOnly: false },
    },
    {
      name: 'email_example',
      type: 'email',
      required: false,
      display: {
        label: 'Email Field',
        placeholder: 'user@example.com',
        description: 'Email input with validation',
        showInForm: true,
        showInList: true,
        showInDetail: true,
        order: 3,
      },
      api: { searchable: true, sortable: true, readOnly: false },
    },
    {
      name: 'url_example',
      type: 'url',
      required: false,
      display: {
        label: 'URL Field',
        placeholder: 'https://example.com',
        description: 'URL input with validation',
        showInForm: true,
        showInList: true,
        showInDetail: true,
        order: 4,
      },
      api: { searchable: true, sortable: true, readOnly: false },
    },
    {
      name: 'phone_example',
      type: 'phone',
      required: false,
      display: {
        label: 'Phone Field',
        placeholder: 'Phone number',
        description: 'Phone input with country code support',
        showInForm: true,
        showInList: true,
        showInDetail: true,
        order: 5,
      },
      api: { searchable: true, sortable: true, readOnly: false },
    },
  ]

  // Number and data fields
  const dataFields: EntityField[] = [
    {
      name: 'number_example',
      type: 'number',
      required: false,
      display: {
        label: 'Number Field',
        placeholder: 'Enter number...',
        description: 'Numeric input field',
        showInForm: true,
        showInList: true,
        showInDetail: true,
        order: 1,
      },
      api: { searchable: false, sortable: true, readOnly: false },
    },
    {
      name: 'boolean_example',
      type: 'boolean',
      required: false,
      display: {
        label: 'Boolean Field',
        description: 'True/false toggle switch',
        showInForm: true,
        showInList: true,
        showInDetail: true,
        order: 2,
      },
      api: { searchable: false, sortable: true, readOnly: false },
    },
    {
      name: 'date_example',
      type: 'date',
      required: false,
      display: {
        label: 'Date Field',
        description: 'Date picker input',
        showInForm: true,
        showInList: true,
        showInDetail: true,
        order: 3,
      },
      api: { searchable: false, sortable: true, readOnly: false },
    },
    {
      name: 'datetime_example',
      type: 'datetime',
      required: false,
      display: {
        label: 'DateTime Field',
        description: 'Date and time picker input',
        showInForm: true,
        showInList: true,
        showInDetail: true,
        order: 4,
      },
      api: { searchable: false, sortable: true, readOnly: false },
    },
    {
      name: 'rating_example',
      type: 'rating',
      required: false,
      display: {
        label: 'Rating Field',
        description: 'Star rating selector',
        showInForm: true,
        showInList: true,
        showInDetail: true,
        order: 5,
      },
      api: { searchable: false, sortable: true, readOnly: false },
    },
    {
      name: 'range_example',
      type: 'range',
      required: false,
      display: {
        label: 'Range Field',
        description: 'Slider range selector',
        showInForm: true,
        showInList: true,
        showInDetail: true,
        order: 6,
      },
      api: { searchable: false, sortable: true, readOnly: false },
    },
    {
      name: 'doublerange_example',
      type: 'doublerange',
      required: false,
      display: {
        label: 'Double Range Field',
        description: 'Dual slider for value ranges',
        showInForm: true,
        showInList: true,
        showInDetail: true,
        order: 7,
      },
      api: { searchable: false, sortable: true, readOnly: false },
    },
  ]

  // Selection fields
  const selectionFields: EntityField[] = [
    {
      name: 'select_example',
      type: 'select',
      required: false,
      options: [
        { value: 'option1', label: 'Option 1' },
        { value: 'option2', label: 'Option 2' },
        { value: 'option3', label: 'Option 3' },
      ],
      display: {
        label: 'Select Field',
        placeholder: 'Choose an option...',
        description: 'Single selection dropdown',
        showInForm: true,
        showInList: true,
        showInDetail: true,
        order: 1,
      },
      api: { searchable: false, sortable: true, readOnly: false },
    },
    {
      name: 'multiselect_example',
      type: 'multiselect',
      required: false,
      options: [
        { value: 'tag1', label: 'Tag 1' },
        { value: 'tag2', label: 'Tag 2' },
        { value: 'tag3', label: 'Tag 3' },
        { value: 'tag4', label: 'Tag 4' },
      ],
      display: {
        label: 'MultiSelect Field',
        placeholder: 'Choose multiple options...',
        description: 'Multiple selection with badges',
        showInForm: true,
        showInList: true,
        showInDetail: true,
        order: 2,
      },
      api: { searchable: false, sortable: false, readOnly: false },
    },
    {
      name: 'radio_example',
      type: 'radio',
      required: false,
      options: [
        { value: 'small', label: 'Small' },
        { value: 'medium', label: 'Medium' },
        { value: 'large', label: 'Large' },
      ],
      display: {
        label: 'Radio Field',
        description: 'Radio button group selection',
        showInForm: true,
        showInList: true,
        showInDetail: true,
        order: 3,
      },
      api: { searchable: false, sortable: true, readOnly: false },
    },
    {
      name: 'buttongroup_example',
      type: 'buttongroup',
      required: false,
      options: [
        { value: 'edit', label: 'Edit' },
        { value: 'view', label: 'View' },
        { value: 'delete', label: 'Delete' },
      ],
      display: {
        label: 'Button Group Field',
        description: 'Button group selection (styled radio)',
        showInForm: true,
        showInList: true,
        showInDetail: true,
        order: 4,
      },
      api: { searchable: false, sortable: true, readOnly: false },
    },
    {
      name: 'combobox_example',
      type: 'combobox',
      required: false,
      options: [
        { value: 'react', label: 'React', description: 'JavaScript library' },
        { value: 'vue', label: 'Vue.js', description: 'Progressive framework' },
        { value: 'angular', label: 'Angular', description: 'TypeScript framework' },
        { value: 'svelte', label: 'Svelte', description: 'Compile-time framework' },
      ],
      display: {
        label: 'Combobox Field',
        placeholder: 'Search and select...',
        description: 'Searchable dropdown selection',
        showInForm: true,
        showInList: true,
        showInDetail: true,
        order: 5,
      },
      api: { searchable: false, sortable: true, readOnly: false },
    },
    {
      name: 'tags_example',
      type: 'tags',
      required: false,
      display: {
        label: 'Tags Field',
        placeholder: 'Add tags...',
        description: 'Dynamic tag input with creation',
        showInForm: true,
        showInList: true,
        showInDetail: true,
        order: 6,
      },
      api: { searchable: true, sortable: false, readOnly: false },
    },
  ]

  // Location & data selector fields
  const locationFields: EntityField[] = [
    {
      name: 'timezone_example',
      type: 'timezone',
      required: false,
      display: {
        label: 'Timezone Field',
        placeholder: 'Select timezone...',
        description: 'Timezone selector with search',
        showInForm: true,
        showInList: true,
        showInDetail: true,
        order: 1,
      },
      api: { searchable: false, sortable: true, readOnly: false },
    },
    {
      name: 'currency_example',
      type: 'currency',
      required: false,
      display: {
        label: 'Currency Field',
        placeholder: 'Select currency...',
        description: 'Currency code selector',
        showInForm: true,
        showInList: true,
        showInDetail: true,
        order: 2,
      },
      api: { searchable: false, sortable: true, readOnly: false },
    },
    {
      name: 'country_example',
      type: 'country',
      required: false,
      display: {
        label: 'Country Field',
        placeholder: 'Select country...',
        description: 'Country selector with search',
        showInForm: true,
        showInList: true,
        showInDetail: true,
        order: 3,
      },
      api: { searchable: false, sortable: true, readOnly: false },
    },
    {
      name: 'address_example',
      type: 'address',
      required: false,
      display: {
        label: 'Address Field',
        description: 'Complete address input form',
        showInForm: true,
        showInList: false,
        showInDetail: true,
        order: 4,
      },
      api: { searchable: true, sortable: false, readOnly: false },
    },
  ]

  // Media fields
  const mediaFields: EntityField[] = [
    {
      name: 'file_example',
      type: 'file',
      required: false,
      display: {
        label: 'File Upload',
        description: 'General file upload with drag & drop',
        showInForm: true,
        showInList: false,
        showInDetail: true,
        order: 1,
      },
      api: { searchable: false, sortable: false, readOnly: false },
    },
    {
      name: 'image_example',
      type: 'image',
      required: false,
      display: {
        label: 'Image Upload',
        description: 'Image upload with preview',
        showInForm: true,
        showInList: false,
        showInDetail: true,
        order: 2,
      },
      api: { searchable: false, sortable: false, readOnly: false },
    },
    {
      name: 'video_example',
      type: 'video',
      required: false,
      display: {
        label: 'Video Upload',
        description: 'Video file upload with thumbnail generation',
        showInForm: true,
        showInList: false,
        showInDetail: true,
        order: 3,
      },
      api: { searchable: false, sortable: false, readOnly: false },
    },
    {
      name: 'audio_example',
      type: 'audio',
      required: false,
      display: {
        label: 'Audio Upload',
        description: 'Audio file upload with player',
        showInForm: true,
        showInList: false,
        showInDetail: true,
        order: 4,
      },
      api: { searchable: false, sortable: false, readOnly: false },
    },
  ]

  // Advanced fields
  const advancedFields: EntityField[] = [
    {
      name: 'json_example',
      type: 'json',
      required: false,
      display: {
        label: 'JSON Field',
        placeholder: '{"key": "value"}',
        description: 'JSON data input with validation',
        showInForm: true,
        showInList: false,
        showInDetail: true,
        order: 1,
      },
      api: { searchable: false, sortable: false, readOnly: false },
    },
    {
      name: 'markdown_example',
      type: 'markdown',
      required: false,
      display: {
        label: 'Markdown Field',
        placeholder: '# Enter markdown...',
        description: 'Markdown text editor',
        showInForm: true,
        showInList: false,
        showInDetail: true,
        order: 2,
      },
      api: { searchable: true, sortable: false, readOnly: false },
    },
    {
      name: 'richtext_example',
      type: 'richtext',
      required: false,
      display: {
        label: 'Rich Text Field',
        placeholder: 'Enter rich text content...',
        description: 'WYSIWYG editor with formatting toolbar (Bold, Italic, Links, Lists)',
        showInForm: true,
        showInList: false,
        showInDetail: true,
        order: 3,
      },
      api: { searchable: true, sortable: false, readOnly: false },
    },
    {
      name: 'code_example',
      type: 'code',
      required: false,
      display: {
        label: 'Code Field',
        placeholder: 'console.log("Hello World");',
        description: 'Code editor with syntax highlighting',
        showInForm: true,
        showInList: false,
        showInDetail: true,
        order: 4,
      },
      api: { searchable: true, sortable: false, readOnly: false },
    },
    {
      name: 'relation_example',
      type: 'relation',
      required: false,
      relation: {
        entity: 'users',
        titleField: 'email',
      },
      display: {
        label: 'Relation Field',
        placeholder: 'Select related items...',
        description: 'Relationship to other entities',
        showInForm: true,
        showInList: true,
        showInDetail: true,
        order: 5,
      },
      api: { searchable: false, sortable: false, readOnly: false },
    },
    {
      name: 'user_example',
      type: 'user',
      required: false,
      display: {
        label: 'User Field',
        placeholder: 'Select users...',
        description: 'User selection with search',
        showInForm: true,
        showInList: true,
        showInDetail: true,
        order: 6,
      },
      api: { searchable: false, sortable: false, readOnly: false },
    },
  ]

  const renderFieldSection = (title: string, description: string, fields: EntityField[]) => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {fields.map((field) => (
          <Card key={field.name} className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{field.display.label}</h4>
                    <Badge variant="outline" className="text-xs">
                      {field.type}
                    </Badge>
                  </div>
                  {field.display.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {field.display.description}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <EntityFieldRenderer
                  field={field}
                  value={fieldValues[field.name]}
                  onChange={(value) => updateFieldValue(field.name, value)}
                  mode="form"
                />
              </div>

              {fieldValues[field.name] !== undefined && fieldValues[field.name] !== '' && (
                <div className="mt-3 p-2 bg-muted rounded text-xs">
                  <strong>Value:</strong> {JSON.stringify(fieldValues[field.name])}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-primary">28</div>
          <div className="text-sm text-muted-foreground">Field Types</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-600">100%</div>
          <div className="text-sm text-muted-foreground">Functional</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">6</div>
          <div className="text-sm text-muted-foreground">Categories</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">∞</div>
          <div className="text-sm text-muted-foreground">Combinations</div>
        </Card>
      </div>

      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
          <TabsTrigger value="selection">Selection</TabsTrigger>
          <TabsTrigger value="location">Location</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-6">
          {renderFieldSection(
            "Basic Text Fields",
            "Fundamental text input fields for forms and data entry",
            basicFields
          )}
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          {renderFieldSection(
            "Data Input Fields",
            "Fields for numbers, dates, booleans and specialized data types",
            dataFields
          )}

          {/* Repeater Field */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Repeater / Array Field</h3>
              <p className="text-sm text-muted-foreground">Dynamic list with add, remove, and reorder functionality</p>
            </div>
            <Card className="p-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{repeaterFieldExample.label}</h4>
                  <Badge variant="outline" className="text-xs">array</Badge>
                  <Badge variant="secondary" className="text-xs">0-5 items</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{repeaterFieldExample.helpText}</p>
                <ArrayField
                  field={repeaterFieldExample}
                  value={blockEditorValues.repeater_items || []}
                  onChange={(value) => updateBlockEditorValue('repeater_items', value)}
                />
                {blockEditorValues.repeater_items && blockEditorValues.repeater_items.length > 0 && (
                  <div className="mt-3 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                    <strong>Value:</strong>
                    <pre className="mt-1 whitespace-pre-wrap">
                      {JSON.stringify(blockEditorValues.repeater_items, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="selection" className="space-y-6">
          {renderFieldSection(
            "Selection Fields",
            "Various selection mechanisms including dropdowns, radio buttons, and multi-select",
            selectionFields
          )}
        </TabsContent>

        <TabsContent value="location" className="space-y-6">
          {renderFieldSection(
            "Location & Data Selectors",
            "Geographic and data-specific selectors with built-in validation",
            locationFields
          )}
        </TabsContent>

        <TabsContent value="media" className="space-y-6">
          {renderFieldSection(
            "Media Upload Fields",
            "File upload fields with preview and management capabilities",
            mediaFields
          )}
        </TabsContent>

        <TabsContent value="advanced" className="space-y-6">
          {renderFieldSection(
            "Advanced Fields",
            "Complex data types and relationship fields for advanced use cases",
            advancedFields
          )}
        </TabsContent>

      </Tabs>
    </div>
  )
}
