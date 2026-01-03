# User Guide

This guide is for content editors and marketers who want to create and manage pages using the Page Builder. No coding required!

## Getting Started

### Accessing the Page Builder

1. Log in to your dashboard
2. Click **Pages** in the sidebar navigation
3. You'll see a list of all your pages

### The Pages List

The pages list shows all your dynamic pages:

| Column | Description |
|--------|-------------|
| **Title** | Page name as it appears in the editor |
| **Slug** | URL path (e.g., `about-us` → `/about-us`) |
| **Status** | Draft or Published |
| **Created** | When the page was created |
| **Actions** | Edit, Delete buttons |

## Creating a New Page

### Step 1: Click "New Page"

Click the **+ New Page** button in the top right of the pages list.

### Step 2: Enter Page Details

Fill in the basic information:

- **Title**: The page name (shown in browser tab)
- **Slug**: The URL path (lowercase, hyphens only)
  - Example: `about-us` creates the URL `/about-us`

### Step 3: Start Editing

Click **Create** to open the page editor.

## The Page Editor

The editor has three panels:

```text
┌─────────────────────────────────────────────────────────────────┐
│                         TOP BAR                                  │
│  [← Back]  [Blocks]  Title  Slug  [Layout|Preview] [Save]       │
├──────────────┬───────────────────────────┬──────────────────────┤
│              │                           │                       │
│   BLOCKS     │        CANVAS             │      SETTINGS        │
│   PANEL      │                           │                       │
│              │   Where your page         │   Configure the      │
│   Choose     │   content appears         │   selected block     │
│   blocks to  │                           │                       │
│   add        │                           │                       │
│              │                           │                       │
└──────────────┴───────────────────────────┴──────────────────────┘
```

### Top Bar

- **← Back**: Return to pages list
- **Blocks Toggle**: Show/hide the blocks panel
- **Title**: Edit the page title
- **Slug**: Edit the URL path
- **Layout/Preview**: Toggle between editing modes
- **Save**: Save your changes (shows "Unsaved" indicator)
- **Publish**: Make the page live

## Adding Blocks

### Method 1: Click to Add

1. Find a block in the left panel
2. Click on it
3. The block is added to the end of your page

### Method 2: Drag and Drop

1. Find a block in the left panel
2. Drag it to the canvas
3. Drop it where you want it

### Available Blocks

| Block | Best For |
|-------|----------|
| **Hero** | Page headers with big headlines and images |
| **Features Grid** | Showcasing product features or benefits |
| **CTA Section** | Call-to-action with buttons |
| **Testimonials** | Customer quotes and reviews |
| **Text Content** | Regular paragraphs and content |

## Configuring Blocks

Click on any block to select it. The settings panel on the right shows three tabs:

### Content Tab

Edit the main content:
- **Title**: Section heading
- **Content**: Main text (supports formatting)
- **Call to Action**: Button text and link

### Design Tab

Customize appearance:
- **Background Color**: Choose from theme colors
- **Block-specific options**: Columns, image, etc.

### Advanced Tab

Technical settings:
- **CSS Class**: Add custom CSS classes
- **HTML ID**: For anchor links (e.g., `#features`)

## Working with Blocks

### Selecting a Block

**In Layout Mode**: Click the block card
**In Preview Mode**: Click anywhere on the block

### Reordering Blocks

**In Layout Mode**:
1. Grab the drag handle (⋮⋮) on a block
2. Drag up or down
3. Drop in the new position

**In Preview Mode**:
1. Select a block
2. Use the ↑ and ↓ buttons that appear

### Duplicating a Block

1. Select the block
2. Click the **Duplicate** button (or in the block card)
3. A copy appears below the original

### Removing a Block

1. Select the block
2. Click **Remove** in the settings panel
3. Or click the trash icon on the block card

## View Modes

### Layout Mode

- Blocks appear as cards
- Easy to drag and reorder
- Quick overview of page structure
- Best for: Organizing your page

### Preview Mode

- Shows how the page will actually look
- Blocks render with real styling
- Click blocks to edit them
- Best for: Checking your design

Toggle between modes using the **Layout | Preview** buttons in the top bar.

## The Settings Panel

When a block is selected, you'll see:

1. **Block Info**: Name and category
2. **Reset**: Clear all settings to defaults
3. **Remove**: Delete the block

### The Three Tabs

#### Content Tab
This is where you edit what your visitors see:
- Headlines and text
- Buttons and links
- Lists and features

#### Design Tab
Control how the block looks:
- Background colors
- Layout options (columns, alignment)
- Visual effects

#### Advanced Tab
For special cases:
- **CSS Class**: Add `my-special-section` to style with custom CSS
- **HTML ID**: Add `pricing` to link to it as `yoursite.com/page#pricing`

## Saving and Publishing

### Saving Changes

- Click **Save** anytime to save your progress
- The "Unsaved" badge shows when you have unsaved changes
- Saved pages aren't visible to the public yet

### Publishing

- Click **Publish** to make the page live
- Published pages show a green "Published" badge
- You can unpublish by toggling in the settings

### Viewing Your Page

Once published:
1. Look for the external link icon next to the slug
2. Click to open the public page in a new tab
3. Or visit `yoursite.com/{slug}` directly

## Tips and Best Practices

### Content Tips

1. **Start with a Hero**: Most pages benefit from a strong header
2. **Use Clear Headlines**: Keep titles short and descriptive
3. **Break Up Content**: Use multiple blocks instead of one long text block
4. **Add CTAs**: Include buttons that guide visitors to take action

### Design Tips

1. **Consistent Colors**: Stick to your theme colors
2. **Alternate Backgrounds**: Use different backgrounds to create visual sections
3. **Preview Often**: Switch to Preview mode to check your design

### SEO Tips

1. **Meaningful Slugs**: Use descriptive URLs like `/pricing` not `/page-1`
2. **Unique Titles**: Each page should have a unique title
3. **Fill SEO Fields**: Add meta description in page settings

## Common Tasks

### Creating a Landing Page

1. Add a **Hero** block with your main headline
2. Add a **Features Grid** to show benefits
3. Add **Testimonials** for social proof
4. End with a **CTA Section** to drive action

### Creating an About Page

1. Add a **Hero** with company name
2. Add **Text Content** for your story
3. Add **Features Grid** for team values
4. Add **CTA** to contact or join

### Creating a Contact Page

1. Add a **Hero** with "Get in Touch"
2. Add **Text Content** with contact info
3. Consider adding a contact form block (if available)

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + S` | Save page |
| `Delete` | Remove selected block |
| `Escape` | Deselect block |

## Getting Help

### Page Not Showing?

- Check that the page is **Published**
- Verify the slug doesn't conflict with other pages
- Wait a few minutes for cache to clear

### Block Not Working?

- Try refreshing the page
- Reset the block settings
- Remove and re-add the block

### Need More Help?

Contact your administrator or check the [Troubleshooting Guide](./09-troubleshooting.md).

---

> **Tip**: Start with the Preview mode to see your changes as you make them. It's the fastest way to build beautiful pages!

**Last Updated**: 2025-01-21
**Version**: 1.0.0
**Status**: Stable
