import { cn } from '~/lib/utils/cn'

export type HeadingProps = {
  level?: 1 | 2 | 3 | 4 | 5 | 6
} & React.ComponentPropsWithoutRef<'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'>

const headingStyles = {
  1: 'text-2xl/tight font-semibold tracking-tight sm:text-3xl/tight',
  2: 'text-2xl/tight font-semibold tracking-tight sm:text-3xl/tight',
  3: 'text-xl/tight font-semibold tracking-tight sm:text-2xl/tight',
  4: 'text-lg/tight font-semibold sm:text-xl/tight',
  5: 'text-base/tight font-semibold sm:text-lg/tight',
  6: 'text-sm/tight font-semibold sm:text-base/tight',
}

export function Heading({ className, level = 1, ...props }: HeadingProps) {
  const Element: `h${typeof level}` = `h${level}`

  return (
    <Element
      {...props}
      className={cn(
        headingStyles[level],
        'text-zinc-900 dark:text-white',
        'transition-colors duration-200',
        className
      )}
    />
  )
}

export function Subheading({ className, level = 2, ...props }: HeadingProps) {
  const Element: `h${typeof level}` = `h${level}`

  return (
    <Element
      {...props}
      className={cn(
        'text-base/7 font-medium sm:text-sm/6',
        'text-zinc-500 dark:text-zinc-400',
        'transition-colors duration-200',
        className
      )}
    />
  )
}
