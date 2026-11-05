"use client"

import { useTheme } from "../../providers/theme-provider"
import { Toaster as Sonner } from "sonner"
import { useCommonText } from "../../lib/i18n/common-text"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ containerAriaLabel, ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  // Sonner's own default is English; the root layout, whose messages carry no `common`, passes the label.
  const label = useCommonText("notifications", "title", "Notifications", containerAriaLabel)

  return (
    <Sonner
      containerAriaLabel={label}
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
