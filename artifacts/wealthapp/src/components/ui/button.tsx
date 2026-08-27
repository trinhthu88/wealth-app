import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green/30 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0" +
" hover-elevate active-elevate-2",
  {
    variants: {
      variant: {
        default:
           "bg-green text-paper border border-green hover:bg-forest-700",
        destructive:
           "bg-clay text-paper border border-clay hover:bg-clay-ink",
        outline:
           "border border-hairline-2 bg-surface text-forest hover:border-green hover:bg-green-tint",
        secondary:
           "border border-green-tint bg-green-tint text-forest hover:bg-mint/20",
         ghost: "border border-transparent text-ink-60 hover:bg-hairline/60 hover:text-forest",
         link: "text-green underline-offset-4 hover:text-forest hover:underline",
      },
      size: {
        // @replit changed sizes
         default: "min-h-11 px-5 py-2",
         sm: "min-h-9 px-4 text-xs",
         lg: "min-h-12 px-8",
         icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
