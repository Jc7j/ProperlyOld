import * as Headless from '@headlessui/react'
import type React from 'react'
import { Text } from '~/components/ui'
import { cn } from '~/lib/utils/cn'

const sizes = {
  xs: 'sm:max-w-xs',
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  '3xl': 'sm:max-w-3xl',
  '4xl': 'sm:max-w-4xl',
  '5xl': 'sm:max-w-5xl',
}

export function Dialog({
  size = 'lg',
  className,
  children,
  ...props
}: {
  size?: keyof typeof sizes
  className?: string
  children: React.ReactNode
} & Omit<Headless.DialogProps, 'as' | 'className'>) {
  return (
    <Headless.Dialog {...props}>
      <Headless.DialogBackdrop
        transition
        className={cn(
          'fixed inset-0 z-50',
          'flex w-screen justify-center overflow-y-auto',
          'bg-zinc-950/25 dark:bg-zinc-950/50',
          'px-4 py-4 sm:px-6 sm:py-8 md:px-8 md:py-12',
          'transition duration-200',
          'focus:outline-none',
          'data-closed:opacity-0 data-enter:ease-out data-leave:ease-in'
        )}
      />

      <div className="fixed inset-0 z-50 w-screen overflow-y-auto">
        <div className="grid min-h-full grid-rows-[1fr_auto] justify-items-center sm:grid-rows-[1fr_auto_3fr] sm:p-4">
          <Headless.DialogPanel
            transition
            className={cn(
              'row-start-2 w-full min-w-0',
              'rounded-t-2xl sm:rounded-2xl',
              'bg-white dark:bg-zinc-900',
              'p-6 sm:p-8',
              'shadow-lg',
              'ring-1 ring-zinc-950/10 dark:ring-white/10',
              'transition duration-200',
              'data-closed:translate-y-4 data-closed:opacity-0',
              'data-enter:ease-out data-leave:ease-in',
              'sm:data-closed:translate-y-0 sm:data-closed:scale-95',
              sizes[size],
              className
            )}
          >
            {children}
          </Headless.DialogPanel>
        </div>
      </div>
    </Headless.Dialog>
  )
}

export function DialogTitle({
  className,
  ...props
}: { className?: string } & Omit<
  Headless.DialogTitleProps,
  'as' | 'className'
>) {
  return (
    <Headless.DialogTitle
      {...props}
      className={cn(
        'text-lg/6 font-semibold sm:text-base/6',
        'text-zinc-900 dark:text-white',
        'text-balance',
        'transition-colors duration-200',
        className
      )}
    />
  )
}

export function DialogDescription({
  className,
  ...props
}: { className?: string } & Omit<
  Headless.DescriptionProps<typeof Text>,
  'as' | 'className'
>) {
  return (
    <Headless.Description
      as={Text}
      {...props}
      className={cn('mt-2 text-pretty', className)}
    />
  )
}

export function DialogBody({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={cn('mt-6', className)} />
}

export function DialogActions({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={cn(
        'mt-8',
        'flex flex-col-reverse sm:flex-row',
        'items-center justify-end',
        'gap-3',
        '*:w-full sm:*:w-auto',
        className
      )}
    />
  )
}
