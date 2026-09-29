"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@nextsparkjs/core/components/ui/card";
import { Button } from "@nextsparkjs/core/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@nextsparkjs/core/components/ui/tabs";
import { Badge } from "@nextsparkjs/core/components/ui/badge";
import { ArrowLeft, Palette, Package, Layers, BookOpen, Download, FormInput } from "lucide-react";
import Link from "next/link";
import { ComponentGallery } from "@nextsparkjs/core/components/superadmin/misc/ComponentGallery";
import { ThemePreview } from "@nextsparkjs/core/components/superadmin/misc/ThemePreview";
import { FieldTypesGallery } from "@nextsparkjs/core/components/superadmin/misc/FieldTypesGallery";
import { useState } from "react";

/**
 * Style Gallery Page - Developer Area
 *
 * Comprehensive design system showcase for developers.
 * Displays components, themes, and design tokens for reference and testing.
 */
export default function DevStylePage() {
  const [activeTab, setActiveTab] = useState("components");

  return (
    <div className="space-y-6" data-cy="devtools-style-page">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dev" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dev Area
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Style Gallery</h1>
          <p className="text-muted-foreground">
            Design system showcase and component library
          </p>
        </div>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export Tokens
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Components</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">30+</div>
            <p className="text-xs text-muted-foreground">
              Available UI components
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Color Tokens</CardTitle>
            <Palette className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">16</div>
            <p className="text-xs text-muted-foreground">
              Theme color variables
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Themes</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground">
              Light & dark modes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documentation</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">100%</div>
            <p className="text-xs text-muted-foreground">
              Component coverage
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="components" className="flex items-center gap-2" data-cy="devtools-style-tab-components">
            <Package className="h-4 w-4" />
            Components
          </TabsTrigger>
          <TabsTrigger value="field-types" className="flex items-center gap-2" data-cy="devtools-style-tab-field-types">
            <FormInput className="h-4 w-4" />
            Field Types
          </TabsTrigger>
          <TabsTrigger value="theme" className="flex items-center gap-2" data-cy="devtools-style-tab-theme">
            <Palette className="h-4 w-4" />
            Theme & Colors
          </TabsTrigger>
          <TabsTrigger value="guidelines" className="flex items-center gap-2" data-cy="devtools-style-tab-guidelines">
            <BookOpen className="h-4 w-4" />
            Guidelines
          </TabsTrigger>
        </TabsList>

        {/* Components Tab */}
        <TabsContent value="components" className="space-y-4" data-cy="devtools-style-component-gallery">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Component Library
              </CardTitle>
              <CardDescription>
                Complete showcase of all available UI components with different states and variations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ComponentGallery />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Field Types Tab */}
        <TabsContent value="field-types" className="space-y-4" data-cy="devtools-style-field-types">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FormInput className="h-5 w-5" />
                Entity Field Types
              </CardTitle>
              <CardDescription>
                Complete showcase of all entity field types with examples and variants for form development
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldTypesGallery />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Theme Tab */}
        <TabsContent value="theme" className="space-y-4" data-cy="devtools-style-theme-preview">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Theme System
              </CardTitle>
              <CardDescription>
                Color tokens, typography, and design system variables for both light and dark themes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ThemePreview />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Guidelines Tab */}
        <TabsContent value="guidelines" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Design Principles */}
            <Card>
              <CardHeader>
                <CardTitle>Design Principles</CardTitle>
                <CardDescription>Core principles guiding our design system</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium flex items-center gap-2">
                    <Badge variant="outline">1</Badge>
                    Consistency
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Maintain visual and functional consistency across all components
                  </p>
                </div>
                <div>
                  <h4 className="font-medium flex items-center gap-2">
                    <Badge variant="outline">2</Badge>
                    Accessibility
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ensure all components meet WCAG 2.1 AA standards
                  </p>
                </div>
                <div>
                  <h4 className="font-medium flex items-center gap-2">
                    <Badge variant="outline">3</Badge>
                    Scalability
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Design components that work at different scales and contexts
                  </p>
                </div>
                <div>
                  <h4 className="font-medium flex items-center gap-2">
                    <Badge variant="outline">4</Badge>
                    Performance
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Optimize for fast loading and smooth interactions
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Usage Guidelines */}
            <Card>
              <CardHeader>
                <CardTitle>Usage Guidelines</CardTitle>
                <CardDescription>How to effectively use this design system</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium">Color Usage</h4>
                  <p className="text-sm text-muted-foreground">
                    Use semantic color names (primary, secondary, destructive) rather than specific colors
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">Typography Scale</h4>
                  <p className="text-sm text-muted-foreground">
                    Follow the established type scale for consistent hierarchy
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">Spacing System</h4>
                  <p className="text-sm text-muted-foreground">
                    Use the 8px grid system for consistent spacing and alignment
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">Component Composition</h4>
                  <p className="text-sm text-muted-foreground">
                    Combine base components to create complex interfaces
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Technical Specs */}
            <Card>
              <CardHeader>
                <CardTitle>Technical Specifications</CardTitle>
                <CardDescription>Implementation details and requirements</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm font-medium">Framework</span>
                  <Badge variant="secondary">Next.js 14</Badge>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm font-medium">Styling</span>
                  <Badge variant="secondary">Tailwind CSS</Badge>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm font-medium">Components</span>
                  <Badge variant="secondary">Radix UI</Badge>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm font-medium">Icons</span>
                  <Badge variant="secondary">Lucide React</Badge>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm font-medium">Theme System</span>
                  <Badge variant="secondary">CSS Variables</Badge>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm font-medium">Build Tool</span>
                  <Badge variant="secondary">Turbo</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Resources */}
            <Card>
              <CardHeader>
                <CardTitle>Resources & Links</CardTitle>
                <CardDescription>Additional resources and documentation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href="https://ui.shadcn.com" target="_blank">
                    <BookOpen className="mr-2 h-4 w-4" />
                    Shadcn/ui Documentation
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href="https://tailwindcss.com" target="_blank">
                    <Layers className="mr-2 h-4 w-4" />
                    Tailwind CSS Docs
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href="https://www.radix-ui.com" target="_blank">
                    <Package className="mr-2 h-4 w-4" />
                    Radix UI Components
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href="https://lucide.dev" target="_blank">
                    <Palette className="mr-2 h-4 w-4" />
                    Lucide Icons
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
