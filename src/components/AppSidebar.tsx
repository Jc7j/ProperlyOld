'use client'

import { useAuth, useOrganization, useUser } from '@clerk/nextjs'
import { OrganizationProfile, UserProfile } from '@clerk/nextjs'
import {
  Building2,
  ChevronLeft,
  ChevronsUpDown,
  Home,
  LogOut,
  Moon,
  Package,
  Settings,
  Sun,
  UserCircle,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import React, { type ReactNode, useState } from 'react'
import {
  Dialog,
  DialogBody,
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
  Navbar,
  NavbarItem,
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
  const { resolvedTheme, setTheme } = useTheme()
  const { signOut } = useAuth()
  const { user } = useUser()
  const { organization } = useOrganization()

  const [showOrgSettings, setShowOrgSettings] = useState(false)
  const [showUserSettings, setShowUserSettings] = useState(false)

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
              <NavbarItem>
                <NavbarLabel>{organization?.name ?? 'Loading...'}</NavbarLabel>
              </NavbarItem>
            </NavbarSection>
          </Navbar>
        }
        sidebar={
          <Sidebar>
            <SidebarHeader>
              <SidebarItem>
                <SidebarLabel>
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
              <Dropdown>
                <DropdownButton as={SidebarItem}>
                  <div className="flex w-full items-center justify-between">
                    <span className="flex min-w-0 items-center gap-3">
                      {user?.imageUrl ? (
                        <Image
                          src={user.imageUrl}
                          alt={user.fullName ?? ''}
                          className="h-8 w-8 rounded-full"
                          width={32}
                          height={32}
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <span className="text-sm font-medium text-zinc-900 dark:text-white">
                            {user?.firstName?.[0] ??
                              user?.emailAddresses?.[0]?.emailAddress?.[0] ??
                              '?'}
                          </span>
                        </div>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-sm/5 font-medium text-zinc-950 dark:text-white">
                          {user?.fullName ??
                            user?.emailAddresses?.[0]?.emailAddress ??
                            'Loading...'}
                        </span>
                        <span className="block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400">
                          {organization?.name ?? 'Loading...'}
                        </span>
                      </span>
                    </span>
                    <ChevronsUpDown className="h-4 w-4" />
                  </div>
                </DropdownButton>
                <DropdownMenu className="min-w-64" anchor="top start">
                  <DropdownItem onClick={() => setShowOrgSettings(true)}>
                    <Building2 className="mr-2 h-4 w-4" />
                    <DropdownLabel>Organization Settings</DropdownLabel>
                  </DropdownItem>
                  <DropdownItem onClick={() => setShowUserSettings(true)}>
                    <UserCircle className="mr-2 h-4 w-4" />
                    <DropdownLabel>Account Settings</DropdownLabel>
                  </DropdownItem>
                  <DropdownItem
                    onClick={() =>
                      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
                    }
                  >
                    {resolvedTheme === 'dark' ? (
                      <Sun className="mr-2 h-4 w-4 text-amber-500 dark:text-amber-400" />
                    ) : (
                      <Moon className="mr-2 h-4 w-4 text-zinc-700 dark:text-zinc-400" />
                    )}
                    <DropdownLabel>
                      {resolvedTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    </DropdownLabel>
                  </DropdownItem>
                  <DropdownDivider />
                  <DropdownItem
                    onClick={() => signOut()}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <DropdownLabel>Log out</DropdownLabel>
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </SidebarFooter>
          </Sidebar>
        }
      >
        {children}
      </SidebarLayout>

      {/* TODO: 1. Add organization settings and user settings
  2. Add Image adding to invoices
*/}
      {/* Organization Settings Dialog */}
      <Dialog
        open={showOrgSettings}
        onClose={() => setShowOrgSettings(false)}
        size="lg"
      >
        <DialogBody className="p-0">
          <OrganizationProfile />
        </DialogBody>
      </Dialog>

      {/* User Settings Dialog */}
      <Dialog
        open={showUserSettings}
        onClose={() => setShowUserSettings(false)}
        size="lg"
      >
        <DialogBody className="p-0">
          <UserProfile />
        </DialogBody>
      </Dialog>
    </>
  )
}
