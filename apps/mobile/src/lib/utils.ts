import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge Tailwind CSS classes
 * Same pattern as shadcn/ui on web
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
