/**
 * Card Component - Web version
 * Compound component for content containers
 */
import * as React from "react";
import { cn } from "../utils";

// Card Root
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("rounded-xl border border-border bg-card p-4", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

// Pressable Card (for clickable cards)
export interface PressableCardProps extends React.HTMLAttributes<HTMLDivElement> {
  onClick?: () => void;
}

const PressableCard = React.forwardRef<HTMLDivElement, PressableCardProps>(
  ({ className, children, onClick, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.();
          }
        }}
        className={cn(
          "rounded-xl border border-border bg-card p-4 cursor-pointer transition-opacity hover:opacity-80 active:opacity-70",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

PressableCard.displayName = "PressableCard";

// Card Header
export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("mb-3", className)} {...props}>
        {children}
      </div>
    );
  }
);

CardHeader.displayName = "CardHeader";

// Card Title
export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <h3 ref={ref} className={cn("text-lg font-semibold", className)} {...props}>
        {children}
      </h3>
    );
  }
);

CardTitle.displayName = "CardTitle";

// Card Description
export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <p ref={ref} className={cn("mt-1 text-sm text-muted-foreground", className)} {...props}>
        {children}
      </p>
    );
  }
);

CardDescription.displayName = "CardDescription";

// Card Content
export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("", className)} {...props}>
        {children}
      </div>
    );
  }
);

CardContent.displayName = "CardContent";

// Card Footer
export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("mt-3 border-t border-border pt-3", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = "CardFooter";

export {
  Card,
  PressableCard,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
};
