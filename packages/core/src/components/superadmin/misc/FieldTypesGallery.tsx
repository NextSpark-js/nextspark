"use client"

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('superadmin.gallery.fieldTypes')
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
    label: t('repeater.label'),
    tab: 'content',
    helpText: t('repeater.help'),
    minItems: 0,
    maxItems: 5,
    itemFields: [
      { name: 'title', type: 'text', label: t('repeater.itemTitle'), tab: 'content', placeholder: t('repeater.itemTitlePlaceholder'), required: true },
      { name: 'description', type: 'textarea', label: t('repeater.itemDescription'), tab: 'content', placeholder: t('repeater.itemDescriptionPlaceholder'), rows: 2 },
      { name: 'url', type: 'url', label: t('repeater.itemLink'), tab: 'content', placeholder: 'https://...' },
    ],
  }

  // Basic text fields
  const basicFields: EntityField[] = [
    {
      name: 'text_example',
      type: 'text',
      required: false,
      display: {
        label: t('fields.text.label'),
        placeholder: t('fields.text.placeholder'),
        description: t('fields.text.description'),
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
        label: t('fields.textarea.label'),
        placeholder: t('fields.textarea.placeholder'),
        description: t('fields.textarea.description'),
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
        label: t('fields.email.label'),
        placeholder: 'user@example.com',
        description: t('fields.email.description'),
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
        label: t('fields.url.label'),
        placeholder: 'https://example.com',
        description: t('fields.url.description'),
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
        label: t('fields.phone.label'),
        placeholder: t('fields.phone.placeholder'),
        description: t('fields.phone.description'),
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
        label: t('fields.number.label'),
        placeholder: t('fields.number.placeholder'),
        description: t('fields.number.description'),
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
        label: t('fields.boolean.label'),
        description: t('fields.boolean.description'),
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
        label: t('fields.date.label'),
        description: t('fields.date.description'),
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
        label: t('fields.datetime.label'),
        description: t('fields.datetime.description'),
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
        label: t('fields.rating.label'),
        description: t('fields.rating.description'),
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
        label: t('fields.range.label'),
        description: t('fields.range.description'),
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
        label: t('fields.doublerange.label'),
        description: t('fields.doublerange.description'),
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
        { value: 'option1', label: t('options.option1') },
        { value: 'option2', label: t('options.option2') },
        { value: 'option3', label: t('options.option3') },
      ],
      display: {
        label: t('fields.select.label'),
        placeholder: t('fields.select.placeholder'),
        description: t('fields.select.description'),
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
        { value: 'tag1', label: t('options.tag1') },
        { value: 'tag2', label: t('options.tag2') },
        { value: 'tag3', label: t('options.tag3') },
        { value: 'tag4', label: t('options.tag4') },
      ],
      display: {
        label: t('fields.multiselect.label'),
        placeholder: t('fields.multiselect.placeholder'),
        description: t('fields.multiselect.description'),
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
        { value: 'small', label: t('options.small') },
        { value: 'medium', label: t('options.medium') },
        { value: 'large', label: t('options.large') },
      ],
      display: {
        label: t('fields.radio.label'),
        description: t('fields.radio.description'),
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
        { value: 'edit', label: t('options.edit') },
        { value: 'view', label: t('options.view') },
        { value: 'delete', label: t('options.delete') },
      ],
      display: {
        label: t('fields.buttongroup.label'),
        description: t('fields.buttongroup.description'),
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
        { value: 'react', label: 'React', description: t('options.react') },
        { value: 'vue', label: 'Vue.js', description: t('options.vue') },
        { value: 'angular', label: 'Angular', description: t('options.angular') },
        { value: 'svelte', label: 'Svelte', description: t('options.svelte') },
      ],
      display: {
        label: t('fields.combobox.label'),
        placeholder: t('fields.combobox.placeholder'),
        description: t('fields.combobox.description'),
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
        label: t('fields.tags.label'),
        placeholder: t('fields.tags.placeholder'),
        description: t('fields.tags.description'),
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
        label: t('fields.timezone.label'),
        placeholder: t('fields.timezone.placeholder'),
        description: t('fields.timezone.description'),
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
        label: t('fields.currency.label'),
        placeholder: t('fields.currency.placeholder'),
        description: t('fields.currency.description'),
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
        label: t('fields.country.label'),
        placeholder: t('fields.country.placeholder'),
        description: t('fields.country.description'),
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
        label: t('fields.address.label'),
        description: t('fields.address.description'),
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
        label: t('fields.file.label'),
        description: t('fields.file.description'),
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
        label: t('fields.image.label'),
        description: t('fields.image.description'),
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
        label: t('fields.video.label'),
        description: t('fields.video.description'),
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
        label: t('fields.audio.label'),
        description: t('fields.audio.description'),
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
        label: t('fields.json.label'),
        placeholder: '{"key": "value"}',
        description: t('fields.json.description'),
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
        label: t('fields.markdown.label'),
        placeholder: t('fields.markdown.placeholder'),
        description: t('fields.markdown.description'),
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
        label: t('fields.richtext.label'),
        placeholder: t('fields.richtext.placeholder'),
        description: t('fields.richtext.description'),
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
        label: t('fields.code.label'),
        placeholder: 'console.log("Hello World");',
        description: t('fields.code.description'),
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
        label: t('fields.relation.label'),
        placeholder: t('fields.relation.placeholder'),
        description: t('fields.relation.description'),
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
        label: t('fields.user.label'),
        placeholder: t('fields.user.placeholder'),
        description: t('fields.user.description'),
        showInForm: true,
        showInList: true,
        showInDetail: true,
        order: 6,
      },
      api: { searchable: false, sortable: false, readOnly: false },
    },
  ]

  // `demo` renders the fields disabled: the upload fields would otherwise upload for real (and the devtools group has no media messages)
  const renderFieldSection = (title: string, description: string, fields: EntityField[], demo = false) => (
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
                  disabled={demo}
                />
              </div>

              {fieldValues[field.name] !== undefined && fieldValues[field.name] !== '' && (
                <div className="mt-3 p-2 bg-muted rounded text-xs">
                  <strong>{t('value')}</strong> {JSON.stringify(fieldValues[field.name])}
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
          <div className="text-sm text-muted-foreground">{t('stats.fieldTypes')}</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-600">100%</div>
          <div className="text-sm text-muted-foreground">{t('stats.functional')}</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">6</div>
          <div className="text-sm text-muted-foreground">{t('stats.categories')}</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">∞</div>
          <div className="text-sm text-muted-foreground">{t('stats.combinations')}</div>
        </Card>
      </div>

      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="basic">{t('tabs.basic')}</TabsTrigger>
          <TabsTrigger value="data">{t('tabs.data')}</TabsTrigger>
          <TabsTrigger value="selection">{t('tabs.selection')}</TabsTrigger>
          <TabsTrigger value="location">{t('tabs.location')}</TabsTrigger>
          <TabsTrigger value="media">{t('tabs.media')}</TabsTrigger>
          <TabsTrigger value="advanced">{t('tabs.advanced')}</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-6">
          {renderFieldSection(
            t('sections.basic.title'),
            t('sections.basic.description'),
            basicFields
          )}
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          {renderFieldSection(
            t('sections.data.title'),
            t('sections.data.description'),
            dataFields
          )}

          {/* Repeater Field */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{t('repeater.title')}</h3>
              <p className="text-sm text-muted-foreground">{t('repeater.description')}</p>
            </div>
            <Card className="p-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{repeaterFieldExample.label}</h4>
                  <Badge variant="outline" className="text-xs">array</Badge>
                  <Badge variant="secondary" className="text-xs">{t('repeater.items', { min: 0, max: 5 })}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{repeaterFieldExample.helpText}</p>
                <ArrayField
                  field={repeaterFieldExample}
                  value={blockEditorValues.repeater_items || []}
                  onChange={(value) => updateBlockEditorValue('repeater_items', value)}
                />
                {blockEditorValues.repeater_items && blockEditorValues.repeater_items.length > 0 && (
                  <div className="mt-3 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                    <strong>{t('value')}</strong>
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
            t('sections.selection.title'),
            t('sections.selection.description'),
            selectionFields
          )}
        </TabsContent>

        <TabsContent value="location" className="space-y-6">
          {renderFieldSection(
            t('sections.location.title'),
            t('sections.location.description'),
            locationFields
          )}
        </TabsContent>

        <TabsContent value="media" className="space-y-6">
          {renderFieldSection(
            t('sections.media.title'),
            t('sections.media.description'),
            mediaFields,
            true
          )}
        </TabsContent>

        <TabsContent value="advanced" className="space-y-6">
          {renderFieldSection(
            t('sections.advanced.title'),
            t('sections.advanced.description'),
            advancedFields
          )}
        </TabsContent>

      </Tabs>
    </div>
  )
}
