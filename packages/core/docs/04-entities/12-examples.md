# Complete Examples

This guide provides complete and functional examples of different entity types that you can use as reference or starting point.

## Example 1: Tasks (Real Entity from the Project)

The tasks entity is a complete example currently in production.

### Main Configuration

```typescript
// contents/themes/default/entities/tasks/tasks.config.ts
import { CheckSquare } from 'lucide-react'
import type { EntityConfig } from '@/core/lib/entities/types'
import { taskFields } from './tasks.fields'

export const taskEntityConfig: EntityConfig = {
  // 1. IDENTIFICATION
  slug: 'tasks',
  enabled: true,
  names: {
    singular: 'task',
    plural: 'Tasks'
  },
  icon: CheckSquare,
  
  // 2. ACCESS
  access: {
    public: false,      // Only authenticated
    api: true,          // External API available
    metadata: true,     // Supports metadata
    shared: false       // Each user sees their tasks
  },
  
  // 3. UI/UX
  ui: {
    dashboard: {
      showInMenu: true,
      showInTopbar: true,
      filters: [  // URL-synchronized filters
        { field: 'status', type: 'multiSelect' },
        { field: 'priority', type: 'multiSelect' }
      ]
    },
    public: {
      hasArchivePage: false,
      hasSinglePage: false
    },
    features: {
      searchable: true,
      sortable: true,
      filterable: true,  // Required for ui.dashboard.filters to work
      bulkOperations: true,
      importExport: false
    }
  },

  // 4. PERMISSIONS (centralized in permissions.config.ts)
  // See: config/permissions.config.ts → entities.tasks
  
  // 5. I18N
  i18n: {
    fallbackLocale: 'en',
    loaders: {
      es: () => import('./messages/es.json'),
      en: () => import('./messages/en.json')
    }
  },
  
  fields: taskFields
}
```

### Fields (tasks.fields.ts)

```typescript
import type { EntityField } from '@/core/lib/entities/types'

export const taskFields: EntityField[] = [
  {
    name: 'title',
    type: 'text',
    required: true,
    display: {
      label: 'Title',
      description: 'Task title or name',
      placeholder: 'Enter task title...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 1,
      columnWidth: 12
    },
    api: {
      readOnly: false,
      searchable: true,
      sortable: true
    }
  },
  {
    name: 'description',
    type: 'textarea',
    required: false,
    display: {
      label: 'Description',
      description: 'Detailed task description',
      placeholder: 'Enter task description...',
      showInList: false,
      showInDetail: true,
      showInForm: true,
      order: 2,
      columnWidth: 12
    },
    api: {
      readOnly: false,
      searchable: true,
      sortable: false
    }
  },
  {
    name: 'status',
    type: 'select',
    required: false,
    defaultValue: 'todo',
    options: [
      { value: 'todo', label: 'To Do' },
      { value: 'in-progress', label: 'In Progress' },
      { value: 'review', label: 'In Review' },
      { value: 'done', label: 'Done' },
      { value: 'blocked', label: 'Blocked' }
    ],
    display: {
      label: 'Status',
      description: 'Current task status',
      placeholder: 'Select status...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 3,
      columnWidth: 4
    },
    api: {
      readOnly: false,
      searchable: false,
      sortable: true
    }
  },
  {
    name: 'priority',
    type: 'select',
    required: false,
    defaultValue: 'medium',
    options: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
      { value: 'urgent', label: 'Urgent' }
    ],
    display: {
      label: 'Priority',
      description: 'Task priority level',
      placeholder: 'Select priority...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 4,
      columnWidth: 4
    },
    api: {
      readOnly: false,
      searchable: false,
      sortable: true
    }
  },
  {
    name: 'dueDate',
    type: 'date',
    required: false,
    display: {
      label: 'Due Date',
      description: 'Task due date',
      placeholder: 'Select date...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 5,
      columnWidth: 4
    },
    api: {
      readOnly: false,
      searchable: false,
      sortable: true
    }
  },
  {
    name: 'clientId',
    type: 'relation',
    required: true,
    relation: {
      entity: 'clients',
      titleField: 'name',
      userFiltered: true
    },
    display: {
      label: 'Client',
      description: 'Associated client',
      placeholder: 'Select client...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 6,
      columnWidth: 6
    },
    api: {
      readOnly: false,
      searchable: false,
      sortable: true
    }
  }
]
```

