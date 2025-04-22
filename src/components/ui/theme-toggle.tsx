'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Button } from '~/components/ui'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  return (
    <Button
      variant="ghost"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="min-h-[36px] min-w-[36px] p-0 sm:min-h-[44px] sm:min-w-[44px]"
    >
      {resolvedTheme === 'dark' ? (
        <Sun className="h-[18px] w-[18px] text-amber-500 sm:h-5 sm:w-5 dark:text-amber-400" />
      ) : (
        <Moon className="h-[18px] w-[18px] text-zinc-700 sm:h-5 sm:w-5 dark:text-zinc-400" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
