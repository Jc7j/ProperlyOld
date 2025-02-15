"use client";

import { useAuth, useOrganization, useUser } from "@clerk/nextjs";
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronsUpDown,
  Home,
  LayoutGrid,
  LogOut,
  Moon,
  Plug,
  Settings,
  ShoppingBag,
  Sparkles,
  Sun,
  UserCircle,
  Users,
} from "lucide-react";
import { useTheme } from "next-themes";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import React, { type ReactNode } from "react";
import {
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
  SidebarHeading,
  SidebarItem,
  SidebarLabel,
  SidebarLayout,
  SidebarSection,
  SidebarSpacer,
} from "~/components/ui";
import { ROUTES } from "~/lib/constants/routes";
import { cn } from "~/lib/utils/cn";

type NavigationItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  exact: boolean;
};

const mainItems: NavigationItem[] = [
  {
    title: "Home",
    url: ROUTES.DASHBOARD.HOME,
    icon: Home,
    exact: true,
  },
  {
    title: "Invoicing",
    url: ROUTES.DASHBOARD.PROPERTIES,
    icon: ShoppingBag,
    exact: true,
  },
];

const mangementGroupSettings: NavigationItem[] = [
  {
    title: "General",
    url: ROUTES.DASHBOARD.SETTINGS.MANAGEMENT_GROUP,
    icon: Building2,
    exact: true,
  },
];

const accountSettings: NavigationItem[] = [
  {
    title: "Profile",
    url: ROUTES.DASHBOARD.SETTINGS.ACCOUNT,
    icon: UserCircle,
    exact: true,
  },
];

export function AppSidebar({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { signOut } = useAuth();
  const { user } = useUser();
  const { organization } = useOrganization();

  const isSettingsPage = pathname.startsWith("/dashboard/settings");

  const renderNavigationItems = (items: NavigationItem[]) => {
    return items.map((item) => {
      const isActive = item.exact
        ? pathname === item.url
        : pathname.startsWith(item.url);
      return (
        <SidebarItem
          key={item.url}
          href={item.url}
          current={isActive}
          className={cn(
            "rounded-xl transition-colors duration-200",
            isActive
              ? "bg-(--primary-50) text-(--primary-900) dark:bg-(--primary-950)/50 dark:text-(--primary-300)"
              : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-white",
          )}
        >
          <item.icon
            className={cn(
              "h-4 w-4",
              isActive
                ? "bg-(--primary-50) text-(--primary-900) dark:bg-(--primary-950)/50 dark:text-(--primary-300)"
                : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-white",
            )}
          />
          <SidebarLabel>{item.title}</SidebarLabel>
        </SidebarItem>
      );
    });
  };

  return (
    <SidebarLayout
      navbar={
        <Navbar>
          <NavbarSpacer />
          <NavbarSection>
            <NavbarItem>
              <NavbarLabel>{organization?.name ?? "Loading..."}</NavbarLabel>
            </NavbarItem>
          </NavbarSection>
        </Navbar>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader>
            {isSettingsPage ? (
              <SidebarItem
                href={ROUTES.DASHBOARD.HOME}
                className="text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
                <SidebarLabel>Back to app</SidebarLabel>
              </SidebarItem>
            ) : (
              <SidebarItem>
                <SidebarLabel>
                  {organization?.name ?? "Loading..."}
                </SidebarLabel>
              </SidebarItem>
            )}
          </SidebarHeader>

          <SidebarBody>
            <SidebarSection>
              {isSettingsPage ? (
                <>
                  <SidebarHeading>Facility Settings</SidebarHeading>
                  {renderNavigationItems(mangementGroupSettings)}
                  <SidebarSpacer />
                  <SidebarHeading>Account Settings</SidebarHeading>
                  {renderNavigationItems(accountSettings)}
                </>
              ) : (
                renderNavigationItems(mainItems)
              )}
            </SidebarSection>

            {!isSettingsPage && (
              <>
                <SidebarSpacer />

                <SidebarSection>
                  <SidebarItem
                    href="/changelog"
                    className="text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-white"
                  >
                    <Sparkles className="h-4 w-4" />
                    <SidebarLabel>What&apos;s New</SidebarLabel>
                  </SidebarItem>
                </SidebarSection>
              </>
            )}
          </SidebarBody>

          <SidebarFooter className="">
            <Dropdown>
              <DropdownButton as={SidebarItem}>
                <div className="flex w-full items-center justify-between">
                  <span className="flex min-w-0 items-center gap-3">
                    {user?.imageUrl ? (
                      <Image
                        src={user.imageUrl}
                        alt={user.fullName ?? ""}
                        className="h-8 w-8 rounded-full"
                        width={32}
                        height={32}
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <span className="text-sm font-medium text-zinc-900 dark:text-white">
                          {user?.firstName?.[0] ??
                            user?.emailAddresses?.[0]?.emailAddress?.[0] ??
                            "?"}
                        </span>
                      </div>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm/5 font-medium text-zinc-950 dark:text-white">
                        {user?.fullName ??
                          user?.emailAddresses?.[0]?.emailAddress ??
                          "Loading..."}
                      </span>
                      <span className="block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400">
                        {organization?.name ?? "Loading..."}
                      </span>
                    </span>
                  </span>
                  <ChevronsUpDown className="h-4 w-4" />
                </div>
              </DropdownButton>
              <DropdownMenu className="min-w-64" anchor="top start">
                <DropdownItem
                  onClick={() =>
                    router.push(ROUTES.DASHBOARD.SETTINGS.MANAGEMENT_GROUP)
                  }
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <DropdownLabel>Settings</DropdownLabel>
                </DropdownItem>
                <DropdownItem
                  onClick={() =>
                    setTheme(resolvedTheme === "dark" ? "light" : "dark")
                  }
                >
                  {resolvedTheme === "dark" ? (
                    <Sun className="mr-2 h-4 w-4 text-amber-500 dark:text-amber-400" />
                  ) : (
                    <Moon className="mr-2 h-4 w-4 text-zinc-700 dark:text-zinc-400" />
                  )}
                  <DropdownLabel>
                    {resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}
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
  );
}