---

## Example 2: Blog Posts (Public)

Blog entity with public access.

```typescript
// blog-posts.config.ts
import { FileText } from 'lucide-react'
import type { EntityConfig } from '@/core/lib/entities/types'

export const blogPostConfig: EntityConfig = {
  slug: 'blog-posts',
  enabled: true,
  names: {
    singular: 'post',
    plural: 'Blog Posts'
  },
  icon: FileText,
  
  access: {
    public: true,       // Public access to read
    api: true,
    metadata: true,
    shared: true        // Everyone sees all posts
  },
  
  ui: {
    dashboard: {
      showInMenu: true,
      showInTopbar: true
    },
    public: {
      hasArchivePage: true,   // /blog
      hasSinglePage: true     // /blog/[slug]
    },
    features: {
      searchable: true,
      sortable: true,
      filterable: true,
      bulkOperations: true,
      importExport: false
    }
  },
  
  // Permissions defined in config/permissions.config.ts → entities.posts
  
  i18n: {
    fallbackLocale: 'en',
    loaders: {
      es: () => import('./messages/es.json'),
      en: () => import('./messages/en.json')
    }
  },
  
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      display: {
        label: 'Title',
        placeholder: 'Post title...',
        showInList: true,
        showInDetail: true,
        showInForm: true,
        order: 1,
        columnWidth: 12
      },
      api: {
        searchable: true,
        sortable: true,
        readOnly: false
      }
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      display: {
        label: 'URL Slug',
        placeholder: 'url-friendly-slug',
        showInList: false,
        showInDetail: true,
        showInForm: true,
        order: 2,
        columnWidth: 6
      },
      api: {
        searchable: false,
        sortable: false,
        readOnly: false
      }
    },
    {
      name: 'content',
      type: 'richtext',
      required: true,
      display: {
        label: 'Content',
        showInList: false,
        showInDetail: true,
        showInForm: true,
        order: 3,
        columnWidth: 12
      },
      api: {
        searchable: true,
        sortable: false,
        readOnly: false
      }
    },
    {
      name: 'featuredImage',
      type: 'image',
      required: false,
      display: {
        label: 'Featured Image',
        showInList: true,
        showInDetail: true,
        showInForm: true,
        order: 4,
        columnWidth: 12
      },
      api: {
        searchable: false,
        sortable: false,
        readOnly: false
      }
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { value: 'draft', label: 'Draft' },
        { value: 'published', label: 'Published' },
        { value: 'archived', label: 'Archived' }
      ],
      display: {
        label: 'Status',
        showInList: true,
        showInDetail: true,
        showInForm: true,
        order: 5,
        columnWidth: 6
      },
      api: {
        searchable: false,
        sortable: true,
        readOnly: false
      }
    },
    {
      name: 'publishedAt',
      type: 'datetime',
      required: false,
      display: {
        label: 'Published At',
        showInList: true,
        showInDetail: true,
        showInForm: true,
        order: 6,
        columnWidth: 6
      },
      api: {
        searchable: false,
        sortable: true,
        readOnly: false
      }
    },
    {
      name: 'categoryIds',
      type: 'relation-multi',
      required: false,
      relation: {
        entity: 'categories',
        titleField: 'name',
        userFiltered: false  // Global categories
      },
      display: {
        label: 'Categories',
        placeholder: 'Select categories...',
        showInList: true,
        showInDetail: true,
        showInForm: true,
        order: 7,
        columnWidth: 6
      },
      api: {
        searchable: false,
        sortable: false,
        readOnly: false
      }
    }
  ],
  
  childEntities: {
    'comments': {
      table: 'blog_post_comments',
      showInParentView: true,
      hasOwnRoutes: false,
      fields: [
        {
          name: 'content',
          type: 'textarea',
          required: true,
          display: {
            label: 'Comment'
          }
        },
        {
          name: 'authorName',
          type: 'text',
          required: true,
          display: {
            label: 'Author'
          }
        },
        {
          name: 'authorEmail',
          type: 'email',
          required: true,
          display: {
            label: 'Email'
          }
        }
      ],
      display: {
        title: 'Comments',
        description: 'Post comments',
        mode: 'list'
      }
    }
  }
}
```

