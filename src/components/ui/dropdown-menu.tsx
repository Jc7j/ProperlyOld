'use client'

import * as Headless from '@headlessui/react'
import type React from 'react'
import { cn } from '~/lib/utils/cn'

import { Button } from './button'
import { Link } from './link'

export function Dropdown(props: Headless.MenuProps) {
  return <Headless.Menu {...props} />
}

export function DropdownButton<T extends React.ElementType = typeof Button>({
  as = Button,
  buttonColor = 'plain',
  ...props
}: { className?: string; buttonColor?: string } & Omit<
  Headless.MenuButtonProps<T>,
  'className'
>) {
  return <Headless.MenuButton color={buttonColor} as={as} {...props} />
}

export function DropdownMenu({
  anchor = 'bottom',
  className,
  ...props
}: { className?: string } & Omit<Headless.MenuItemsProps, 'as' | 'className'>) {
  return (
    <Headless.MenuItems
      {...props}
      transition
      anchor={anchor}
      className={cn(
        'z-50 min-w-[8rem] rounded-lg bg-white/95 p-1 shadow-lg dark:bg-zinc-800/95',
        'backdrop-blur-sm backdrop-saturate-150',
        'ring-1 ring-zinc-950/10 dark:ring-white/10',
        'animate-in fade-in zoom-in-95 duration-200',
        'data-closed:animate-out data-closed:fade-out data-closed:zoom-out-95 data-closed:duration-150',
        'data-[anchor=top]:slide-in-from-bottom-2',
        'data-[anchor=bottom]:slide-in-from-top-2',
        className
      )}
    />
  )
}

export function DropdownItem({
  className,
  ...props
}: { className?: string } & (
  | Omit<Headless.MenuItemProps<'button'>, 'as' | 'className'>
  | Omit<Headless.MenuItemProps<typeof Link>, 'as' | 'className'>
)) {
  const classes = cn(
    'relative flex w-full select-none items-center rounded-md px-2 py-1.5 text-sm outline-none',
    'text-zinc-700 dark:text-zinc-300',
    'transition-all duration-200',
    'hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-50',
    'focus:bg-zinc-100 focus:text-zinc-900 dark:focus:bg-zinc-700/50 dark:focus:text-zinc-50',
    'active:bg-zinc-200 dark:active:bg-zinc-700',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-zinc-500 [&>svg]:dark:text-zinc-400',
    '[&>svg]:transition-colors [&>svg]:duration-200',
    'hover:[&>svg]:text-zinc-900 dark:hover:[&>svg]:text-zinc-50',
    className
  )

  return 'href' in props ? (
    <Headless.MenuItem as={Link} {...props} className={classes} />
  ) : (
    <Headless.MenuItem
      as="button"
      type="button"
      {...props}
      className={classes}
    />
  )
}

export function DropdownHeader({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={cn(
        'px-2 py-1.5 text-sm font-semibold',
        'text-zinc-900 dark:text-zinc-50',
        className
      )}
    />
  )
}

export function DropdownSection({
  className,
  ...props
}: { className?: string } & Omit<
  Headless.MenuSectionProps,
  'as' | 'className'
>) {
  return <Headless.MenuSection {...props} className={cn('py-1', className)} />
}

export function DropdownHeading({
  className,
  ...props
}: { className?: string } & Omit<
  Headless.MenuHeadingProps,
  'as' | 'className'
>) {
  return (
    <Headless.MenuHeading
      {...props}
      className={cn(
        'px-2 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400',
        className
      )}
    />
  )
}

export function DropdownDivider({
  className,
  ...props
}: { className?: string } & Omit<
  Headless.MenuSeparatorProps,
  'as' | 'className'
>) {
  return (
    <Headless.MenuSeparator
      {...props}
      className={cn(
        'my-1 h-px',
        'bg-gradient-to-r from-zinc-200 via-zinc-200 to-transparent',
        'dark:from-zinc-700 dark:via-zinc-700',
        className
      )}
    />
  )
}

export function DropdownLabel({
  className,
  ...props
}: { className?: string } & Omit<Headless.LabelProps, 'as' | 'className'>) {
  return (
    <Headless.Label
      {...props}
      className={cn(
        'px-2 py-1.5 text-sm font-medium',
        'text-zinc-700 dark:text-zinc-300',
        'transition-colors duration-200',
        className
      )}
    />
  )
}

export function DropdownDescription({
  className,
  ...props
}: { className?: string } & Omit<
  Headless.DescriptionProps,
  'as' | 'className'
>) {
  return (
    <Headless.Description
      {...props}
      className={cn(
        'text-sm',
        'text-zinc-500 dark:text-zinc-400',
        'transition-colors duration-200',
        'group-hover:text-zinc-900 dark:group-hover:text-zinc-50',
        'group-focus:text-zinc-900 dark:group-focus:text-zinc-50',
        className
      )}
    />
  )
}

export function DropdownShortcut({
  keys,
  className,
  ...props
}: { keys: string | string[]; className?: string } & Omit<
  Headless.DescriptionProps<'kbd'>,
  'as' | 'className'
>) {
  return (
    <Headless.Description
      as="kbd"
      {...props}
      className={cn('ml-auto flex items-center gap-1', className)}
    >
      {(Array.isArray(keys) ? keys : keys.split('')).map((key, index) => (
        <kbd
          key={index}
          className={cn(
            'min-w-[1.25rem] rounded px-1 text-center text-xs',
            'bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400',
            'transition-colors duration-200',
            'group-hover:bg-zinc-200 group-hover:text-zinc-900',
            'dark:group-hover:bg-zinc-600 dark:group-hover:text-zinc-50',
            index > 0 && key.length > 1 && 'ml-1'
          )}
        >
          {key}
        </kbd>
      ))}
    </Headless.Description>
  )
}
