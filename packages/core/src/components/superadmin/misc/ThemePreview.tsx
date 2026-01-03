"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';

import { Copy, Palette, Monitor, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/**
 * Theme Preview Component
 * 
 * Displays current theme colors, typography, and design tokens.
 * Shows both light and dark mode variations with copy functionality.
 */
export function ThemePreview() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-4 bg-muted rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded animate-pulse" />
                  <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Theme Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Theme Controls
          </CardTitle>
          <CardDescription>
            Switch between light and dark themes to preview color variations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Button
              variant={theme === 'light' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTheme('light')}
              className="flex items-center gap-2"
            >
              <Sun className="h-4 w-4" />
              Light
            </Button>
            <Button
              variant={theme === 'dark' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTheme('dark')}
              className="flex items-center gap-2"
            >
              <Moon className="h-4 w-4" />
              Dark
            </Button>
            <Button
              variant={theme === 'system' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTheme('system')}
              className="flex items-center gap-2"
            >
              <Monitor className="h-4 w-4" />
              System
            </Button>
            <Badge variant="outline" className="ml-auto">
              Current: {theme}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Color Palette */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Primary Colors */}
        <Card>
          <CardHeader>
            <CardTitle>Primary Colors</CardTitle>
            <CardDescription>Main brand colors and accent tones</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ColorSwatch
              name="Primary"
              description="Main brand color"
              cssVar="--primary"
              copyValue="var(--primary)"
            />
            <ColorSwatch
              name="Primary Foreground"
              description="Text on primary background"
              cssVar="--primary-foreground"
              copyValue="var(--primary-foreground)"
            />
            <ColorSwatch
              name="Secondary"
              description="Secondary brand color"
              cssVar="--secondary"
              copyValue="var(--secondary)"
            />
            <ColorSwatch
              name="Secondary Foreground"
              description="Text on secondary background"
              cssVar="--secondary-foreground"
              copyValue="var(--secondary-foreground)"
            />
          </CardContent>
        </Card>

        {/* Background Colors */}
        <Card>
          <CardHeader>
            <CardTitle>Background Colors</CardTitle>
            <CardDescription>Page and card background colors</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ColorSwatch
              name="Background"
              description="Main page background"
              cssVar="--background"
              copyValue="var(--background)"
            />
            <ColorSwatch
              name="Foreground"
              description="Main text color"
              cssVar="--foreground"
              copyValue="var(--foreground)"
            />
            <ColorSwatch
              name="Card"
              description="Card background"
              cssVar="--card"
              copyValue="var(--card)"
            />
            <ColorSwatch
              name="Card Foreground"
              description="Text on card background"
              cssVar="--card-foreground"
              copyValue="var(--card-foreground)"
            />
          </CardContent>
        </Card>

        {/* Interactive Colors */}
        <Card>
          <CardHeader>
            <CardTitle>Interactive Colors</CardTitle>
            <CardDescription>Buttons, links, and interactive elements</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ColorSwatch
              name="Accent"
              description="Accent color for highlights"
              cssVar="--accent"
              copyValue="var(--accent)"
            />
            <ColorSwatch
              name="Accent Foreground"
              description="Text on accent background"
              cssVar="--accent-foreground"
              copyValue="var(--accent-foreground)"
            />
            <ColorSwatch
              name="Muted"
              description="Subtle background color"
              cssVar="--muted"
              copyValue="var(--muted)"
            />
            <ColorSwatch
              name="Muted Foreground"
              description="Subtle text color"
              cssVar="--muted-foreground"
              copyValue="var(--muted-foreground)"
            />
          </CardContent>
        </Card>

        {/* Status Colors */}
        <Card>
          <CardHeader>
            <CardTitle>Status Colors</CardTitle>
            <CardDescription>Error, warning, and status indicators</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ColorSwatch
              name="Destructive"
              description="Error and danger states"
              cssVar="--destructive"
              copyValue="var(--destructive)"
            />
            <ColorSwatch
              name="Destructive Foreground"
              description="Text on destructive background"
              cssVar="--destructive-foreground"
              copyValue="var(--destructive-foreground)"
            />
            <ColorSwatch
              name="Border"
              description="Border color"
              cssVar="--border"
              copyValue="var(--border)"
            />
            <ColorSwatch
              name="Input"
              description="Input border color"
              cssVar="--input"
              copyValue="var(--input)"
            />
          </CardContent>
        </Card>
      </div>

      {/* Typography */}
      <Card>
        <CardHeader>
          <CardTitle>Typography</CardTitle>
          <CardDescription>Font families, sizes, and text styles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <h1 className="text-4xl font-bold">Heading 1</h1>
              <code className="text-xs text-muted-foreground">text-4xl font-bold</code>
            </div>
            <div>
              <h2 className="text-3xl font-bold">Heading 2</h2>
              <code className="text-xs text-muted-foreground">text-3xl font-bold</code>
            </div>
            <div>
              <h3 className="text-2xl font-bold">Heading 3</h3>
              <code className="text-xs text-muted-foreground">text-2xl font-bold</code>
            </div>
            <div>
              <h4 className="text-xl font-semibold">Heading 4</h4>
              <code className="text-xs text-muted-foreground">text-xl font-semibold</code>
            </div>
            <div>
              <p className="text-base">Body text - This is the default body text style used throughout the application.</p>
              <code className="text-xs text-muted-foreground">text-base</code>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Small text - Used for captions, help text, and secondary information.</p>
              <code className="text-xs text-muted-foreground">text-sm text-muted-foreground</code>
            </div>
            <div>
              <code className="text-xs bg-muted px-2 py-1 rounded">Code text - Monospace font for code snippets</code>
              <code className="text-xs text-muted-foreground block mt-1">text-xs bg-muted px-2 py-1 rounded</code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Border Radius */}
      <Card>
        <CardHeader>
          <CardTitle>Border Radius</CardTitle>
          <CardDescription>Border radius tokens and examples</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary mx-auto rounded-none mb-2"></div>
              <code className="text-xs">rounded-none</code>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary mx-auto rounded-sm mb-2"></div>
              <code className="text-xs">rounded-sm</code>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary mx-auto rounded mb-2"></div>
              <code className="text-xs">rounded</code>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary mx-auto rounded-lg mb-2"></div>
              <code className="text-xs">rounded-lg</code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface ColorSwatchProps {
  name: string;
  description: string;
  cssVar: string;
  copyValue: string;
}

function ColorSwatch({ name, description, cssVar, copyValue }: ColorSwatchProps) {
  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg">
      <div 
        className="w-10 h-10 rounded-md border"
        style={{ backgroundColor: `var(${cssVar})` }}
      />
      <div className="flex-1">
        <div className="font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
        <code className="text-xs text-muted-foreground">{cssVar}</code>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigator.clipboard.writeText(copyValue)}
        className="h-8 w-8 p-0"
      >
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}
