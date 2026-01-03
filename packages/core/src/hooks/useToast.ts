"use client"

import { toast } from "sonner"

export interface ToastProps {
  title?: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function useToast() {
  return {
    toast: ({
      title,
      description,
      action,
      ...props
    }: ToastProps & {
      variant?: "default" | "destructive" | "success" | "warning"
    } = {}) => {
      const { variant = "default", ...rest } = props

      switch (variant) {
        case "destructive":
          return toast.error(title || "Error", {
            description,
            action: action ? {
              label: action.label,
              onClick: action.onClick
            } : undefined,
            ...rest
          })
        case "success":
          return toast.success(title || "Success", {
            description,
            action: action ? {
              label: action.label,
              onClick: action.onClick
            } : undefined,
            ...rest
          })
        case "warning":
          return toast.warning(title || "Warning", {
            description,
            action: action ? {
              label: action.label,
              onClick: action.onClick
            } : undefined,
            ...rest
          })
        default:
          return toast(title || "Notification", {
            description,
            action: action ? {
              label: action.label,
              onClick: action.onClick
            } : undefined,
            ...rest
          })
      }
    },
    success: (title: string, description?: string) =>
      toast.success(title, { description }),
    error: (title: string, description?: string) =>
      toast.error(title, { description }),
    warning: (title: string, description?: string) =>
      toast.warning(title, { description }),
    info: (title: string, description?: string) =>
      toast.info(title, { description }),
    dismiss: toast.dismiss,
  }
}