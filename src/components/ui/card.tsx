import { cn } from '~/lib/utils/cn'

export function Card({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl bg-white ring-1 ring-zinc-950/5 transition dark:bg-zinc-900 dark:ring-white/10',
        className
      )}
    >
      {children}
    </div>
  )
}
