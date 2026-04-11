import { cn } from '@/lib/utils'

interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical'
  className?: string
}

export function Separator({
  orientation = 'horizontal',
  className
}: SeparatorProps): JSX.Element {
  return (
    <div
      role="separator"
      className={cn(
        'bg-[var(--border-subtle)] shrink-0',
        orientation === 'horizontal' ? 'h-[1px] w-full' : 'w-[1px] h-full',
        className
      )}
    />
  )
}
