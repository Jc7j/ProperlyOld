'use client'

import * as Headless from '@headlessui/react'
import * as React from 'react'
import { cn } from '~/lib/utils/cn'

import { Button } from './button'
import { Heading, type HeadingProps } from './heading'

export function Popover(props: Headless.PopoverProps) {
  return <Headless.Popover {...props} />
}

export function PopoverTrigger<T extends React.ElementType = typeof Button>({
  as = Button,
  buttonColor = 'plain',
  className,
  ...props
}: {
  buttonColor?: string
  className?: string
} & Omit<Headless.PopoverButtonProps<T>, 'className'>) {
  return (
    <Headless.Popover.Button
      color={buttonColor}
      as={as}
      className={cn(
        'data-[open]:bg-accent data-[state=open]:bg-accent',
        className
      )}
      {...props}
    />
  )
}

export function PopoverContent({
  anchor = 'bottom',
  className,
  children,
  ...props
}: {
  anchor?: string
  className?: string
  children: React.ReactNode
} & Omit<Headless.PopoverPanelProps, 'as' | 'className'>) {
  return (
    <Headless.Popover.Panel
      {...props}
      transition
      anchor={anchor}
      className={cn(
        // Anchor positioning
        '[--anchor-gap:--spacing(2)] [--anchor-padding:--spacing(1)] data-[anchor~=end]:[--anchor-offset:6px] data-[anchor~=start]:[--anchor-offset:-6px] sm:data-[anchor~=end]:[--anchor-offset:4px] sm:data-[anchor~=start]:[--anchor-offset:-4px]',
        // Base styles
        'isolate w-max rounded-xl p-4',
        // Invisible border that is only visible in `forced-colors` mode for accessibility purposes
        'outline outline-transparent focus:outline-hidden',
        // Handle scrolling when menu won't fit in viewport
        'overflow-y-auto',
        // Popover background
        'bg-white/75 backdrop-blur-xl dark:bg-zinc-800/75',
        // Shadows
        'ring-1 shadow-lg ring-zinc-950/10 dark:ring-white/10 dark:ring-inset',
        // Transitions
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 transition duration-200',
        // Slide animations based on anchor
        'data-[anchor~=bottom]:slide-in-from-top-2 data-[anchor~=top]:slide-in-from-bottom-2 data-[anchor~=left]:slide-in-from-right-2 data-[anchor~=right]:slide-in-from-left-2',
        className
      )}
    >
      {children}
    </Headless.Popover.Panel>
  )
}

export function PopoverClose<T extends React.ElementType = typeof Button>({
  as = Button,
  className,
  ...props
}: { className?: string } & Omit<Headless.PopoverButtonProps<T>, 'className'>) {
  return (
    <Headless.Popover.Button
      as={as}
      className={cn(
        'ring-offset-background focus:ring-ring rounded-lg opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:pointer-events-none',
        className
      )}
      {...props}
    />
  )
}

export function PopoverDivider({
  className,
  ...props
}: { className?: string } & React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={cn(
        'mx-3.5 my-1 h-px border-0 bg-zinc-950/5 sm:mx-3 dark:bg-white/10 forced-colors:bg-[CanvasText]',
        className
      )}
    />
  )
}

export function PopoverHeader({
  className,
  level = 4,
  ...props
}: Omit<HeadingProps, 'className'> & {
  className?: string
}) {
  return (
    <div className="mb-2">
      <Heading
        level={level}
        {...props}
        className={cn(
          'text-base/6 font-medium text-zinc-950 sm:text-sm/6 dark:text-white',
          className
        )}
      />
    </div>
  )
}

const PopoverGroup = Headless.Popover.Group

export { PopoverGroup }
