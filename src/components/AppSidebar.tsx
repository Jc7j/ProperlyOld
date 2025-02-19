'use client'

import { useOrganization } from '@clerk/nextjs'
import { OrganizationProfile, UserButton } from '@clerk/nextjs'
import { Building2, Home, Package } from 'lucide-react'
import { usePathname } from 'next/navigation'
import React, { type ReactNode, useState } from 'react'
import {
  Button,
  Dialog,
  Navbar,
  NavbarLabel,
  NavbarSection,
  NavbarSpacer,
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarLayout,
  SidebarSection,
  ThemeToggle,
} from '~/components/ui'
import { ROUTES } from '~/lib/constants/routes'
import { cn } from '~/lib/utils/cn'

type NavigationItem = {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
  exact: boolean
}

// Add Organization Settings as a navigation item
const mainItems: NavigationItem[] = [
  {
    title: 'Home',
    url: ROUTES.DASHBOARD.HOME,
    icon: Home,
    exact: true,
  },
  {
    title: 'Properties',
    url: ROUTES.DASHBOARD.PROPERTIES,
    icon: Building2,
    exact: true,
  },
  {
    title: 'Supplies',
    url: ROUTES.DASHBOARD.SUPPLIES,
    icon: Package,
    exact: true,
  },
]

export function AppSidebar({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { organization } = useOrganization()
  const [showOrgSettings, setShowOrgSettings] = useState(false)

  const renderNavigationItems = (items: NavigationItem[]) => {
    return items.map((item) => {
      const isActive = item.exact
        ? pathname === item.url
        : pathname.startsWith(item.url)
      return (
        <SidebarItem
          key={item.url}
          href={item.url}
          current={isActive}
          className={cn(
            'rounded-xl transition-colors duration-200',
            isActive
              ? 'bg-(--primary-50) text-(--primary-900) dark:bg-(--primary-950)/50 dark:text-(--primary-300)'
              : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-white'
          )}
        >
          <item.icon
            className={cn(
              'h-4 w-4',
              isActive
                ? 'bg-(--primary-50) text-(--primary-900) dark:bg-(--primary-950)/50 dark:text-(--primary-300)'
                : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-white'
            )}
          />
          <SidebarLabel>{item.title}</SidebarLabel>
        </SidebarItem>
      )
    })
  }

  return (
    <>
      <SidebarLayout
        navbar={
          <Navbar>
            <NavbarSpacer />
            <NavbarSection>
              <ThemeToggle />
              <Button plain onClick={() => setShowOrgSettings(true)}>
                <NavbarLabel>{organization?.name ?? 'Loading...'}</NavbarLabel>
              </Button>
            </NavbarSection>
          </Navbar>
        }
        sidebar={
          <Sidebar>
            <SidebarHeader>
              <SidebarItem>
                <SidebarLabel>
                  <ThemeToggle />
                  <Button plain onClick={() => setShowOrgSettings(true)}>
                    {organization?.name ?? 'Loading...'}
                  </Button>
                </SidebarLabel>
              </SidebarItem>
            </SidebarHeader>

            <SidebarBody>
              <SidebarSection>
                {renderNavigationItems(mainItems)}
              </SidebarSection>
            </SidebarBody>

            <SidebarFooter>
              <SidebarItem>
                <UserButton
                  appearance={{
                    elements: {
                      rootBox: 'w-full',
                      userButtonBox: 'w-full',
                      userButtonTrigger: 'w-full',
                    },
                  }}
                  showName
                />
              </SidebarItem>
            </SidebarFooter>
          </Sidebar>
        }
      >
        {children}
      </SidebarLayout>

      {/* Organization Settings Dialog */}
      <Dialog
        open={showOrgSettings}
        onClose={() => setShowOrgSettings(false)}
        className="bg-transparent border-0 shadow-none border-none md:-ml-50"
      >
        <OrganizationProfile routing="hash" />
      </Dialog>
    </>
  )
}
