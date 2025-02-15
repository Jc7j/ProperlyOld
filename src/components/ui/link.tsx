import type { Url } from 'next/dist/shared/lib/router/router'
import NextLink from 'next/link'
import { type ComponentPropsWithoutRef, forwardRef } from 'react'

export type LinkProps = ComponentPropsWithoutRef<typeof NextLink> & {
  href: Url
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { className, children, ...props },
  ref
) {
  return (
    <NextLink {...props} ref={ref} className={className}>
      {children}
    </NextLink>
  )
})
