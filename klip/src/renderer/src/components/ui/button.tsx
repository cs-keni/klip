import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 font-medium transition-all duration-100',
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]',
    'disabled:pointer-events-none disabled:opacity-40',
    'active:scale-[0.96]'
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          'bg-[var(--accent)] text-white hover:bg-[var(--accent-light)] shadow-sm',
        secondary:
          'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--bg-overlay)] hover:border-[var(--border-strong)]',
        ghost:
          'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
        destructive:
          'bg-[var(--destructive)] text-white hover:opacity-90',
        outline:
          'border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
      },
      size: {
        sm: 'h-7 px-2.5 text-xs rounded',
        md: 'h-8 px-3 text-sm rounded',
        lg: 'h-10 px-4 text-sm rounded-md',
        icon: 'h-8 w-8 rounded',
        'icon-sm': 'h-7 w-7 rounded'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md'
    }
  }
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
)
Button.displayName = 'Button'

export { Button, buttonVariants }
