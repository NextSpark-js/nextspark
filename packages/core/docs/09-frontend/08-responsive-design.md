# Responsive Design

Responsive design ensures our application works beautifully across all devices and screen sizes. This guide covers our mobile-first responsive strategy using Tailwind CSS v4, from tiny mobile screens to ultra-wide desktop displays.

---

## 📋 Table of Contents

1. [Breakpoint Strategy](#breakpoint-strategy)
2. [Mobile-First Approach](#mobile-first-approach)
3. [Responsive Layout Patterns](#responsive-layout-patterns)
4. [Responsive Components](#responsive-components)
5. [Responsive Images and Media](#responsive-images-and-media)
6. [Responsive Typography](#responsive-typography)
7. [Container Queries](#container-queries)
8. [Testing Responsive Layouts](#testing-responsive-layouts)
9. [Best Practices](#best-practices)
10. [Common Pitfalls](#common-pitfalls)

---

## Breakpoint Strategy

### Tailwind CSS Default Breakpoints

Tailwind uses a mobile-first breakpoint system:

| Breakpoint | Min Width | Typical Devices |
|------------|-----------|-----------------|
| `sm` | 640px | Large phones, small tablets |
| `md` | 768px | Tablets |
| `lg` | 1024px | Laptops, desktops |
| `xl` | 1280px | Large desktops |
| `2xl` | 1536px | Extra large screens |

### Usage

```typescript
// Mobile-first: Start with mobile styles, add larger screen styles progressively
<div className="
  w-full              // Mobile: Full width
  sm:w-1/2            // Small screens: Half width
  md:w-1/3            // Medium screens: Third width
  lg:w-1/4            // Large screens: Quarter width
  xl:w-1/6            // Extra large: Sixth width
">
  Content
</div>
```

### Custom Breakpoints

```javascript
// tailwind.config.js (if needed)
export default {
  theme: {
    screens: {
      'xs': '475px',    // Extra small devices
      'sm': '640px',    // Small devices
      'md': '768px',    // Medium devices
      'lg': '1024px',   // Large devices
      'xl': '1280px',   // Extra large devices
      '2xl': '1536px',  // 2X extra large devices
      '3xl': '1920px',  // Ultra wide screens
    },
  },
}
```

---

## Mobile-First Approach

### Why Mobile-First?

✅ **Performance** - Smaller initial payload for mobile users
✅ **Progressive Enhancement** - Add complexity for larger screens
✅ **Simpler Code** - Fewer overrides and specificity issues
✅ **Mobile-Focused** - Most traffic comes from mobile devices

### Mobile-First Example

```typescript
// ✅ CORRECT - Mobile-first approach
function ProductCard({ product }: { product: Product }) {
  return (
    <div className="
      p-4              // Mobile: Padding 1rem
      sm:p-6           // Small screens: Padding 1.5rem
      lg:p-8           // Large screens: Padding 2rem
    ">
      <Image
        src={product.image}
        alt={product.name}
        className="
          w-full         // Mobile: Full width
          h-48           // Mobile: Fixed height
          sm:h-64        // Small screens: Taller
          lg:h-80        // Large screens: Even taller
          object-cover
        "
      />

      <h3 className="
        text-lg         // Mobile: 1.125rem
        sm:text-xl      // Small screens: 1.25rem
        lg:text-2xl     // Large screens: 1.5rem
        font-bold
        mt-4
      ">
        {product.name}
      </h3>

      <p className="
        text-sm         // Mobile: Small text
        sm:text-base    // Small screens: Normal text
        text-muted-foreground
        mt-2
      ">
        {product.description}
      </p>

      <Button className="
        w-full          // Mobile: Full width button
        sm:w-auto       // Small screens: Auto width
        mt-4
      ">
        Add to Cart
      </Button>
    </div>
  )
}

// ❌ WRONG - Desktop-first (requires more overrides)
<div className="p-8 sm:p-6 md:p-4">
  Content
</div>
```

---

## Responsive Layout Patterns

### Grid Layouts

```typescript
// Product grid - 1 column on mobile, 2 on tablet, 3 on desktop, 4 on large
function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="
      grid
      grid-cols-1        // Mobile: 1 column
      sm:grid-cols-2     // Small screens: 2 columns
      lg:grid-cols-3     // Large screens: 3 columns
      xl:grid-cols-4     // Extra large: 4 columns
      gap-4              // Mobile gap
      sm:gap-6           // Larger gap on bigger screens
      lg:gap-8
    ">
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}

// Sidebar layout - Stack on mobile, side-by-side on desktop
function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="
      flex
      flex-col           // Mobile: Stack vertically
      lg:flex-row        // Large screens: Side by side
      gap-6
    ">
      <aside className="
        w-full           // Mobile: Full width
        lg:w-64          // Large screens: Fixed width sidebar
        lg:sticky
        lg:top-4
        lg:h-[calc(100vh-2rem)]
      ">
        <Sidebar />
      </aside>

      <main className="
        flex-1           // Take remaining space
        min-w-0          // Prevent flex overflow
      ">
        {children}
      </main>
    </div>
  )
}
```

### Flexbox Patterns

```typescript
// Card with responsive flex direction
function FeatureCard({ feature }: { feature: Feature }) {
  return (
    <div className="
      flex
      flex-col           // Mobile: Stack vertically
      sm:flex-row        // Small screens: Horizontal
      gap-4
      p-6
      border
      rounded-lg
    ">
      <div className="
        shrink-0         // Prevent icon from shrinking
        w-12 h-12        // Mobile: Small icon
        sm:w-16 sm:h-16  // Larger on bigger screens
      ">
        <feature.Icon className="w-full h-full" />
      </div>

      <div className="flex-1">
        <h3 className="text-lg font-semibold">
          {feature.title}
        </h3>
        <p className="text-muted-foreground mt-2">
          {feature.description}
        </p>
      </div>
    </div>
  )
}

// Responsive navigation
function Navigation() {
  return (
    <nav className="
      flex
      flex-col           // Mobile: Vertical menu
      md:flex-row        // Medium screens: Horizontal menu
      gap-2
      md:gap-4
      items-start        // Mobile: Align start
      md:items-center    // Medium screens: Center items
    ">
      <Link href="/dashboard">Dashboard</Link>
      <Link href="/products">Products</Link>
      <Link href="/settings">Settings</Link>
    </nav>
  )
}
```

### Container Width Strategy

```typescript
// Responsive container widths
function PageContainer({ children }: { children: ReactNode }) {
  return (
    <div className="
      w-full
      px-4               // Mobile: Side padding
      sm:px-6
      lg:px-8
      mx-auto
      max-w-7xl          // Maximum width on large screens
    ">
      {children}
    </div>
  )
}

// Narrow content container (for reading)
function ArticleContainer({ children }: { children: ReactNode }) {
  return (
    <div className="
      w-full
      px-4
      mx-auto
      max-w-3xl          // Optimal reading width
    ">
      {children}
    </div>
  )
}
```

---

## Responsive Components

### Mobile Navigation Pattern

```typescript
'use client'

import { useState } from 'react'
import { MenuIcon, XIcon } from 'lucide-react'

function ResponsiveNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <nav className="border-b">
      {/* Desktop navigation - hidden on mobile */}
      <div className="
        hidden           // Hidden on mobile
        md:flex          // Visible on medium screens and up
        items-center
        justify-between
        px-6
        py-4
      ">
        <Logo />

        <div className="flex items-center gap-6">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/products">Products</Link>
          <Link href="/settings">Settings</Link>
        </div>

        <UserMenu />
      </div>

      {/* Mobile navigation */}
      <div className="md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Logo />

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <XIcon className="h-6 w-6" />
            ) : (
              <MenuIcon className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile menu panel */}
        {mobileMenuOpen && (
          <div className="border-t px-4 py-4">
            <div className="flex flex-col gap-4">
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/products">Products</Link>
              <Link href="/settings">Settings</Link>
              <Separator className="my-2" />
              <UserMenu />
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
```

### Responsive Data Tables

```typescript
// Desktop: Full table, Mobile: Card view
function ResponsiveTable({ data }: { data: User[] }) {
  return (
    <>
      {/* Desktop table view */}
      <div className="
        hidden           // Hidden on mobile
        md:block         // Visible on medium screens and up
      ">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map(user => (
              <TableRow key={user.id}>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.role}</TableCell>
                <TableCell>{user.status}</TableCell>
                <TableCell>
                  <Button size="sm">Edit</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card view */}
      <div className="
        md:hidden        // Hidden on medium screens and up
        space-y-4
      ">
        {data.map(user => (
          <Card key={user.id}>
            <CardContent className="p-4">
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{user.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p>{user.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Role</p>
                  <Badge>{user.role}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                    {user.status}
                  </Badge>
                </div>
                <Button size="sm" className="w-full mt-2">
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
```

### Responsive Modals

```typescript
function ResponsiveDialog({ children, ...props }: DialogProps) {
  return (
    <Dialog {...props}>
      <DialogContent className="
        w-full
        max-w-[calc(100%-2rem)]  // Mobile: Leave some margin
        sm:max-w-lg               // Desktop: Fixed max width
        max-h-[90vh]              // Don't exceed viewport height
        overflow-y-auto           // Scroll if content is too tall
      ">
        {children}
      </DialogContent>
    </Dialog>
  )
}
```

---

## Responsive Images and Media

### Responsive Images

```typescript
import Image from 'next/image'

// Responsive product image
function ProductImage({ product }: { product: Product }) {
  return (
    <div className="
      relative
      w-full
      h-48              // Mobile: Fixed height
      sm:h-64           // Tablet: Taller
      lg:h-80           // Desktop: Even taller
    ">
      <Image
        src={product.image}
        alt={product.name}
        fill
        className="object-cover rounded-lg"
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
      />
    </div>
  )
}

// Responsive hero image
function HeroImage() {
  return (
    <div className="
      relative
      w-full
      h-[300px]         // Mobile
      sm:h-[400px]      // Tablet
      lg:h-[500px]      // Desktop
      xl:h-[600px]      // Large desktop
    ">
      <Image
        src="/hero.jpg"
        alt="Hero image"
        fill
        priority
        className="object-cover"
        sizes="100vw"
      />
    </div>
  )
}
```

### Responsive Videos

```typescript
// Responsive aspect ratio container
function ResponsiveVideo({ videoUrl }: { videoUrl: string }) {
  return (
    <div className="
      relative
      w-full
      aspect-video      // Maintain 16:9 aspect ratio
    ">
      <iframe
        src={videoUrl}
        className="absolute inset-0 w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}
```

---

## Responsive Typography

### Responsive Font Sizes

```typescript
function TypographyExample() {
  return (
    <div>
      {/* Responsive headings */}
      <h1 className="
        text-3xl         // Mobile: 1.875rem
        sm:text-4xl      // Tablet: 2.25rem
        lg:text-5xl      // Desktop: 3rem
        xl:text-6xl      // Large: 3.75rem
        font-bold
      ">
        Page Title
      </h1>

      <h2 className="
        text-2xl         // Mobile: 1.5rem
        sm:text-3xl      // Tablet: 1.875rem
        lg:text-4xl      // Desktop: 2.25rem
        font-semibold
        mt-8
      ">
        Section Title
      </h2>

      <p className="
        text-base        // Mobile: 1rem
        sm:text-lg       // Tablet: 1.125rem
        leading-relaxed  // Better readability
        mt-4
      ">
        Body text that is easy to read on all devices.
      </p>
    </div>
  )
}
```

### Responsive Line Height and Letter Spacing

```typescript
<p className="
  text-sm            // Mobile: Smaller text
  sm:text-base       // Desktop: Normal text
  leading-relaxed    // Mobile: Comfortable line height
  sm:leading-loose   // Desktop: More breathing room
  tracking-wide      // Letter spacing
">
  Optimized for readability across all screen sizes.
</p>
```

---

## Container Queries

Container queries allow you to style elements based on their parent container's size, not the viewport.

### Basic Container Query

```typescript
// Define a container
function ProductCard({ product }: { product: Product }) {
  return (
    <div className="@container">  {/* Container query context */}
      <div className="
        p-4
        @md:p-6         // When container is >= md breakpoint
        @lg:p-8         // When container is >= lg breakpoint
      ">
        <Image
          src={product.image}
          alt={product.name}
          className="
            w-full
            h-32
            @md:h-48     // Taller when container allows
            @lg:h-64
            object-cover
          "
        />

        <h3 className="
          text-base
          @md:text-lg    // Larger text in wider containers
          @lg:text-xl
          font-bold
          mt-4
        ">
          {product.name}
        </h3>
      </div>
    </div>
  )
}
```

### Container Query in Grid

```typescript
function ResponsiveGrid({ products }: { products: Product[] }) {
  return (
    <div className="
      grid
      grid-cols-1
      sm:grid-cols-2
      lg:grid-cols-3
      gap-4
    ">
      {products.map(product => (
        // Each card adapts to its column width
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
```

---

## Testing Responsive Layouts

### Browser DevTools

```typescript
// Add data attributes for easier testing
function ResponsiveComponent() {
  return (
    <div
      data-testid="responsive-container"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
    >
      {/* Content */}
    </div>
  )
}
```

### Cypress Responsive Testing

```typescript
// cypress/e2e/responsive.cy.ts
describe('Responsive Layout', () => {
  const viewports = [
    { device: 'Mobile', width: 375, height: 667 },
    { device: 'Tablet', width: 768, height: 1024 },
    { device: 'Desktop', width: 1280, height: 720 },
  ]

  viewports.forEach(({ device, width, height }) => {
    describe(`${device} (${width}x${height})`, () => {
      beforeEach(() => {
        cy.viewport(width, height)
        cy.visit('/products')
      })

      it('should display correct number of columns', () => {
        cy.get('[data-testid="product-grid"]').then($grid => {
          const columns = getComputedStyle($grid[0])
            .getPropertyValue('grid-template-columns')
            .split(' ').length

          if (width < 640) {
            expect(columns).to.equal(1)  // Mobile: 1 column
          } else if (width < 1024) {
            expect(columns).to.equal(2)  // Tablet: 2 columns
          } else {
            expect(columns).to.equal(3)  // Desktop: 3 columns
          }
        })
      })

      it('should have readable text sizes', () => {
        cy.get('h1').should('be.visible')
        cy.get('p').should('have.css', 'font-size').and('satisfy', (size: string) => {
          const sizeNum = parseFloat(size)
          return sizeNum >= 14 && sizeNum <= 24  // Readable range
        })
      })

      it('should have touch-friendly targets on mobile', () => {
        if (width < 768) {
          cy.get('button').each($button => {
            const rect = $button[0].getBoundingClientRect()
            expect(rect.height).to.be.at.least(44)  // 44px minimum
            expect(rect.width).to.be.at.least(44)
          })
        }
      })
    })
  })
})
```

### Visual Regression Testing

```typescript
// cypress/e2e/visual-regression.cy.ts
describe('Visual Regression', () => {
  ['mobile', 'tablet', 'desktop'].forEach(viewport => {
    it(`should match ${viewport} snapshot`, () => {
      if (viewport === 'mobile') {
        cy.viewport(375, 667)
      } else if (viewport === 'tablet') {
        cy.viewport(768, 1024)
      } else {
        cy.viewport(1280, 720)
      }

      cy.visit('/dashboard')
      cy.matchImageSnapshot(`dashboard-${viewport}`)
    })
  })
})
```

---

## Best Practices

### 1. Use Mobile-First Approach

✅ **CORRECT**:
```typescript
<div className="w-full sm:w-1/2 lg:w-1/3">
  Content
</div>
```

❌ **WRONG**:
```typescript
<div className="w-1/3 lg:w-1/2 sm:w-full">
  Content
</div>
```

### 2. Test on Real Devices

- Use real mobile devices, not just browser emulation
- Test on both iOS and Android
- Check different screen sizes (small phones to tablets)

### 3. Consider Touch Targets

```typescript
// ✅ CORRECT - Minimum 44x44px touch targets
<button className="
  p-3              // Minimum padding for touch
  min-h-[44px]     // Minimum height
  min-w-[44px]     // Minimum width
">
  <Icon className="h-5 w-5" />
</button>

// ❌ WRONG - Too small for touch
<button className="p-1">
  <Icon className="h-3 w-3" />
</button>
```

### 4. Use Semantic Breakpoints

```typescript
// ✅ CORRECT - Breakpoints based on content needs
<div className="
  grid
  grid-cols-1       // Mobile: Single column for readability
  md:grid-cols-2    // Tablet: Two columns when space allows
  xl:grid-cols-3    // Large screens: Three columns
">

// ❌ WRONG - Arbitrary breakpoints
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
```

### 5. Optimize Images for Each Breakpoint

```typescript
// ✅ CORRECT - Responsive image with sizes
<Image
  src="/product.jpg"
  alt="Product"
  fill
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
  className="object-cover"
/>

// ❌ WRONG - Same image for all sizes
<Image
  src="/product-large.jpg"  // Always loads large image
  alt="Product"
  width={1200}
  height={800}
/>
```

### 6. Hide Content Responsibly

```typescript
// ✅ CORRECT - Use semantic hiding classes
<nav>
  {/* Desktop menu */}
  <div className="hidden md:flex gap-4">
    <Link href="/dashboard">Dashboard</Link>
    <Link href="/products">Products</Link>
  </div>

  {/* Mobile menu */}
  <div className="md:hidden">
    <MobileMenu />
  </div>
</nav>

// ❌ WRONG - Display none prevents screen readers
<div style={{ display: 'none' }}>
  Hidden content
</div>
```

---

## Common Pitfalls

### ❌ WRONG Patterns

```typescript
// 1. Fixed widths that break on small screens
<div className="w-[600px]">
  Content
</div>

// 2. Not testing on real devices
// Testing only in browser DevTools

// 3. Forgetting touch targets
<button className="p-1">
  <Icon className="h-3 w-3" />
</button>

// 4. Too many breakpoints
<div className="text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl 2xl:text-2xl">

// 5. Hardcoded heights
<div className="h-screen">
  Content
</div>

// 6. Not considering landscape mode
// Assuming portrait orientation only
```

### ✅ CORRECT Patterns

```typescript
// 1. Responsive widths
<div className="w-full max-w-2xl">
  Content
</div>

// 2. Test on real devices
// Use BrowserStack, actual phones, tablets

// 3. Proper touch targets
<button className="p-3 min-h-[44px] min-w-[44px]">
  <Icon className="h-5 w-5" />
</button>

// 4. Meaningful breakpoints
<div className="text-base lg:text-lg">
  Content
</div>

// 5. Dynamic heights
<div className="min-h-screen">
  Content
</div>

// 6. Handle all orientations
@media (orientation: landscape) {
  /* Landscape-specific styles */
}
```

---

## Related Documentation

- **[Component Architecture](./01-component-architecture.md)** - Component organization patterns
- **[Accessibility](./07-accessibility.md)** - Mobile accessibility considerations
- **[Performance Optimization](./09-performance-optimization.md)** - Image optimization

---

## Resources

### Tools

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Responsive Design Checker](https://responsivedesignchecker.com/)
- [BrowserStack](https://www.browserstack.com/) - Real device testing
- [Chrome DevTools Device Mode](https://developer.chrome.com/docs/devtools/device-mode/)

### Testing

- [Cypress Viewport Commands](https://docs.cypress.io/api/commands/viewport)
- [Playwright Device Emulation](https://playwright.dev/docs/emulation)
- [Percy](https://percy.io/) - Visual regression testing

### Guidelines

- [Material Design Responsive Layout](https://m2.material.io/design/layout/responsive-layout-grid.html)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Google Mobile-Friendly Test](https://search.google.com/test/mobile-friendly)
