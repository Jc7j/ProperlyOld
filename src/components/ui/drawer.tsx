'use client'

import * as Headless from '@headlessui/react'
import { X } from 'lucide-react'
import {
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useMediaQuery } from '~/lib/hooks/useMediaQuery'
import { cn } from '~/lib/utils/cn'

import { Button } from './button'

interface DrawerProps {
  open: boolean
  onClose: (value: boolean) => void
  children: ReactNode
  className?: string
  showBackdrop?: boolean
  closeOnOutsideClick?: boolean
  position?: 'left' | 'right' | 'bottom'
  fullWidth?: boolean
  snapPoints?: string[]
  draggable?: boolean
  onPositionChange?: (position: 'left' | 'right' | 'bottom') => void
  dragHandleClassName?: string
}

export function Drawer({
  open,
  onClose,
  children,
  className,
  showBackdrop = true,
  closeOnOutsideClick = true,
  position = 'right',
  fullWidth = false,
  snapPoints = ['25%', '80%', '95%'],
  draggable = false,
  onPositionChange,
  dragHandleClassName = 'drawer-drag-handle',
}: DrawerProps) {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [currentPosition, setCurrentPosition] = useState(position)
  const [currentSnapPoint, setCurrentSnapPoint] = useState(snapPoints[1])
  const [isDragging, setIsDragging] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef({
    y: 0,
    x: 0,
    startTop: 0,
    startLeft: 0,
    height: 0,
  })

  const allowPageInteraction = !showBackdrop && !closeOnOutsideClick

  // Update position based on mobile status
  useEffect(() => {
    const newPosition = isMobile ? 'bottom' : position
    setCurrentPosition(newPosition)
    if (onPositionChange) {
      onPositionChange(newPosition)
    }
  }, [isMobile, position, onPositionChange])

  // Ensure we're using the right snap point on mobile vs desktop
  useEffect(() => {
    // When switching to mobile, set to the default snap point (80%)
    if (isMobile) {
      setCurrentSnapPoint(snapPoints[1])
    }
  }, [isMobile, snapPoints])

  // Function to safely get drawer element properties
  const getDrawerRect = () => {
    if (!drawerRef.current) return null
    return drawerRef.current.getBoundingClientRect()
  }

  // Handle start of dragging
  const handleDragStart = (e: ReactMouseEvent | React.TouchEvent) => {
    // Only allow dragging from the handle area
    const target = e.target as HTMLElement
    const isHandle = target.closest(`.${dragHandleClassName}`)
    if (!isHandle) return

    e.preventDefault()
    setIsDragging(true)

    const rect = getDrawerRect()
    if (!rect) return

    if ('touches' in e && e.touches?.[0]) {
      dragStartRef.current = {
        y: e.touches[0].clientY,
        x: e.touches[0].clientX,
        startTop: rect.top,
        startLeft: rect.left,
        height: rect.height,
      }
    } else {
      const mouseEvent = e as ReactMouseEvent
      dragStartRef.current = {
        y: mouseEvent.clientY,
        x: mouseEvent.clientX,
        startTop: rect.top,
        startLeft: rect.left,
        height: rect.height,
      }
    }

    document.addEventListener('mousemove', handleDrag)
    document.addEventListener('touchmove', handleTouchDrag, { passive: false })
    document.addEventListener('mouseup', handleDragEnd)
    document.addEventListener('touchend', handleDragEnd)
  }

  // Handle mouse/touch drag movement
  const handleDrag = (e: MouseEvent) => {
    if (!isDragging || !drawerRef.current) return

    const deltaY = e.clientY - dragStartRef.current.y

    if (currentPosition === 'bottom') {
      // For bottom position, drag up/down
      const newTop = Math.max(0, dragStartRef.current.startTop + deltaY)
      const translateY = newTop - dragStartRef.current.startTop
      drawerRef.current.style.transform = `translateY(${translateY}px)`
    } else {
      // For side positions, handle horizontal dragging
      const deltaX = e.clientX - dragStartRef.current.x
      const translateX =
        currentPosition === 'left'
          ? Math.min(
              0,
              dragStartRef.current.startLeft +
                deltaX -
                dragStartRef.current.startLeft
            )
          : Math.max(
              0,
              dragStartRef.current.startLeft +
                deltaX -
                dragStartRef.current.startLeft
            )
      drawerRef.current.style.transform = `translateX(${translateX}px)`
    }
  }

  // Handle touch drag movement
  const handleTouchDrag = (e: TouchEvent) => {
    if (!isDragging || !drawerRef.current || !e.touches[0]) return

    e.preventDefault()

    const deltaY = e.touches[0].clientY - dragStartRef.current.y

    if (currentPosition === 'bottom') {
      // For bottom position, drag up/down
      const newTop = Math.max(0, dragStartRef.current.startTop + deltaY)
      const translateY = newTop - dragStartRef.current.startTop
      drawerRef.current.style.transform = `translateY(${translateY}px)`
    } else {
      // For side positions, handle horizontal dragging
      const deltaX = e.touches[0].clientX - dragStartRef.current.x
      const translateX =
        currentPosition === 'left'
          ? Math.min(
              0,
              dragStartRef.current.startLeft +
                deltaX -
                dragStartRef.current.startLeft
            )
          : Math.max(
              0,
              dragStartRef.current.startLeft +
                deltaX -
                dragStartRef.current.startLeft
            )
      drawerRef.current.style.transform = `translateX(${translateX}px)`
    }
  }

  // Handle end of drag
  const handleDragEnd = () => {
    if (!isDragging || !drawerRef.current) return

    setIsDragging(false)
    document.removeEventListener('mousemove', handleDrag)
    document.removeEventListener('touchmove', handleTouchDrag)
    document.removeEventListener('mouseup', handleDragEnd)
    document.removeEventListener('touchend', handleDragEnd)

    const rect = getDrawerRect()
    if (!rect) return

    if (currentPosition === 'bottom') {
      // Handle bottom drawer snap points or dismiss
      const draggedPercent =
        ((rect.top - dragStartRef.current.startTop) / window.innerHeight) * 100

      if (draggedPercent > 25) {
        // Dismiss the drawer if dragged down more than 25% of screen height
        drawerRef.current.style.transform = 'translateY(100%)'
        setTimeout(() => onClose(false), 200)
      } else {
        // Snap back to original position
        drawerRef.current.style.transform = 'translateY(0)'
      }
    } else {
      // Handle side drawer dismissal
      const draggedPercent =
        currentPosition === 'left'
          ? (-parseFloat(
              drawerRef.current.style.transform
                .replace('translateX(', '')
                .replace('px)', '')
            ) /
              rect.width) *
            100
          : (parseFloat(
              drawerRef.current.style.transform
                .replace('translateX(', '')
                .replace('px)', '')
            ) /
              rect.width) *
            100

      if (draggedPercent > 40) {
        // Dismiss if dragged more than 40% of drawer width
        const direction = currentPosition === 'left' ? -100 : 100
        drawerRef.current.style.transform = `translateX(${direction}%)`
        setTimeout(() => onClose(false), 200)
      } else {
        // Snap back
        drawerRef.current.style.transform = 'translateX(0)'
      }
    }
  }

  // Determine proper drawer size and positioning for different contexts
  const getDrawerStyles = () => {
    if (currentPosition === 'bottom') {
      return {
        maxWidth: '100%',
        width: '100%',
        height: currentSnapPoint,
        maxHeight: '95vh', // Ensure there's always some space at the top
        bottom: 0,
        left: 0,
        right: 0,
        top: 'auto',
        borderRadius: '1rem 1rem 0 0',
        boxShadow:
          '0 -10px 15px -3px rgba(0, 0, 0, 0.1), 0 -4px 6px -2px rgba(0, 0, 0, 0.05)',
        transformOrigin: 'bottom',
      }
    } else if (currentPosition === 'left') {
      return {
        height: '100vh',
        maxHeight: '100vh',
        width: fullWidth ? '100%' : '28rem',
        maxWidth: fullWidth ? '100%' : 'min(calc(100vw - 32px), 28rem)',
        top: 0,
        left: 0,
        right: 'auto',
        bottom: 0,
        transformOrigin: 'left',
      }
    } else {
      return {
        height: '100vh',
        maxHeight: '100vh',
        width: fullWidth ? '100%' : '28rem',
        maxWidth: fullWidth ? '100%' : 'min(calc(100vw - 32px), 28rem)',
        top: 0,
        right: 0,
        left: 'auto',
        bottom: 0,
        transformOrigin: 'right',
      }
    }
  }

  // Get transition styles for entrance/exit animations
  const getTransitionStyles = () => {
    if (currentPosition === 'bottom') {
      return {
        enter: 'transform transition ease-out duration-300',
        enterFrom: 'translate-y-full',
        enterTo: 'translate-y-0',
        leave: 'transform transition ease-in duration-200',
        leaveFrom: 'translate-y-0',
        leaveTo: 'translate-y-full',
      }
    } else if (currentPosition === 'left') {
      return {
        enter: 'transform transition ease-out duration-300',
        enterFrom: '-translate-x-full',
        enterTo: 'translate-x-0',
        leave: 'transform transition ease-in duration-200',
        leaveFrom: 'translate-x-0',
        leaveTo: '-translate-x-full',
      }
    } else {
      return {
        enter: 'transform transition ease-out duration-300',
        enterFrom: 'translate-x-full',
        enterTo: 'translate-x-0',
        leave: 'transform transition ease-in duration-200',
        leaveFrom: 'translate-x-0',
        leaveTo: 'translate-x-full',
      }
    }
  }

  // Desktop version for left/right positions
  const renderDesktopDrawer = () => {
    return (
      <Headless.Transition appear show={open} as="div">
        {showBackdrop && (
          <Headless.TransitionChild
            as="div"
            enter="transition-opacity ease-in-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-in-out duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-zinc-950/10 dark:bg-zinc-950/20" />
          </Headless.TransitionChild>
        )}

        <div
          className={cn(
            'fixed inset-0 overflow-hidden',
            allowPageInteraction && 'pointer-events-none'
          )}
        >
          <div
            className={cn(
              'absolute inset-0 overflow-hidden',
              allowPageInteraction && 'pointer-events-none'
            )}
          >
            {draggable ? (
              <Headless.DialogPanel
                ref={drawerRef}
                className={cn(
                  'fixed top-4 pointer-events-auto w-screen max-w-md',
                  'bg-white dark:bg-zinc-950',
                  'ring-1 ring-zinc-950/10 dark:ring-white/20',
                  'rounded-xl shadow-2xl',
                  isDragging && 'transition-none cursor-grabbing',
                  !isDragging && 'transition-all duration-150',
                  className
                )}
                style={{
                  right: currentPosition === 'right' ? '4px' : 'auto',
                  left: currentPosition === 'left' ? '4px' : 'auto',
                }}
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
              >
                {children}
              </Headless.DialogPanel>
            ) : (
              <div
                className={cn(
                  'pointer-events-none fixed inset-y-4 flex max-w-full',
                  currentPosition === 'left' ? 'left-4' : 'right-4'
                )}
              >
                <Headless.TransitionChild
                  as="div"
                  enter="transform transition ease-in-out duration-150"
                  enterFrom={
                    currentPosition === 'left'
                      ? 'translate-x-negative-full'
                      : 'translate-x-full'
                  }
                  enterTo="translate-x-0"
                  leave="transform transition ease-in-out duration-150"
                  leaveFrom="translate-x-0"
                  leaveTo={
                    currentPosition === 'left'
                      ? 'translate-x-negative-full'
                      : 'translate-x-full'
                  }
                >
                  <Headless.DialogPanel
                    className={cn(
                      'pointer-events-auto w-screen max-w-md transform',
                      'bg-white dark:bg-zinc-950',
                      'ring-1 ring-zinc-950/10 dark:ring-white/20',
                      'rounded-xl shadow-2xl',
                      className
                    )}
                  >
                    {children}
                  </Headless.DialogPanel>
                </Headless.TransitionChild>
              </div>
            )}
          </div>
        </div>
      </Headless.Transition>
    )
  }

  // Mobile version for bottom position
  const renderMobileDrawer = () => {
    return (
      <Headless.Transition appear show={open} as="div">
        {/* Backdrop */}
        {showBackdrop && (
          <Headless.TransitionChild
            as="div"
            enter="transition-opacity ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div
              className={cn('fixed inset-0', 'backdrop-blur-sm bg-black/30')}
            />
          </Headless.TransitionChild>
        )}

        {/* Drawer Content */}
        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <Headless.TransitionChild as="div" {...getTransitionStyles()}>
              <Headless.DialogPanel
                ref={drawerRef}
                className={cn(
                  'fixed overflow-hidden bg-white dark:bg-zinc-950',
                  'ring-1 ring-zinc-950/5 dark:ring-white/10',
                  'shadow-2xl transition-transform duration-300 ease-in-out',
                  isDragging && 'transition-none',
                  'rounded-t-xl',
                  'flex flex-col',
                  className
                )}
                style={getDrawerStyles()}
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
              >
                <DrawerDragHandle className={dragHandleClassName} />
                <div className="flex-1 overflow-y-auto">{children}</div>
              </Headless.DialogPanel>
            </Headless.TransitionChild>
          </div>
        </div>
      </Headless.Transition>
    )
  }

  return (
    <Headless.Dialog
      open={open}
      onClose={
        closeOnOutsideClick
          ? onClose
          : () => {
              /* No-op function to prevent auto-close when closeOnOutsideClick is false */
            }
      }
      className={cn(
        'relative z-50',
        allowPageInteraction && 'pointer-events-none'
      )}
    >
      {isMobile ? renderMobileDrawer() : renderDesktopDrawer()}
    </Headless.Dialog>
  )
}

