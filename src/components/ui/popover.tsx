'use client'

import * as PopoverPrimitive from '@radix-ui/react-popover'
import * as React from 'react'
import { cn } from '~/lib/utils/cn'

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverAnchor = PopoverPrimitive.Anchor

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className
      )}
      onInteractOutside={(e) => {
        if (props.onInteractOutside) {
          props.onInteractOutside(e)
          return
        }

        const target = e.target as HTMLElement

        const isCalendarPopover = !!target.closest('.fixed.z-50.rounded-3xl')

        const isOtherRadixComponent = !!target.closest(
          '[data-state="open"]:not([data-radix-popover-content])'
        )

        const isInteractiveComponent =
          !!target.closest('[role="listbox"]') ||
          !!target.closest('[role="combobox"]') ||
          !!target.closest('[role="menu"]') ||
          !!target.closest('[role="dialog"]')

        if (
          isCalendarPopover ||
          isOtherRadixComponent ||
          isInteractiveComponent
        ) {
          e.preventDefault()
        }
      }}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