---

## Example 3: E-commerce Orders

Order entity with items (child entity).

```typescript
// orders.config.ts
import { ShoppingCart } from 'lucide-react'

export const orderConfig: EntityConfig = {
  slug: 'orders',
  enabled: true,
  names: {
    singular: 'order',
    plural: 'Orders'
  },
  icon: ShoppingCart,
  
  access: {
    public: false,
    api: true,
    metadata: true,
    shared: false
  },
  
  ui: {
    dashboard: {
      showInMenu: true,
      showInTopbar: false
    },
    public: {
      hasArchivePage: false,
      hasSinglePage: false
    },
    features: {
      searchable: true,
      sortable: true,
      filterable: true,
      bulkOperations: false,
      importExport: true
    }
  },
  
  // Permissions defined in config/permissions.config.ts → entities.invoices
  
  i18n: {
    fallbackLocale: 'en',
    loaders: {
      es: () => import('./messages/es.json'),
      en: () => import('./messages/en.json')
    }
  },
  
  fields: [
    {
      name: 'orderNumber',
      type: 'text',
      required: true,
      display: {
        label: 'Order #',
        showInList: true,
        showInDetail: true,
        showInForm: false,  // Auto-generated
        order: 1,
        columnWidth: 4
      },
      api: {
        searchable: true,
        sortable: true,
        readOnly: true
      }
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { value: 'pending', label: 'Pending' },
        { value: 'processing', label: 'Processing' },
        { value: 'shipped', label: 'Shipped' },
        { value: 'delivered', label: 'Delivered' },
        { value: 'cancelled', label: 'Cancelled' }
      ],
      display: {
        label: 'Status',
        showInList: true,
        showInDetail: true,
        showInForm: true,
        order: 2,
        columnWidth: 4
      },
      api: {
        searchable: false,
        sortable: true,
        readOnly: false
      }
    },
    {
      name: 'subtotal',
      type: 'number',
      required: true,
      defaultValue: 0,
      display: {
        label: 'Subtotal',
        showInList: true,
        showInDetail: true,
        showInForm: false,  // Calculated
        order: 3,
        columnWidth: 3
      },
      api: {
        searchable: false,
        sortable: true,
        readOnly: true
      }
    },
    {
      name: 'tax',
      type: 'number',
      required: true,
      defaultValue: 0,
      display: {
        label: 'Tax',
        showInList: false,
        showInDetail: true,
        showInForm: false,
        order: 4,
        columnWidth: 3
      },
      api: {
        searchable: false,
        sortable: false,
        readOnly: true
      }
    },
    {
      name: 'total',
      type: 'number',
      required: true,
      defaultValue: 0,
      display: {
        label: 'Total',
        showInList: true,
        showInDetail: true,
        showInForm: false,
        order: 5,
        columnWidth: 3
      },
      api: {
        searchable: false,
        sortable: true,
        readOnly: true
      }
    }
  ],
  
  // Child entity: Order Items
  childEntities: {
    'items': {
      table: 'order_items',
      showInParentView: true,
      hasOwnRoutes: false,
      fields: [
        {
          name: 'productName',
          type: 'text',
          required: true,
          display: {
            label: 'Product'
          }
        },
        {
          name: 'quantity',
          type: 'number',
          required: true,
          defaultValue: 1,
          display: {
            label: 'Qty'
          }
        },
        {
          name: 'price',
          type: 'number',
          required: true,
          display: {
            label: 'Price'
          }
        },
        {
          name: 'subtotal',
          type: 'number',
          required: true,
          display: {
            label: 'Subtotal'
          }
        }
      ],
      display: {
        title: 'Order Items',
        description: 'Products in this order',
        mode: 'table'
      }
    }
  }
}
```

---

## Example 4: CRM Contacts (With Relations)