export function DrawerHeader({
  title,
  description,
  onClose,
  action,
  className,
}: {
  title: string | ReactNode
  description?: string | ReactNode
  onClose: () => void
  action?: React.ReactNode
  className?: string
}) {
  const isMobile = useMediaQuery('(max-width: 768px)')

  if (isMobile) {
    return (
      <div className={cn('px-4 py-3 sm:px-6 sm:py-4', className)}>
        <div className="flex items-center justify-between">
          <Headless.DialogTitle className="text-base font-semibold text-gray-900 dark:text-gray-50">
            {title}
          </Headless.DialogTitle>
          <div className="ml-3 flex h-7 items-center gap-2">
            {action}
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <span className="sr-only">Close panel</span>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        {description && (
          <div className="mt-1">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {description}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn('bg-primary px-6 py-4 rounded-t-xl', className)}>
      <div className="flex items-center justify-between">
        <Headless.DialogTitle className="text-base font-semibold text-primary-foreground">
          {title}
        </Headless.DialogTitle>
        <div className="ml-3 flex h-7 items-center gap-2">
          {action}
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary/90"
          >
            <span className="sr-only">Close panel</span>
            <X className="h-6 w-6" />
          </Button>
        </div>
      </div>
      {description && (
        <div className="mt-1">
          <div className="text-sm text-primary-foreground/70">
            {description}
          </div>
        </div>
      )}
    </div>
  )
}

export function DrawerBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const isMobile = useMediaQuery('(max-width: 768px)')

  if (isMobile) {
    return (
      <div
        className={cn(
          'flex-1 overflow-y-auto px-4 py-2 sm:px-6 sm:py-4',
          className
        )}
      >
        {children}
      </div>
    )
  }

  return (
    <div className={cn('flex-1 overflow-y-auto', className)}>{children}</div>
  )
}

export function DrawerFooter({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const isMobile = useMediaQuery('(max-width: 768px)')

  if (isMobile) {
    return (
      <div
        className={cn(
          'flex shrink-0 justify-end gap-4 border-t border-zinc-200 dark:border-zinc-800 px-4 py-3 sm:px-6 sm:py-4',
          'bg-white dark:bg-zinc-950',
          className
        )}
      >
        {children}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex shrink-0 justify-end gap-4 border-t border-border px-6 py-4 rounded-b-xl',
        'bg-white dark:bg-zinc-950',
        className
      )}
    >
      {children}
    </div>
  )
}

export function DrawerDragHandle({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'drawer-drag-handle w-full flex justify-center py-2',
        className
      )}
    >
      <div className="h-1 w-12 rounded-full bg-zinc-200 dark:bg-zinc-700" />
    </div>
  )
}
