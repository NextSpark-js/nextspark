"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from '../../lib/utils'
import { Cross2Icon } from "@radix-ui/react-icons"

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

/**
 * Registration channel between `SheetContent` and `SheetDescription`.
 *
 * Radix warns at runtime when a Dialog content has `aria-describedby` but no
 * matching `Description` element in the DOM. `SheetContent` renders a visually
 * hidden fallback description by default and drops it as soon as a real
 * `SheetDescription` registers itself, so consumers get an accessible Sheet
 * out of the box without duplicating descriptions when they do provide one.
 */
type UnregisterDescription = () => void
const SheetDescriptionContext = React.createContext<(() => UnregisterDescription) | null>(null)

// useLayoutEffect on the client so the fallback is swapped before paint;
// useEffect on the server where layout effects are a no-op.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect

/**
 * Close button: 44x44px hit area (WCAG 2.5.5 / platform tap-target minimum)
 * around a 16px glyph. `right-0.5 top-0.5` + `h-11 w-11` keeps the glyph at the
 * same visual spot as the previous `right-4 top-4` 16px button.
 */
const sheetCloseButtonClassName =
  "absolute right-0.5 top-0.5 inline-flex h-11 w-11 items-center justify-center rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent"

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  /**
   * Extra classes merged onto the built-in close button (position, size,
   * colors...). The default already meets the 44x44px touch target.
   */
  closeButtonClassName?: string
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, closeButtonClassName, children, ...props }, ref) => {
  const [hasDescription, setHasDescription] = React.useState(false)
  const descriptionCount = React.useRef(0)

  const registerDescription = React.useCallback((): UnregisterDescription => {
    descriptionCount.current += 1
    setHasDescription(true)
    return () => {
      descriptionCount.current -= 1
      if (descriptionCount.current === 0) setHasDescription(false)
    }
  }, [])

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        ref={ref}
        className={cn(sheetVariants({ side }), className)}
        {...props}
      >
        <SheetDescriptionContext.Provider value={registerDescription}>
          <SheetPrimitive.Close className={cn(sheetCloseButtonClassName, closeButtonClassName)}>
            <Cross2Icon className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
          {children}
          {/*
            Fallback description (see SheetDescriptionContext). Rendered after
            `children` so, during the single commit where both can coexist,
            the consumer's description wins the `aria-describedby` lookup.
          */}
          {!hasDescription && <SheetPrimitive.Description className="sr-only" />}
        </SheetDescriptionContext.Provider>
      </SheetPrimitive.Content>
    </SheetPortal>
  )
})
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => {
  const registerDescription = React.useContext(SheetDescriptionContext)

  // Tell the enclosing SheetContent a real description exists so it drops
  // its visually hidden fallback. No-op when used outside SheetContent.
  useIsomorphicLayoutEffect(() => registerDescription?.(), [registerDescription])

  return (
    <SheetPrimitive.Description
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
})
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
