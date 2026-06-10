"use client";
import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 rounded-lg shadow-sm active:scale-95",
          variant === "default" && "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-md",
          variant === "outline" && "border-2 border-input bg-background hover:bg-secondary hover:border-primary/50",
          variant === "ghost" && "hover:bg-secondary",
          variant === "destructive" && "bg-red-600 text-white hover:bg-red-700 hover:shadow-md",
          size === "default" && "h-10 px-5 py-2 text-sm",
          size === "sm" && "h-8 px-3 text-xs",
          size === "lg" && "h-12 px-7 text-base",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