```typescript
// contacts.config.ts
import { Users } from 'lucide-react'

export const contactConfig: EntityConfig = {
  slug: 'contacts',
  enabled: true,
  names: {
    singular: 'contact',
    plural: 'Contacts'
  },
  icon: Users,
  
  access: {
    public: false,
    api: true,
    metadata: true,
    shared: false
  },
  
  ui: {
    dashboard: {
      showInMenu: true,
      showInTopbar: true
    },
    public: {
      hasArchivePage: false,
      hasSinglePage: false
    },
    features: {
      searchable: true,
      sortable: true,
      filterable: true,
      bulkOperations: true,
      importExport: true
    }
  },
  
  // Permissions defined in config/permissions.config.ts → entities.projects
  
  i18n: {
    fallbackLocale: 'en',
    loaders: {
      es: () => import('./messages/es.json'),
      en: () => import('./messages/en.json')
    }
  },
  
  fields: [
    {
      name: 'fullName',
      type: 'text',
      required: true,
      display: {
        label: 'Full Name',
        placeholder: 'John Doe',
        showInList: true,
        showInDetail: true,
        showInForm: true,
        order: 1,
        columnWidth: 6
      },
      api: {
        searchable: true,
        sortable: true,
        readOnly: false
      }
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      display: {
        label: 'Email',
        placeholder: 'john@example.com',
        showInList: true,
        showInDetail: true,
        showInForm: true,
        order: 2,
        columnWidth: 6
      },
      api: {
        searchable: true,
        sortable: true,
        readOnly: false
      }
    },
    {
      name: 'phone',
      type: 'phone',
      required: false,
      display: {
        label: 'Phone',
        placeholder: '+1 (555) 123-4567',
        showInList: true,
        showInDetail: true,
        showInForm: true,
        order: 3,
        columnWidth: 6
      },
      api: {
        searchable: true,
        sortable: false,
        readOnly: false
      }
    },
    {
      name: 'companyId',
      type: 'relation',
      required: false,
      relation: {
        entity: 'companies',
        titleField: 'name',
        userFiltered: true
      },
      display: {
        label: 'Company',
        placeholder: 'Select company...',
        showInList: true,
        showInDetail: true,
        showInForm: true,
        order: 4,
        columnWidth: 6
      },
      api: {
        searchable: false,
        sortable: true,
        readOnly: false
      }
    },
    {
      name: 'position',
      type: 'text',
      required: false,
      display: {
        label: 'Position',
        placeholder: 'CEO, Developer, etc.',
        showInList: true,
        showInDetail: true,
        showInForm: true,
        order: 5,
        columnWidth: 6
      },
      api: {
        searchable: true,
        sortable: false,
        readOnly: false
      }
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'lead',
      options: [
        { value: 'lead', label: 'Lead' },
        { value: 'prospect', label: 'Prospect' },
        { value: 'customer', label: 'Customer' },
        { value: 'inactive', label: 'Inactive' }
      ],
      display: {
        label: 'Status',
        showInList: true,
        showInDetail: true,
        showInForm: true,
        order: 6,
        columnWidth: 6
      },
      api: {
        searchable: false,
        sortable: true,
        readOnly: false
      }
    },
    {
      name: 'notes',
      type: 'textarea',
      required: false,
      display: {
        label: 'Notes',
        placeholder: 'Additional notes...',
        showInList: false,
        showInDetail: true,
        showInForm: true,
        order: 7,
        columnWidth: 12
      },
      api: {
        searchable: true,
        sortable: false,
        readOnly: false
      }
    }
  ]
}
```

---

## Pattern Summary

| Example | Type | Access | Child Entities | Relations | Metadata |
|---------|------|---------|----------------|-----------|----------|
| Tasks | Personal | Private | No | Yes (client) | Yes |
| Blog Posts | Content | Public | Yes (comments) | Yes (categories) | Yes |
| Orders | Transactional | Private | Yes (items) | No | Yes |
| Contacts | CRM | Private | No | Yes (company) | Yes |

## Next Steps

- **[Configuration Reference](./03-configuration-reference.md)** - Complete configuration reference
- **[Field Types](./04-field-types.md)** - All field types
- **[Testing](../12-testing/01-overview.md)** - Entity testing

---

> 💡 **Tip**: All these examples are based on real project patterns. The `tasks` entity in `contents/themes/default/entities/tasks/` is particularly complete and in production.
