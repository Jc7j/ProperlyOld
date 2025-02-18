import { cn } from '~/lib/utils/cn'

interface SpinnerProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function Spinner({ className, size = 'md' }: SpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  }

  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <svg
        className={cn(
          'animate-spin text-blue-600',
          sizeClasses[size],
          className
        )}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  )
}

// Usage example:
/*
// Default (medium) size
<Spinner />

// Small size
<Spinner size="sm" />

// Large size
<Spinner size="lg" />

// Custom color
<Spinner className="text-red-600" />

// Custom size and color
<Spinner size="lg" className="text-green-600" />
*/
