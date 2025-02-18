import { cn } from '~/lib/utils/cn'

import { Link } from './link'

export function Text({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'p'>) {
  return (
    <p
      data-slot="text"
      {...props}
      className={cn(
        'text-base/6 sm:text-sm/6',
        'text-zinc-600 dark:text-zinc-400',
        'transition-colors duration-200',
        className
      )}
    />
  )
}

export function TextLink({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Link>) {
  return (
    <Link
      {...props}
      className={cn(
        'text-zinc-900 dark:text-white',
        'underline decoration-zinc-400/50 dark:decoration-zinc-500/50',
        'hover:decoration-zinc-400 dark:hover:decoration-zinc-500',
        'transition-colors duration-200',
        className
      )}
    />
  )
}

export function Strong({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'strong'>) {
  return (
    <strong
      {...props}
      className={cn(
        'font-medium',
        'text-zinc-900 dark:text-white',
        'transition-colors duration-200',
        className
      )}
    />
  )
}

export function Code({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'code'>) {
  return (
    <code
      {...props}
      className={cn(
        'rounded-md',
        'border border-zinc-200 dark:border-zinc-800',
        'bg-zinc-100 dark:bg-zinc-900',
        'px-1.5 py-0.5',
        'text-sm font-medium sm:text-xs',
        'text-zinc-900 dark:text-white',
        'transition-colors duration-200',
        className
      )}
    />
  )
}
