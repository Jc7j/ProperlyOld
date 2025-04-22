'use client'

import { useOrganization } from '@clerk/nextjs'
import { OrganizationProfile, UserButton } from '@clerk/nextjs'
import { Building2, File, Home, Package } from 'lucide-react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
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
  {
    title: 'Invoices',
    url: ROUTES.DASHBOARD.INVOICES,
    icon: File,
    exact: true,
  },
  {
    title: 'Owner Statements',
    url: ROUTES.DASHBOARD.OWNER_STATEMENTS,
    icon: File,
    exact: true,
  },
]

export function AppSidebar({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { organization } = useOrganization()
  const [showOrgSettings, setShowOrgSettings] = useState(false)
  const { theme, setTheme } = useTheme()

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
    <div className="flex h-full flex-col">
      <SidebarLayout
        navbar={
          <Navbar>
            <NavbarSpacer />
            <NavbarSection className="flex items-center gap-2">
              <NavbarLabel>{organization?.name ?? 'Loading...'}</NavbarLabel>
            </NavbarSection>
          </Navbar>
        }
        sidebar={
          <Sidebar>
            <SidebarHeader>
              <SidebarItem>
                <SidebarLabel className="flex items-center gap-2">
                  {organization?.name ?? 'Loading...'}
                </SidebarLabel>
              </SidebarItem>
            </SidebarHeader>

            <SidebarBody>
              <SidebarSection>
                {renderNavigationItems(mainItems)}
              </SidebarSection>
            </SidebarBody>

            <SidebarFooter>
              <Button
                variant="ghost"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label="Toggle theme"
                className={cn(
                  'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors duration-200',
                  'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-white'
                )}
              >
                {theme === 'dark' ? (
                  <Moon className="size-4" />
                ) : (
                  <Sun className="size-4" />
                )}
                <span>{theme === 'dark' ? 'Dark' : 'Light'} Mode</span>
              </Button>

              <Button
                variant="ghost"
                onClick={() => setShowOrgSettings(true)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors duration-200',
                  'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-white'
                )}
              >
                Organization Settings
              </Button>
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
    </div>
  )
}
